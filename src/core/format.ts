// Formatacao numerica em pt-BR.
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const oneDec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const CURRENCY = 'duc.';

export const fmtInt = (n: number) => intFmt.format(Math.round(n));
export const fmtDec = (n: number) => oneDec.format(n);
export const fmt2 = (n: number) => twoDec.format(n);

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const scaled = (v: number, suffix: string) => `${sign}${v >= 100 ? intFmt.format(v) : oneDec.format(v)} ${suffix}`;
  if (a >= 1e12) return scaled(a / 1e12, 'tri');
  if (a >= 1e9) return scaled(a / 1e9, 'bi');
  if (a >= 1e6) return scaled(a / 1e6, 'mi');
  if (a >= 1e4) return scaled(a / 1e3, 'mil');
  return sign + intFmt.format(a);
}

export const fmtMoney = (n: number) => `${fmtCompact(n)} ${CURRENCY}`;
export const fmtPct = (v: number, digits = 1) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v * 100)}%`;
export const fmtSignedPct = (v: number, digits = 1) => `${v >= 0 ? '+' : ''}${fmtPct(v, digits)}`;
export const fmtSigned = (v: number) => `${v >= 0 ? '+' : ''}${fmtInt(v)}`;
export const fmtArea = (km2: number) => `${fmtCompact(km2)} km²`;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
