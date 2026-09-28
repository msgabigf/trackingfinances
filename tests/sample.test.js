import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCats, defaultPlano, DEFAULT_PAGTOS } from '../js/seed.js';
import { buildSample } from '../js/sample.js';
import * as C from '../js/core/calc.js';
import { thisMonth, addMonths } from '../js/core/dates.js';
const { validRec, newId: realId } = await import('../js/data.js');

let k = 0;
const newId = () => (k++ % 2 ? `s${k}` : realId());

test('sample data produces sensible plans for both people', () => {
  for (const eu of ['gabi', 'yuri']) {
    const base = [];
    for (const escopo of ['casa', eu]) {
      const cats = defaultCats(escopo).map(c => ({ ...c, id: newId() }));
      base.push(...cats, { ...defaultPlano(escopo, cats), id: newId() });
    }
    const pagtos = DEFAULT_PAGTOS(eu, { gabi: 'Gabi', yuri: 'Yuri' }).map(p => ({ ...p, id: newId() }));
    base.push(...pagtos);
    const cats = base.filter(r => r.kind === 'cat');
    const sample = buildSample({ eu, newId, cats, pagtos }).map(r => ({ ...r, exemplo: true, editadoEm: '2099-01-01' }));
    assert.ok(sample.every(r => !('catId' in r) || r.catId !== null), 'every category name in the sample exists');
    for (const r of [...base, ...sample]) assert.ok(validRec({ ...r, _pct: undefined }), `valid ${r.kind} ${JSON.stringify(r).slice(0, 80)}`);
    const ix = C.index([...base, ...sample]);
    const mes = thisMonth();
    const casa = C.planoCasa(ix, mes);
    assert.equal(casa.valorCasa, 840000);
    assert.ok(casa.livre > 0, 'livre casa positive');
    assert.equal(casa.rows.reduce((a, r) => a + r.planejado, 0), casa.livre);
    const meu = C.planoPessoal(ix, eu, mes, casa);
    assert.ok(Number.isFinite(meu.livre));
    const prev = C.planoCasa(ix, addMonths(mes, -1));
    assert.equal(prev.overflow, 0, 'last month imprevistos covered by remanejamentos');
    const s = C.saldo(ix);
    assert.ok(Number.isFinite(s.valor));
    assert.ok(C.sugerirImprevisto(ix, casa), 'this month has an emergency to cover');
    assert.equal(C.pendentes(ix, eu).length, 2);
    console.log(eu, { livreCasa: casa.livre, aindaDa: casa.aindaDa, overflow: casa.overflow, livreMeu: meu.livre, saldo: s.net, prevOverflow: prev.overflow });
  }
});
