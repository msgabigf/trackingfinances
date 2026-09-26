// Small single-series bar charts in SVG with a tap/hover tooltip.
// One hue (the palette blue), the highlighted bar in the primary blue,
// an optional dashed line (average or target).

import { esc } from './dom.js';

let seq = 0;

export function barChart(points, { height = 150, line = null, lineLabel = '', fmt = String, hl = -1 } = {}) {
  const id = `ch${++seq}`;
  const W = 320;
  const H = height;
  const top = 18;
  const bottom = 22;
  const max = Math.max(1, line || 0, ...points.map(p => p.value));
  const n = Math.max(1, points.length);
  const gap = n > 8 ? 6 : 10;
  const bw = Math.max(6, Math.min(34, (W - gap * (n - 1)) / n));
  const totalW = bw * n + gap * (n - 1);
  const x0 = (W - totalW) / 2;
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const bars = points.map((p, i) => {
    const x = x0 + i * (bw + gap);
    const yy = y(Math.max(0, p.value));
    const h = Math.max(p.value > 0 ? 2 : 0, H - bottom - yy);
    const r = Math.min(4, bw / 2, h);
    // rounded top, square bottom anchored to the baseline
    const path = h > 0
      ? `M${x},${H - bottom} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - bottom} Z`
      : '';
    return `<path class="bar-rect ${i === hl ? 'hl' : ''}" d="${path}"/>
      <rect class="hit" x="${x - gap / 2}" y="${top}" width="${bw + gap}" height="${H - top}" data-i="${i}"/>
      <text class="axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`;
  }).join('');
  const ln = line != null
    ? `<line class="avg" x1="${x0 - 4}" x2="${x0 + totalW + 4}" y1="${y(line)}" y2="${y(line)}"/>
       <text class="avg-l" x="${x0 + totalW + 4}" y="${y(line) - 5}" text-anchor="end">${esc(lineLabel)}</text>`
    : '';
  const tips = JSON.stringify(points.map(p => `${p.label}: ${fmt(p.value)}`));
  return `<div class="chart" id="${id}" data-tips='${esc(tips)}'>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(points.map(p => `${p.label} ${fmt(p.value)}`).join(', '))}">
      <line class="base" x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}"/>
      ${bars}${ln}
    </svg>
  </div>`;
}

// Tooltips for every chart inside root (tap on phones, hover elsewhere).
export function wireCharts(root) {
  for (const el of root.querySelectorAll('.chart[data-tips]')) {
    const tips = JSON.parse(el.dataset.tips);
    let tip = null;
    const show = (e) => {
      const hit = e.target.closest('.hit');
      if (!hit) return hide();
      const i = Number(hit.dataset.i);
      if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; el.appendChild(tip); }
      tip.textContent = document.body.classList.contains('ocultar') ? tips[i].replace(/R\$.*/, 'R$ •••') : tips[i];
      const box = el.getBoundingClientRect();
      const hb = hit.getBoundingClientRect();
      tip.style.left = `${Math.min(box.width - 50, Math.max(50, hb.left - box.left + hb.width / 2))}px`;
      tip.style.top = '10px';
    };
    const hide = () => { tip?.remove(); tip = null; };
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') show(e); });
    el.addEventListener('pointerleave', hide);
  }
}
