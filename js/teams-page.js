/* 名簿ページ（teams.html）の画面まわり。
   データの形と CSV の読み書きそのものは js/roster.js にある。

   入力は打ち終わりを待って自動で保存する（「保存」ボタンは置かない）。
   削除だけは確認を挟む。 */

import {
  app, isConfigured, watchRoster, watchConnection,
  newRosterId, writeTeam, patchTeam, removeTeam, removePlayer, writeRoster, readRoster,
} from './db.js';
import { rosterList, rosterFromCsv, csvFromRoster, buildRoster, SAMPLE_CSV } from './roster.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let teams = [];        // 画面で使う配列（roster.js が整形したもの）
let selected = null;   // 選んでいるチームID
let loaded = false;    // 最初の読み込みが済んだか
let needDetail = false; // 入力中に届いた変更を、手が離れてから描き直すための印
let focusNext = null;  // 追加した選手の欄に、描き直したあとカーソルを入れる

/* ---------- 画面下に出る短い知らせ ---------- */
let toastTimer = null;
function toast(msg) {
  const box = $('toast');
  box.textContent = msg;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 6000);
}
function send(p) {
  return Promise.resolve(p).catch(err => {
    const m = String((err && err.message) || err);
    toast(m.toLowerCase().includes('permission')
      ? '保存できませんでした。ログインし直してください。'
      : '保存できませんでした：' + m);
  });
}

/* ---------- つながっているかの表示 ---------- */
let connOk = null;
function paintConn() {
  const el = $('conn');
  if (!loaded) { el.className = 'state'; el.lastElementChild.textContent = '読み込み中…'; return; }
  el.className = 'state ' + (connOk === false ? 'off' : 'ok');
  el.lastElementChild.textContent = connOk === false ? '接続待ち（復帰後に自動で戻ります）' : '保存済み';
}

/* ---------- ログイン ---------- */
const auth = app ? getAuth(app) : null;
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  onAuthStateChanged(auth, user => {
    $('gate').hidden = !!user;
    if (user) { $('loginErr').textContent = ''; $('pass').value = ''; start(); }
  });
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginBtn').disabled = true;
    $('loginErr').textContent = '';
    try {
      await signInWithEmailAndPassword(auth, $('email').value.trim(), $('pass').value);
    } catch (err) {
      const c = (err && err.code) || '';
      $('loginErr').textContent = c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')
        ? 'メールアドレスかパスワードが違います。'
        : 'ログインできませんでした：' + (err.message || c);
    } finally {
      $('loginBtn').disabled = false;
    }
  });
  $('logout').onclick = () => signOut(auth);
} else {
  $('gate').hidden = true;
  $('tlist').innerHTML = '<p class="empty">js/firebase-config.js に Firebase の接続情報が入っていません。</p>';
}

let started = false;
function start() {
  if (started || !isConfigured) return;
  started = true;
  watchConnection(ok => { connOk = ok; paintConn(); });
  watchRoster(raw => {
    teams = rosterList(raw);
    loaded = true;
    if (selected && !teams.some(t => t.id === selected)) selected = null;
    if (!selected && teams.length) selected = teams[0].id;
    paintConn();
    renderTeams();
    scheduleDetail();
  });
}

/* 入力中に画面を描き直すとカーソルが飛んでしまうので、手が離れるまで待つ */
function typingInDetail() {
  const el = document.activeElement;
  return !!el && el.tagName === 'INPUT' && $('detail').contains(el);
}
function scheduleDetail() {
  if (typingInDetail()) { needDetail = true; return; }
  needDetail = false;
  renderDetail();
}

/* ---------- 左：チーム一覧 ---------- */
function renderTeams() {
  $('teamCount').textContent = teams.length ? `${teams.length}チーム` : '';
  if (!teams.length) {
    $('tlist').innerHTML = '<p class="empty">まだ登録がありません。<br>下の「チームを追加」か、CSVの取り込みで登録してください。</p>';
    return;
  }
  $('tlist').innerHTML = teams.map(t => `
    <button type="button" data-id="${esc(t.id)}" aria-pressed="${t.id === selected}">
      <span class="nm">${esc(t.name)}</span>
      <span class="ct">${t.players.length}</span>
    </button>`).join('');
  $('tlist').querySelectorAll('button').forEach(b => {
    b.onclick = () => { selected = b.dataset.id; renderTeams(); renderDetail(); };
  });
}

