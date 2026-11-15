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
  smapTitle: { en: 'Regional soil wetness from NASA MERRA-2', tr: 'NASA MERRA-2 ile bölgesel toprak nemi' },
  smapComing: { en: 'NASA MERRA-2 soil wetness for this district is not available.', tr: 'Bu ilçe için NASA MERRA-2 toprak nemi verisi yok.' },
  smapLatest: { en: 'Latest month ({date}): root zone {w} % wet, {pct}th percentile for this calendar month.', tr: 'Son ay ({date}): kök bölgesi %{w} ıslak; bu takvim ayı için {pct}. yüzdelik.' },
  smapNote: { en: 'MERRA-2 is a NASA reanalysis model (~55 km cell), not a satellite measurement. 100 % = saturated, not field capacity.', tr: 'MERRA-2 bir NASA yeniden analiz modelidir (~55 km hücre), uydu ölçümü değildir. %100 = doygun, tarla kapasitesi değil.' },
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

  // Shell
  navMap: { en: 'Map', tr: 'Harita' },
  seeOnMap: { en: 'See on the map', tr: 'Haritada gör' },
  mapTitle: { en: 'Map of Turkey: districts, fields and the 3D process', tr: 'Türkiye haritası: ilçeler, tarlalar ve 3B süreç' },
  mapHint: {
    en: 'Pick a district on the map, then “Watch the process in 3D” to see two years of water in the three fields.',
    tr: 'Haritada bir ilçe seçin, sonra “Süreci 3B izle” ile üç tarlada iki yılın suyunu izleyin.',
  },
  mapOpenFull: { en: 'Full screen', tr: 'Tam ekran' },
  exitFull: { en: 'Exit full screen (Esc)', tr: 'Tam ekrandan çık (Esc)' },
  simWatch: { en: 'Watch the process in 3D', tr: 'Süreci 3B izle' },
  simWatchSub: { en: 'Two years of water in the three fields, week by week', tr: 'Üç tarlada iki yılın suyu, hafta hafta' },
  simTitle: { en: 'See two years happen', tr: 'İki yılı gözünüzle görün' },
  simBody: {
    en: 'Three fields side by side, fallow, chickpea and lentil, through the 24 months of a typical year of your district: rain, the water stored in the soil, the crops and the bare months.',
    tr: 'Nadas, nohut ve mercimek tarlaları yan yana, ilçenizin tipik bir yılının 24 ayı boyunca: yağmur, toprakta biriken su, ekinler ve çıplak aylar.',
  },
  simForField: { en: 'How do two years go on this field?', tr: 'Bu tarlada iki yıl nasıl geçer?' },
  navHome: { en: 'Home', tr: 'Ana sayfa' },
  navAnalysis: { en: 'Detailed analysis', tr: 'Ayrıntılı analiz' },
  navPanel: { en: 'My fields', tr: 'Tarlalarım' },
  navProfile: { en: 'My profile', tr: 'Profilim' },
  navLogin: { en: 'Sign in', tr: 'Giriş yap' },
  navRegister: { en: 'Create account', tr: 'Hesap aç' },
  logout: { en: 'Sign out', tr: 'Çıkış yap' },
  menu: { en: 'Menu', tr: 'Menü' },

  // Home
  heroKicker: { en: 'NASA Space Apps 2026 · Field Shift', tr: 'NASA Space Apps 2026 · Field Shift' },
  heroTitle: { en: 'Will you leave your field fallow this year?', tr: 'Bu yıl tarlanızı nadasa mı bırakacaksınız?' },
  heroBody: {
    en: 'NöbetSu compares fallow, chickpea and lentil with the last 24 years of your district’s climate: how much water stays in the soil, how long the field lies bare, and what happens to the next wheat. In plain words, leaving the decision to you.',
    tr: 'NöbetSu, ilçenizin son 24 yılının iklimiyle nadası, nohutu ve mercimeği karşılaştırır: toprakta ne kadar su kalır, tarla ne kadar çıplak kalır, sonraki buğday ne olur. Sade bir dille anlatır, kararı size bırakır.',
  },
  heroStart: { en: 'Create a free account', tr: 'Ücretsiz hesap aç' },
  heroTry: { en: 'Try without an account', tr: 'Hesap açmadan dene' },
  heroHave: { en: 'I already have an account', tr: 'Hesabım var, giriş yap' },
  stepsTitle: { en: 'In three steps', tr: 'Üç adımda' },
  step1T: { en: 'Pick your district', tr: 'İlçenizi seçin' },
  step1B: { en: 'Results are ready for 13 rainfed districts of Central Anatolia.', tr: 'İç Anadolu’da 13 kuru tarım ilçesi için sonuçlar hazır.' },
  step2T: { en: 'Add your field', tr: 'Tarlanızı ekleyin' },
  step2B: { en: 'Say how deep the soil is and what matters most to you.', tr: 'Toprağın ne kadar derin olduğunu ve sizin için neyin önemli olduğunu seçin.' },
  step3T: { en: 'Read the result', tr: 'Sonucu okuyun' },
  step3B: { en: 'See which crop order looks most suitable for your field, and why.', tr: 'Hangi ekim sırasının tarlanıza en uygun göründüğünü ve nedenini görün.' },
  optionsTitle: { en: 'The three options', tr: 'Üç seçenek' },
  opt_fallow_wheat: {
    en: 'Today’s practice. The field rests a year and stores rain in the soil, but it stays bare for a long time and wind can carry the soil away.',
    tr: 'Bugünkü uygulama. Tarla bir yıl dinlenir, yağmuru toprakta biriktirir; ama uzun süre çıplak kalır, rüzgâr toprağı uçurabilir.',
  },
  opt_chickpea_wheat: {
    en: 'Chickpea in the fallow year: a harvest and nitrogen from the air, and less bare time. It leaves less water in the soil for the wheat.',
    tr: 'Nadas yılında nohut: bir hasat daha ve havadan azot, tarla daha az çıplak kalır. Buğdaya toprakta daha az su bırakır.',
  },
  opt_lentil_wheat: {
    en: 'Lentil in the fallow year: like chickpea, a harvest and nitrogen with less bare time; it also leaves less water for the wheat.',
    tr: 'Nadas yılında mercimek: nohut gibi bir hasat ve azot getirir, tarla daha az çıplak kalır; o da buğdaya daha az su bırakır.',
  },
  trustTitle: { en: 'What it is based on', tr: 'Neye dayanıyor?' },
  trust1: { en: 'NASA POWER daily weather for your district, 2000 to today', tr: 'NASA POWER: ilçenizin 2000’den bugüne günlük hava verisi' },
  trust2: { en: 'Every year computed separately, so you see the bad years and the good ones', tr: 'Her yıl ayrı hesaplanır; kötü yılı da iyi yılı da görürsünüz' },
  trust3: { en: 'Soil from SoilGrids (ISRIC), a regional estimate', tr: 'Toprak bilgisi SoilGrids’ten (ISRIC), bölgesel tahmin' },
  honest: {
    en: 'Results describe a typical rainfed field of the district, not your field. A soil test and your local agriculture expert still matter.',
    tr: 'Sonuçlar ilçenin tipik bir kuru tarım tarlası içindir, sizin tarlanız değil. Toprak analizi ve yerel tarım uzmanının görüşü yine önemlidir.',
  },

  // Sign in / register
  loginTitle: { en: 'Sign in', tr: 'Giriş yap' },
  registerTitle: { en: 'Create an account', tr: 'Hesap aç' },
  phone: { en: 'Mobile number', tr: 'Cep telefonu' },
  phoneHint: { en: 'For example 0532 123 45 67', tr: 'Örnek: 0532 123 45 67' },
  pin: { en: 'PIN (4–6 digits)', tr: 'PIN (4–6 rakam)' },
  pinHint: { en: 'Protects your account on this phone. Do not share it.', tr: 'Hesabınızı bu telefonda korur. Kimseyle paylaşmayın.' },
  fullName: { en: 'Your name', tr: 'Adınız soyadınız' },
  yourDistrict: { en: 'Your district', tr: 'İlçeniz' },
  submitLogin: { en: 'Sign in', tr: 'Giriş yap' },
  submitRegister: { en: 'Create account', tr: 'Hesabı aç' },
  toRegister: { en: 'No account yet? Create one', tr: 'Hesabınız yok mu? Hesap açın' },
  toLogin: { en: 'Have an account? Sign in', tr: 'Hesabınız var mı? Giriş yapın' },
  deviceNote: {
    en: 'For now your account and fields are kept only on this device. They do not appear on another phone.',
    tr: 'Hesabınız ve tarlalarınız şimdilik yalnızca bu cihazda saklanır. Başka bir telefonda görünmez.',
  },
  working: { en: 'One moment…', tr: 'Bir saniye…' },
  err_bad_phone: { en: 'Check the mobile number (10 digits starting with 5).', tr: 'Cep telefonu numarasını kontrol edin (5 ile başlayan 10 hane).' },
  err_bad_pin: { en: 'The PIN must be 4 to 6 digits.', tr: 'PIN 4 ile 6 rakam arasında olmalı.' },
  err_bad_name: { en: 'Write your name.', tr: 'Adınızı yazın.' },
  err_exists: { en: 'There is already an account with this number on this device. Sign in.', tr: 'Bu numarayla bu cihazda zaten bir hesap var. Giriş yapın.' },
  err_not_found: { en: 'No account with this number on this device.', tr: 'Bu numarayla bu cihazda bir hesap bulunamadı.' },
  err_wrong_pin: { en: 'Wrong PIN.', tr: 'PIN yanlış.' },
  err_storage: { en: 'This browser does not allow saving data (a private tab?).', tr: 'Tarayıcı veri saklamaya izin vermiyor (gizli sekme olabilir).' },

  // Farmer panel
  hello: { en: 'Hello, {name}', tr: 'Merhaba, {name}' },
  panelSub: { en: 'Your fields and the crop order that looks most suitable for each.', tr: 'Tarlalarınız ve her biri için en uygun görünen ekim sırası.' },
  addField: { en: 'Add a field', tr: 'Tarla ekle' },
  noFields: { en: 'No fields yet. Add your first field and see the result in seconds.', tr: 'Henüz tarla eklemediniz. İlk tarlanızı ekleyin, sonucu birkaç saniyede görün.' },
  mostSuitable: { en: 'Most suitable', tr: 'En uygun görünen' },
  details: { en: 'Details', tr: 'Ayrıntı' },
  donumUnit: { en: 'dönüm', tr: 'dönüm' },
  districtResult: { en: 'District result, not your field', tr: 'İlçe sonucu, tarlanız değil' },
  totalArea: { en: '{n} fields · {a} dönüm', tr: '{n} tarla · {a} dönüm' },
  signInFirst: { en: 'Sign in to see your fields.', tr: 'Tarlalarınızı görmek için giriş yapın.' },

  // Field form
  fieldNewTitle: { en: 'New field', tr: 'Yeni tarla' },
  fieldEditTitle: { en: 'Edit field', tr: 'Tarlayı düzenle' },
  fieldName: { en: 'Name of the field', tr: 'Tarlanın adı' },
  fieldNamePh: { en: 'For example: Roadside, Big field', tr: 'Örnek: Yol kenarı, Büyük tarla' },
  fieldDistrict: { en: 'Which district is it in?', tr: 'Hangi ilçede?' },
  fieldArea: { en: 'Size (dönüm)', tr: 'Büyüklüğü (dönüm)' },
  fieldAreaHint: { en: 'Leave empty if you are not sure.', tr: 'Bilmiyorsanız boş bırakın.' },
  fieldDepth: { en: 'How deep is the soil?', tr: 'Toprak ne kadar derin?' },
  depthHelp_shallow: { en: 'You hit stone or rock before 60 cm.', tr: '60 cm’ye inmeden taşa, kayaya rastlanır.' },
  depthHelp_medium: { en: '60–90 cm. Pick this if you are not sure.', tr: '60–90 cm arası. Emin değilseniz bunu seçin.' },
  depthHelp_deep: { en: 'Deeper than 90 cm, without stones.', tr: '90 cm’den derin, taşsız toprak.' },
  fieldPriority: { en: 'What matters most to you?', tr: 'Sizin için en önemli olan ne?' },
  prio_balanced: { en: 'Balanced', tr: 'Dengeli' },
  prio_balanced_help: { en: 'Earnings, wheat yield, soil and water together: the team’s default weights.', tr: 'Kazanç, buğday verimi, toprak ve su birlikte: ekibin varsayılan ağırlıkları.' },
  prio_value: { en: 'Earnings', tr: 'Kazanç' },
  prio_value_help: { en: 'What the two years bring in matters most.', tr: 'İki yılın kazandırdığı en önemlisi.' },
  prio_yield: { en: 'Protect the wheat yield', tr: 'Buğday verimini korumak' },
  prio_yield_help: { en: 'The next wheat should not fall behind.', tr: 'Sonraki buğday geride kalmasın.' },
  prio_soil: { en: 'Protect the soil', tr: 'Toprağı korumak' },
  prio_soil_help: { en: 'Fewer bare, windy days; less soil blown away.', tr: 'Daha az çıplak ve rüzgârlı gün, daha az savrulan toprak.' },
  prio_water: { en: 'Store water in the soil', tr: 'Toprakta su biriktirmek' },
  prio_water_help: { en: 'More water in the soil when the wheat is sown.', tr: 'Buğday ekilirken toprakta daha çok su.' },
  fieldNote: { en: 'Note (optional)', tr: 'Not (isteğe bağlı)' },
  save: { en: 'Save', tr: 'Kaydet' },
  cancel: { en: 'Cancel', tr: 'Vazgeç' },
  deleteField: { en: 'Delete field', tr: 'Tarlayı sil' },
  confirmDeleteField: { en: 'Delete this field?', tr: 'Bu tarla silinsin mi?' },
  err_field_name: { en: 'Give the field a name.', tr: 'Tarlaya bir ad verin.' },

  // Field detail
  forThisField: { en: 'For this field', tr: 'Bu tarla için' },
  vsFallowTitle: { en: 'Compared with fallow', tr: 'Nadasla karşılaştırınca' },
  factWater: { en: 'Water in the soil at wheat sowing', tr: 'Buğday ekilirken toprakta su' },
  factWheat: { en: 'Next wheat yield', tr: 'Sonraki buğday verimi' },
  factWheatVal: { en: '{pct} of wheat after fallow', tr: 'nadas sonrası buğdayın {pct} kadarı' },
  factBare: { en: 'Days the field lies bare (2 years)', tr: 'Tarlanın çıplak kaldığı gün (2 yıl)' },
  factHarvests: { en: 'Harvests in two years', tr: 'İki yılda hasat' },
  fallowRef: { en: 'fallow: {v}', tr: 'nadasta: {v}' },
  badGoodYears: { en: 'In a dry year {lo}, in a wet year {hi}', tr: 'Kurak yılda {lo}, yağışlı yılda {hi}' },
  openAnalysis: { en: 'Open the detailed analysis', tr: 'Ayrıntılı analizi aç' },
  editField: { en: 'Edit', tr: 'Düzenle' },
  notFoundField: { en: 'This field was not found.', tr: 'Bu tarla bulunamadı.' },
  back: { en: 'Back', tr: 'Geri' },

  // Profile
  profileTitle: { en: 'My profile', tr: 'Profilim' },
  memberSince: { en: 'Member since {date}', tr: '{date} tarihinden beri üye' },
  saved: { en: 'Saved', tr: 'Kaydedildi' },
  deleteAccount: { en: 'Delete my account and fields from this device', tr: 'Hesabımı ve tarlalarımı bu cihazdan sil' },
  confirmDeleteAccount: {
    en: 'Your account and all your fields will be removed from this device. This cannot be undone.',
    tr: 'Hesabınız ve tüm tarlalarınız bu cihazdan silinecek. Bu geri alınamaz.',
  },

  // Fertilizer plan (15 Nov, docs/GUBRE.md). kg per dekar only; no money.
  fertTitle: { en: 'Fertilizer plan', tr: 'Gübre planı' },
  fertIntro: {
    en: 'Suggested for your soil and crop: when, which fertilizer and how many kg per dekar. Compare it with what you usually do; the decision is yours.',
    tr: 'Toprağınıza ve ürününüze göre önerilen: ne zaman, hangi gübreden, dekara kaç kg. Her zaman yaptığınızla karşılaştırın; karar sizin.',
  },
  fertCrop: { en: 'Crop', tr: 'Ürün' },
  fertOtherCrop: { en: 'Other crop', tr: 'Başka ürün' },
  fertWater: { en: 'Water', tr: 'Sulama' },
  water_rainfed: { en: 'Rainfed', tr: 'Kuru tarım' },
  water_limited: { en: 'Limited irrigation', tr: 'Kısıtlı sulu' },
  water_irrigated: { en: 'Irrigated', tr: 'Sulu' },
  fertInoculated: { en: 'Seed inoculated with Rhizobium', tr: 'Tohum Rhizobium ile aşılı' },
  fertBanding: { en: 'Combined seed drill (fertilizer in a band next to the seed)', tr: 'Kombine mibzer (gübre tohumun yanına bant halinde)' },
  fertWhen: { en: 'When', tr: 'Ne zaman' },
  fertWhat: { en: 'Fertilizer', tr: 'Gübre' },
  fertPerDa: { en: 'per dekar', tr: 'dekara' },
  fertForField: { en: 'whole field ({a} dönüm)', tr: 'tüm tarla ({a} dönüm)' },
  fert_t_base: { en: 'At sowing (base fertilizer)', tr: 'Ekimle (taban gübre)' },
  fert_t_pre_plant: { en: 'Before sowing', tr: 'Ekimden önce' },
  fert_t_foliar: { en: 'On the leaves', tr: 'Yapraktan' },
  fert_t_top: { en: 'Top dressing', tr: 'Üst gübre' },
  fertNoDoses: { en: 'No fertilizer amount could be worked out for this crop and water yet; see below why.', tr: 'Bu ürün ve sulama için henüz gübre miktarı çıkarılamadı; nedeni aşağıda.' },
  fertNeedsTest: {
    en: 'Satellites cannot measure phosphorus or potassium. Enter your soil test and the plan adds them.',
    tr: 'Fosfor ve potasyum uydudan ölçülemez. Toprak analizinizi girerseniz plan bunları da ekler.',
  },
  fertNutrients: { en: 'Pure nutrient per dekar', tr: 'Dekara saf besin' },
  nutrient_n: { en: 'Nitrogen (N)', tr: 'Azot (N)' },
  nutrient_p2o5: { en: 'Phosphorus (P₂O₅)', tr: 'Fosfor (P₂O₅)' },
  nutrient_k2o: { en: 'Potassium (K₂O)', tr: 'Potasyum (K₂O)' },
  basis_soil_table: { en: 'official table (TAGEM, Central Anatolia)', tr: 'resmi tablo (TAGEM, Orta Anadolu)' },
  basis_fixed_starter: { en: 'legume starter dose', tr: 'baklagil başlangıç dozu' },
  basis_response_curve: { en: 'yield response curve', tr: 'verim eğrisi' },
  basis_balance: { en: 'nutrient balance (coefficients not verified)', tr: 'besin dengesi (katsayılar doğrulanmadı)' },
  basis_needs_soil_test: { en: 'soil test needed', tr: 'toprak analizi gerekli' },
  basis_pending: { en: 'no source yet', tr: 'kaynak bekleniyor' },
  fertWhy: { en: 'Why these amounts?', tr: 'Neden bu miktarlar?' },
  fertFlags: { en: 'Your soil', tr: 'Toprağınız' },
  flag_alkaline: { en: 'alkaline (high pH)', tr: 'alkali (pH yüksek)' },
  flag_high_lime: { en: 'limy', tr: 'kireçli' },
  flag_low_om: { en: 'very low organic matter', tr: 'organik madde çok az' },
  flag_low_total_n: { en: 'low nitrogen', tr: 'azot az' },
  flag_saline: { en: 'salty for this crop', tr: 'bu ürün için tuzlu' },
  flag_zn_low: { en: 'zinc short', tr: 'çinko eksik' },
  flag_zn_likely_low: { en: 'zinc probably short', tr: 'çinko muhtemelen eksik' },
  fertAdvice: { en: 'Good to know', tr: 'Bilmeniz iyi olur' },
  fertSalinity: { en: 'More salt-tolerant at this salinity: {c}', tr: 'Bu tuzlulukta daha dayanıklı: {c}' },
  fertGuide: { en: 'For comparison, the Toros guide at {y} kg/da:', tr: 'Karşılaştırma için Toros rehberi {y} kg/da verimde:' },
  fertTarget: { en: 'Target yield {v} kg/da', tr: 'Hedef verim {v} kg/da' },
  fertMissing: { en: 'A soil test of these would make the plan more precise: {list}', tr: 'Bunları analiz ettirirseniz plan netleşir: {list}' },
  fertSoilTitle: { en: 'My soil test', tr: 'Toprak analizim' },
  fertSoilHint: {
    en: 'Values from your lab report (0–20 cm). Empty boxes use the satellite estimate where there is one.',
    tr: 'Laboratuvar raporunuzdaki değerler (0–20 cm). Boş kutular için varsa uydu tahmini kullanılır.',
  },
  fertSoilFrom: { en: 'estimate: {v}', tr: 'tahmin: {v}' },
  fertSoilUsed: { en: 'Soil values used', tr: 'Kullanılan toprak değerleri' },
  fertSave: { en: 'Save soil test', tr: 'Analizi kaydet' },
  fertClear: { en: 'Clear', tr: 'Temizle' },
  fertSaved: { en: 'Saved to this field.', tr: 'Bu tarlaya kaydedildi.' },
  soil_om_pct: { en: 'Organic matter (%)', tr: 'Organik madde (%)' },
  soil_p2o5_kg_per_da: { en: 'Phosphorus, Olsen (kg P₂O₅/da)', tr: 'Fosfor, Olsen (kg P₂O₅/da)' },
  soil_k2o_kg_per_da: { en: 'Potassium (kg K₂O/da)', tr: 'Potasyum (kg K₂O/da)' },
  soil_ph: { en: 'pH', tr: 'pH' },
  soil_lime_pct: { en: 'Lime, CaCO₃ (%)', tr: 'Kireç, CaCO₃ (%)' },
  soil_ec_ds_m: { en: 'Salinity, EC (dS/m)', tr: 'Tuzluluk, EC (dS/m)' },
  soil_zn_ppm: { en: 'Zinc, DTPA (mg/kg)', tr: 'Çinko, DTPA (mg/kg)' },
  soil_total_n_pct: { en: 'Total nitrogen (%)', tr: 'Toplam azot (%)' },
  soil_olsen_p_ppm: { en: 'Phosphorus (mg P/kg)', tr: 'Fosfor (mg P/kg)' },
  soil_k_ppm: { en: 'Potassium (mg K/kg)', tr: 'Potasyum (mg K/kg)' },
  fertFarmer: {
    en: 'A suggestion from your soil values and official tables; your own experience and a local agronomist come first.',
    tr: 'Toprak değerlerinize ve resmi tablolara dayanan bir öneri; kendi deneyiminiz ve bölgenizdeki ziraat mühendisinin görüşü önceliklidir.',
  },
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
