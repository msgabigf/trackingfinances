import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, fmtMoney, allocate, installments, applyBps, parsePct } from '../js/core/money.js';
import { addMonths, dateIn, today, fmtDate, parseDate } from '../js/core/dates.js';
import * as C from '../js/core/calc.js';

let n = 0;
const id = () => `t${++n}`;
const rec = (kind, escopo, fields) => ({ id: id(), kind, escopo, ...fields });

// A small household used by most tests.
function casa() {
  const cats = {
    mercado: rec('cat', 'casa', { nome: 'Mercado', grupo: 'variavel', ordem: 1 }),
    delivery: rec('cat', 'casa', { nome: 'Delivery', grupo: 'variavel', extra: true, ordem: 2 }),
    lazer: rec('cat', 'casa', { nome: 'Lazer', grupo: 'variavel', extra: true, ordem: 3 }),
    imprev: rec('cat', 'casa', { nome: 'Imprevistos', grupo: 'variavel', papel: 'imprevistos', ordem: 4 }),
    reserva: rec('cat', 'casa', { nome: 'Reserva', grupo: 'variavel', papel: 'reserva', ordem: 5 }),
    farmacia: rec('cat', 'casa', { nome: 'Farmácia', grupo: 'imprevisto', ordem: 6 }),
    luz: rec('cat', 'casa', { nome: 'Luz', grupo: 'fixo', ordem: 7 }),
    salao: rec('cat', 'gabi', { nome: 'Salão', grupo: 'variavel', extra: true, ordem: 1 }),
    reservaG: rec('cat', 'gabi', { nome: 'Reserva', grupo: 'variavel', papel: 'reserva', ordem: 2 }),
  };
  const luz = rec('fixo', 'casa', { nome: 'Luz', catId: cats.luz.id, valorPrevisto: 20000 });
  const cond = rec('fixo', 'casa', { nome: 'Condomínio', catId: cats.luz.id, valorPrevisto: 80000 });
  const ipva = rec('fixo', 'casa', { nome: 'IPVA', catId: cats.luz.id, valorPrevisto: 120000, anual: true, mesVenc: 3 });
  const recs = [
    ...Object.values(cats), luz, cond, ipva,
    rec('base', 'casa', { pessoa: 'gabi', mes: '2026-01', valor: 600000 }),
    rec('base', 'casa', { pessoa: 'yuri', mes: '2026-01', valor: 400000 }),
    rec('plano', 'casa', {
      mes: '2026-01', valorCasa: 500000, investimento: 50000,
      pcts: { [cats.mercado.id]: 4000, [cats.delivery.id]: 2000, [cats.lazer.id]: 2000, [cats.imprev.id]: 1000, [cats.reserva.id]: 1000 },
    }),
    rec('plano', 'gabi', { mes: '2026-01', pcts: { [cats.salao.id]: 6000, [cats.reservaG.id]: 4000 } }),
  ];
  return { cats, luz, cond, ipva, recs };
}

test('parseMoney understands pt-BR and en inputs', () => {
  assert.equal(parseMoney('12,50'), 1250);
  assert.equal(parseMoney('12.50'), 1250);
  assert.equal(parseMoney('12,5'), 1250);
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('1,234.56'), 123456);
  assert.equal(parseMoney('1.234'), 123400);
  assert.equal(parseMoney('R$ 30'), 3000);
  assert.equal(parseMoney('0,01'), 1);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('1,234'), null);
  assert.equal(parseMoney('12,345'), null);
});

test('fmtMoney formats R$ 1.234,56', () => {
  assert.equal(fmtMoney(123456).replace(/ /g, ' '), 'R$ 1.234,56');
  assert.equal(fmtMoney(-500).replace(/ /g, ' '), '-R$ 5,00');
  assert.equal(parsePct('12,5'), 1250);
});

test('allocate always adds up exactly', () => {
  const parts = allocate(100, [1, 1, 1]);
  assert.deepEqual(parts, [34, 33, 33]);
  assert.equal(allocate(99999, [4000, 2000, 2000, 1000, 1000]).reduce((a, b) => a + b), 99999);
  assert.deepEqual(allocate(0, [1, 2]), [0, 0]);
  assert.deepEqual(allocate(10, [0, 0]), [0, 0]);
  assert.deepEqual(allocate(10, [0, 5]), [0, 10]);
});

