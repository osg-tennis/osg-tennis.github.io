/* 得点計算のテスト。
   node tests/score-test.mjs で実行する（ブラウザもサーバーも要らない）。 */

import { defaultState, addPoint, ptText, setStr, resultLine, normalize, emptyScore } from '../js/parts.js';

let fail = 0;
const ok = (c, m) => { if (!c) { console.log('NG:', m); fail++; } else console.log('ok:', m); };

/* Realtime Database の保存を真似る：null と空の入れ物は消える */
function rtdb(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) { const a = v.map(rtdb).filter(x => x !== undefined); return a.length ? a : undefined; }
  if (typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) { const x = rtdb(v[k]); if (x !== undefined) o[k] = x; }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}
const trip = st => normalize(JSON.parse(JSON.stringify(rtdb(st) ?? {})), 'A');

let st;
const game = (s, n = 4) => { for (let i = 0; i < n; i++) addPoint(st, s); };
const set6 = s => { for (let i = 0; i < 6; i++) game(s); };

// 1) 1ゲーム
st = defaultState('A');
for (let i = 0; i < 4; i++) addPoint(st, 'a');
ok(st.sc.g.a === 1 && st.sc.g.b === 0, '4点で1ゲーム');
ok(st.sc.srv === 'b', 'ゲーム後にサーブ交代');

// 2) デュースとAD
st = defaultState('A');
for (let i = 0; i < 3; i++) { addPoint(st, 'a'); addPoint(st, 'b'); }
ok(ptText(st, 'a') === '40' && ptText(st, 'b') === '40', '40-40');
addPoint(st, 'a'); ok(ptText(st, 'a') === 'AD', 'AD');
addPoint(st, 'b'); ok(ptText(st, 'a') === '40' && ptText(st, 'b') === '40', 'デュースに戻る');
addPoint(st, 'a'); addPoint(st, 'a'); ok(st.sc.g.a === 1, '2点差でゲーム');

// 3) 6-6 → タイブレーク → 7-6(7-5)
st = defaultState('A');
for (let i = 0; i < 6; i++) { game('a'); game('b'); }
ok(st.sc.tb === true, '6-6でタイブレーク開始');
for (let i = 0; i < 5; i++) { addPoint(st, 'a'); addPoint(st, 'b'); }
addPoint(st, 'a'); addPoint(st, 'a');
ok(st.sc.done.length === 1 && setStr(st.sc.done[0]) === '7-6(7-5)', 'タイブレーク結果 7-6(7-5)');

// 4) 3セットマッチの決着
st = defaultState('A');
set6('a'); set6('a');
ok(st.sc.win === 'a', '2セット先取で勝ち');
addPoint(st, 'a'); ok(st.sc.win === 'a' && st.sc.done.length === 2, '決着後は加点しない');

// 5) 最終セット10ポイントタイブレーク
st = defaultState('A'); st.rules.mtb = true;
set6('a'); set6('b');
ok(st.sc.tb && st.sc.mtb, '1-1で10ポイントタイブレーク');
for (let i = 0; i < 10; i++) addPoint(st, 'b');
ok(st.sc.win === 'b' && setStr(st.sc.done[2]) === '[0-10]', '[0-10]で決着');

// 6) ノーアドバンテージ
st = defaultState('A'); st.rules.noAd = true;
for (let i = 0; i < 3; i++) { addPoint(st, 'a'); addPoint(st, 'b'); }
addPoint(st, 'a'); ok(st.sc.g.a === 1, 'ノーアドは40-40の次の1点でゲーム');

// 7) 取り消し
st = defaultState('A');
for (let i = 0; i < 4; i++) addPoint(st, 'a');
st.sc = JSON.parse(st.hist.pop());
ok(st.sc.p.a === 3 && st.sc.g.a === 0, '取り消しで40-0に戻る');

// 8) Firebase 往復でデータが崩れないか
st = defaultState('A'); st.rules.mtb = true;
for (let i = 0; i < 6; i++) { game('a'); game('b'); }
for (let i = 0; i < 7; i++) addPoint(st, 'b');
ok(JSON.stringify(st) === JSON.stringify(trip(st)), 'タイブレーク途中の状態が往復で保たれる');

st = defaultState('A'); st.sc = emptyScore(); st.hist = [];
ok(JSON.stringify(trip(st)) === JSON.stringify(st), '初期状態が往復で保たれる');

st = defaultState('A');
st.draft.lay.bug.v = false; st.draft.lay.bug.dx = 0; st.draft.resBand = false; st.draft.free = '';
ok(JSON.stringify(trip(st)) === JSON.stringify(st), 'false や 0 や空文字が往復で保たれる');

// 9) 8ゲームマッチ
st = defaultState('A'); st.rules.sets = 1; st.rules.games = 8; st.rules.tb = true;
for (let i = 0; i < 7; i++) game('a');
ok(st.sc.g.a === 7 && !st.sc.win, '7ゲームではまだ決着しない');
game('a');
ok(st.sc.win === 'a' && setStr(st.sc.done[0]) === '8-0', '8ゲーム先取で決着');

st = defaultState('A'); st.rules.sets = 1; st.rules.games = 8; st.rules.tb = true;
for (let i = 0; i < 8; i++) { game('a'); game('b'); }
ok(st.sc.tb === true && st.sc.mtb === false, '8-8でタイブレーク開始');
for (let i = 0; i < 6; i++) { addPoint(st, 'a'); addPoint(st, 'b'); }
ok(!st.sc.win, '6-6では7ポイントタイブレークは終わらない');
addPoint(st, 'a'); addPoint(st, 'a');
ok(st.sc.win === 'a' && setStr(st.sc.done[0]) === '9-8(8-6)', '7ポイントタイブレークで決着');

// 10) 結果行
st = defaultState('A');
st.draft.m.code = 'S1'; st.draft.m.pA = '山口'; st.draft.m.pB = '矢ノ川';
set6('a'); set6('a');
ok(resultLine(st, st.draft) === 'S1 山口(OSG) 6-0 6-0 矢ノ川(LUCENT)', '結果行の組み立て');

// 11) データ無し
ok(JSON.stringify(normalize(null, 'B')) === JSON.stringify(defaultState('B')), 'データ無しで初期値');

console.log(fail ? `\n${fail} 件 失敗` : '\nすべて成功');
process.exit(fail ? 1 : 0);
