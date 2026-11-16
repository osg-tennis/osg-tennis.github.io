/* 名簿（チームと選手）の整形と、CSV の読み書き。

   Firebase には触らないので、node でそのままテストできる（tests/roster-test.mjs）。

   Firebase での持ち方
     roster/{チームID} = { name, kana, order, players: { 選手ID: { name, kana, no, order } } }

   CSV の形
     チーム名,選手名,かな,背番号
     OSG,山田 太郎,やまだ たろう,1
   ・1行1選手。同じチーム名の行をまとめて1チームにする
   ・選手名が空の行は「チームだけの登録」として扱う（かな欄はチームのかなになる）
   ・見出し行は あっても無くてもよい */

export const CSV_HEAD = ['チーム名', '選手名', 'かな', '背番号'];

/* 並び順。order が同じなら五十音順 */
const by = (a, b) => (a.order - b.order) || String(a.kana || a.name).localeCompare(String(b.kana || b.name), 'ja');

/* Firebase の生データ → 画面で使う配列 */
export function rosterList(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return Object.entries(src)
    .map(([id, t]) => ({
      id,
      name: String((t && t.name) || '').trim(),
      kana: String((t && t.kana) || '').trim(),
      order: Number((t && t.order) || 0),
      players: Object.entries((t && t.players) || {})
        .map(([pid, p]) => ({
          id: pid,
          name: String((p && p.name) || '').trim(),
          kana: String((p && p.kana) || '').trim(),
          no: String((p && p.no) || '').trim(),
          order: Number((p && p.order) || 0),
        }))
        .filter(p => p.name)
        .sort(by),
    }))
    .filter(t => t.name)
    .sort(by);
}

/* 「山田 太郎」→「山田」。空白が無ければそのまま返す */
export function surname(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s) return '';
  return s.split(/[\s　]+/)[0] || s;
}

/* ダブルスの表示名「山田・佐藤」 */
export function pairLabel(a, b) {
  return [surname(a), surname(b)].filter(Boolean).join('・');
}

/* ---------- CSV を読む ---------- */

/* ふつうのCSVの決まり（" で囲む、"" で " 自身）に従って表に分解する */
export function parseCsv(text) {
  const s = String(text == null ? '' : text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c !== '"') { cell += c; continue; }
      if (s[i + 1] === '"') { cell += '"'; i++; continue; }
      quoted = false;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  /* 空っぽの行は捨てる */
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function isHeaderRow(r) {
  const a = String(r[0] || '').trim().toLowerCase();
  return a === 'チーム名' || a === 'team' || a === 'チーム';
}

/* CSV の文字列 → [{ name, kana, players:[{name,kana,no}] }] と、取り込めなかった行の説明 */
export function rosterFromCsv(text) {
  const rows = parseCsv(text);
  const teams = [];
  const errors = [];
  const found = new Map();
  rows.forEach((r, i) => {
    if (i === 0 && isHeaderRow(r)) return;
    const line = i + 1;
    const tn = String(r[0] || '').trim();
    const pn = String(r[1] || '').trim();
    const kana = String(r[2] || '').trim();
    const no = String(r[3] || '').trim();
    if (!tn) { errors.push(`${line}行目：チーム名が空です`); return; }
    let t = found.get(tn);
    if (!t) { t = { name: tn, kana: '', players: [] }; found.set(tn, t); teams.push(t); }
    if (!pn) { if (kana) t.kana = kana; return; } // チームだけの行
    if (t.players.some(p => p.name === pn)) { errors.push(`${line}行目：${tn} に「${pn}」が2回出てきます`); return; }
    t.players.push({ name: pn, kana, no });
  });
  if (!teams.length) errors.push('取り込める行がありませんでした。見本CSVと同じ形になっているか確認してください。');
  return { teams, errors };
}

/* ---------- CSV を書く ---------- */

const q = v => {
  const s = String(v == null ? '' : v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/* Excel でそのまま開けるよう、先頭に BOM を付けて改行は CRLF にする */
export function csvFromRoster(teams) {
  const out = [CSV_HEAD.join(',')];
  for (const t of teams || []) {
    const ps = t.players || [];
    if (!ps.length) { out.push([q(t.name), '', q(t.kana), ''].join(',')); continue; }
    for (const p of ps) out.push([q(t.name), q(p.name), q(p.kana), q(p.no)].join(','));
  }
  return '﻿' + out.join('\r\n') + '\r\n';
}

/* 書き方の見本。名簿画面の「見本CSVをダウンロード」で配る */
export const SAMPLE_CSV = csvFromRoster([
  {
    name: 'OSG',
    kana: 'おーえすじー',
    players: [
      { name: '山田 太郎', kana: 'やまだ たろう', no: '1' },
      { name: '佐藤 次郎', kana: 'さとう じろう', no: '2' },
      { name: '鈴木 三郎', kana: 'すずき さぶろう', no: '3' },
    ],
  },
  {
    name: '明治安田生命',
    kana: 'めいじやすだせいめい',
    players: [
      { name: '高橋 四郎', kana: 'たかはし しろう', no: '1' },
      { name: '田中 五郎', kana: 'たなか ごろう', no: '' },
    ],
  },
]);

/* ---------- 取り込んだ内容を、いまの名簿と合わせる ----------
   mode 'add'     … いまの名簿に足す（同じ名前のチーム・選手は上書きせず残す）
   mode 'replace' … いまの名簿を捨てて、CSV の内容だけにする
   newId は ID を作る関数（Firebase の push キーを渡す。テストでは連番） */
export function buildRoster(current, imported, mode, newId) {
  const base = mode === 'replace'
    ? []
    : (current || []).map(t => ({ ...t, players: (t.players || []).map(p => ({ ...p })) }));
  const byName = new Map(base.map(t => [t.name, t]));
  const sum = { newTeams: 0, newPlayers: 0, existingPlayers: 0 };

  for (const it of imported || []) {
    let t = byName.get(it.name);
    if (!t) {
      t = { id: newId(), name: it.name, kana: it.kana || '', order: base.length, players: [] };
      base.push(t);
      byName.set(it.name, t);
      sum.newTeams++;
    }
    if (it.kana) t.kana = it.kana;
    for (const p of it.players || []) {
      const ex = t.players.find(x => x.name === p.name);
      if (ex) {
        if (p.kana) ex.kana = p.kana;
        if (p.no) ex.no = p.no;
        sum.existingPlayers++;
      } else {
        t.players.push({ id: newId(), name: p.name, kana: p.kana || '', no: p.no || '', order: t.players.length });
        sum.newPlayers++;
      }
    }
  }

  const data = {};
  base.forEach((t, i) => {
    const players = {};
    t.players.forEach((p, j) => {
      players[p.id] = { name: p.name, kana: p.kana || '', no: p.no || '', order: j };
    });
    data[t.id] = { name: t.name, kana: t.kana || '', order: i, players };
  });
  return { data, sum };
}
