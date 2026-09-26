// All the money math, as pure functions over a list of records.
// No DOM, no storage: everything here runs in node tests too.
//
// Record kinds (see DATA.md):
//   cat, lanc, parc, renda, base, plano, fixo, meta, acerto, remanej,
//   aporteExtra, fechamento, pagto
// Every record has: id, kind, escopo ('casa' | 'gabi' | 'yuri'), editadoEm,
// and excluidoEm when it is in the Lixeira (ignored here).

import { TOTAL_BPS, applyBps, allocate, installments } from './money.js';
import { monthOf, addMonths, dateIn, dayOf } from './dates.js';

export const PESSOAS = ['gabi', 'yuri'];
export const outra = (p) => (p === 'gabi' ? 'yuri' : 'gabi');

export const DEFAULT_PLANO_CASA = {
  valorCasa: 0,
  pcts: {},
  investimento: 0,
  freelaGuardar: 7000, // 70% of every freela is saved
  freelaPessoal: 5000, // of the saved part, 50% goes to the person, 50% to the house
  limiteCasa: 7000,    // warn when the house needs more than 70% of both bases
  limiteParcelas: 2000, // warn when installments take more than 20% of a month's Livre
};
export const DEFAULT_PLANO_PESSOAL = { pcts: {}, investimento: 0 };

// ---------------------------------------------------------------- indexing

export function index(recs) {
  const ix = { all: [], byId: new Map() };
  for (const r of recs) {
    if (!r || r.excluidoEm) continue;
    ix.all.push(r);
    ix.byId.set(r.id, r);
    (ix[r.kind] ||= []).push(r);
  }
  return ix;
}

const list = (ix, kind) => ix[kind] || [];
const inScope = (escopo) => (r) => r.escopo === escopo;

// the record with the greatest .mes <= mes; before the first one, the first one
function latestFor(recs, mes) {
  let best = null;
  let first = null;
  for (const r of recs) {
    if (!first || r.mes < first.mes) first = r;
    if (r.mes <= mes && (!best || r.mes > best.mes)) best = r;
  }
  return best || first;
}

export function catMap(ix) {
  const m = new Map();
  for (const c of list(ix, 'cat')) m.set(c.id, c);
  return m;
}

export function catsOf(ix, escopo, grupo) {
  return list(ix, 'cat')
    .filter(c => c.escopo === escopo && (!grupo || c.grupo === grupo))
    .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || a.nome.localeCompare(b.nome));
}

export function poolCat(ix, escopo, papel) {
  return list(ix, 'cat').find(c => c.escopo === escopo && c.papel === papel) || null;
}

// ---------------------------------------------------------------- income & split

export function baseDe(ix, pessoa, mes) {
  const r = latestFor(list(ix, 'base').filter(b => b.pessoa === pessoa), mes);
  return r ? r.valor : 0;
}

export function rendasDoMes(ix, pessoa, mes) {
  const items = list(ix, 'renda').filter(r => r.pessoa === pessoa && monthOf(r.data) === mes);
  const base = items.filter(r => r.tipo !== 'freela').reduce((a, r) => a + r.valor, 0);
  const freela = items.filter(r => r.tipo === 'freela').reduce((a, r) => a + r.valor, 0);
  const curtir = items.filter(r => r.tipo === 'freela' && r.separado).reduce((a, r) => a + (r.curtir || 0), 0);
  const pendentes = items.filter(r => r.tipo === 'freela' && !r.separado);
  return { items, base, freela, curtir, pendentes, total: base + freela };
}

export function fechamentoDe(ix, mes) {
  return list(ix, 'fechamento').find(f => f.mes === mes && f.fechado) || null;
}

// Joint items are split by each person's Renda base that month.
// Returns basis points: { gabi, yuri } adding up to 10000.
export function splitDoMes(ix, mes) {
  const f = fechamentoDe(ix, mes);
  if (f && Number.isInteger(f.splitGabi)) return { gabi: f.splitGabi, yuri: TOTAL_BPS - f.splitGabi, fechado: true };
  const g = baseDe(ix, 'gabi', mes);
  const y = baseDe(ix, 'yuri', mes);
  if (g + y <= 0) return { gabi: 5000, yuri: 5000, fechado: false, semRenda: true };
  const gabi = Math.round((g * TOTAL_BPS) / (g + y));
  return { gabi, yuri: TOTAL_BPS - gabi, fechado: false };
}

