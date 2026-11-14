import type { Lang } from '@/strings';

// Display formatting only. Ranges and medians come from lib/economics.ts.
export function fmtNum(v: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(ratio: number, lang: Lang): string {
  return lang === 'tr' ? `%${fmtNum(ratio * 100, lang)}` : `${fmtNum(ratio * 100, lang)} %`;
}

/** A number that is already a percentage (0–100), written the way each language puts the sign. */
export function fmtPctOf100(v: number, lang: Lang, digits = 0): string {
  const n = fmtNum(v, lang, digits);
  return lang === 'tr' ? `%${n}` : `${n} %`;
}
