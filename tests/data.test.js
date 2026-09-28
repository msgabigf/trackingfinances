import { test } from 'node:test';
import assert from 'node:assert/strict';

// data.js touches IndexedDB only when called, so importing it in node is safe.
const { validRec } = await import('../js/data.js');

test('validRec accepts normal records and rejects injected ones', () => {
  assert.equal(validRec({ id: 'abc123', kind: 'lanc', escopo: 'casa', tipo: 'gasto', valor: 1250, data: '2026-09-25', catId: 'x1', pagoPor: 'gabi' }), true);
  assert.equal(validRec({ id: '"><img src=x onerror=alert(1)>', kind: 'lanc', escopo: 'casa' }), false);
  assert.equal(validRec({ id: 'a', kind: 'lanc', escopo: 'casa', catId: '" onclick="x' }), false);
  assert.equal(validRec({ id: 'a', kind: 'lanc', escopo: 'casa', valor: '10' }), false);
  assert.equal(validRec({ id: 'a', kind: 'lanc', escopo: 'outra' }), false);
  assert.equal(validRec({ id: 'a', kind: 'fixo', escopo: 'casa', diaVenc: '5<b>' }), false);
  assert.equal(validRec({ id: 'a', kind: 'lanc', escopo: 'casa', data: '25/09/2026' }), false);
  assert.equal(validRec({ id: 'a', kind: 'plano', escopo: 'casa', mes: '2026-09', pcts: { x: 1000 } }), true);
  assert.equal(validRec({ id: 'a', kind: 'evil', escopo: 'casa' }), false);
});