export function shareOf(valor, split, pessoa) {
  const g = applyBps(valor, split.gabi);
  return pessoa === 'gabi' ? g : valor - g;
}

// ---------------------------------------------------------------- plans

export function planoDe(ix, escopo, mes) {
  const r = latestFor(list(ix, 'plano').filter(inScope(escopo)), mes);
  const def = escopo === 'casa' ? DEFAULT_PLANO_CASA : DEFAULT_PLANO_PESSOAL;
  return { ...def, ...(r || {}), pcts: { ...(r?.pcts || {}) } };
}

// Freela: 70% guardar (half mine, half the house), 30% curtir, by default.
export function separarFreela(valor, plano) {
  const guardar = applyBps(valor, plano.freelaGuardar ?? DEFAULT_PLANO_CASA.freelaGuardar);
  const pessoal = applyBps(guardar, plano.freelaPessoal ?? DEFAULT_PLANO_CASA.freelaPessoal);
  return { guardar, pessoal, conjunto: guardar - pessoal, curtir: valor - guardar };
}

// ---------------------------------------------------------------- entries

export function lancsDoMes(ix, escopo, mes) {
  return list(ix, 'lanc').filter(l => l.escopo === escopo && !l.pendente && monthOf(l.data) === mes);
}

export function pendentes(ix, escopo) {
  return list(ix, 'lanc').filter(l => l.escopo === escopo && l.pendente);
}

// Every installment of a parceled purchase, with the month it counts in.
export function parcelasDe(p) {
  const amounts = installments(p.valorTotal, p.n);
  const start = monthOf(p.data);
  return amounts.map((valor, i) => {
    let mes = addMonths(start, i);
    if (p.quitadoMes && mes > p.quitadoMes) mes = p.quitadoMes;
    return {
      parcId: p.id, i: i + 1, n: p.n, valor, mes,
      data: dateIn(addMonths(start, i), dayOf(p.data)),
      catId: p.catId, pagoPor: p.pagoPor, pagto: p.pagto, obs: p.obs, escopo: p.escopo,
    };
  });
}

export function parcelasDoMes(ix, escopo, mes) {
  const itens = list(ix, 'parc').filter(inScope(escopo)).flatMap(parcelasDe).filter(x => x.mes === mes);
  return { itens, total: itens.reduce((a, x) => a + x.valor, 0) };
}

function fixoAtivo(f, mes) {
  if (f.arquivado) return false;
  if (f.desde && mes < f.desde) return false;
  if (f.ate && mes > f.ate) return false;
  return true;
}

// Fixed costs of a month: the real amount once a bill is entered, else the
// expected one. Yearly costs (IPVA, seguro) are spread as a monthly provisão.
export function fixosDoMes(ix, escopo, mes) {
  const lancs = lancsDoMes(ix, escopo, mes).filter(l => l.tipo === 'fixa');
  const fixos = list(ix, 'fixo').filter(f => f.escopo === escopo && fixoAtivo(f, mes));
  const ids = new Set(fixos.map(f => f.id));
  const itens = fixos.map(f => {
    const pagos = lancs.filter(l => l.fixoId === f.id);
    const real = pagos.length ? pagos.reduce((a, l) => a + l.valor, 0) : null;
    const anual = !!f.anual;
    const venceEsteMes = anual ? Number(mes.slice(5, 7)) === (f.mesVenc || 1) : true;
    return {
      fixo: f, anual, venceEsteMes, previsto: f.valorPrevisto || 0, real, pago: real != null,
      valor: real != null ? real : (f.valorPrevisto || 0),
      provisao: anual ? Math.round((f.valorPrevisto || 0) / 12) : 0,
      lancs: pagos,
    };
  });
  const avulsos = lancs.filter(l => !l.fixoId || !ids.has(l.fixoId));
  const mensal = itens.filter(i => !i.anual).reduce((a, i) => a + i.valor, 0);
  const provisao = itens.reduce((a, i) => a + i.provisao, 0);
  const avulsoTotal = avulsos.reduce((a, l) => a + l.valor, 0);
  return { itens, avulsos, mensal: mensal + avulsoTotal, provisao, total: mensal + avulsoTotal + provisao };
}