test('installments: first absorbs rounding', () => {
  assert.deepEqual(installments(100000, 3), [33334, 33333, 33333]);
  assert.equal(installments(99999, 7).reduce((a, b) => a + b), 99999);
});

test('dates', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(dateIn('2026-02', 31), '2026-02-28');
  assert.equal(fmtDate('2026-09-25'), '25/09/2026');
  assert.equal(parseDate('5/9/2026'), '2026-09-05');
  // 01:00 UTC on Sep 26 is still Sep 25 in São Paulo
  assert.equal(today(new Date('2026-09-26T01:00:00Z')), '2026-09-25');
});

test('split follows Renda base, month by month', () => {
  const { recs } = casa();
  recs.push(rec('base', 'casa', { pessoa: 'yuri', mes: '2026-03', valor: 600000 }));
  const ix = C.index(recs);
  assert.deepEqual(C.splitDoMes(ix, '2026-01'), { gabi: 6000, yuri: 4000, fechado: false });
  assert.deepEqual(C.splitDoMes(ix, '2026-02'), { gabi: 6000, yuri: 4000, fechado: false });
  assert.deepEqual(C.splitDoMes(ix, '2026-03'), { gabi: 5000, yuri: 5000, fechado: false });
  // a closed month keeps its split even if bases change later
  recs.push(rec('fechamento', 'casa', { mes: '2026-03', fechado: true, splitGabi: 5000 }));
  recs.push(rec('base', 'casa', { pessoa: 'gabi', mes: '2026-03', valor: 900000 }));
  assert.equal(C.splitDoMes(C.index(recs), '2026-03').gabi, 5000);
});

test('freelas never change the split', () => {
  const { recs } = casa();
  recs.push(rec('renda', 'casa', { pessoa: 'yuri', data: '2026-01-10', valor: 500000, tipo: 'freela' }));
  assert.equal(C.splitDoMes(C.index(recs), '2026-01').gabi, 6000);
});

test('plano casa: contributions, fixed, provisão, livre and budgets', () => {
  const { recs, cats } = casa();
  const p = C.planoCasa(C.index(recs), '2026-01');
  assert.deepEqual(p.contrib, { gabi: 300000, yuri: 200000 });
  // fixed: luz 200 + cond 800 = 1000; IPVA 1200/12 = 100 provisão
  assert.equal(p.fixos.mensal, 100000);
  assert.equal(p.fixos.provisao, 10000);
  // livre = 5000 - 1000 - 100 - 500 invest = 3400
  assert.equal(p.livre, 340000);
  const mercado = p.rows.find(r => r.cat.id === cats.mercado.id);
  assert.equal(mercado.orcamento, 136000);
  assert.equal(p.rows.reduce((a, r) => a + r.orcamento, 0), p.livre);
});

test('a higher bill recalculates the budgets', () => {
  const { recs, cats, luz } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'fixa', fixoId: luz.id, catId: cats.luz.id, valor: 28000, data: '2026-01-12', pagoPor: 'gabi' }));
  const p = C.planoCasa(C.index(recs), '2026-01');
  assert.equal(p.livre, 340000 - 8000);
  assert.equal(p.rows.find(r => r.cat.id === cats.mercado.id).orcamento, 132800);
  assert.equal(p.fixos.itens.find(i => i.fixo.id === luz.id).pago, true);
});

test('annual payments are covered by the provisão, not charged again', () => {
  const { recs, cats, ipva } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'fixa', fixoId: ipva.id, catId: cats.luz.id, valor: 125000, data: '2026-03-05', pagoPor: 'yuri' }));
  const p = C.planoCasa(C.index(recs), '2026-03');
  assert.equal(p.fixos.total, 110000);
});

