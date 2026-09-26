// In-memory data layer over IndexedDB. Screens read `ix()` (an index of the
// visible records) and write through save / remove; every write re-renders.

import * as store from './store.js';
import { index } from './core/calc.js';
import { defaultCats, defaultPlano, DEFAULT_PAGTOS } from './seed.js';

const DEFAULT_SETTINGS = {
  eu: null,                        // 'gabi' | 'yuri'
  nomes: { gabi: 'Gabi', yuri: 'Yuri' },
  iniciado: false,
  ocultar: false,
  ultimo: {},                      // last tipo / categoria / pagto used on quick-add
  vistoEm: null,
};

const state = { recs: new Map(), settings: { ...DEFAULT_SETTINGS }, ix: null };
const listeners = new Set();

export function newId() {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

const nowIso = () => new Date().toISOString();

export async function load() {
  const [all, settings] = await Promise.all([store.recs.all(), store.kv.get('settings')]);
  state.recs = new Map(all.map(r => [r.id, r]));
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}), nomes: { ...DEFAULT_SETTINGS.nomes, ...(settings?.nomes || {}) } };
  state.ix = null;
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { state.ix = null; for (const fn of listeners) fn(); }

export function ix() {
  if (!state.ix) state.ix = index([...state.recs.values()]);
  return state.ix;
}

export function get(id) { return state.recs.get(id) || null; }
export function allRecs() { return [...state.recs.values()]; }

export function settings() { return state.settings; }
export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await store.kv.set('settings', state.settings);
  emit();
}

export const eu = () => state.settings.eu;
export const nome = (p) => (p === 'casa' ? 'Casa' : state.settings.nomes[p] || p);

function stamp(rec) {
  const t = nowIso();
  const out = { ...rec };
  if (!out.id) out.id = newId();
  if (!out.criadoEm) { out.criadoEm = t; out.criadoPor = state.settings.eu; }
  out.editadoEm = t;
  out._pendente = true;
  delete out._pct;
  return out;
}

export async function save(rec) {
  const r = stamp(rec);
  state.recs.set(r.id, r);
  await store.recs.put(r);
  await touchActivity(r);
  emit();
  return r;
}

export async function saveMany(list) {
  const out = list.map(stamp);
  for (const r of out) state.recs.set(r.id, r);
  await store.recs.putMany(out);
  if (out.length) await touchActivity(out[0]);
  emit();
  return out;
}

async function touchActivity(r) {
  if (r.kind === 'lanc' || r.kind === 'parc') state.settings.ultimaAtividade = nowIso();
  await store.kv.set('settings', state.settings);
}

// Deleting is a tombstone (Lixeira, 30 days), never a hard delete.
export async function remove(id) {
  const r = state.recs.get(id);
  if (!r) return;
  await save({ ...r, excluidoEm: nowIso() });
}

export async function removeMany(ids) {
  const t = nowIso();
  await saveMany(ids.map(id => state.recs.get(id)).filter(Boolean).map(r => ({ ...r, excluidoEm: t })));
}

export async function restore(id) {
  const r = state.recs.get(id);
  if (!r) return;
  const { excluidoEm, ...rest } = r;
  await save(rest);
}

export function lixeira() {
  const limite = Date.now() - 30 * 86400000;
  return [...state.recs.values()]
    .filter(r => r.excluidoEm && Date.parse(r.excluidoEm) > limite && ['lanc', 'parc', 'meta', 'renda', 'acerto', 'fixo'].includes(r.kind))
    .sort((a, b) => (a.excluidoEm < b.excluidoEm ? 1 : -1));
}

// ---------------------------------------------------------------- setup

export async function setupDefaults(eu) {
  const has = (escopo) => [...state.recs.values()].some(r => r.kind === 'cat' && r.escopo === escopo && !r.excluidoEm);
  const novos = [];
  for (const escopo of ['casa', eu]) {
    if (has(escopo)) continue;
    const cats = defaultCats(escopo).map(c => ({ ...c, id: newId() }));
    novos.push(...cats, defaultPlano(escopo, cats));
  }
  if (![...state.recs.values()].some(r => r.kind === 'pagto')) novos.push(...DEFAULT_PAGTOS(eu, state.settings.nomes));
  if (novos.length) await saveMany(novos);
}

// ---------------------------------------------------------------- sample data

export async function loadSample(buildSample) {
  await clearSample(false);
  const recsOut = buildSample({ eu: state.settings.eu, nomes: state.settings.nomes, newId });
  await saveMany(recsOut.map(r => ({ ...r, exemplo: true })));
}

// Sample records are removed for good (they are never synced).
export async function clearSample(notify = true) {
  const ids = [...state.recs.values()].filter(r => r.exemplo).map(r => r.id);
  for (const id of ids) state.recs.delete(id);
  await store.recs.deleteMany(ids);
  if (notify) emit();
  return ids.length;
}