function committed(ix, escopo, mes, plano) {
  const lancs = lancsDoMes(ix, escopo, mes);
  const invReal = lancs.filter(l => l.tipo === 'invest' && !l.voluntario).reduce((a, l) => a + l.valor, 0);
  const aporteReal = lancs.filter(l => l.tipo === 'aporte' && !l.voluntario).reduce((a, l) => a + l.valor, 0);
  const metas = list(ix, 'meta').filter(m => m.escopo === escopo && !m.arquivada && (!m.desde || m.desde <= mes));
  const metasPlan = metas.reduce((a, m) => a + (m.aporteMensal || 0), 0);
  const invPlan = plano.investimento || 0;
  return {
    invest: Math.max(invPlan, invReal), investPlan: invPlan, investReal: invReal,
    metas: Math.max(metasPlan, aporteReal), metasPlan, metasReal: aporteReal,
  };
}

export function aportesExtrasDoMes(ix, mes) {
  const items = list(ix, 'aporteExtra').filter(a => a.mes === mes);
  const out = { items, gabi: 0, yuri: 0, total: 0 };
  for (const a of items) { out[a.pessoa] += a.valor; out.total += a.valor; }
  return out;
}

function remanejDoMes(ix, escopo, mes) {
  return list(ix, 'remanej').filter(r => r.escopo === escopo && r.mes === mes);
}

// Category budgets from the Livre and the plan percentages, then that
// month's remanejamentos. Imprevisto categories all draw from one pool.
function budgets(ix, escopo, mes, livre, plano, paraPool = 0) {
  const cats = catsOf(ix, escopo, 'variavel');
  const cm = catMap(ix);
  const pool = poolCat(ix, escopo, 'imprevistos');
  const alloc = allocate(Math.max(0, livre), cats.map(c => plano.pcts[c.id] || 0));
  const budget = new Map(cats.map((c, i) => [c.id, alloc[i]]));
  const moved = new Map();
  // Aportes extras exist to cover imprevistos, so they go straight to the pool
  if (pool && paraPool) moved.set(pool.id, paraPool);
  for (const r of remanejDoMes(ix, escopo, mes)) {
    moved.set(r.de, (moved.get(r.de) || 0) - r.valor);
    moved.set(r.para, (moved.get(r.para) || 0) + r.valor);
  }
  const keyOf = (catId) => {
    const c = cm.get(catId);
    if (c && c.grupo === 'imprevisto' && pool) return pool.id;
    return catId;
  };
  const spent = new Map();
  const lancs = lancsDoMes(ix, escopo, mes).filter(l => l.tipo === 'gasto');
  for (const l of lancs) spent.set(keyOf(l.catId), (spent.get(keyOf(l.catId)) || 0) + l.valor);
  const spentTotal = lancs.reduce((a, l) => a + l.valor, 0);
  const rows = cats.map(c => {
    const planned = budget.get(c.id) || 0;
    const mv = moved.get(c.id) || 0;
    const b = planned + mv;
    const s = spent.get(c.id) || 0;
    return { cat: c, pct: plano.pcts[c.id] || 0, planejado: planned, remanejado: mv, orcamento: b, gasto: s, resta: b - s };
  });
  // spending in categories that have no budget row (fixed categories typed as gasto, deleted categories)
  const semLinha = [...spent.entries()].filter(([k]) => !budget.has(k)).reduce((a, [, v]) => a + v, 0);
  const poolRow = pool ? rows.find(r => r.cat.id === pool.id) : null;
  const overflow = poolRow ? Math.max(0, poolRow.gasto - poolRow.orcamento) : 0;
  return { rows, spentTotal, semLinha, overflow, pool };
}

