// Every UI string, in English and Turkish (PLAN_MVP §6; Turkish is E4).
// Data files carry their own {en, tr} texts; use tx() for those.

export type Lang = 'en' | 'tr';
export type T = { en: string; tr: string };

export const S = {
  appName: { en: 'NöbetSu', tr: 'NöbetSu' },
  question: { en: 'Fallow, chickpea or lentil before wheat?', tr: 'Buğdaydan önce nadas mı, nohut mu, mercimek mi?' },
  tagline: {
    en: 'Water, soil and wheat yield of three rainfed rotations across 24 years of NASA climate data.',
    tr: 'Üç kuru tarım rotasyonunun suyu, toprağı ve buğday verimi, 24 yıllık NASA iklim verisiyle.',
  },
  district: { en: 'District', tr: 'İlçe' },
  depth: { en: 'Soil depth', tr: 'Toprak derinliği' },
  language: { en: 'Language', tr: 'Dil' },
  loading: { en: 'Loading data…', tr: 'Veri yükleniyor…' },
  loadFailed: { en: 'The data could not be loaded. Reload the page to try again.', tr: 'Veri yüklenemedi. Tekrar denemek için sayfayı yenileyin.' },
  mockBanner: { en: 'Mock data: these numbers are not real yet.', tr: 'Örnek (mock) veri: bu sayılar henüz gerçek değil.' },
  pending: { en: 'pending', tr: 'bekleniyor' },
  unverified: { en: 'not verified', tr: 'doğrulanmadı' },
  badge_measured: { en: 'measured', tr: 'ölçüm' },
  badge_model: { en: 'model', tr: 'model' },
  badge_official: { en: 'official', tr: 'resmi' },
  badge_statistic: { en: 'statistic', tr: 'istatistik' },
  badge_literature: { en: 'literature', tr: 'literatür' },
  badge_assumption: { en: 'assumption', tr: 'varsayım' },
  badge_user: { en: 'your value', tr: 'senin değerin' },
  regionalNote: {
    en: 'Regional result for a typical rainfed field of the district, not your field.',
    tr: 'İlçenin tipik bir kuru tarım tarlası için bölgesel sonuç; sizin tarlanız değil.',
  },
  comingNext: { en: 'Sections arrive in the next milestone.', tr: 'Bölümler bir sonraki aşamada gelecek.' },
  supports: {
    en: 'This tool supports, it does not replace, farmer judgment and local expertise.',
    tr: 'Bu araç çiftçinin ve yerel uzmanın kararını destekler, yerine geçmez.',
  },
  sources: { en: 'Weather: NASA POWER daily. Soil: SoilGrids 2.0 (ISRIC).', tr: 'Hava: NASA POWER günlük. Toprak: SoilGrids 2.0 (ISRIC).' },
} as const satisfies Record<string, T>;

export type Key = keyof typeof S;

export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s: string = S[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function tx(lang: Lang, text: T | null | undefined): string {
  return text ? text[lang] || text.en : '';
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('nobetsu.lang');
    if (saved === 'en' || saved === 'tr') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem('nobetsu.lang', lang); } catch { /* ignore */ }
}
