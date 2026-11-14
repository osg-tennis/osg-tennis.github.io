import { defaultState, addPoint, setStr, ptText } from '../js/parts.js';
let fail=0; const ok=(c,m)=>{ if(!c){console.log('NG:',m);fail++} else console.log('ok:',m) };

// 1セットマッチ＋ノーアドバンテージ
let st = defaultState('A');
st.rules.sets = 1; st.rules.games = 6; st.rules.noAd = true; st.rules.tb = true;
const game = s => { for (let i=0;i<4;i++) addPoint(st, s); };

// 40-40 の次の1点でゲーム
for (let i=0;i<3;i++){ addPoint(st,'a'); addPoint(st,'b'); }
ok(ptText(st,'a')==='40' && ptText(st,'b')==='40', '40-40 になる');
addPoint(st,'b');
ok(st.sc.g.b===1 && st.sc.p.a===0, 'ノーアドは40-40の次の1点でゲーム');

// 6ゲーム先取で試合終了（1セットマッチ）
st = defaultState('A');
st.rules.sets = 1; st.rules.games = 6; st.rules.noAd = true; st.rules.tb = true;
for (let i=0;i<5;i++) game('a');
ok(!st.sc.win, '5ゲームではまだ終わらない');
game('a');
ok(st.sc.win==='a' && setStr(st.sc.done[0])==='6-0', '6ゲーム先取で試合終了');

// 5-5 から 7-5 で終了（2ゲーム差が必要）
st = defaultState('A');
st.rules.sets = 1; st.rules.games = 6; st.rules.noAd = true; st.rules.tb = true;
for (let i=0;i<5;i++){ game('a'); game('b'); }
game('a');
ok(!st.sc.win && st.sc.g.a===6 && st.sc.g.b===5, '6-5 ではまだ終わらない');
game('a');
ok(st.sc.win==='a' && setStr(st.sc.done[0])==='7-5', '7-5 で試合終了');

// 6-6 からタイブレーク（ノーアドでもタイブレークは2点差）
st = defaultState('A');
st.rules.sets = 1; st.rules.games = 6; st.rules.noAd = true; st.rules.tb = true;
for (let i=0;i<6;i++){ game('a'); game('b'); }
ok(st.sc.tb===true, '6-6 でタイブレーク');
for (let i=0;i<6;i++){ addPoint(st,'a'); addPoint(st,'b'); }
ok(!st.sc.win, 'タイブレークは6-6では終わらない（2点差が必要）');
addPoint(st,'a'); addPoint(st,'a');
ok(st.sc.win==='a' && setStr(st.sc.done[0])==='7-6(8-6)', 'タイブレークで試合終了');

// 8ゲームマッチ＋ノーアド
st = defaultState('A');
st.rules.sets = 1; st.rules.games = 8; st.rules.noAd = true; st.rules.tb = true;
for (let i=0;i<8;i++) game('a');
ok(st.sc.win==='a' && setStr(st.sc.done[0])==='8-0', '8ゲームマッチ＋ノーアドも終わる');

console.log(fail?`\n${fail} 件 失敗`:'\nすべて成功');
process.exit(fail?1:0);