export function planoCasa(ix, mes) {
  const plano = planoDe(ix, 'casa', mes);
  const split = splitDoMes(ix, mes);
  const bases = { gabi: baseDe(ix, 'gabi', mes), yuri: baseDe(ix, 'yuri', mes) };
  const extras = aportesExtrasDoMes(ix, mes);
  const valorCasa = plano.valorCasa || 0;
  const contribGabi = applyBps(valorCasa, split.gabi);
  const contrib = { gabi: contribGabi, yuri: valorCasa - contribGabi };
  const fixos = fixosDoMes(ix, 'casa', mes);
  const com = committed(ix, 'casa', mes, plano);
  const parcelas = parcelasDoMes(ix, 'casa', mes);
  const livre = valorCasa - fixos.total - com.invest - com.metas - parcelas.total;
  const b = budgets(ix, 'casa', mes, livre, plano, extras.total);
  const avisos = [];
  const somaBases = bases.gabi + bases.yuri;
  if (somaBases > 0 && valorCasa > applyBps(somaBases, plano.limiteCasa)) avisos.push({ tipo: 'limiteCasa', valor: valorCasa, limite: applyBps(somaBases, plano.limiteCasa) });
  if (valorCasa > 0 && valorCasa + extras.total < fixos.total) avisos.push({ tipo: 'fixosDescobertos', falta: fixos.total - valorCasa - extras.total });
  if (livre < 0) avisos.push({ tipo: 'livreNegativo', valor: livre });
  return {
    escopo: 'casa', mes, plano, split, bases, contrib, extras, valorCasa, fixos, ...com, parcelas, livre,
    ...b, aindaDa: livre + extras.total - b.spentTotal, avisos,
  };
}

export function planoPessoal(ix, pessoa, mes, casa = planoCasa(ix, mes)) {
  const plano = planoDe(ix, pessoa, mes);
  const base = baseDe(ix, pessoa, mes);
  const rendas = rendasDoMes(ix, pessoa, mes);
  const contrib = casa.contrib[pessoa];
  const aporteExtra = casa.extras[pessoa];
  const fixos = fixosDoMes(ix, pessoa, mes);
  const com = committed(ix, pessoa, mes, plano);
  const parcelas = parcelasDoMes(ix, pessoa, mes);
  const curtir = rendas.curtir;
  const livre = base - contrib - aporteExtra - fixos.total - com.invest - com.metas - parcelas.total + curtir;
  const b = budgets(ix, pessoa, mes, livre, plano);
  const avisos = [];
  if (livre < 0) avisos.push({ tipo: 'livreNegativo', valor: livre });
  if (rendas.base > 0 && rendas.base < base) avisos.push({ tipo: 'rendaAbaixo', falta: base - rendas.base });
  return {
    escopo: pessoa, mes, plano, base, rendas, contrib, aporteExtra, fixos, ...com, parcelas, curtir, livre,
    ...b, aindaDa: livre - b.spentTotal, avisos,
  };
}

// ---------------------------------------------------------------- imprevistos

// When the Imprevistos budget runs out: take from the "extra" categories first
// (proportionally to what is left in each), then from Reserva, then ask both
// of us for an Aporte extra split by the month's split.
export function sugerirImprevisto(ix, plano) {
  const falta = plano.overflow;
  if (falta <= 0) return null;
  const cm = catMap(ix);
  const doadores = plano.rows.filter(r => {
    const c = cm.get(r.cat.id);
    return c && c.extra && !c.papel && r.resta > 0;
  });
  const disponivel = doadores.reduce((a, r) => a + r.resta, 0);
  const take1 = Math.min(falta, disponivel);
  const parts = allocate(take1, doadores.map(r => r.resta));
  const remanejes = doadores.map((r, i) => ({ de: r.cat.id, nome: r.cat.nome, valor: parts[i] })).filter(x => x.valor > 0);
  let resto = falta - take1;
  const reserva = plano.rows.find(r => r.cat.papel === 'reserva');
  if (resto > 0 && reserva && reserva.resta > 0) {
    const v = Math.min(resto, reserva.resta);
    remanejes.push({ de: reserva.cat.id, nome: reserva.cat.nome, valor: v });
    resto -= v;
  }
  let aporte = null;
  if (resto > 0 && plano.escopo === 'casa') {
    const g = applyBps(resto, plano.split.gabi);
    aporte = { gabi: g, yuri: resto - g, total: resto };
  }
  return { falta, para: plano.pool?.id, remanejes, aporte, negativo: plano.escopo === 'casa' ? 0 : resto };
}

