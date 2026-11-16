import {
  parseCsv, rosterFromCsv, csvFromRoster, rosterList,
  surname, pairLabel, buildRoster, SAMPLE_CSV,
} from "../js/roster.js";

let fail = 0;
const ok = (c, m) => { if (!c) { console.log("NG:", m); fail++; } else console.log("ok:", m); };

/* ---------- CSV を読む ---------- */
{
  const rows = parseCsv('a,b\r\nc,"d,e"\r\n\r\n"f""g",h\n');
  ok(rows.length === 3, "空行は捨てる");
  ok(rows[1][1] === "d,e", "引用符の中のカンマは区切りにしない");
  ok(rows[2][0] === 'f"g', '"" は " ひとつ');
}

{
  const { teams, errors } = rosterFromCsv(
    "チーム名,選手名,かな,背番号\n" +
    "OSG,山田 太郎,やまだ たろう,1\n" +
    "OSG,佐藤 次郎,,2\n" +
    "明治安田生命,高橋 四郎,,\n"
  );
  ok(errors.length === 0, "見本どおりなら警告なし");
  ok(teams.length === 2, "同じチーム名の行はまとめる");
  ok(teams[0].players.length === 2, "OSG は2人");
  ok(teams[0].players[0].no === "1", "背番号が入る");
}

{
  /* 見出し行が無くても読めること */
  const { teams } = rosterFromCsv("OSG,山田 太郎\nOSG,佐藤 次郎\n");
  ok(teams.length === 1 && teams[0].players.length === 2, "見出し行は無くてもよい");
}

{
  /* BOM 付き（Excel が付ける）でも読めること */
  const { teams, errors } = rosterFromCsv("﻿チーム名,選手名\nOSG,山田 太郎\n");
  ok(errors.length === 0 && teams[0].name === "OSG", "先頭の BOM を取り除く");
}

{
  const { errors } = rosterFromCsv("チーム名,選手名\n,山田 太郎\nOSG,佐藤 次郎\nOSG,佐藤 次郎\n");
  ok(errors.length === 2, "チーム名が空の行と、同じ選手の重複を知らせる");
}

{
  const { teams } = rosterFromCsv("チーム名,選手名,かな\nOSG,,おーえすじー\nOSG,山田 太郎,やまだ\n");
  ok(teams[0].kana === "おーえすじー", "選手名が空の行はチームのかなになる");
  ok(teams[0].players.length === 1, "チームだけの行は選手に数えない");
}

/* ---------- CSV を書く → もう一度読む ---------- */
{
  const src = [
    { name: "OSG", kana: "おーえすじー", players: [{ name: "山田, 太郎", kana: "やまだ", no: "1" }] },
    { name: "空チーム", kana: "", players: [] },
  ];
  const text = csvFromRoster(src);
  ok(text.startsWith("﻿"), "Excel 用に BOM を付ける");
  const { teams, errors } = rosterFromCsv(text);
  ok(errors.length === 0, "書いた CSV はそのまま読み直せる");
  ok(teams[0].players[0].name === "山田, 太郎", "カンマを含む名前も壊れない");
  ok(teams.length === 2 && teams[1].name === "空チーム", "選手のいないチームも残る");
}

{
  const { teams, errors } = rosterFromCsv(SAMPLE_CSV);
  ok(errors.length === 0 && teams.length === 2, "見本CSVはそのまま取り込める");
}

/* ---------- 名前の扱い ---------- */
{
  ok(surname("山田 太郎") === "山田", "半角空白で姓を取る");
  ok(surname("山田　太郎") === "山田", "全角空白でも姓を取る");
  ok(surname("ヤマダ") === "ヤマダ", "空白が無ければそのまま");
  ok(pairLabel("山田 太郎", "佐藤 次郎") === "山田・佐藤", "ダブルスの表示名");
  ok(pairLabel("山田 太郎", "") === "山田", "片方だけなら中黒を付けない");
}

/* ---------- Firebase の生データ → 配列 ---------- */
{
  const list = rosterList({
    t2: { name: "B", order: 1, players: { p1: { name: "乙", order: 1 }, p2: { name: "甲", order: 0 } } },
    t1: { name: "A", order: 0, players: {} },
    t3: { name: "", order: 2 },
  });
  ok(list.length === 2, "名前の無いチームは出さない");
  ok(list[0].name === "A" && list[1].name === "B", "order の順に並ぶ");
  ok(list[1].players[0].name === "甲", "選手も order の順に並ぶ");
}

/* ---------- 取り込みの合体 ---------- */
{
  let n = 0;
  const newId = () => "id" + (++n);
  const current = [{ id: "old", name: "OSG", kana: "", order: 0, players: [{ id: "p0", name: "山田 太郎", kana: "", no: "1", order: 0 }] }];
  const imported = rosterFromCsv("OSG,佐藤 次郎\n新チーム,鈴木 三郎\n").teams;

  const add = buildRoster(current, imported, "add", newId);
  ok(Object.keys(add.data).length === 2, "足す：元のチームは残る");
  ok(Object.keys(add.data.old.players).length === 2, "足す：既存チームに選手が増える");
  ok(add.data.old.players.p0.name === "山田 太郎", "足す：元の選手の ID は変わらない");
  ok(add.sum.newTeams === 1 && add.sum.newPlayers === 2, "足す：増えた数を数える");

  n = 0;
  const rep = buildRoster(current, imported, "replace", newId);
  ok(Object.keys(rep.data).length === 2, "置き換え：CSV のチームだけになる");
  ok(!rep.data.old, "置き換え：元のチームは消える");
  ok(Object.values(rep.data).every(t => Object.keys(t.players).length === 1), "置き換え：選手も CSV どおり");
}

{
  /* 同じ CSV をもう一度取り込んでも二重にならない */
  let n = 0;
  const newId = () => "id" + (++n);
  const imported = rosterFromCsv("OSG,山田 太郎,やまだ,1\n").teams;
  const first = buildRoster([], imported, "add", newId);
  const current = rosterList(first.data);
  const second = buildRoster(current, imported, "add", newId);
  ok(Object.keys(second.data).length === 1, "二重取り込み：チームは増えない");
  ok(Object.keys(Object.values(second.data)[0].players).length === 1, "二重取り込み：選手も増えない");
  ok(second.sum.newPlayers === 0 && second.sum.existingPlayers === 1, "二重取り込み：既にいる人として数える");
}

console.log(fail ? `\n${fail} 件失敗` : "\nすべて成功");
process.exit(fail ? 1 : 0);