/* ---------- 右：選んだチームの中身 ---------- */
function renderDetail() {
  const box = $('detail');
  const t = teams.find(x => x.id === selected);
  if (!t) {
    box.innerHTML = loaded && !teams.length
      ? '<p class="empty">まずチームを登録してください。</p>'
      : '<p class="empty">左の一覧からチームを選んでください。</p>';
    return;
  }
  box.innerHTML = `
    <h2>Team<span>${esc(t.name)}</span><span class="chip drf">${t.players.length}人</span></h2>
    <div class="grid-2">
      <label>チーム名（配信に出る名前）<input type="text" id="tName" value="${esc(t.name)}"></label>
      <label>かな（並び順に使います）<input type="text" id="tKana" value="${esc(t.kana)}"></label>
    </div>
    <div class="phead"><span></span><span>選手名</span><span>かな</span><span>背番号</span><span></span></div>
    <div class="plist" id="plist">${t.players.map((p, i) => playerRow(p, i)).join('')
      || '<p class="empty">まだ選手がいません。下の「選手を追加」で登録してください。</p>'}</div>
    <div class="row">
      <button type="button" class="primary" id="addPlayer">＋ 選手を追加</button>
      <button type="button" class="danger" id="delTeam" style="flex:0 0 auto">このチームを削除</button>
    </div>
    <p class="note">選手名は配信の「選手情報」にそのまま出ます。ダブルスの表示（例：山田・佐藤）は、名字を自動で取り出して組み立てます。</p>`;

  /* チーム名を空にすると一覧から消えて開けなくなるので、空のままは保存しない */
  bindText($('tName'), v => {
    if (!v.trim()) { $('tName').value = t.name; toast('チーム名は空にできません。削除するなら「このチームを削除」を押してください。'); return null; }
    return patchTeam(t.id, { name: v.trim() });
  });
  bindText($('tKana'), v => patchTeam(t.id, { kana: v.trim() }));

  t.players.forEach(p => {
    bindText($(`pn_${p.id}`), v => patchTeam(t.id, { [`players/${p.id}/name`]: v }));
    bindText($(`pk_${p.id}`), v => patchTeam(t.id, { [`players/${p.id}/kana`]: v }));
    bindText($(`po_${p.id}`), v => patchTeam(t.id, { [`players/${p.id}/no`]: v }));
    $(`pd_${p.id}`).onclick = () => {
      if (!confirm(`「${p.name || 'この選手'}」を名簿から削除します。よろしいですか？`)) return;
      send(removePlayer(t.id, p.id));
    };
  });

  $('addPlayer').onclick = () => {
    const id = newRosterId();
    focusNext = `pn_${id}`;
    send(patchTeam(t.id, { [`players/${id}`]: { name: '', kana: '', no: '', order: t.players.length } }));
  };
  $('delTeam').onclick = () => {
    const n = t.players.length;
    if (!confirm(`「${t.name}」を${n ? `選手${n}人ごと` : ''}削除します。元に戻せません。よろしいですか？`)) return;
    send(removeTeam(t.id));
  };

  if (focusNext) {
    const el = $(focusNext);
    focusNext = null;
    if (el) el.focus();
  }
}

function playerRow(p, i) {
  return `<div class="prow">
    <span class="idx">${i + 1}</span>
    <input class="f-name" type="text" id="pn_${esc(p.id)}" value="${esc(p.name)}" placeholder="山田 太郎">
    <input class="f-kana" type="text" id="pk_${esc(p.id)}" value="${esc(p.kana)}" placeholder="やまだ たろう">
    <input class="f-no" type="text" id="po_${esc(p.id)}" value="${esc(p.no)}" placeholder="背番号" inputmode="numeric">
    <button type="button" class="del" id="pd_${esc(p.id)}" title="この選手を削除" aria-label="この選手を削除">×</button>
  </div>`;
}

/* 打ち終わりを待ってから保存する。打っている最中は画面を描き直さない */
function bindText(el, save) {
  if (!el) return;
  let timer = null;
  let last = el.value;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (el.value === last) return;
    last = el.value;
    send(save(el.value));
  };
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });
  el.addEventListener('blur', () => {
    flush();
    /* 入力中に見送った変更があれば、ここで描き直す */
    if (needDetail) setTimeout(() => { if (!typingInDetail()) scheduleDetail(); }, 0);
  });
}

/* ---------- CSV ---------- */
function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('sampleCsv').onclick = () => download('名簿の見本.csv', SAMPLE_CSV);

