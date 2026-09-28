// Money is always integer centavos (R$ 12,50 = 1250). Percentages are integer
// basis points (12,5% = 1250, 100% = 10000). Never floating point in storage.

export const TOTAL_BPS = 10000;

// "12,50" "12.50" "1.234,56" "1,234.56" "R$ 30" "30" -> centavos, or null.
export function parseMoney(input) {
  if (input == null) return null;
  let s = String(input).replace(/[R$\s ]/g, '');
  if (!s) return null;
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart = s;
  let decPart = '';
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = Math.max(lastComma, lastDot);
    intPart = s.slice(0, dec);
    decPart = s.slice(dec + 1);
  } else if (lastComma >= 0) {
    // "1,234,567" is thousands; "12,5" is decimal
    const parts = s.split(',');
    if (parts.length > 2) {
      intPart = parts.join('');
    } else {
      intPart = parts[0];
      decPart = parts[1] ?? '';
    }
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    // "1.234" and "1.234.567" are pt-BR thousands; "12.5" / "12.50" are decimals
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      intPart = parts.join('');
    } else {
      intPart = parts[0];
      decPart = parts[1] ?? '';
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (decPart.length > 2) return null;
  if (!intPart && !decPart) return null;
  const cents = parseInt(intPart || '0', 10) * 100 + parseInt((decPart + '00').slice(0, 2), 10);
  if (!Number.isFinite(cents)) return null;
  return neg ? -cents : cents;
}

const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

// 123456 -> "R$ 1.234,56"
export function fmtMoney(cents, { sign = false, short = false } = {}) {
  const c = Math.round(cents || 0);
  const abs = Math.abs(c);
  const body = short && abs % 100 === 0 ? brl0.format(abs / 100) : brl.format(abs / 100);
  const pre = c < 0 ? '-' : sign && c > 0 ? '+' : '';
  return `${pre}R$ ${body}`;
}

// 123456 -> "1.234,56" (for input fields)
export function fmtMoneyPlain(cents) {
  return brl.format((cents || 0) / 100);
}

// 1250 -> "12,5%"
export function fmtPct(bps) {
  const v = (bps || 0) / 100;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)}%`;
}

// "12,5" -> 1250 bps
export function parsePct(input) {
  if (input == null) return null;
  const s = String(input).replace(/[%\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

// amount × bps / 10000, rounded half up, integer-only math
export function applyBps(cents, bps) {
  return Math.round((cents * bps) / TOTAL_BPS);
}

// Split a total into integer parts proportional to weights, so the parts add up
// exactly to the total (largest remainder method). Weights may be any
// non-negative integers. Returns an array aligned with weights.
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const sign = total < 0 ? -1 : 1;
  const t = Math.abs(total);
  const raw = weights.map(w => (t * Math.max(0, w)) / sum);
  const base = raw.map(Math.floor);
  let rest = t - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), w: weights[i] }))
    .filter(o => o.w > 0)
    .sort((a, b) => b.frac - a.frac || b.w - a.w || a.i - b.i);
  for (let k = 0; rest > 0 && order.length; k = (k + 1) % order.length) {
    base[order[k].i] += 1;
    rest -= 1;
  }
  return base.map(v => v * sign);
}

// Installment amounts: the first absorbs the rounding so they add up exactly.
export function installments(total, n) {
  const count = Math.max(1, Math.floor(n));
  const each = Math.floor(total / count);
  const first = total - each * (count - 1);
  return Array.from({ length: count }, (_, i) => (i === 0 ? first : each));
}
