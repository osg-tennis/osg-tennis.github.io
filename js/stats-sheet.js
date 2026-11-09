/* 分析結果の見せ方だけを受け持つモジュール。
   Firebase には触れないので、どのページからでも同じ結果を描ける。

     renderSheet(container, points, meta) … 画面に出す（ページ切り替え・CSV・画像保存つき）

   画面表示と画像保存は同じ buildSheet() の結果を使うので、内容がずれない。 */

import { analyse, momentum, toCsv, dblLabel, fixDoubles } from './stats.js';

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

  // ダブルスのときは、4人を横並びにした表を1つ足す（スマホでも1画面に収めるため）
  if (r.players) {
    const P = r.players;
    const cols = [
      { team: 'a', i: 0 }, { team: 'a', i: 1 },
      { team: 'b', i: 0 }, { team: 'b', i: 1 },
    ].map(c => ({ ...c, name: dblLabel(meta, c.team, c.i), v: P[c.team][c.i] }));
    const line = (label, get, better) => [label, ...cols.map(c => get(c.v)), better];
    secs.push({
      title: '選手別',
      wide: true,
      groups: [
        { name: (meta.teams && meta.teams.a) || 'A', span: 2 },
        { name: (meta.teams && meta.teams.b) || 'B', span: 2 },
      ],
      names: cols.map(c => c.name),
      rows: [
        line('サーブ数', v => n(v.serve.total), null),
        line('1st確率', v => p(v.serve.firstPct), 'high'),
        line('1st獲得', v => p(v.serve.firstWonPct), 'high'),
        line('2nd獲得', v => p(v.serve.secondWonPct), 'high'),
        line('サーブ獲得', v => p(v.serve.wonPct), 'high'),
        line('ダブルフォールト', v => n(v.serve.df), 'low'),
        line('リターン数', v => n(v.ret.faced), null),
        line('リターン獲得', v => p(v.ret.wonPct), 'high'),
        line('デュース側', v => p(v.ret.deucePct), 'high'),
        line('アド側', v => p(v.ret.adPct), 'high'),
      ],
    });
  }
  return secs;
}

