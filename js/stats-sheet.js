/* 分析結果の見せ方だけを受け持つモジュール。
   Firebase には触れないので、どのページからでも同じ結果を描ける。

     renderSheet(container, points, meta) … 画面に出す（ページ切り替え・CSV・画像保存つき）

   画面表示と画像保存は同じ buildSheet() の結果を使うので、内容がずれない。 */

import { analyse, momentum, toCsv, dblLabel } from './stats.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = v => (v == null ? '–' : String(v));
const p = v => (v == null ? '–' : v + '%');

/* ---------- 集計結果を「見出し＋行」の形に整える ----------
   画面表示と画像保存の両方がこれを使うので、内容がずれない。
   better … どちらが良いかの判定（'high' は大きいほど良い、'low' は小さいほど良い） */
function buildSheet(r, meta) {
  const A = r.stats.a, B = r.stats.b;
  const secs = [
    {
      title: 'サービス',
      rows: [
        ['ファーストサーブ確率', p(A.serve.firstPct), p(B.serve.firstPct), 'high'],
        ['ファースト獲得率', p(A.serve.firstWonPct), p(B.serve.firstWonPct), 'high'],
        ['セカンド獲得率', p(A.serve.secondWonPct), p(B.serve.secondWonPct), 'high'],
        ['サービスポイント獲得率', p(A.serve.wonPct), p(B.serve.wonPct), 'high'],
        ['ダブルフォールト', n(A.serve.df), n(B.serve.df), 'low'],
        ['サーブを打った数', n(A.serve.total), n(B.serve.total), null],
      ],
    },
    {
      title: 'リターン',
      rows: [
        ['1stに対する獲得率', p(A.ret.firstPct), p(B.ret.firstPct), 'high'],
        ['2ndに対する獲得率', p(A.ret.secondPct), p(B.ret.secondPct), 'high'],
        ['リターンポイント獲得率', p(A.ret.wonPct), p(B.ret.wonPct), 'high'],
      ],
    },
    {
      title: 'ブレークとキープ',
      rows: [
        ['ブレーク成功 / 機会', `${A.bp.converted} / ${A.bp.chances}`, `${B.bp.converted} / ${B.bp.chances}`, null],
        ['ブレークポイント獲得率', p(A.bp.convPct), p(B.bp.convPct), 'high'],
        ['ブレークポイントセーブ率', p(A.bp.savePct), p(B.bp.savePct), 'high'],
        ['キープ / サービスゲーム', `${A.hold.held} / ${A.hold.games}`, `${B.hold.held} / ${B.hold.games}`, null],
        ['キープ率', p(A.hold.pct), p(B.hold.pct), 'high'],
      ],
    },
    {
      title: '勝負所',
      rows: [
        ['デュースでの獲得率', p(A.key.deucePct), p(B.key.deucePct), 'high'],
        ['30-30 での獲得率', p(A.key.bp30Pct), p(B.key.bp30Pct), 'high'],
        ['ゲームポイント決定率', p(A.key.gpPct), p(B.key.gpPct), 'high'],
        ['最多連続ポイント', n(A.streak), n(B.streak), 'high'],
      ],
    },
    {
      title: 'コートサイド',
      rows: [
        ['デュース サーブ獲得率', p(A.side.deuce.servePct), p(B.side.deuce.servePct), 'high'],
        ['アド サーブ獲得率', p(A.side.ad.servePct), p(B.side.ad.servePct), 'high'],
        ['デュース リターン獲得率', p(A.side.deuce.retPct), p(B.side.deuce.retPct), 'high'],
        ['アド リターン獲得率', p(A.side.ad.retPct), p(B.side.ad.retPct), 'high'],
      ],
    },
  ];

  // ダブルスのときは、ペアの2人を並べた表も足す
  if (r.players) {
    for (const t of ['a', 'b']) {
      const v0 = r.players[t][0], v1 = r.players[t][1];
      secs.push({
        title: `${(meta.teams && meta.teams[t]) || t.toUpperCase()} の選手別`,
        names: [dblLabel(meta, t, 0), dblLabel(meta, t, 1)],
        rows: [
          ['サーブを打った数', n(v0.serve.total), n(v1.serve.total), null],
          ['ファーストサーブ確率', p(v0.serve.firstPct), p(v1.serve.firstPct), 'high'],
          ['ファースト獲得率', p(v0.serve.firstWonPct), p(v1.serve.firstWonPct), 'high'],
          ['セカンド獲得率', p(v0.serve.secondWonPct), p(v1.serve.secondWonPct), 'high'],
          ['サービスポイント獲得率', p(v0.serve.wonPct), p(v1.serve.wonPct), 'high'],
          ['ダブルフォールト', n(v0.serve.df), n(v1.serve.df), 'low'],
          ['リターンした数', n(v0.ret.faced), n(v1.ret.faced), null],
          ['リターン獲得率', p(v0.ret.wonPct), p(v1.ret.wonPct), 'high'],
          ['デュース リターン獲得率', p(v0.ret.deucePct), p(v1.ret.deucePct), 'high'],
          ['アド リターン獲得率', p(v0.ret.adPct), p(v1.ret.adPct), 'high'],
        ],
      });
    }
  }
  return secs;
}

