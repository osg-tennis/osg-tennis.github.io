/* 分析ページの画面まわり。計算そのものは js/stats.js にある。

   スマホで見ることを前提に、1画面に収まる単位でページを分けている。
   「画像を保存」を押すと、全項目を1枚のPNGにして保存できる（スクショ不要）。 */

import { app, isConfigured, listMatches, readPoints } from './db.js';
import { renderSheet } from './stats-sheet.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let matches = [];
let current = null;

/* ---------- ログイン ---------- */
const auth = app ? getAuth(app) : null;
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  onAuthStateChanged(auth, user => {
    $('gate').hidden = !!user;
    if (user) { $('pass').value = ''; loadList(); }
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
  $('mlist').innerHTML = '<p class="empty">js/firebase-config.js に Firebase の接続情報が入っていません。</p>';
}

/* ---------- 試合の一覧 ---------- */
async function loadList() {
  if (!isConfigured) return;
  try {
    matches = await listMatches();
  } catch (err) {
    $('mlist').innerHTML = `<p class="empty">一覧を読み込めませんでした：${esc(err.message || err)}</p>`;
    return;
  }
  if (!matches.length) {
    $('mlist').innerHTML = '<p class="empty">まだ記録がありません。操作画面で得点ボタンを押すと、その試合から自動で記録が始まります。</p>';
    return;
  }
  $('mlist').innerHTML = matches
    .map(m => {
      const d = m.startedAt ? new Date(m.startedAt) : null;
      const when = d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
      const who = `${esc(m.teams ? m.teams.a : 'A')} vs ${esc(m.teams ? m.teams.b : 'B')}`;
      const pl = m.players && (m.players.a || m.players.b) ? `${esc(m.players.a)} / ${esc(m.players.b)}` : '';
      return `<button type="button" class="mitem" data-id="${esc(m.id)}">
        <b>${who}</b>
        <small>${when}　${esc(m.code || '')} ${esc(m.courtName || 'コート' + (m.court || ''))}</small>
        ${pl ? `<small>${pl}</small>` : ''}
        ${m.score ? `<small>${esc(m.score)}</small>` : '<small>記録中</small>'}
      </button>`;
    })
    .join('');
}

$('mlist').addEventListener('click', e => {
  const b = e.target.closest('[data-id]');
  if (b) openMatch(b.dataset.id);
});

/* ---------- 1試合の分析 ---------- */
async function openMatch(id) {
  current = matches.find(m => m.id === id);
  document.querySelectorAll('.mitem').forEach(el => el.setAttribute('aria-current', String(el.dataset.id === id)));
  $('detail').innerHTML = '<section class="card"><p class="empty">読み込み中…</p></section>';
  let points;
  try {
    points = await readPoints(id);
  } catch (err) {
    $('detail').innerHTML = `<section class="card"><p class="empty">読み込めませんでした：${esc(err.message || err)}</p></section>`;
    return;
  }
  if (!points.length) {
    $('detail').innerHTML = '<section class="card"><p class="empty">この試合にはまだポイントの記録がありません。</p></section>';
    return;
  }
  document.querySelector('.layout').classList.add('has-sel');
  renderSheet($('detail'), points, current);
}