test('installments commit future months', () => {
  const { recs, cats } = casa();
  recs.push(rec('parc', 'casa', { valorTotal: 90000, n: 3, data: '2026-01-20', catId: cats.lazer.id, pagoPor: 'gabi' }));
  const ix = C.index(recs);
  assert.equal(C.planoCasa(ix, '2026-01').parcelas.total, 30000);
  assert.equal(C.planoCasa(ix, '2026-03').parcelas.total, 30000);
  assert.equal(C.planoCasa(ix, '2026-04').parcelas.total, 0);
  assert.equal(C.planoCasa(ix, '2026-02').livre, 340000 - 30000);
});

test('quitar antecipado moves the rest to that month', () => {
  const { recs, cats } = casa();
  recs.push(rec('parc', 'casa', { valorTotal: 120000, n: 4, data: '2026-01-20', catId: cats.lazer.id, pagoPor: 'gabi', quitadoMes: '2026-02' }));
  const ix = C.index(recs);
  assert.equal(C.planoCasa(ix, '2026-02').parcelas.total, 90000);
  assert.equal(C.planoCasa(ix, '2026-03').parcelas.total, 0);
});

test('balance: whoever paid gets credit, each owes their share', () => {
  const { recs, cats } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.mercado.id, valor: 10000, data: '2026-01-05', pagoPor: 'gabi' }));
  let s = C.saldo(C.index(recs));
  assert.equal(s.deve, 'yuri');
  assert.equal(s.valor, 4000);
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.mercado.id, valor: 20000, data: '2026-01-06', pagoPor: 'yuri' }));
  s = C.saldo(C.index(recs));
  // gabi: paid 100, owes 60+120 = 180 -> -80
  assert.equal(s.deve, 'gabi');
  assert.equal(s.valor, 8000);
  recs.push(rec('acerto', 'casa', { de: 'gabi', para: 'yuri', valor: 8000, data: '2026-01-07' }));
  assert.equal(C.saldo(C.index(recs)).valor, 0);
});

test('voluntary freela contributions never create debt', () => {
  const { recs } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'aporte', valor: 35000, data: '2026-01-05', pagoPor: 'yuri', voluntario: true }));
  assert.equal(C.saldo(C.index(recs)).valor, 0);
});

test('freela split 70/30 with the saved part half mine, half the house', () => {
  const s = C.separarFreela(100000, C.DEFAULT_PLANO_CASA);
  assert.deepEqual(s, { guardar: 70000, pessoal: 35000, conjunto: 35000, curtir: 30000 });
  const odd = C.separarFreela(33333, C.DEFAULT_PLANO_CASA);
  assert.equal(odd.pessoal + odd.conjunto + odd.curtir, 33333);
});

test('imprevisto over budget: extras first, then Reserva, then Aporte extra', () => {
  const { recs, cats } = casa();
  // livre 3400: delivery 680, lazer 680, imprevistos 340, reserva 340
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.delivery.id, valor: 28000, data: '2026-01-03', pagoPor: 'gabi' }));
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.farmacia.id, valor: 50000, data: '2026-01-04', pagoPor: 'yuri' }));
  let ix = C.index(recs);
  let p = C.planoCasa(ix, '2026-01');
  assert.equal(p.overflow, 16000);
  let s = C.sugerirImprevisto(ix, p);
  // delivery has 400 left, lazer 680: 160 split proportionally
  assert.equal(s.remanejes.reduce((a, r) => a + r.valor, 0), 16000);
  assert.equal(s.remanejes.find(r => r.de === cats.delivery.id).valor, 5926);
  assert.equal(s.aporte, null);

  // a big one: everything extra + Reserva used, the rest split 60/40
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.farmacia.id, valor: 200000, data: '2026-01-05', pagoPor: 'yuri' }));
  ix = C.index(recs);
  p = C.planoCasa(ix, '2026-01');
  s = C.sugerirImprevisto(ix, p);
  // overflow 2160; extras 400+680 = 1080; reserva 340; rest 740 -> 444 / 296
  assert.equal(s.falta, 216000);
  assert.equal(s.remanejes.find(r => r.de === cats.reserva.id).valor, 34000);
  assert.deepEqual(s.aporte, { gabi: 44400, yuri: 29600, total: 74000 });

  // accepting: remanejamentos + aportes extras close the gap
  for (const r of s.remanejes) recs.push(rec('remanej', 'casa', { mes: '2026-01', de: r.de, para: s.para, valor: r.valor }));
  recs.push(rec('aporteExtra', 'casa', { mes: '2026-01', pessoa: 'gabi', valor: s.aporte.gabi }));
  recs.push(rec('aporteExtra', 'casa', { mes: '2026-01', pessoa: 'yuri', valor: s.aporte.yuri }));
  ix = C.index(recs);
  p = C.planoCasa(ix, '2026-01');
  // the aporte extra goes straight to the Imprevistos pool, so it is covered
  assert.equal(p.overflow, 0);
  assert.equal(p.livre, 340000);
  const g = C.planoPessoal(ix, 'gabi', '2026-01', p);
  assert.equal(g.aporteExtra, 44400);
});