/* 数字として比べられるときだけ、良いほうに印をつける */
function winner(va, vb, better) {
  if (!better) return 0;
  const num = s => {
    const m = String(s).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const a = num(va), b = num(vb);
  if (a == null || b == null || a === b) return 0;
  const aWins = better === 'low' ? a < b : a > b;
  return aWins ? 1 : 2;
}

/* ---------- 画面に出す ---------- */
export function renderSheet(root, points, meta) {
  const r = analyse(points, meta);
  const secs = buildSheet(r, meta);
  const A = r.stats.a, B = r.stats.b;
  const na = (meta.players && meta.players.a) || (meta.teams && meta.teams.a) || 'A';
  const nb = (meta.players && meta.players.b) || (meta.teams && meta.teams.b) || 'B';

  const head = (x, y) => `<div class="srow head"><div class="v">${esc(x)}</div><div class="lab"></div><div class="v">${esc(y)}</div></div>`;
  const secHtml = s => `
    <div class="sec">
      <h3>${esc(s.title)}</h3>
      ${s.names ? head(s.names[0], s.names[1]) : ''}
      ${s.rows.map(([lab, va, vb, better]) => {
        const w = winner(va, vb, better);
        return `<div class="srow">
          <div class="v${w === 1 ? ' win' : ''}">${esc(va)}</div>
          <div class="lab">${esc(lab)}</div>
          <div class="v${w === 2 ? ' win' : ''}">${esc(vb)}</div>
        </div>`;
      }).join('')}
    </div>`;

  const by = t => secs.filter(s => s.title === t).map(secHtml).join('');
  const playerSecs = secs.filter(s => s.names);

  // 1画面に収まる単位でページを分ける
  // スマホの1画面に収まるまとまりでページを分ける（スクショの枚数を減らすため）
  const pages = [
    {
      key: 'p1', label: 'サーブ・勝負所',
      html: `
        <div class="sum">
          <div><span>スコア</span><b>${esc(meta.score || '記録中')}</b></div>
          <div><span>時間</span><b>${r.minutes != null ? r.minutes + '分' : '–'}</b></div>
          <div><span>ポイント</span><b>${A.won}-${B.won}</b></div>
          <div><span>ゲーム</span><b>${r.games.length}</b></div>
        </div>
        ${by('サービス')}${by('リターン')}${by('勝負所')}`,
    },
    {
      key: 'p2', label: 'ブレーク・流れ',
      html: by('ブレークとキープ') + by('コートサイド') +
        `<div class="sec"><h3>試合の流れ（上が ${esc(na)} 優勢）</h3>${chart(points)}</div>`,
    },
  ];
  // 選手別はチームごとに1ページ（1画面に収まるように）
  playerSecs.forEach((s, i) => {
    const short = s.title.replace(' の選手別', '');
    pages.push({ key: 'pp' + i, label: short.length > 5 ? short.slice(0, 5) + '…' : short, html: secHtml(s) });
  });

  root.innerHTML = `
    <section class="card sheet-card">
      <div class="sheet-head">
        <div class="who"><b>${esc(na)}</b><i>vs</i><b>${esc(nb)}</b></div>
        <div class="row">
          <button type="button" id="png" class="primary">画像を保存</button>
          <button type="button" id="csv" class="ghost">CSV</button>
          <button type="button" id="pick2" class="ghost">試合を変える</button>
        </div>
      </div>
      <nav class="pager" role="tablist" aria-label="分析のページ">
        ${pages.map((pg, i) => `<button type="button" role="tab" data-pg="${pg.key}" aria-selected="${i === 0}">${pg.label}</button>`).join('')}
      </nav>
      ${pages.map((pg, i) => `<div class="sheet" data-pg="${pg.key}"${i ? ' hidden' : ''}>${pg.html}</div>`).join('')}
      <p class="note">得点ボタンの記録から自動集計（ウィナー・ラリー数は含みません）</p>
    </section>`;

  const pgBtns = [...root.querySelectorAll('.pager [role=tab]')];
  pgBtns.forEach((b, i) => {
    b.onclick = () => {
      pgBtns.forEach(x => x.setAttribute('aria-selected', String(x === b)));
      root.querySelectorAll('.sheet').forEach(s => (s.hidden = s.dataset.pg !== b.dataset.pg));
    };
    b.onkeydown = e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = pgBtns[(i + d + pgBtns.length) % pgBtns.length];
      next.click();
      next.focus();
    };
  });

  const back = root.querySelector('#pick2');
  if (back) back.onclick = () => {
    const l = document.querySelector('.layout');
    if (l) l.classList.remove('has-sel');
    const pick = document.getElementById('pick');
    if (pick) pick.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  root.querySelector('#csv').onclick = () => {
    download(new Blob(['﻿' + toCsv(points, meta)], { type: 'text/csv;charset=utf-8' }), `${meta.id || 'match'}.csv`);
  };
  root.querySelector('#png').onclick = () => savePng(root, secs, r, meta, na, nb, points);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* 得点差の推移を折れ線にする */
function chart(points) {
  const m = momentum(points);
  const W = 900, H = 240, pad = 12;
  const max = Math.max(4, ...m.map(v => Math.abs(v)));
  const x = i => pad + (i * (W - pad * 2)) / Math.max(1, m.length - 1);
  const y = v => H / 2 - (v / max) * (H / 2 - pad);
  const d = m.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="得点差の推移">
    <rect width="${W}" height="${H}" fill="rgba(255,255,255,.03)" rx="10"/>
    <line x1="${pad}" y1="${H / 2}" x2="${W - pad}" y2="${H / 2}" stroke="#2a4170" stroke-width="2"/>
    <path d="${d}" fill="none" stroke="#d4ef3a" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- 全項目を1枚のPNGにする ----------
   スクショを何枚も撮らなくて済むよう、同じ内容を画像にして保存する。 */
async function savePng(root, secs, r, meta, na, nb, points) {
  const btn = root.querySelector('#png');
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = '作成中…';
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const W = 760; // 論理幅。実際は2倍の解像度で描く
    const PAD = 28;
    const ROW = 34;
    const SEC_HEAD = 40;
    const jp = w => `${w} 15px "Noto Sans JP", system-ui, sans-serif`;
    const num = w => `${w} 22px "Barlow Condensed", "Noto Sans JP", sans-serif`;

    // 高さを先に計算する
    let H = 150 + 70; // 見出し＋サマリー
    for (const s of secs) H += SEC_HEAD + (s.names ? ROW : 0) + s.rows.length * ROW + 14;
    H += 242; // 流れのグラフ
    H += 40; // 注記

    const dpr = 2;
    const cv = document.createElement('canvas');
    cv.width = W * dpr;
    cv.height = H * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.textBaseline = 'middle';

    // 背景
    g.fillStyle = '#0a1324';
    g.fillRect(0, 0, W, H);

    let y = PAD;

    // 見出し
    g.fillStyle = '#d4ef3a';
    g.font = jp(800);
    g.textAlign = 'left';
    g.fillText('SCORE ANALYSIS', PAD, y + 8);
    const when = meta.startedAt ? new Date(meta.startedAt).toLocaleString('ja-JP') : '';
    g.fillStyle = '#8ba0c6';
    g.font = jp(500);
    g.textAlign = 'right';
    g.fillText(when, W - PAD, y + 8);
    y += 34;

    g.textAlign = 'left';
    g.fillStyle = '#eef3fb';
    g.font = `800 26px "Noto Sans JP", sans-serif`;
    g.fillText(`${na}  vs  ${nb}`, PAD, y + 12);
    y += 36;
    g.fillStyle = '#8ba0c6';
    g.font = jp(500);
    g.fillText(`${meta.code || ''} ${meta.courtName || ''}　${meta.score || '記録中'}`.trim(), PAD, y + 8);
    y += 36;

    // サマリー
    const cells = [
      ['総ポイント', String(r.total)],
      ['獲得ポイント', `${r.stats.a.won} - ${r.stats.b.won}`],
      ['ゲーム数', String(r.games.length)],
      ['所要時間', r.minutes != null ? r.minutes + ' 分' : '–'],
    ];
    const cw = (W - PAD * 2 - 12 * 3) / 4;
    cells.forEach((c, i) => {
      const cx = PAD + i * (cw + 12);
      g.fillStyle = '#111f3d';
      roundRect(g, cx, y, cw, 58, 10);
      g.fill();
      g.fillStyle = '#8ba0c6';
      g.font = `700 11px "Noto Sans JP", sans-serif`;
      g.textAlign = 'center';
      g.fillText(c[0], cx + cw / 2, y + 17);
      g.fillStyle = '#eef3fb';
      g.font = num(700);
      g.fillText(c[1], cx + cw / 2, y + 40);
    });
    y += 58 + 20;

    // 各セクション
    const vx1 = PAD + 70, vx2 = W - PAD - 70;
    for (const s of secs) {
      g.textAlign = 'left';
      g.fillStyle = '#d4ef3a';
      g.font = `800 13px "Noto Sans JP", sans-serif`;
      g.fillText(s.title, PAD, y + 14);
      y += SEC_HEAD - 10;

      if (s.names) {
        g.fillStyle = '#eef3fb';
        g.font = `800 14px "Noto Sans JP", sans-serif`;
        g.textAlign = 'center';
        g.fillText(s.names[0], vx1, y + ROW / 2);
        g.fillText(s.names[1], vx2, y + ROW / 2);
        y += ROW;
      }

      for (const [lab, va, vb, better] of s.rows) {
        const w = winner(va, vb, better);
        g.strokeStyle = '#1a2b53';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(PAD, y + ROW - 0.5);
        g.lineTo(W - PAD, y + ROW - 0.5);
        g.stroke();

        g.textAlign = 'center';
        g.font = num(700);
        g.fillStyle = w === 1 ? '#d4ef3a' : '#eef3fb';
        g.fillText(va, vx1, y + ROW / 2);
        g.fillStyle = w === 2 ? '#d4ef3a' : '#eef3fb';
        g.fillText(vb, vx2, y + ROW / 2);

        g.fillStyle = '#8ba0c6';
        g.font = `500 12.5px "Noto Sans JP", sans-serif`;
        g.fillText(lab, W / 2, y + ROW / 2);
        y += ROW;
      }
      y += 14;
    }

    // 流れのグラフ
    g.textAlign = 'left';
    g.fillStyle = '#d4ef3a';
    g.font = `800 13px "Noto Sans JP", sans-serif`;
    g.fillText(`試合の流れ（上が ${na} 優勢）`, PAD, y + 14);
    y += 30;
    const gw = W - PAD * 2, gh = 190;
    g.fillStyle = '#0c1831';
    roundRect(g, PAD, y, gw, gh, 10);
    g.fill();
    const m = momentum(points);
    const mx = Math.max(4, ...m.map(v => Math.abs(v)));
    g.strokeStyle = '#2a4170';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(PAD + 10, y + gh / 2);
    g.lineTo(PAD + gw - 10, y + gh / 2);
    g.stroke();
    g.strokeStyle = '#d4ef3a';
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.beginPath();
    m.forEach((v, i) => {
      const px = PAD + 10 + (i * (gw - 20)) / Math.max(1, m.length - 1);
      const py = y + gh / 2 - (v / mx) * (gh / 2 - 12);
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    });
    g.stroke();
    y += gh + 22;

    g.fillStyle = '#5f739b';
    g.font = `500 11.5px "Noto Sans JP", sans-serif`;
    g.textAlign = 'left';
    g.fillText('OSG LIVE スコアボード　得点ボタンの記録から自動集計（ウィナー・ラリー数は含みません）', PAD, y + 8);

    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    download(blob, `${meta.id || 'match'}.png`);
  } catch (err) {
    alert('画像を作れませんでした：' + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
