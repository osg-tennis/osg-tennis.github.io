import { defaultState, addPoint, oth, serverPlayer, returnerPlayer } from "../js/parts.js";
import { analyse, fixDoubles, courtSide } from "../js/stats.js";

let fail=0;
const ok=(c,m)=>{ if(!c){console.log("NG:",m);fail++} else console.log("ok:",m) };

/* 1ポイントずつ、そのときのサーバー／リターナーを記録しながら進める */
function play(actions, dblPatch={}, rules={}) {
  const st = defaultState("A");
  Object.assign(st.rules, rules);
  st.dbl.on = true;
  Object.assign(st.dbl.srvFirst, dblPatch.srvFirst||{});
  Object.assign(st.dbl.deuce, dblPatch.deuce||{});
  const log = [];
  for (const side of actions) {
    const before = JSON.parse(JSON.stringify(st.sc));
    log.push({
      game: before.g.a + before.g.b,
      srv: before.srv,
      sp: serverPlayer(before, st.dbl),
      rp: returnerPlayer(before, st.dbl),
      tb: !!before.tb,
      pts: before.p.a + before.p.b,
    });
    addPoint(st, side);
  }
  return { st, log };
}
const game = (s,n=4)=>Array(n).fill(s);

// 1) ゲームごとにペア内で交代する
let { log } = play([...game("a"),...game("b"),...game("a"),...game("b")]);
const firstOf = g => log.find(x=>x.game===g);
ok(firstOf(0).srv==="a" && firstOf(0).sp===0, "第1ゲーム：Aチームは A1 がサーブ");
ok(firstOf(1).srv==="b" && firstOf(1).sp===0, "第2ゲーム：Bチームは B1 がサーブ");
ok(firstOf(2).srv==="a" && firstOf(2).sp===1, "第3ゲーム：Aチームは A2 に交代");
ok(firstOf(3).srv==="b" && firstOf(3).sp===1, "第4ゲーム：Bチームは B2 に交代");

// 1ゲーム中はサーバーが変わらない
ok(log.filter(x=>x.game===0).every(x=>x.sp===0), "同じゲーム中はサーバーが変わらない");

// 2) 先にサーブする人を入れ替えた場合
({ log } = play([...game("a"),...game("b"),...game("a")], {srvFirst:{a:1}}));
ok(log.find(x=>x.game===0).sp===1 && log.find(x=>x.game===2).sp===0, "A2 を先にすると順番が入れ替わる");

// 3) リターンはコートサイドで固定
({ log } = play(game("a")));
const r0 = log.map(x=>x.rp);
ok(r0[0]===0 && r0[1]===1 && r0[2]===0 && r0[3]===1, "デュース=B1、アド=B2 で交互");
({ log } = play(game("a"), {deuce:{b:1}}));
ok(log[0].rp===1 && log[1].rp===0, "デュース側を入れ替えると逆になる");

// 4) 5セット目まで進めてもゲームごとの交代が続く
({ log } = play([...Array(10)].flatMap((_, i) => game(i % 2 ? "b" : "a"))));
ok(log.find(x=>x.game===8).sp===0 && log.find(x=>x.game===6).sp===1, "9ゲーム目で A1 に戻る");

// 5) タイブレーク：1本→2本ずつでペア内も回る
const toSix=[]; for(let i=0;i<6;i++){ toSix.push(...game("a")); toSix.push(...game("b")); }
({ log } = play([...toSix, "a","a","a","a","a","a","a"]));
const tb = log.filter(x=>x.tb);
ok(tb.length===7, "タイブレークのポイントを記録");
ok(tb[0].srv!==tb[1].srv, "1本目のあとサーブ側が交代");
ok(tb[1].srv===tb[2].srv, "以降は2本ずつ");
ok(tb[3].srv===tb[0].srv, "4本目で最初のチームに戻る");
// 6ゲームずつ終えているので、タイブレーク最初のサーブは各チームとも先頭の人に戻る
ok(tb[0].sp===0, "タイブレーク1本目は A1（6ゲーム終了＝偶数回）");
ok(tb[1].sp===0, "相手チームも B1 から");
ok(tb[3].sp===1, "次の番は A2");
ok(tb[0].rp===0 && tb[1].rp===1, "タイブレークもサイドで交互");


