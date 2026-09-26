// Boot, router and global actions.

import * as D from './data.js';
import * as C from './core/calc.js';
import * as S from './ui/screens.js';
import { thisMonth, today, fmtDate } from './core/dates.js';
import { fmtMoneyPlain } from './core/money.js';
import { icon } from './ui/icons.js';
import { onAct } from './ui/dom.js';
import { wireCharts } from './ui/chart.js';
import { toast, confirmSheet, closeSheet, sheetOpen } from './ui/overlay.js';
import { requestPersistence } from './store.js';

const VERSION = '1.0.1';
const view = document.getElementById('view');
const nav = document.getElementById('nav');

const state = { mes: thisMonth(), tab: 'geral', filtro: null, setup: 'intro', planoAba: 'casa', catRange: 1 };

const ctx = {
  state,
  version: VERSION,
  go: (to) => { if (location.hash === to) render(); else location.hash = to; },
  back: () => { if (state.canBack && history.length > 1) history.back(); else ctx.go('#/inicio'); },
  render: () => render(),
};

const ROUTES = {
  inicio: () => S.inicio(ctx),
  lancamentos: () => S.lancamentos(ctx),
  metas: () => S.metasScreen(ctx),
  meta: (id) => S.metaScreen(ctx, id),
  cat: (id) => S.catScreen(ctx, id),
  mais: () => S.mais(ctx),
  pendentes: () => S.pendentesScreen(ctx),
  renda: () => S.rendaScreen(ctx),
  fixos: () => S.fixosScreen(ctx),
  saldo: () => S.saldoScreen(ctx),
  plano: () => S.planoScreen(ctx),
  real: (id, params) => S.realScreen(ctx, params),
  proximos: () => S.proximosScreen(ctx),
  faturas: () => S.faturasScreen(ctx),
  lixeira: () => S.lixeiraScreen(ctx),
  ajustes: () => S.ajustesScreen(ctx),
};
const TABS = { inicio: 'inicio', lancamentos: 'lancamentos', metas: 'metas', meta: 'metas', mais: 'mais' };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '') || 'inicio';
  const [path, query] = h.split('?');
  const [name, id] = path.split('/');
  return { name, id: id ? decodeURIComponent(id) : null, params: new URLSearchParams(query || '') };
}

let lastRoute = '';
function render() {
  const s = D.settings();
  document.body.classList.toggle('ocultar', !!s.ocultar);
  let out;
  const route = parseHash();
  if (!s.iniciado) {
    out = S.welcome(ctx);
  } else {
    const fn = ROUTES[route.name] || ROUTES.inicio;
    out = fn(route.id, route.params);
  }
  const key = `${route.name}/${route.id || ''}`;
  const keepScroll = key === lastRoute;
  const y = window.scrollY;
  view.innerHTML = out.html;
  out.mount?.(view);
  wireCharts(view);
  const showNav = out.nav !== false && s.iniciado;
  nav.hidden = !showNav;
  document.body.classList.toggle('no-nav', !showNav);
  const tab = TABS[route.name] || (['cat', 'real', 'plano', 'renda', 'fixos', 'saldo', 'proximos', 'faturas', 'lixeira', 'ajustes', 'pendentes'].includes(route.name) ? 'mais' : 'inicio');
  for (const a of nav.querySelectorAll('a[data-tab]')) a.classList.toggle('on', a.dataset.tab === tab);
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastRoute = key;
}

function renderNav() {
  nav.innerHTML = `<div class="nav-inner">
    <a href="#/inicio" data-tab="inicio">${icon('home')}Início</a>
    <a href="#/lancamentos" data-tab="lancamentos">${icon('swap')}Lançamentos</a>
    <button class="fab" data-act="add" aria-label="Novo lançamento">${icon('plus')}</button>
    <a href="#/metas" data-tab="metas">${icon('target')}Metas</a>
    <a href="#/mais" data-tab="mais">${icon('dots')}Mais</a>
  </div>`;
}

// ---------------------------------------------------------------- actions

