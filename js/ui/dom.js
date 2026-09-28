// Tiny helpers for building HTML strings safely and wiring events.

import { fmtMoney, fmtPct, TOTAL_BPS } from '../core/money.js';
import { icon } from './icons.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// money inside a .v span, so "Esconder valores" can blur it
export const money = (c, opts) => `<span class="v num">${esc(fmtMoney(c, opts))}</span>`;
export const pct = (bps) => `<span class="num">${esc(fmtPct(bps))}</span>`;

export function bar(value, total, { cls = '', lg = false } = {}) {
  const p = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : value > 0 ? 100 : 0;
  let state = '';
  if (!cls) {
    if (total > 0 && value > total) state = 'over';
    else if (total > 0 && value > total * 0.85) state = 'near';
  }
  return `<div class="bar ${lg ? 'lg' : ''} ${state} ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"><i style="width:${p.toFixed(1)}%"></i></div>`;
}

export const ratio = (a, b) => (b > 0 ? Math.round((a * TOTAL_BPS) / b) : 0);

export function topbar(title = '', { back = true, right = '' } = {}) {
  return `<div class="topbar">
    ${back ? `<button class="icon-btn" data-act="back" aria-label="Voltar">${icon('left')}</button>` : '<span style="width:44px"></span>'}
    <div class="title">${esc(title)}</div>
    ${right || '<span style="width:44px"></span>'}
  </div>`;
}

export function notice(html, { kind = '', ic = 'bell', act = '', data = '' } = {}) {
  const tag = act ? 'button' : 'div';
  return `<${tag} class="notice ${kind}" ${act ? `data-act="${act}"` : ''} ${data}>${icon(ic)}<div class="grow">${html}</div>${act ? icon('right', 'chev') : ''}</${tag}>`;
}

// Delegated click handling: <button data-act="name" data-id="...">
export function onAct(root, handlers) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
