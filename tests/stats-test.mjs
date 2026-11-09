import { defaultState, addPoint, oth } from "../js/parts.js";
import { analyse, groupGames, winsGameIf, courtSide } from "../js/stats.js";

let fail=0;
const ok=(c,m)=>{ if(!c){console.log("NG:",m);fail++} else console.log("ok:",m) };

/* control.js と同じ手順でポイント記録を作る。
   'a'/'b' … その側が得点、'F' … フォルト（2回続けるとダブルフォールト） */
function run(actions, rules={}) {
  const st = defaultState("A");
  Object.assign(st.rules, rules);
  const recs = [];
  for (let act of actions) {
    let df = false;
    if (act === "F") {
      if (!st.sc.fault) { st.sc.fault = true; continue; }
      act = oth(st.sc.srv); df = true;
    }
    const before = JSON.parse(JSON.stringify(st.sc));
    if (!addPoint(st, act)) continue;
    st.sc.fault = false;
    const rec = { t: 1000*recs.length, w: act, s: before.srv, sv: before.fault?2:1,
      set: before.done.length, ga: before.g.a, gb: before.g.b, pa: before.p.a, pb: before.p.b };
    if (before.tb) rec.tb = true;
    if (before.mtb) rec.mtb = true;
    if (df) rec.df = true;
    recs.push(rec);
  }
  return { st, recs };
}
const meta = r => ({ teams:{a:"A",b:"B"}, rules:{sets:3,games:6,noAd:false,tb:true,mtb:false, ...r} });

// 1) サーバーが4連取＝キープ
let { recs } = run(["a","a","a","a"]);
let r = analyse(recs, meta());
ok(r.stats.a.hold.games===1 && r.stats.a.hold.held===1, "キープ 1/1");
ok(r.stats.a.bp.faced===0, "ブレークポイントなし");
ok(r.stats.a.serve.total===4 && r.stats.a.serve.firstWon===4, "サーブ4本すべて獲得");
ok(r.stats.a.serve.firstPct===100, "ファーストサーブ確率100%");

// 2) 0-40から相手が取る＝ブレーク（0-40のポイントが1本のブレークポイント）
({ recs } = run(["b","b","b","b"]));
r = analyse(recs, meta());
ok(r.stats.a.hold.games===1 && r.stats.a.hold.held===0, "キープ 0/1");
ok(r.stats.a.bp.faced===1 && r.stats.a.bp.lost===1, "ブレークポイント 1本を失う");
ok(r.stats.b.bp.chances===1 && r.stats.b.bp.converted===1, "ブレーク成功 1/1");
ok(r.stats.a.bp.savePct===0 && r.stats.b.bp.convPct===100, "セーブ率0% / 獲得率100%");

// 3) ブレークポイントをしのぐ（0-40 →デュース→サーバーが取る）
({ recs } = run(["b","b","b","a","a","a","a","a"]));
r = analyse(recs, meta());
ok(r.stats.a.bp.faced===3 && r.stats.a.bp.lost===0, "0-40・15-40・30-40の3本をしのぐ");
ok(r.stats.a.bp.savePct===100, "セーブ率100%");
ok(r.stats.a.hold.held===1, "しのいでキープ");
ok(r.stats.a.key.deuce===1, "デュースを1回通過");

// 4) フォルトとセカンドサーブ
({ recs } = run(["F","a","a","a","a"]));
r = analyse(recs, meta());
ok(r.stats.a.serve.total===4 && r.stats.a.serve.first===3, "4本中3本がファーストサーブ");
ok(r.stats.a.serve.firstPct===75, "ファーストサーブ確率75%");
ok(r.stats.a.serve.secondWon===1 && r.stats.a.serve.secondWonPct===100, "セカンドサーブ獲得率100%");
ok(r.stats.b.ret.secondFaced===1, "リターン側のセカンド本数");

// 5) ダブルフォールト
({ recs } = run(["F","F","a","a","a","a"]));
r = analyse(recs, meta());
ok(r.stats.a.serve.df===1, "ダブルフォールト1本");
ok(recs[0].w==="b" && recs[0].df===true && recs[0].sv===2, "ダブルフォールトは相手の得点として2ndで記録");
ok(r.stats.a.hold.held===1, "そのあとキープ");

// 6) ゲームのまとまりとサーブ交代
({ recs } = run(["a","a","a","a", "b","b","b","b"]));
let games = groupGames(recs);
ok(games.length===2, "2ゲームに分かれる");
ok(games[0].server==="a" && games[1].server==="b", "ゲームごとにサーバーが入れ替わる");
ok(games[0].winner==="a" && games[1].winner==="b", "どちらもキープ");
r = analyse(recs, meta());
ok(r.stats.a.hold.pct===100 && r.stats.b.hold.pct===100, "両者キープ率100%");

