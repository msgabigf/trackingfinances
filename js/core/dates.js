// Dates are stored as "aaaa-mm-dd" text in Brazil time; months as "aaaa-mm".

export const TZ = 'America/Sao_Paulo';

const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export function today(now = new Date()) {
  return isoFmt.format(now);
}

export function monthOf(date) {
  return String(date).slice(0, 7);
}

export function thisMonth(now = new Date()) {
  return monthOf(today(now));
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function monthDiff(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dayOf(date) {
  return Number(String(date).slice(8, 10));
}

// clamp a day to the month length: ("2026-02", 31) -> "2026-02-28"
export function dateIn(month, day) {
  const d = Math.min(Math.max(1, day), daysInMonth(month));
  return `${month}-${String(d).padStart(2, '0')}`;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// "2026-09-25" -> "25/09/2026"
export function fmtDate(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

// "2026-09-25" -> "25 set"
export function fmtDateShort(date) {
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MESES_CURTOS[Number(m) - 1]}`;
}

// "2026-09" -> "setembro de 2026" / "Setembro"
export function fmtMonth(month, { year = true, cap = false } = {}) {
  const [y, m] = month.split('-');
  let s = MESES[Number(m) - 1];
  if (cap) s = s[0].toUpperCase() + s.slice(1);
  return year ? `${s} de ${y}` : s;
}

// "2026-09" -> "set/26"
export function fmtMonthShort(month) {
  const [y, m] = month.split('-');
  return `${MESES_CURTOS[Number(m) - 1]}/${y.slice(2)}`;
}

export function monthLabel(month) {
  return MESES_CURTOS[Number(month.split('-')[1]) - 1];
}

export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// "25/09/2026" or "2026-09-25" -> "2026-09-25"
export function parseDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
