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
  comingNext: { en: 'Water ledger, field calendar, flip grid and evidence arrive in the next milestones.', tr: 'Su defteri, tarla takvimi, flip ızgarası ve kanıt paneli sonraki aşamalarda gelecek.' },
  supports: {
    en: 'This tool supports, it does not replace, farmer judgment and local expertise.',
    tr: 'Bu araç çiftçinin ve yerel uzmanın kararını destekler, yerine geçmez.',
  },
  sources: { en: 'Weather: NASA POWER daily. Soil: SoilGrids 2.0 (ISRIC).', tr: 'Hava: NASA POWER günlük. Toprak: SoilGrids 2.0 (ISRIC).' },

  // Recommendation (ISMAIL_BAKMALI §11, §14)
  recTitle: { en: 'Most suitable for this land under your priorities', tr: 'Önceliklerinize göre bu arazi için en uygun' },
  recDriver: { en: 'Weighed most: {d}', tr: 'En çok etki eden: {d}' },
  recClose: { en: 'Results are close: {r} is almost as suitable.', tr: 'Sonuçlar yakın: {r} da neredeyse aynı uygun.' },
  recNone: { en: 'Under these conditions no option passes the productivity thresholds.', tr: 'Bu koşullarda hiçbir seçenek verimlilik eşiklerini geçmiyor.' },
  recBlocked: { en: 'Not suggested, whatever it would earn:', tr: 'Ne kazandırırsa kazandırsın önerilmiyor:' },
  robustStable: { en: 'This holds if prices move ±20 %.', tr: 'Bu öneri fiyatlar ±%20 değişse de değişmiyor.' },
  robustFlip: { en: 'If the {crop} price {dir} {pct} %, the suggestion becomes {r}.', tr: '{crop} fiyatı %{pct} {dir} öneri {r} olur.' },
  robustFlipNone: { en: 'If the {crop} price {dir} {pct} %, no option passes the thresholds.', tr: '{crop} fiyatı %{pct} {dir} hiçbir seçenek eşikleri geçmez.' },
  up: { en: 'rises', tr: 'artarsa' },
  down: { en: 'falls', tr: 'düşerse' },
  robustNote: { en: 'A sensitivity step chosen by the team, not a forecast.', tr: 'Ekibin seçtiği bir duyarlılık adımı, tahmin değil.' },
  block_wheat_yield_below_baseline: {
    en: 'It brings the next wheat below 85 % of wheat after fallow.',
    tr: "Sonraki buğdayı nadas sonrasının %85'inin altına düşürüyor.",
  },
  block_first_crop_fails: {
    en: 'The first-year crop fails in most years (median yield under 30 %).',
    tr: "İlk yıl ürünü çoğu yıl başarısız (ortanca verim %30'un altında).",
  },
  crit_value: { en: 'earnings', tr: 'kazanç' },
  crit_yield: { en: 'wheat yield', tr: 'buğday verimi' },
  crit_soil: { en: 'soil protection', tr: 'toprak koruma' },
  crit_water: { en: 'water', tr: 'su' },
  crop_wheat: { en: 'wheat', tr: 'buğday' },
  crop_chickpea: { en: 'chickpea', tr: 'nohut' },
  crop_lentil: { en: 'lentil', tr: 'mercimek' },
  precipWarn: {
    en: 'In this district the satellite rainfall is {pct} % {dir} than the ground station; water results may be {tone}.',
    tr: 'Bu ilçede uydu yağışı istasyondan %{pct} {dir}; su sonuçları {tone} olabilir.',
  },
  higher: { en: 'higher', tr: 'yüksek' },
  lower: { en: 'lower', tr: 'düşük' },
  optimistic: { en: 'optimistic', tr: 'iyimser' },
  pessimistic: { en: 'pessimistic', tr: 'kötümser' },

  // Priorities
  prioTitle: { en: 'Your priorities', tr: 'Öncelikleriniz' },
  prioSub: { en: 'Move the sliders; the suggestion and the order of the cards update at once.', tr: 'Kaydırıcıları oynatın; öneri ve kartların sırası hemen değişir.' },
  prioShare: { en: '{pct} % of the decision', tr: 'kararın %{pct}' },
  prioReset: { en: 'Back to the team defaults', tr: 'Ekip varsayılanlarına dön' },
  prioDefaultNote: { en: 'Defaults: team decision of 14 Nov ({w}).', tr: 'Varsayılanlar: 14 Kasım ekip kararı ({w}).' },

  // Rotation cards
  cardsTitle: { en: 'Three options, side by side', tr: 'Üç seçenek yan yana' },
  cardsSub: { en: '{n} start years ({a}–{b}). Median, with P10–P90 in small print.', tr: '{n} başlangıç yılı ({a}–{b}). Ortanca; küçük yazıda P10–P90.' },
  currentPractice: { en: 'current practice', tr: 'bugünkü uygulama' },
  suggested: { en: 'most suitable', tr: 'en uygun' },
  blockedTag: { en: 'not suggested', tr: 'önerilmiyor' },
  rowWater: { en: 'Water at wheat sowing', tr: 'Buğday ekiminde su' },
  rowWaterUnit: { en: '1 mm = 1 m³/da', tr: '1 mm = 1 m³/da' },
  rowWheat: { en: 'Wheat yield', tr: 'Buğday verimi' },
  rowWheatHint: { en: 'of the yield possible with enough water', tr: 'su yeterli olsaydı alınabilecek verimin' },
  rowFirst: { en: 'First-year crop yield', tr: 'İlk yıl ürünü verimi' },
  rowHarvests: { en: 'Harvests in two years', tr: 'İki yılda hasat' },
  rowBare: { en: 'Bare days', tr: 'Çıplak gün' },
  rowWind: { en: '{n} windy and dry', tr: '{n} rüzgârlı ve kuru' },
  rowStress: { en: 'Wheat water-stress days', tr: 'Buğday su stresi günü' },
  rowN: { en: 'Fixes nitrogen from the air', tr: 'Havadan azot bağlar' },
  rowNoN: { en: 'No nitrogen fixing', tr: 'Azot bağlamaz' },
  rowTillage: { en: 'Tillage passes', tr: 'Toprak işleme' },
  perYear: { en: '/year', tr: '/yıl' },
  days: { en: 'days', tr: 'gün' },
  vsFallow: { en: 'vs fallow', tr: 'nadasa göre' },
  scoreTitle: { en: 'Score under your priorities', tr: 'Önceliklerinize göre puan' },
  scoreHint: { en: 'Each bar: this option relative to the best one on that criterion.', tr: 'Her çubuk: bu seçeneğin o ölçütte en iyiye göre durumu.' },
  why: { en: 'Why this strategy?', tr: 'Neden bu strateji?' },
  evidence: { en: 'Evidence', tr: 'Kanıt' },
  benefits: { en: 'Benefits', tr: 'Faydaları' },
  gaps: { en: 'What we do not know', tr: 'Bilmediklerimiz' },
  localReview: { en: 'Ask a local expert about', tr: 'Yerel uzmana danışın' },

  // Soil health (PLAN_MVP §6 3b)
  soilTitle: { en: 'Soil health', tr: 'Toprak sağlığı' },
  soilCard: { en: "Your district's soil (regional estimate)", tr: 'İlçenizin toprağı (bölgesel tahmin)' },
  soilCardSub: { en: 'SoilGrids 2.0, {d}. Median with the 90 % range. An estimate for the district, not your field.', tr: 'SoilGrids 2.0, {d}. Ortanca ve %90 aralığı. İlçe için tahmin, sizin tarlanız değil.' },
  texture: { en: 'Texture class (0–100 cm)', tr: 'Doku sınıfı (0–100 cm)' },
  awc: { en: 'Available water the model uses', tr: 'Modelin kullandığı yarayışlı su' },
  awcAlt: { en: 'Other estimates (not used): {list}', tr: 'Diğer tahminler (kullanılmadı): {list}' },
  awc_soilgrids_wv0033_wv1500: { en: 'SoilGrids', tr: 'SoilGrids' },
  awc_saxton_rawls_2006: { en: 'Saxton–Rawls', tr: 'Saxton–Rawls' },
  notRemote: { en: "What satellites can't tell you", tr: 'Uydunun söyleyemedikleri' },
  notRemoteBody: { en: 'These need a soil test or a check in the field. Ask your provincial agriculture directorate or a soil laboratory.', tr: 'Bunlar için toprak analizi ya da tarlada kontrol gerekir. İl tarım müdürlüğüne ya da bir toprak laboratuvarına danışın.' },
  nr_phosphorus: { en: 'phosphorus', tr: 'fosfor' },
  nr_potassium: { en: 'potassium', tr: 'potasyum' },
  nr_micronutrients: { en: 'micronutrients', tr: 'mikro besinler' },
  nr_compaction: { en: 'compaction', tr: 'sıkışma' },
  fullTitle: { en: 'How full is the soil?', tr: 'Toprak ne kadar dolu?' },
  fullSub: { en: 'Share of the soil water store filled at each month end, median of {n} years with the P10–P90 band. 100 % = field capacity.', tr: 'Her ay sonunda toprak su deposunun dolu payı; {n} yılın ortancası ve P10–P90 bandı. %100 = tarla kapasitesi.' },
  year1: { en: 'Year 1', tr: '1. yıl' },
  year2: { en: 'Year 2', tr: '2. yıl' },
  fieldCapacity: { en: 'field capacity', tr: 'tarla kapasitesi' },
  smapTitle: { en: 'Regional wetness from NASA SMAP', tr: 'NASA SMAP ile bölgesel nem' },
  smapComing: { en: 'Coming: SMAP root-zone data for this district has not arrived yet.', tr: 'Yakında: Bu ilçe için SMAP kök bölgesi verisi henüz gelmedi.' },
  smapLatest: { en: 'Latest ({date}): {w} % wet, {pct}th percentile for this month.', tr: 'Son değer ({date}): %{w} nemli; bu ay için {pct}. yüzdelik.' },
  showTable: { en: 'Show as a table', tr: 'Tablo olarak göster' },
  month: { en: 'Month', tr: 'Ay' },
  median: { en: 'median', tr: 'ortanca' },

  // Chart A
  chartATitle: { en: '24 climates, one decision', tr: '24 iklim, tek karar' },
  chartASub: {
    en: 'Each dot is one start year: wheat yield as a share of what enough water would allow. The bar marks the median, the dashes P10 and P90.',
    tr: 'Her nokta bir başlangıç yılı: buğday verimi, su yeterli olsaydı alınabilecek verimin yüzdesi olarak. Çizgi ortancayı, kesikli çizgiler P10 ve P90’ı gösterir.',
  },
  startYear: { en: 'Start year', tr: 'Başlangıç yılı' },
  wheatYieldPct: { en: 'Wheat yield (% of water-limited)', tr: 'Buğday verimi (su sınırlı verimin %)' },
} as const satisfies Record<string, T>;

export type Key = keyof typeof S;

/** USDA texture classes (results.soil.texture_class is the English USDA name). */
const TEXTURE_TR: Record<string, string> = {
  clay: 'kil', 'silty clay': 'siltli kil', 'sandy clay': 'kumlu kil', 'clay loam': 'killi tın',
  'silty clay loam': 'siltli killi tın', 'sandy clay loam': 'kumlu killi tın', loam: 'tın', 'silt loam': 'siltli tın',
  'sandy loam': 'kumlu tın', silt: 'silt', 'loamy sand': 'tınlı kum', sand: 'kum',
};
export function textureName(lang: Lang, cls: string): string {
  return lang === 'tr' ? TEXTURE_TR[cls.toLowerCase()] ?? cls : cls;
}

/** For keys built from data (e.g. `nr_${id}`): fall back to the raw id when no string exists. */
export const hasKey = (k: string): k is Key => k in S;

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