test('personal plan: base minus house share, fixed, plus freela curtir', () => {
  const { recs } = casa();
  recs.push(rec('fixo', 'gabi', { nome: 'Academia', valorPrevisto: 15000 }));
  recs.push(rec('renda', 'casa', { pessoa: 'gabi', data: '2026-01-15', valor: 100000, tipo: 'freela', separado: true, curtir: 30000 }));
  const ix = C.index(recs);
  const g = C.planoPessoal(ix, 'gabi', '2026-01');
  // 6000 - 3000 - 150 + 300 = 3150
  assert.equal(g.livre, 315000);
  assert.equal(g.rows.reduce((a, r) => a + r.orcamento, 0), 315000);
});

test('guardado x extras', () => {
  const { recs, cats } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'aporte', valor: 50000, data: '2026-01-05', pagoPor: 'gabi', voluntario: true }));
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.delivery.id, valor: 20000, data: '2026-01-06', pagoPor: 'gabi' }));
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.farmacia.id, valor: 90000, data: '2026-01-06', pagoPor: 'gabi' }));
  const ge = C.guardadoExtras(C.index(recs), 'casa', '2026-01');
  assert.equal(ge.guardado, 50000);
  assert.equal(ge.extras, 20000); // pharmacy is never an extra
  assert.equal(ge.ganhando, true);
});

test('card bills', () => {
  assert.equal(C.faturaDe('2026-01-05', 3, 10), '2026-02-10');
  assert.equal(C.faturaDe('2026-01-02', 3, 10), '2026-01-10');
  assert.equal(C.faturaDe('2026-01-20', 25, 5), '2026-02-05');
  assert.equal(C.faturaDe('2026-01-28', 25, 5), '2026-03-05');
  const cartao = { id: 'c1', kind: 'pagto', escopo: 'casa', tipo: 'credito', fechamento: 25, vencimento: 5 };
  const recs = [cartao,
    { id: 'l1', kind: 'lanc', escopo: 'casa', tipo: 'gasto', valor: 10000, data: '2026-01-20', pagto: 'c1' },
    { id: 'p1', kind: 'parc', escopo: 'casa', valorTotal: 30000, n: 3, data: '2026-01-10', pagto: 'c1' }];
  const f = C.faturasAbertas(C.index(recs), '2026-01-21');
  assert.equal(f[0].vence, '2026-02-05');
  assert.equal(f[0].total, 20000);
  assert.equal(f.length, 3);
});

test('meta progress and monthly need', () => {
  const meta = { id: 'm1', kind: 'meta', escopo: 'casa', alvo: 1200000, prazo: '2026-12' };
  const recs = [meta, { id: 'a', kind: 'lanc', escopo: 'casa', tipo: 'aporte', metaId: 'm1', valor: 480000, data: '2026-03-01' }];
  const p = C.metaProgresso(C.index(recs), meta, '2026-07');
  assert.equal(p.pct, 4000);
  assert.equal(p.porMes, 120000);
});

test('deleted records are ignored', () => {
  const { recs, cats } = casa();
  recs.push(rec('lanc', 'casa', { tipo: 'gasto', catId: cats.mercado.id, valor: 10000, data: '2026-01-05', pagoPor: 'gabi', excluidoEm: '2026-01-06T00:00:00Z' }));
  assert.equal(C.saldo(C.index(recs)).valor, 0);
});

test('applyBps rounds half up', () => {
  assert.equal(applyBps(1, 5000), 1);
  assert.equal(applyBps(3, 5000), 2);
});
