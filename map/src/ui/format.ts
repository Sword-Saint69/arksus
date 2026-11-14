import { getLang } from '../strings';

const nf = (d: number) => new Intl.NumberFormat(getLang() === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function fmtNum(v: number, digits = 0) { return nf(digits).format(v); }

/** Area in the unit a reader expects for that size: m², dönüm, hectare or km². */
export function fmtArea(m2: number): { value: string; unit: string } {
  if (m2 >= 1e7) return { value: fmtNum(m2 / 1e6, m2 >= 1e9 ? 0 : 1), unit: 'km²' };
  if (m2 >= 1e4) return { value: fmtNum(m2 / 1e4, 2), unit: 'ha' };
  return { value: fmtNum(m2, 0), unit: 'm²' };
}

/** Dönüm (1000 m²) is how land is bought and sold in Turkey; always show it next to the metric unit. */
export function fmtDonum(m2: number) { return fmtNum(m2 / 1000, m2 < 1e5 ? 1 : 0); }

export function fmtLen(m: number) {
  return m >= 1000 ? `${fmtNum(m / 1000, 2)} km` : `${fmtNum(m, 0)} m`;
}


export function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