function editRecord(k, id) {
  const r = D.get(id);
  if (!r) return;
  if (r.kind === 'renda') return S.recebiSheet(ctx, { editing: r });
  S.quickAdd(ctx, { editing: r });
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function csv() {
  const ix = D.ix();
  const cm = C.catMap(ix);
  const eu = D.eu();
  const rows = [['Data', 'Tipo', 'De quem', 'Categoria', 'Valor', 'Quem pagou', 'Como pagou', 'Observação']];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const TIPO = { gasto: 'Gasto', fixa: 'Conta fixa', invest: 'Investimento', aporte: 'Meta' };
  const lancs = (ix.lanc || []).filter(l => !l.pendente && (l.escopo === 'casa' || l.escopo === eu));
  for (const l of lancs.sort((a, b) => (a.data < b.data ? -1 : 1))) {
    rows.push([fmtDate(l.data), TIPO[l.tipo] || l.tipo, l.escopo === 'casa' ? 'Casa' : D.nome(eu), cm.get(l.catId)?.nome || D.get(l.metaId)?.nome || '', fmtMoneyPlain(l.valor), l.pagoPor ? D.nome(l.pagoPor) : '', D.get(l.pagto)?.nome || '', l.obs || '']);
  }
  for (const p of (ix.parc || []).filter(p => p.escopo === 'casa' || p.escopo === eu)) {
    for (const x of C.parcelasDe(p)) rows.push([fmtDate(x.data), `Parcela ${x.i}/${x.n}`, p.escopo === 'casa' ? 'Casa' : D.nome(eu), cm.get(p.catId)?.nome || '', fmtMoneyPlain(x.valor), p.pagoPor ? D.nome(p.pagoPor) : '', D.get(p.pagto)?.nome || '', p.obs || '']);
  }
  return '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n');
}

