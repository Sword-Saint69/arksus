import { useStore, type Lang } from '@/state/store';
import { S, type Key, type T } from './strings';

export type { Key, T, Lang };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s: string = S[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** A text from a data file ({en, tr}). */
export const pick = (lang: Lang, text: T | null | undefined): string => (text ? text[lang] || text.en : '');

/** For keys built from data (`crop_${id}`): false when no string exists. */
export const hasKey = (k: string): k is Key => k in S;

const locale = (lang: Lang) => (lang === 'tr' ? 'tr-TR' : 'en-GB');

export function fmtNum(lang: Lang, v: number, digits = 0): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(v);
}

/** A 0–1 ratio as a percentage, with the sign where each language puts it. */
export function fmtPct(lang: Lang, ratio: number, digits = 0): string {
  const n = fmtNum(lang, ratio * 100, digits);
  return lang === 'tr' ? `%${n}` : `${n} %`;
}

export function fmtMonth(lang: Lang, date: Date | string, withYear = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale(lang), withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }).format(d);
}

export function fmtDay(lang: Lang, date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** USDA texture classes (results.soil.texture_class is the English USDA name). */
const TEXTURE_TR: Record<string, string> = {
  clay: 'kil', 'silty clay': 'siltli kil', 'sandy clay': 'kumlu kil', 'clay loam': 'killi tın',
  'silty clay loam': 'siltli killi tın', 'sandy clay loam': 'kumlu killi tın', loam: 'tın', 'silt loam': 'siltli tın',
  'sandy loam': 'kumlu tın', silt: 'silt', 'loamy sand': 'tınlı kum', sand: 'kum',
};
export const textureName = (lang: Lang, cls: string): string => (lang === 'tr' ? TEXTURE_TR[cls.toLowerCase()] ?? cls : cls);

/** Everything a component needs to speak the current language. */
export function useT() {
  const lang = useStore((s) => s.lang);
  return {
    lang,
    t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars),
    tx: (text: T | null | undefined) => pick(lang, text),
    num: (v: number, digits = 0) => fmtNum(lang, v, digits),
    pct: (ratio: number, digits = 0) => fmtPct(lang, ratio, digits),
  };
}