// ---------------------------------------------------------------- balance

// Positive: Yuri owes Gabi. Negative: Gabi owes Yuri.
export function saldo(ix, ateMes) {
  let net = 0;
  const historico = [];
  const push = (data, desc, delta) => { net += delta; historico.push({ data, desc, delta }); };
  for (const l of list(ix, 'lanc')) {
    if (l.escopo !== 'casa' || l.pendente || l.voluntario) continue;
    const mes = monthOf(l.data);
    if (ateMes && mes > ateMes) continue;
    const sp = splitDoMes(ix, mes);
    const paid = l.pagoPor === 'gabi' ? l.valor : 0;
    push(l.data, l, paid - shareOf(l.valor, sp, 'gabi'));
  }
  for (const p of list(ix, 'parc').filter(inScope('casa'))) {
    for (const x of parcelasDe(p)) {
      if (ateMes && x.mes > ateMes) continue;
      const sp = splitDoMes(ix, x.mes);
      const paid = x.pagoPor === 'gabi' ? x.valor : 0;
      push(x.data, x, paid - shareOf(x.valor, sp, 'gabi'));
    }
  }
  for (const a of list(ix, 'acerto')) {
    if (ateMes && monthOf(a.data) > ateMes) continue;
    push(a.data, a, a.de === 'gabi' ? a.valor : -a.valor);
  }
  historico.sort((a, b) => (a.data < b.data ? 1 : -1));
  return { net, deve: net > 0 ? 'yuri' : net < 0 ? 'gabi' : null, recebe: net > 0 ? 'gabi' : net < 0 ? 'yuri' : null, valor: Math.abs(net), historico };
}

// ---------------------------------------------------------------- indicators

export function guardadoExtras(ix, escopo, mes) {
  const cm = catMap(ix);
  const lancs = lancsDoMes(ix, escopo, mes);
  const guardado = lancs.filter(l => l.tipo === 'invest' || l.tipo === 'aporte').reduce((a, l) => a + l.valor, 0);
  const isExtra = (catId) => { const c = cm.get(catId); return !!(c && c.extra); };
  const porCat = new Map();
  let extras = 0;
  for (const l of lancs.filter(l => l.tipo === 'gasto' && isExtra(l.catId))) {
    extras += l.valor;
    porCat.set(l.catId, (porCat.get(l.catId) || 0) + l.valor);
  }
  for (const x of parcelasDoMes(ix, escopo, mes).itens.filter(x => isExtra(x.catId))) {
    extras += x.valor;
    porCat.set(x.catId, (porCat.get(x.catId) || 0) + x.valor);
  }
  const maior = [...porCat.entries()].sort((a, b) => b[1] - a[1])[0];
  return { guardado, extras, ganhando: guardado >= extras && guardado > 0, maiorExtra: maior ? { cat: cm.get(maior[0]), valor: maior[1] } : null };
}

export function gastoPorCategoria(ix, escopo, mes) {
  const map = new Map();
  for (const l of lancsDoMes(ix, escopo, mes)) {
    if (l.tipo !== 'gasto' && l.tipo !== 'fixa') continue;
    map.set(l.catId, (map.get(l.catId) || 0) + l.valor);
  }
  for (const x of parcelasDoMes(ix, escopo, mes).itens) map.set(x.catId, (map.get(x.catId) || 0) + x.valor);
  return map;
}

