// Bottom sheets, confirm dialogs and toasts.

import { esc } from './dom.js';

let current = null;

export function openSheet(html, { onClose } = {}) {
  closeSheet(true);
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(scrim, sheet);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });
  scrim.addEventListener('click', () => closeSheet());
  current = { scrim, sheet, onClose };
  return sheet;
}

export function closeSheet(instant = false) {
  if (!current) return;
  const { scrim, sheet, onClose } = current;
  current = null;
  document.body.classList.remove('sheet-open');
  if (instant) { scrim.remove(); sheet.remove(); }
  else {
    scrim.classList.remove('show');
    sheet.classList.remove('show');
    setTimeout(() => { scrim.remove(); sheet.remove(); }, 260);
  }
  onClose?.();
}

export const sheetOpen = () => !!current;

// Promise<boolean>
export function confirmSheet(title, body, { ok = 'Confirmar', cancel = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const el = openSheet(`
      <div class="stack" style="padding:6px 2px 4px">
        <h2 class="h2">${esc(title)}</h2>
        ${body ? `<div class="ink2">${body}</div>` : ''}
        <div class="stack-sm">
          <button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button>
          <button class="btn ghost" data-cancel>${esc(cancel)}</button>
        </div>
      </div>`, { onClose: () => finish(false) });
    el.querySelector('[data-ok]').onclick = () => { finish(true); closeSheet(); };
    el.querySelector('[data-cancel]').onclick = () => { finish(false); closeSheet(); };
  });
}

let toastTimer = null;
export function toast(msg, { action, onAction, ms = 4500 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  const hide = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); };
  if (action) t.querySelector('button').onclick = () => { hide(); onAction?.(); };
  toastTimer = setTimeout(hide, ms);
}