$('exportCsv').onclick = () => {
  if (!teams.length) { toast('まだ登録がありません。'); return; }
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  download(`名簿_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`, csvFromRoster(teams));
};

let lastCsv = null; // 選んだファイルの中身。取り込み方法を変えたときに読み直す

$('csvFile').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // 同じファイルをもう一度選べるようにする
  if (!file) return;
  let text = '';
  try {
    text = await file.text();
  } catch (err) {
    toast('ファイルを読めませんでした：' + (err.message || err));
    return;
  }
  lastCsv = { name: file.name, text };
  showImport(lastCsv.name, lastCsv.text);
});

/* 取り込み方法を変えたら、説明の文も作り直す */
$('impMode').addEventListener('change', () => {
  if (lastCsv && !$('impBox').hidden) showImport(lastCsv.name, lastCsv.text);
});

function showImport(fileName, text) {
  const mode = $('impMode').value === 'replace' ? 'replace' : 'add';
  const { teams: imported, errors } = rosterFromCsv(text);
  const box = $('impBox');
  box.hidden = false;

  if (!imported.length) {
    box.innerHTML = `<div class="imp">
      <h3>${esc(fileName)} は取り込めませんでした</h3>
      <p class="warn">${esc(errors.join('\n'))}</p>
      <p class="note">文字化けするときは、Excel の「名前を付けて保存」で <b>CSV UTF-8（コンマ区切り）</b> を選んでください。</p>
    </div>`;
    return;
  }

  const { sum } = buildRoster(teams, imported, mode, () => 'x');
  const people = imported.reduce((n, t) => n + t.players.length, 0);
  const prev = imported.slice(0, 8).map(t =>
    `<div><b>${esc(t.name)}</b>　${t.players.length}人　${esc(t.players.slice(0, 4).map(p => p.name).join('、'))}${t.players.length > 4 ? ' …' : ''}</div>`
  ).join('');

  box.innerHTML = `<div class="imp">
    <h3>${esc(fileName)} の中身</h3>
    <p class="sum">${mode === 'replace'
      ? `いまの名簿を全部消して、<b>${imported.length}</b>チーム / <b>${people}</b>人に入れ替えます。`
      : `新しく増えるのは <b>${sum.newTeams}</b>チーム / <b>${sum.newPlayers}</b>人です。${sum.existingPlayers ? `すでに登録済みの ${sum.existingPlayers}人 はそのまま残ります。` : ''}`}</p>
    ${errors.length ? `<p class="warn">次の行は読みとばします：\n${esc(errors.join('\n'))}</p>` : ''}
    <div class="prev">${prev}${imported.length > 8 ? `<div>ほか ${imported.length - 8} チーム</div>` : ''}</div>
    <div class="row">
      <button type="button" class="primary" id="impRun">この内容で取り込む</button>
      <button type="button" class="ghost" id="impCancel" style="flex:0 0 auto">やめる</button>
    </div>
  </div>`;

  $('impCancel').onclick = () => { box.hidden = true; box.innerHTML = ''; };
  $('impRun').onclick = async () => {
    if (mode === 'replace' && !confirm(`いまの名簿（${teams.length}チーム）を全部消して入れ替えます。元に戻せません。よろしいですか？`)) return;
    $('impRun').disabled = true;
    try {
      /* 直前の状態をサーバーから取り直してから合わせる（他の人の編集を消さないため） */
      const current = rosterList(await readRoster());
      const { data, sum: s } = buildRoster(current, imported, mode, newRosterId);
      await writeRoster(data);
      toast(mode === 'replace'
        ? `名簿を入れ替えました（${imported.length}チーム）。`
        : `取り込みました（チーム ${s.newTeams} / 選手 ${s.newPlayers} を追加）。`);
      box.hidden = true;
      box.innerHTML = '';
      lastCsv = null;
    } catch (err) {
      const m = String((err && err.message) || err);
      toast(m.toLowerCase().includes('permission')
        ? '取り込めませんでした。ログインし直してください。'
        : '取り込めませんでした：' + m);
      $('impRun').disabled = false;
    }
  };
}

/* ---------- チームを追加 ---------- */
$('addTeam').onclick = () => {
  const name = (prompt('チーム名を入力してください（配信に出る名前）') || '').trim();
  if (!name) return;
  if (teams.some(t => t.name === name)) { toast(`「${name}」はすでに登録されています。`); return; }
  const id = newRosterId();
  selected = id;
  send(writeTeam(id, { name, kana: '', order: teams.length, players: {} }));
};