/* 並んだ値のうち、良いものの位置を返す（比べられないときは空） */
export function bestOf(values, better) {
  if (!better) return [];
  const num = s => {
    const m = String(s).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const ns = values.map(num);
  const ok = ns.filter(v => v != null);
  if (ok.length < 2) return [];
  const target = better === 'low' ? Math.min(...ok) : Math.max(...ok);
  if (ok.every(v => v === target)) return [];
  return ns.map(v => v === target);
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
/* タブは作らず縦に1本で並べる。共有リンクで開いた人がそのまま読み下せるように。 */
export function renderSheet(root, points, meta, opts = {}) {
  points = fixDoubles(points); // ダブルスの担当のずれを直してから集計する
  const r = analyse(points, meta);
  const secs = buildSheet(r, meta);
  const A = r.stats.a, B = r.stats.b;
  const na = (meta.players && meta.players.a) || (meta.teams && meta.teams.a) || 'A';
  const nb = (meta.players && meta.players.b) || (meta.teams && meta.teams.b) || 'B';

  /* 2人を比べる節（値｜項目｜値） */
  const duoSec = sec => `
    <section class="sec">
      <h3>${esc(sec.title)}</h3>
      ${sec.rows.map(([lab, va, vb, better]) => {
        const w = winner(va, vb, better);
        return `<div class="srow">
          <div class="v${w === 1 ? ' win' : ''}">${esc(va)}</div>
          <div class="lab">${esc(lab)}</div>
          <div class="v${w === 2 ? ' win' : ''}">${esc(vb)}</div>
        </div>`;
      }).join('')}
    </section>`;

  /* 4人を横並びにする節（ダブルス） */
  const wideSec = sec => `
    <section class="sec wide">
      <h3>${esc(sec.title)}</h3>
      <div class="wrow grp">
        <div></div>
        ${sec.groups.map(g => `<div class="gname" style="grid-column:span ${g.span}">${esc(g.name)}</div>`).join('')}
      </div>
      <div class="wrow names">
        <div></div>
        ${sec.names.map(x => `<div>${esc(x)}</div>`).join('')}
      </div>
      ${sec.rows.map(row => {
        const lab = row[0], vals = row.slice(1, -1), better = row[row.length - 1];
        const best = bestOf(vals, better);
        return `<div class="wrow">
          <div class="lab">${esc(lab)}</div>
          ${vals.map((v, i) => `<div class="v${best[i] ? ' win' : ''}">${esc(v)}</div>`).join('')}
        </div>`;
      }).join('')}
    </section>`;

  const share = opts.shareUrl
    ? `<button type="button" id="share" class="ghost">リンクをコピー</button>`
    : '';

  root.innerHTML = `
    <section class="card sheet-card">
      <header class="sheet-head">
        <div>
          <div class="who"><b>${esc(na)}</b><i>vs</i><b>${esc(nb)}</b></div>
          <p class="meta-line">${esc(matchLine(meta))}</p>
        </div>
        <div class="row acts">
          <button type="button" id="png" class="primary">画像を保存</button>
          ${share}
          <button type="button" id="csv" class="ghost">CSV</button>
          ${opts.onPick ? '<button type="button" id="pick2" class="ghost">試合を変える</button>' : ''}
        </div>
      </header>

      <div class="sum">
        <div><span>スコア</span><b>${esc(meta.score || '記録中')}</b></div>
        <div><span>時間</span><b>${r.minutes != null ? r.minutes + '分' : '–'}</b></div>
        <div><span>ポイント</span><b>${A.won}-${B.won}</b></div>
        <div><span>ゲーム</span><b>${r.games.length}</b></div>
      </div>

      <div class="sheet">
        ${secs.map(sec => (sec.wide ? wideSec(sec) : duoSec(sec))).join('')}
        <section class="sec">
          <h3>試合の流れ（上が ${esc(na)} 優勢）</h3>
          ${chart(points)}
        </section>
      </div>

      <p class="note">得点ボタンの記録から自動集計（ウィナー・ラリー数は含みません）</p>
    </section>`;

  const q = sel => root.querySelector(sel);
  q('#csv').onclick = () => {
    download(new Blob(['﻿' + toCsv(points, meta)], { type: 'text/csv;charset=utf-8' }), `${meta.id || 'match'}.csv`);
  };
  q('#png').onclick = () => savePng(root, secs, r, meta, na, nb, points);
  if (opts.onPick) q('#pick2').onclick = opts.onPick;
  if (opts.shareUrl) {
    q('#share').onclick = async () => {
      const b = q('#share');
      try {
        await navigator.clipboard.writeText(opts.shareUrl);
        b.textContent = 'コピーしました';
        b.classList.add('on');
      } catch (e) {
        b.textContent = 'コピーできません';
      }
      setTimeout(() => { b.textContent = 'リンクをコピー'; b.classList.remove('on'); }, 2200);
    };
  }
}

function matchLine(meta) {
  const d = meta.startedAt ? new Date(meta.startedAt) : null;
  const when = d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  return [when, meta.code, meta.courtName || (meta.court ? 'コート' + meta.court : '')].filter(Boolean).join('　');
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
    <rect width="${W}" height="${H}" fill="rgba(255,255,255,.04)" rx="10"/>
    <line x1="${pad}" y1="${H / 2}" x2="${W - pad}" y2="${H / 2}" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
    <path d="${d}" fill="none" stroke="#d8f24a" stroke-width="3" stroke-linejoin="round"/>
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
    const BG = '#000', CARD = '#1c1c1f', LINE = 'rgba(255,255,255,.1)';
    const INK = '#f5f5f7', MUTE = '#8e8e93', FAINT = '#636366', ACCENT = '#d8f24a';
    const num = w => `${w} 22px "Barlow Condensed", "Noto Sans JP", sans-serif`;

    // 高さを先に計算する
    let H = 150 + 70; // 見出し＋サマリー
    for (const s of secs) H += SEC_HEAD + (s.names ? ROW + 22 : 0) + s.rows.length * ROW + 14;
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
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);

    let y = PAD;

    // 見出し
    g.fillStyle = ACCENT;
    g.font = jp(800);
    g.textAlign = 'left';
    g.fillText('SCORE ANALYSIS', PAD, y + 8);
    const when = meta.startedAt ? new Date(meta.startedAt).toLocaleString('ja-JP') : '';
    g.fillStyle = MUTE;
    g.font = jp(500);
    g.textAlign = 'right';
    g.fillText(when, W - PAD, y + 8);
    y += 34;

    g.textAlign = 'left';
    g.fillStyle = INK;
    g.font = `700 26px "Noto Sans JP", sans-serif`;
    g.fillText(`${na}  vs  ${nb}`, PAD, y + 12);
    y += 36;
    g.fillStyle = MUTE;
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
      g.fillStyle = CARD;
      roundRect(g, cx, y, cw, 58, 10);
      g.fill();
      g.fillStyle = MUTE;
      g.font = `600 11px "Noto Sans JP", sans-serif`;
      g.textAlign = 'center';
      g.fillText(c[0], cx + cw / 2, y + 17);
      g.fillStyle = INK;
      g.font = num(700);
      g.fillText(c[1], cx + cw / 2, y + 40);
    });
    y += 58 + 20;

    // 各セクション
    const vx1 = PAD + 70, vx2 = W - PAD - 70;
    for (const s of secs) {
      g.textAlign = 'left';
      g.fillStyle = FAINT;
      g.font = `700 12px "Noto Sans JP", sans-serif`;
      g.fillText(s.title, PAD, y + 14);
      y += SEC_HEAD - 10;

      const hair = () => {
        g.strokeStyle = LINE;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(PAD, y + ROW - 0.5);
        g.lineTo(W - PAD, y + ROW - 0.5);
        g.stroke();
      };

      if (s.wide) {
        // ダブルスの4人表：左に項目、右に4人ぶんの数字
        const colW = 92;
        const cx = i => W - PAD - colW * (4 - i) + colW / 2;
        g.textAlign = 'center';
        g.fillStyle = FAINT;
        g.font = `700 11px "Noto Sans JP", sans-serif`;
        s.groups.forEach((grp, i) => g.fillText(grp.name, (cx(i * 2) + cx(i * 2 + 1)) / 2, y + 10));
        y += 22;
        g.fillStyle = INK;
        g.font = `700 13px "Noto Sans JP", sans-serif`;
        s.names.forEach((nm, i) => g.fillText(nm, cx(i), y + ROW / 2));
        hair();
        y += ROW;

        for (const row of s.rows) {
          const lab = row[0], vals = row.slice(1, -1), better = row[row.length - 1];
          const best = bestOf(vals, better);
          hair();
          g.textAlign = 'left';
          g.fillStyle = MUTE;
          g.font = `400 12.5px "Noto Sans JP", sans-serif`;
          g.fillText(lab, PAD, y + ROW / 2);
          g.textAlign = 'center';
          g.font = num(700);
          vals.forEach((v, i) => {
            g.fillStyle = best[i] ? ACCENT : INK;
            g.fillText(v, cx(i), y + ROW / 2);
          });
          y += ROW;
        }
      } else {
        for (const [lab, va, vb, better] of s.rows) {
          const w = winner(va, vb, better);
          hair();
          g.textAlign = 'center';
          g.font = num(700);
          g.fillStyle = w === 1 ? ACCENT : INK;
          g.fillText(va, vx1, y + ROW / 2);
          g.fillStyle = w === 2 ? ACCENT : INK;
          g.fillText(vb, vx2, y + ROW / 2);
          g.fillStyle = MUTE;
          g.font = `400 12.5px "Noto Sans JP", sans-serif`;
          g.fillText(lab, W / 2, y + ROW / 2);
          y += ROW;
        }
      }
      y += 14;
    }

    // 流れのグラフ
    g.textAlign = 'left';
    g.fillStyle = FAINT;
    g.font = `700 12px "Noto Sans JP", sans-serif`;
    g.fillText(`試合の流れ（上が ${na} 優勢）`, PAD, y + 14);
    y += 30;
    const gw = W - PAD * 2, gh = 190;
    g.fillStyle = CARD;
    roundRect(g, PAD, y, gw, gh, 10);
    g.fill();
    const m = momentum(points);
    const mx = Math.max(4, ...m.map(v => Math.abs(v)));
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(PAD + 10, y + gh / 2);
    g.lineTo(PAD + gw - 10, y + gh / 2);
    g.stroke();
    g.strokeStyle = ACCENT;
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

    g.fillStyle = FAINT;
    g.font = `400 11.5px "Noto Sans JP", sans-serif`;
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
