// lib/safe.ts - Safe number formatting helpers
// Use these instead of raw .toFixed() to prevent crashes on undefined/null values

/** Safe toFixed - returns '-' for null/undefined/NaN */
export function sf(v: number | undefined | null, decimals = 2): string {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return Number(v).toFixed(decimals);
}

/** Safe P&L formatting: +$123.45 or -$123.45 */
export function pnl(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}$${n.toFixed(2)}`;
}

/** Safe R multiple formatting: 2.5R or -1.3R */
export function rfmt(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Number(v).toFixed(2)}R`;
}

/** Safe percentage: 72.5% */
export function pct(v: number | undefined | null, decimals = 1): string {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Number(v).toFixed(decimals)}%`;
}

/** Safe currency: $1234.56 */
export function cur(v: number | undefined | null): string {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `$${Number(v).toFixed(2)}`;
}