export function metaProgresso(ix, meta, hojeMes) {
  const aportes = list(ix, 'lanc').filter(l => l.tipo === 'aporte' && l.metaId === meta.id && !l.pendente);
  const guardado = aportes.reduce((a, l) => a + l.valor, 0);
  const falta = Math.max(0, (meta.alvo || 0) - guardado);
  let porMes = null;
  if (meta.prazo && falta > 0 && hojeMes) {
    const [ya, ma] = hojeMes.split('-').map(Number);
    const [yb, mb] = meta.prazo.split('-').map(Number);
    const meses = Math.max(1, (yb * 12 + mb) - (ya * 12 + ma) + 1);
    porMes = Math.ceil(falta / meses);
  }
  const pct = meta.alvo ? Math.min(TOTAL_BPS, Math.round((guardado * TOTAL_BPS) / meta.alvo)) : 0;
  const porMesHist = new Map();
  for (const l of aportes) porMesHist.set(monthOf(l.data), (porMesHist.get(monthOf(l.data)) || 0) + l.valor);
  return { guardado, falta, pct, porMes, porMesHist, aportes };
}

// How much of each coming month is already committed (installments, fixed costs).
export function proximosMeses(ix, eu, desde, n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const mes = addMonths(desde, i);
    const casa = planoCasa(ix, mes);
    const meu = planoPessoal(ix, eu, mes, casa);
    const pc = casa.parcelas.total;
    const pm = meu.parcelas.total;
    out.push({
      mes,
      casa: { parcelas: pc, fixos: casa.fixos.total, livre: casa.livre, alerta: casa.livre > 0 && pc > applyBps(casa.livre + pc, casa.plano.limiteParcelas) },
      meu: { parcelas: pm, fixos: meu.fixos.total, livre: meu.livre, alerta: meu.livre > 0 && pm > applyBps(meu.livre + pm, casa.plano.limiteParcelas) },
    });
  }
  return out;
}

// Which card bill a purchase date falls into.
export function faturaDe(date, fechamento, vencimento) {
  const m = monthOf(date);
  const closeMonth = dayOf(date) <= fechamento ? m : addMonths(m, 1);
  const dueMonth = vencimento > fechamento ? closeMonth : addMonths(closeMonth, 1);
  return dateIn(dueMonth, vencimento);
}

// Money that must still be in the bank for open card bills.
export function faturasAbertas(ix, hoje) {
  const cartoes = list(ix, 'pagto').filter(p => p.tipo === 'credito' && p.fechamento && p.vencimento);
  const out = [];
  for (const c of cartoes) {
    const bills = new Map();
    const add = (data, valor) => {
      const due = faturaDe(data, c.fechamento, c.vencimento);
      if (due < hoje) return;
      bills.set(due, (bills.get(due) || 0) + valor);
    };
    for (const l of list(ix, 'lanc')) if (l.pagto === c.id && !l.pendente) add(l.data, l.valor);
    for (const p of list(ix, 'parc').filter(p => p.pagto === c.id)) for (const x of parcelasDe(p)) add(x.data, x.valor);
    for (const [vence, total] of [...bills.entries()].sort()) out.push({ cartao: c, vence, total });
  }
  return out.sort((a, b) => (a.vence < b.vence ? -1 : 1));
}

// Months with any real entries, to know when numbers stop being estimates.
export function mesesComDados(ix, escopo) {
  return new Set(list(ix, 'lanc').filter(l => l.escopo === escopo && !l.pendente && !l.exemplo).map(l => monthOf(l.data))).size;
}

// Planejado x Real: average spending of the previous months per category.
export function planejadoReal(ix, escopo, mes, meses = 3) {
  const atual = escopo === 'casa' ? planoCasa(ix, mes) : planoPessoal(ix, escopo, mes);
  const prev = [];
  for (let i = 1; i <= meses; i++) prev.push(addMonths(mes, -i));
  const comDados = prev.filter(m => lancsDoMes(ix, escopo, m).length > 0);
  const rows = atual.rows.map(r => {
    if (!comDados.length) return { ...r, media: null };
    let soma = 0;
    for (const m of comDados) {
      const p = escopo === 'casa' ? planoCasa(ix, m) : planoPessoal(ix, escopo, m);
      soma += p.rows.find(x => x.cat.id === r.cat.id)?.gasto || 0;
    }
    const media = Math.round(soma / comDados.length);
    const sugestaoPct = atual.livre > 0 ? Math.round((media * TOTAL_BPS) / atual.livre) : null;
    return { ...r, media, sugestaoPct };
  });
  return { rows, meses: comDados.length, livre: atual.livre };
}