export function hasSample() { return [...state.recs.values()].some(r => r.exemplo); }

// ---------------------------------------------------------------- validation

// Records that come from outside the phone (backup files now, the sheets in
// stage 2) are untrusted: check every field the screens rely on.
const KINDS = new Set(['cat', 'lanc', 'parc', 'renda', 'base', 'plano', 'fixo', 'meta', 'acerto', 'remanej', 'aporteExtra', 'fechamento', 'pagto']);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const REFS = ['catId', 'fixoId', 'metaId', 'pagto', 'de', 'para'];
const INTS = ['valor', 'valorTotal', 'valorPrevisto', 'valorCasa', 'investimento', 'alvo', 'aporteMensal', 'curtir', 'n', 'diaVenc', 'mesVenc', 'fechamento', 'vencimento', 'ordem', 'freelaGuardar', 'freelaPessoal', 'limiteCasa', 'limiteParcelas', 'splitGabi'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const PESSOA = new Set(['gabi', 'yuri']);

export function validRec(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  if (typeof r.id !== 'string' || !ID.test(r.id) || !KINDS.has(r.kind)) return false;
  if (r.escopo !== 'casa' && !PESSOA.has(r.escopo)) return false;
  for (const k of REFS) if (r[k] != null && !(typeof r[k] === 'string' && (ID.test(r[k]) || PESSOA.has(r[k])))) return false;
  for (const k of INTS) if (r[k] != null && !Number.isSafeInteger(r[k])) return false;
  for (const k of ['pagoPor', 'pessoa', 'dono']) if (r[k] != null && !PESSOA.has(r[k])) return false;
  if (r.data != null && !(typeof r.data === 'string' && DATE.test(r.data))) return false;
  for (const k of ['mes', 'prazo', 'desde', 'ate', 'quitadoMes']) if (r[k] != null && !(typeof r[k] === 'string' && MONTH.test(r[k]))) return false;
  for (const k of ['nome', 'obs', 'texto', 'frase', 'icone', 'motivo', 'origem', 'tipo', 'grupo', 'papel']) if (r[k] != null && typeof r[k] !== 'string') return false;
  if (r.pcts != null) {
    if (typeof r.pcts !== 'object' || Array.isArray(r.pcts)) return false;
    for (const [k, v] of Object.entries(r.pcts)) if (!ID.test(k) || !Number.isSafeInteger(v)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- backup

export function exportBackup() {
  return {
    app: 'gabi-e-yuri',
    schemaVersion: store.SCHEMA_VERSION,
    exportadoEm: nowIso(),
    eu: state.settings.eu,
    recs: [...state.recs.values()].filter(r => r.escopo === 'casa' || r.escopo === state.settings.eu).map(({ _pendente, ...r }) => r),
  };
}

// Compare a backup with what is on the phone, without changing anything.
export function previewBackup(obj) {
  if (!obj || obj.app !== 'gabi-e-yuri' || !Array.isArray(obj.recs)) throw new Error('Esse arquivo não é um backup do app.');
  if (obj.schemaVersion > store.SCHEMA_VERSION) throw new Error('Backup de uma versão mais nova do app. Atualize o app primeiro.');
  let novos = 0, atualizados = 0, iguais = 0, ignorados = 0;
  for (const r of obj.recs) {
    if (!validRec(r)) { ignorados++; continue; }
    if (r.escopo !== 'casa' && r.escopo !== state.settings.eu) { ignorados++; continue; }
    const cur = state.recs.get(r.id);
    if (!cur) novos++;
    else if ((r.editadoEm || '') > (cur.editadoEm || '')) atualizados++;
    else iguais++;
  }
  return { novos, atualizados, iguais, ignorados, total: obj.recs.length, exportadoEm: obj.exportadoEm };
}

// Merge by id: the most recent edit wins. Nothing is deleted.
export async function restoreBackup(obj) {
  previewBackup(obj);
  const out = [];
  for (const r of obj.recs) {
    if (!validRec(r)) continue;
    if (r.escopo !== 'casa' && r.escopo !== state.settings.eu) continue;
    const cur = state.recs.get(r.id);
    if (!cur || (r.editadoEm || '') > (cur.editadoEm || '')) out.push({ ...r, _pendente: true });
  }
  for (const r of out) state.recs.set(r.id, r);
  await store.recs.putMany(out);
  emit();
  return out.length;
}

export async function resetAll() {
  await store.recs.clear();
  state.recs.clear();
  state.settings = { ...DEFAULT_SETTINGS };
  await store.kv.set('settings', state.settings);
  emit();
}
