// Every UI string in both languages, as NöbetSu's frontend brief asks
// (src/strings.ts with en and tr keys). Data files carry their own {en, tr}.

export type Lang = 'tr' | 'en';

const S = {
  appTagline: { tr: 'Nadas mı, nohut mu, mercimek mi? · Arazi haritası', en: 'Fallow, chickpea or lentil? · Land map' },
  searchLabel: { tr: 'Yer ara', en: 'Search places' },
  searchPh: { tr: 'İl, ilçe, köy veya koordinat ara', en: 'Search a province, district, village or coordinates' },
  searching: { tr: 'Aranıyor…', en: 'Searching…' },
  noResults: { tr: 'Sonuç bulunamadı', en: 'No results' },
  searchDown: { tr: 'Arama şu an yapılamıyor', en: 'Search is unavailable right now' },
  goToCoord: { tr: 'Koordinata git', en: 'Go to coordinates' },
  select: { tr: 'Seç', en: 'Pick' },
  selectKind: { tr: 'Seçim türü', en: 'Selection type' },
  auto: { tr: 'Otomatik', en: 'Auto' },
  kind_pilot: { tr: 'Pilot ilçe', en: 'Pilot district' },
  kind_province: { tr: 'İl', en: 'Province' },
  kind_island: { tr: 'Ada', en: 'Island' },
  kind_field: { tr: 'Tarla', en: 'Field' },
  kind_parcel: { tr: 'Parsel', en: 'Parcel' },
  layers: { tr: 'Katmanlar', en: 'Layers' },
  basemap: { tr: 'Altlık', en: 'Basemap' },
  selectable: { tr: 'Seçilebilir katmanlar', en: 'Selectable layers' },
  lyrPilots: { tr: 'Pilot ilçeler', en: 'Pilot districts' },
  lyrProvinces: { tr: 'İl sınırları', en: 'Province borders' },
  lyrIslands: { tr: 'Adalar', en: 'Islands' },
  lyrFields: { tr: 'Tarlalar', en: 'Fields' },
  lyrParcels: { tr: 'Parseller', en: 'Parcels' },
  lyrLabels: { tr: 'Yer adları', en: 'Place names' },
  illustrative: { tr: 'temsili', en: 'illustrative' },
  terrain: { tr: 'Arazi', en: 'Terrain' },
  exaggeration: { tr: 'Yükselti abartısı', en: 'Height exaggeration' },
  fieldColors: { tr: 'Tarla renkleri', en: 'Field colours' },
  open: { tr: 'Açık', en: 'Open' },
  commercial: { tr: 'Ticari', en: 'Commercial' },
  zoomIn: { tr: 'Yakınlaş', en: 'Zoom in' },
  zoomOut: { tr: 'Uzaklaş', en: 'Zoom out' },
  north: { tr: 'Kuzeye çevir', en: 'Reset north' },
  pitch: { tr: '2B / 3B görünüm', en: '2D / 3D view' },
  home: { tr: 'Tüm Türkiye', en: 'All of Turkey' },
  mapControls: { tr: 'Harita denetimleri', en: 'Map controls' },
  explore: { tr: 'Hızlı keşif', en: 'Quick explore' },
  cursorPos: { tr: 'İmleç konumu', en: 'Cursor position' },
  cursorElev: { tr: 'İmleç altındaki rakım', en: 'Elevation under cursor' },
  zoomLevel: { tr: 'Yakınlık seviyesi', en: 'Zoom level' },
  booting: { tr: 'Harita yükleniyor', en: 'Loading the map' },
  mapAria: {
    tr: "Türkiye'nin üç boyutlu haritası. Sürükleyerek kaydırın, tekerlekle yakınlaşın, sağ tuşla döndürün.",
    en: 'Three-dimensional map of Turkey. Drag to pan, scroll to zoom, right-drag to rotate.',
  },
  zoomForFields: { tr: 'Tarlaları görmek için biraz daha yakınlaşın', en: 'Zoom in a little more to see fields' },
  loadingFields: { tr: 'OSM tarlaları yükleniyor ({n} hücre)', en: 'Loading OSM fields ({n} cells)' },
  loadingTiles: { tr: '{n} karo yükleniyor', en: 'Loading {n} tiles' },
  willRetry: { tr: '{e}, yeniden denenecek', en: '{e}, will retry' },
  needZoom: { tr: '{k} seçmek için z{z} ve üzerine yakınlaşın', en: 'Zoom to z{z} or closer to pick a {k}' },
  copied: { tr: 'Koordinat kopyalandı', en: 'Coordinates copied' },
  copyFailed: { tr: 'Kopyalanamadı', en: 'Could not copy' },
  exported: { tr: '{n} öğe GeoJSON olarak indirildi', en: '{n} items downloaded as GeoJSON' },

  // Inspector
  emptyTitle: { tr: 'Bir yer seçin', en: 'Pick a place' },
  emptyBody: {
    tr: 'NöbetSu İç Anadolu’nun 13 pilot ilçesinde 24 yıllık NASA iklim verisiyle nadas ve baklagil seçeneklerini karşılaştırır. Bir pilot ilçeyle başlayın ya da haritada bir il, ada, tarla veya parsele tıklayın.',
    en: 'NöbetSu compares fallow and legume options in 13 Central Anatolian pilot districts with 24 years of NASA climate data. Start with a pilot district, or click a province, island, field or parcel on the map.',
  },
  emptyPilots: { tr: 'Pilot ilçeler', en: 'Pilot districts' },
  howTo: { tr: 'Nasıl seçilir', en: 'How to pick' },
  howClick: { tr: '<b>Tıkla</b> seç · <b>Shift + tıkla</b> listeye ekle', en: '<b>Click</b> to pick · <b>Shift + click</b> to add to the list' },
  howProvince: { tr: '<b>İl</b> her yakınlıkta', en: '<b>Province</b> at any zoom' },
  howIsland: { tr: "<b>Ada</b> OSM'deki ada ve adacıklar, z5+", en: '<b>Island</b> islands and islets from OSM, z5+' },
  howField: { tr: "<b>Tarla</b> z13'ten itibaren OSM'den", en: '<b>Field</b> from OSM, z13+' },
  howParcel: { tr: '<b>Parsel</b> z14+ tıkla ya da <b>Ada / Parsel</b> ile ara (TKGM)', en: '<b>Parcel</b> click at z14+ or use <b>Block / Parcel</b> search (TKGM)' },
  kbdSearch: { tr: 'ara', en: 'search' },
  kbdClear: { tr: 'seçimi kaldır', en: 'clear' },
  kbdRotate: { tr: 'Sağ tuş: döndür', en: 'Right-drag: rotate' },
  location: { tr: 'Konum', en: 'Location' },
  area: { tr: 'Alan', en: 'Area' },
  donum: { tr: 'Dönüm', en: 'Dönüm' },
  perimeter: { tr: 'Çevre', en: 'Perimeter' },
  elevation: { tr: 'Rakım', en: 'Elevation' },
  elevRange: { tr: 'Rakım aralığı', en: 'Elevation range' },
  center: { tr: 'Merkez', en: 'Centre' },
  parcelNote: {
    tr: "Parsel sınırları temsilidir: TKGM kadastro verisi açık lisanslı değil. Tarla sınırı OpenStreetMap'ten gerçek veridir.",
    en: 'Parcel lines are illustrative: Turkish cadastre (TKGM) data is not openly licensed. The field outline is real OpenStreetMap data.',
  },
  addToList: { tr: 'Listeye ekle', en: 'Add to list' },
  inList: { tr: 'Listede', en: 'In list' },
  focus: { tr: 'Yakınlaş', en: 'Zoom to' },
  coords: { tr: 'Koordinat', en: 'Coordinates' },
  openOsm: { tr: "OpenStreetMap'te aç", en: 'Open in OpenStreetMap' },
  list: { tr: 'Seçim listesi', en: 'Selection list' },
  items: { tr: '{n} öğe', en: '{n} items' },
  total: { tr: 'Toplam', en: 'Total' },
  downloadAll: { tr: 'Tümünü indir', en: 'Download all' },
  clear: { tr: 'Temizle', en: 'Clear' },
  remove: { tr: '{name} öğesini çıkar', en: 'Remove {name}' },
  nearPilot: {
    tr: '{name} pilot noktasına {km} km. Oradaki sonuçlar ilçeyi temsil eder, bu tarlayı değil.',
    en: '{km} km from the {name} pilot point. Its results represent the district, not this field.',
  },
  seePilot: { tr: '{name} sonuçlarını aç', en: 'Open {name} results' },

  // Pilot district panel
  pilotChip: { tr: 'Pilot ilçe · NöbetSu', en: 'Pilot district · NöbetSu' },
  depth: { tr: 'Toprak derinliği', en: 'Soil depth' },
  rotations: { tr: 'İki yıllık seçenekler', en: 'Two-year options' },
  rotationsSub: { tr: '24 başlangıç yılı ({a}–{b}), medyan ve P10–P90', en: '24 start years ({a}–{b}), median and P10–P90' },
  currentPractice: { tr: 'bugünkü uygulama', en: 'current practice' },
  waterAtSowing: { tr: 'Buğday ekiminde su', en: 'Water at wheat sowing' },
  bareDays: { tr: 'Çıplak gün', en: 'Bare days' },
  windExposed: { tr: 'rüzgâra açık', en: 'wind-exposed' },
  wheatStress: { tr: 'Buğday su stresi', en: 'Wheat water stress' },
  days: { tr: 'gün', en: 'days' },
  nFixing: { tr: 'Azot bağlar', en: 'Fixes nitrogen' },
  noNFixing: { tr: 'Azot bağlamaz', en: 'No nitrogen fixing' },
  vsBaseline: { tr: 'nadasa göre', en: 'vs fallow' },
  moneyPending: {
    tr: 'Verim (kg/da) ve iki yıllık kâr/zarar: maliyet ve beklenen en yüksek verim (Ym) verisi bekleniyor, bu yüzden gösterilmiyor.',
    en: 'Yield (kg/da) and two-year margin: cost and maximum-yield (Ym) data are pending, so they are not shown.',
  },
  why: { tr: 'Neden bu strateji?', en: 'Why this strategy?' },
  evidence: { tr: 'Kanıt', en: 'Evidence' },
  benefits: { tr: 'Faydalar', en: 'Benefits' },
  gaps: { tr: 'Bilmediklerimiz', en: 'What we do not know' },
  localReview: { tr: 'Yerel uzmana sorun', en: 'Ask a local expert about' },
  soilCard: { tr: 'İlçenin toprağı (bölgesel tahmin)', en: "Your district's soil (regional estimate)" },
  soilCardSub: { tr: 'SoilGrids 2.0, {d}. Medyan ve %90 aralık. Tarlanız değil.', en: 'SoilGrids 2.0, {d}. Median and 90 % range. Not your field.' },
  awc: { tr: 'Kullanılabilir su kapasitesi', en: 'Available water capacity' },
  notRemote: { tr: 'Uydunun söyleyemedikleri', en: "What satellites can't tell you" },
  notRemoteBody: { tr: 'Bunlar için toprak analizi ya da tarlada kontrol gerekir:', en: 'These need a soil test or a field check:' },
  phosphorus: { tr: 'fosfor', en: 'phosphorus' },
  potassium: { tr: 'potasyum', en: 'potassium' },
  micronutrients: { tr: 'mikro besinler', en: 'micronutrients' },
  compaction: { tr: 'sıkışma', en: 'compaction' },
  smap: { tr: 'NASA SMAP bölgesel nem', en: 'NASA SMAP regional wetness' },
  smapComing: { tr: 'Yakında: SMAP verisi henüz bu ilçe için hazır değil.', en: 'Coming: SMAP data is not ready for this district yet.' },
  weatherSource: { tr: 'Hava: NASA POWER günlük, {a} → {b}', en: 'Weather: NASA POWER daily, {a} → {b}' },
  supportNote: {
    tr: 'Bu araç çiftçinin ve yerel uzmanın kararını destekler, yerine geçmez.',
    en: 'This tool supports, it does not replace, farmer judgment and local expertise.',
  },
  pilotPin: { tr: '{name} pilot ilçesi, {province}', en: '{name} pilot district, {province}' },
  representative: { tr: 'Temsil alanı (10 km)', en: 'Representative area (10 km)' },
  badge_measured: { tr: 'ölçüm', en: 'measured' },
  badge_model: { tr: 'model', en: 'model' },
  badge_official: { tr: 'resmi', en: 'official' },
  badge_statistic: { tr: 'istatistik', en: 'statistic' },
  badge_literature: { tr: 'literatür', en: 'literature' },
  badge_assumption: { tr: 'varsayım', en: 'assumption' },
  badge_user: { tr: 'kullanıcı', en: 'user' },
  unverified: { tr: 'doğrulanmadı', en: 'not verified' },
  pending: { tr: 'bekleniyor', en: 'pending' },
  // Ada / parsel search (TKGM)
  psButton: { tr: 'Ada / Parsel', en: 'Block / Parcel' },
  psTitle: { tr: 'Ada / parsel sorgula', en: 'Find a parcel by block / number' },
  psSub: { tr: 'Tapu kaydındaki il, ilçe, mahalle, ada ve parsel numarasıyla.', en: 'With the province, district, neighbourhood, block (ada) and parcel number from the title deed.' },
  psIl: { tr: 'İl', en: 'Province' },
  psIlce: { tr: 'İlçe', en: 'District' },
  psMahalle: { tr: 'Mahalle / köy', en: 'Neighbourhood / village' },
  psAda: { tr: 'Ada', en: 'Block (ada)' },
  psParsel: { tr: 'Parsel', en: 'Parcel' },
  psChoose: { tr: 'Seçin…', en: 'Choose…' },
  psLoading: { tr: 'Yükleniyor…', en: 'Loading…' },
  psFind: { tr: 'Parseli bul', en: 'Find parcel' },
  psFinding: { tr: 'Sorgulanıyor…', en: 'Searching…' },
  psNotFound: { tr: 'Bu ada/parsel bulunamadı. Numaraları ve mahalleyi kontrol edin.', en: 'No parcel with this block/number. Check the numbers and the neighbourhood.' },
  psFail: { tr: 'TKGM servisine ulaşılamadı, biraz sonra tekrar deneyin.', en: 'Could not reach the TKGM service, try again shortly.' },
  psHere: { tr: 'Haritada görünen yerden doldur', en: 'Fill from the map view' },
  psAdaHint: { tr: 'Adası olmayan parsellerde 0 yazın.', en: 'Use 0 for parcels without a block.' },
  psClose: { tr: 'Kapat', en: 'Close' },
  psClickHint: { tr: 'İpucu: z14 ve yakınında haritaya tıklayınca o noktadaki gerçek parsel gelir.', en: 'Tip: at z14 or closer, clicking the map fetches the real parcel at that point.' },
  queryingParcel: { tr: 'TKGM parseli sorgulanıyor…', en: 'Looking up the TKGM parcel…' },
  noParcelHere: { tr: 'Bu noktada kayıtlı parsel yok (yol, dere ya da kadastro dışı alan olabilir).', en: 'No registered parcel here (it may be a road, stream or uncadastred land).' },
  tkgmNote: {
    tr: 'Kaynak: TKGM Parsel Sorgu. Bilgi amaçlıdır, resmi belge yerine geçmez; tapu kaydı için e-Devlet veya tapu müdürlüğü esastır.',
    en: 'Source: TKGM Parcel Query. For information only, not an official document; the land registry (e-Devlet or the title office) is authoritative.',
  },
  mockBanner: { tr: 'Örnek (mock) veri: sayılar gerçek değil.', en: 'Mock data: the numbers are not real.' },
} as const;

export type Key = keyof typeof S;

let lang: Lang = ((): Lang => {
  try {
    const saved = localStorage.getItem('terrashift.lang');
    if (saved === 'tr' || saved === 'en') return saved;
  } catch { /* storage blocked: fall through */ }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
})();

export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('terrashift.lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = S[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Pick the current language from a data-file {en, tr} text. */
export function tx(text: { en: string; tr: string } | null | undefined): string {
  return text ? text[lang] || text.en : '';
}

/** Apply data-i18n / data-i18n-* attributes in static HTML. */
export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n as Key); });
  for (const attr of ['placeholder', 'aria-label', 'title']) {
    root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`).forEach((el) => {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`) as Key));
    });
  }
}