// 6) 分析ページ向けの選手別集計
function recsOf(actions, dblPatch={}) {
  const st = defaultState("A");
  st.dbl.on = true;
  Object.assign(st.dbl.srvFirst, dblPatch.srvFirst||{});
  Object.assign(st.dbl.deuce, dblPatch.deuce||{});
  const recs = [];
  for (const side of actions) {
    const before = JSON.parse(JSON.stringify(st.sc));
    if (!addPoint(st, side)) continue;
    recs.push({ t: recs.length*1000, w: side, s: before.srv, sv: 1,
      set: before.done.length, ga: before.g.a, gb: before.g.b, pa: before.p.a, pb: before.p.b,
      sp: serverPlayer(before, st.dbl), rp: returnerPlayer(before, st.dbl) });
  }
  return recs;
}
const dmeta = { teams:{a:"OSG",b:"相手"}, dbl:{on:true,names:{a1:"渡辺",a2:"島",b1:"江坂",b2:"安田"}},
  rules:{sets:3,games:6,noAd:false,tb:true,mtb:false} };

let recs = recsOf([...game("a"),...game("b"),...game("a"),...game("b")]);
let r = analyse(recs, dmeta);
ok(r.players !== null, "選手別の集計が出る");
ok(r.players.a[0].serve.total===4 && r.players.a[1].serve.total===4, "A1とA2が4本ずつサーブ");
ok(r.players.a[0].serve.wonPct===100, "A1はサーブを全て取った");
ok(r.players.b[0].ret.faced===4 && r.players.b[1].ret.faced===4, "相手の2ゲーム分をサイドで4本ずつ");
ok(r.players.b[0].ret.deuce===4 && r.players.b[0].ret.ad===0, "B1はデュースサイドのみ");
const tot = ["a","b"].reduce((t,x)=>t+r.players[x][0].serve.total+r.players[x][1].serve.total,0);
ok(tot===recs.length, "選手別サーブ本数の合計が総ポイント数と一致");

// 記録にサーブした人が無い（シングルス）なら選手別は出ない
recs = recsOf(game("a")).map(x=>{ const y={...x}; delete y.sp; delete y.rp; return y; });
ok(analyse(recs, dmeta).players===null, "シングルスの記録では選手別を出さない");


// 7) 試合の途中で「入れ替え」を押した場合、セット全体を正しい担当に揃える
//    （実際の記録で、リターン担当が途中から入れ替わっていた）
function mk(i, s, rp, pa, pb) {
  return { t: i*1000, w: 'a', s, sv: 1, set: 0, ga: 0, gb: 0, pa, pb, sp: 0, rp };
}
// b がサーブ、a がリターン。デュース側(偶数)を 0、アド側(奇数)を 1 で記録…
// の途中から、押し間違いで逆の担当が記録されてしまった状態を作る
const mixedRet = [
  mk(0,'b',0,0,0), mk(1,'b',1,1,0), mk(2,'b',0,1,1), mk(3,'b',1,2,1),
  mk(4,'b',1,2,2), mk(5,'b',0,3,2),              // ここから逆になった
];
const fixedRet = fixDoubles(mixedRet);
const sides = fixedRet.map(p => courtSide(p) + ':' + p.rp);
ok(sides.every(x => x === 'deuce:0' || x === 'ad:1'), "デュース側とアド側で担当が1人ずつに揃う");

// 揃えた結果、各選手はどちらか片方のサイドにしか出ない
const r2 = analyse(mixedRet, { teams:{a:'A',b:'B'}, rules:{sets:3,games:6,noAd:false,tb:true,mtb:false} });
ok(r2.players.a[0].ret.ad === 0 && r2.players.a[1].ret.deuce === 0, "選手ごとに片側だけに数字が出る");

// 多数決なので、入れ替えが少数なら元の担当が残る
ok(fixDoubles(mixedRet)[5].rp === 1, "少数側の記録が多数側に合わせて直る");

// サーブ担当も、セット内のゲーム番号から整合するように直る
const srvPts = [
  { t:0, w:'a', s:'a', sv:1, set:0, ga:0, gb:0, pa:0, pb:0, sp:0, rp:0 },
  { t:1, w:'a', s:'a', sv:1, set:0, ga:2, gb:0, pa:0, pb:0, sp:1, rp:0 },
  { t:2, w:'a', s:'a', sv:1, set:0, ga:4, gb:0, pa:0, pb:0, sp:1, rp:0 }, // 本当は 0
];
const fixedSrv = fixDoubles(srvPts);
ok(fixedSrv.map(p=>p.sp).join('') === "010", "サーブ担当が1ゲームおきの規則に揃う");

// シングルス（sp/rp が無い記録）は触らない
const single = [{ t:0, w:'a', s:'a', sv:1, set:0, ga:0, gb:0, pa:0, pb:0 }];
ok(fixDoubles(single) === single, "シングルスの記録はそのまま");

console.log(fail?`\n${fail} 件 失敗`:"\nすべて成功");
process.exit(fail?1:0);