// 7) タイブレークはキープの対象外
const long=[]; for(let i=0;i<6;i++){ for(let k=0;k<4;k++) long.push("a"); for(let k=0;k<4;k++) long.push("b"); }
({ recs } = run(long));
r = analyse(recs, meta());
ok(r.stats.a.hold.games===6 && r.stats.b.hold.games===6, "12ゲームぶんのサービスゲーム");
const tbPts=[]; for(let i=0;i<7;i++) tbPts.push("a");
({ recs } = run([...long, ...tbPts]));
games = groupGames(recs);
ok(games[games.length-1].tb===true, "最後のまとまりがタイブレーク");
r = analyse(recs, meta());
ok(r.stats.a.hold.games===6, "タイブレークはキープ率に入らない");
ok(r.stats.a.serve.total+r.stats.b.serve.total===recs.length, "サーブ本数の合計＝総ポイント数");

// 8) 連続ポイント
({ recs } = run(["a","a","a","b","b","b","b"]));
r = analyse(recs, meta());
ok(r.stats.a.streak===3 && r.stats.b.streak===4, "最多連続ポイント");

// 9) ノーアドバンテージ
({ recs } = run(["a","b","a","b","a","b","b"], {noAd:true}));
r = analyse(recs, meta({noAd:true}));
ok(r.stats.a.bp.faced===1 && r.stats.a.bp.lost===1, "ノーアドの40-40はブレークポイント");

// 10) 合計の整合
({ recs } = run(long));
r = analyse(recs, meta());
ok(r.stats.a.won + r.stats.b.won === recs.length, "獲得ポイントの合計が一致");
ok(r.total===recs.length, "総ポイント数が一致");


// 11) コートサイド（デュース＝偶数、アド＝奇数）
ok(courtSide({pa:0,pb:0})==="deuce" && courtSide({pa:1,pb:0})==="ad", "0-0はデュース、15-0はアド");
ok(courtSide({pa:1,pb:1})==="deuce" && courtSide({pa:3,pb:3})==="deuce", "15-15と40-40はデュースサイド");
ok(courtSide({pa:4,pb:3})==="ad", "アドバンテージはアドサイド");

({ recs } = run(["a","a","a","a"]));
r = analyse(recs, meta());
ok(r.stats.a.side.deuce.served===2 && r.stats.a.side.ad.served===2, "4ポイントでデュース2本・アド2本");
ok(r.stats.a.side.deuce.servePct===100 && r.stats.a.side.ad.servePct===100, "両サイドとも獲得率100%");
ok(r.stats.b.side.deuce.ret===2 && r.stats.b.side.ad.retPct===0, "リターン側もサイド別に数える");

// タイブレークも1ポイントごとに入れ替わる
({ recs } = run([...long, ...tbPts]));
const tb = recs.filter(p=>p.tb);
ok(tb.length>0 && courtSide(tb[0])==="deuce" && courtSide(tb[1])==="ad", "タイブレークもサイドが交互");

// サイド別の合計が総ポイント数と一致
({ recs } = run(long));
r = analyse(recs, meta());
const sum = ["a","b"].reduce((t,s)=>t+r.stats[s].side.deuce.served+r.stats[s].side.ad.served,0);
ok(sum===recs.length, "サイド別サーブ本数の合計が総ポイント数と一致");


// 12) ゲーム途中でサーブ交代を押して直した場合は、多かったほうをサーバーとみなす
//     （実際の記録で、1ゲーム目だけ両チームにまたがっていた）
const mixed = [
  { w:'a', s:'a', sv:1, set:0, ga:0, gb:0, pa:0, pb:0 },
  { w:'b', s:'a', sv:1, set:0, ga:0, gb:0, pa:1, pb:0 },
  { w:'b', s:'b', sv:1, set:0, ga:0, gb:0, pa:1, pb:1 },
  { w:'b', s:'b', sv:1, set:0, ga:0, gb:0, pa:1, pb:2 },
  { w:'b', s:'b', sv:1, set:0, ga:0, gb:0, pa:1, pb:3 },
].map((p,i)=>({t:i*1000, ...p}));
let gs = groupGames(mixed);
ok(gs.length===1 && gs[0].server==="b", "多かったほうをサーバーとする");
r = analyse(mixed, meta());
ok(r.stats.b.hold.games===1 && r.stats.a.hold.games===0, "サービスゲームは修正後の側に数える");

// 同数なら、あとから直したほう（最後のポイント）を採る
const tie = [
  { w:'a', s:'a', sv:1, set:0, ga:0, gb:0, pa:0, pb:0 },
  { w:'a', s:'b', sv:1, set:0, ga:0, gb:0, pa:1, pb:0 },
].map((p,i)=>({t:i*1000, ...p}));
ok(groupGames(tie)[0].server==="b", "同数なら最後のポイントのサーバー");

// 交互にサーブしていれば 10ゲームで 5/5 になる
const alt=[]; for(let i=0;i<10;i++){ const s=i%2?'b':'a'; for(let k=0;k<4;k++) alt.push(s); }
({ recs } = run(alt));
r = analyse(recs, meta());
ok(r.stats.a.hold.games===5 && r.stats.b.hold.games===5, "10ゲームなら5回ずつ");

console.log(fail?`\n${fail} 件 失敗`:"\nすべて成功");
process.exit(fail?1:0);