onAct(document.body, {
  back: () => ctx.back(),
  go: (d) => ctx.go(d.to),
  add: () => S.quickAdd(ctx),
  tab: (d) => { state.tab = d.tab; if (!location.hash.startsWith('#/inicio') && location.hash) ctx.go('#/inicio'); else render(); },
  mes: (d) => { state.mes = d.mes; render(); },
  ocultar: () => D.saveSettings({ ocultar: !D.settings().ocultar }),
  cat: (d) => { state.catRange = 1; ctx.go(`#/cat/${d.id}`); },
  meta: (d) => ctx.go(`#/meta/${d.id}`),
  range: (d) => { state.catRange = Number(d.v); render(); },
  edit: (d) => editRecord(d.k, d.id),
  classificar: (d) => S.quickAdd(ctx, { editing: D.get(d.id) }),
  imprevisto: (d) => S.imprevistoSheet(ctx, d.mes),
  freela: (d) => S.freelaSheet(ctx, D.get(d.id)),
  pagar: (d) => S.pagarFixo(ctx, D.get(d.id), state.mes),
  editfixo: (d) => S.fixoForm(ctx, D.get(d.id)),
  novofixo: (d) => S.fixoForm(ctx, null, d.escopo),
  recebi: () => S.recebiSheet(ctx),
  editrenda: (d) => S.recebiSheet(ctx, { editing: D.get(d.id) }),
  acerto: () => S.acertoSheet(ctx),
  novameta: () => S.metaForm(ctx),
  editmeta: (d) => S.metaForm(ctx, D.get(d.id)),
  aportar: (d) => { const m = D.get(d.id); S.quickAdd(ctx, { escopo: m.escopo, tipo: 'aporte', metaId: m.id }); },
  editcat: (d) => { const c = D.get(d.id); S.catForm(ctx, c.escopo, c); },
  novacat: (d) => S.catForm(ctx, d.escopo),
  aba: (d) => { state.planoAba = d.v; render(); },
  fesc: (d) => { state.filtro = { ...(state.filtro || { escopo: 'todos', tipo: '', cat: '', pagto: '', quem: '' }), escopo: d.v }; render(); },
  restaurar: async (d) => { await D.restore(d.id); toast('Restaurado'); },
  fechar: async (d) => {
    const ix = D.ix();
    const f = C.fechamentoDe(ix, d.mes);
    if (f) {
      if (await confirmSheet('Reabrir o mês?', 'A divisão volta a seguir a renda base atual.', { ok: 'Reabrir' })) await D.save({ ...f, fechado: false });
      return;
    }
    const sp = C.splitDoMes(ix, d.mes);
    if (await confirmSheet('Fechar o mês?', `A divisão fica travada em ${D.nome('gabi')} ${(sp.gabi / 100).toLocaleString('pt-BR')}% e ${D.nome('yuri')} ${(sp.yuri / 100).toLocaleString('pt-BR')}%. Dá para reabrir depois.`, { ok: 'Fechar mês' })) {
      const old = (ix.fechamento || []).find(x => x.mes === d.mes);
      await D.save({ ...(old || { kind: 'fechamento', escopo: 'casa', mes: d.mes }), fechado: true, splitGabi: sp.gabi });
      toast('Mês fechado');
    }
  },
  // ajustes
  salvarnomes: async () => {
    const nomes = { gabi: document.getElementById('aj-gabi').value.trim() || 'Gabi', yuri: document.getElementById('aj-yuri').value.trim() || 'Yuri' };
    await D.saveSettings({ nomes });
    toast('Nomes salvos');
  },
  tema: (d) => { D.saveSettings({ tema: d.v }); applyTheme(); },
  novopagto: () => S.pagtoForm(ctx),
  editpagto: (d) => S.pagtoForm(ctx, D.get(d.id)),
  exemplo: async () => {
    if (await confirmSheet('Carregar dados de exemplo?', 'Três meses fictícios. Os seus dados reais continuam, e "Apagar exemplo" remove só o que for de exemplo.', { ok: 'Carregar' })) {
      await S.loadSampleData();
      toast('Exemplo carregado');
    }
  },
  apagarexemplo: async () => {
    if (await confirmSheet('Apagar dados de exemplo?', 'Remove só o que foi criado pelo exemplo.', { ok: 'Apagar exemplo', danger: true })) {
      const n = await D.clearSample();
      toast(`${n} registros de exemplo apagados`);
    }
  },
  backup: () => download(`gabi-e-yuri-backup-${today()}.json`, JSON.stringify(D.exportBackup(), null, 1), 'application/json'),
  csv: () => download(`gabi-e-yuri-${today()}.csv`, csv(), 'text/csv;charset=utf-8'),
  apagartudo: async () => {
    if (await confirmSheet('Apagar tudo deste celular?', 'Baixe um backup antes. Isso não pode ser desfeito.', { ok: 'Apagar tudo', danger: true })) {
      await D.resetAll();
      state.setup = 'intro';
      ctx.go('#/inicio');
    }
  },
  // setup
  setup: (d) => { state.setup = d.v; render(); },
  souEu: async (d) => { await D.saveSettings({ eu: d.v }); await D.setupDefaults(d.v); state.setup = 'exemplo'; render(); },
  comecar: async (d) => {
    if (d.v === 'exemplo') await S.loadSampleData();
    await D.saveSettings({ iniciado: true });
    requestPersistence();
    ctx.go('#/inicio');
  },
});

window.addEventListener('hashchange', () => { closeSheet(true); state.canBack = true; render(); });

function applyTheme() {
  const t = D.settings().tema || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------------------------------------------------------------- service worker + updates

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const ask = (w) => toast('Nova versão disponível', { action: 'Atualizar', ms: 15000, onAction: () => w.postMessage('skipWaiting') });
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

// ---------------------------------------------------------------- boot

(async function boot() {
  try {
    await D.load();
  } catch (e) {
    view.innerHTML = '<div class="empty">Não consegui abrir os dados deste celular. Feche e abra o app de novo.</div>';
    return;
  }
  if (D.settings().ocultarPadrao) await D.saveSettings({ ocultar: true });
  applyTheme();
  renderNav();
  D.subscribe(() => { if (!sheetOpen()) render(); else pendingRender = true; });
  render();
  registerSW();
})();

// re-render after a sheet closes if data changed while it was open
let pendingRender = false;
const obs = new MutationObserver(() => { if (pendingRender && !sheetOpen()) { pendingRender = false; render(); } });
obs.observe(document.body, { childList: true });
