# İsmail'in bakması gerekenler (Gümüş'ten)

Web tarafına başlarken `main`'i çek; aşağıdakiler hazır. Gümüş'ün dosyalarına dokunma (sözleşme sahibi Gümüş); değişiklik gerekiyorsa buraya ya da gruba yaz. Yaptığını `- [x]` ile işaretle. Yeni madde en alta tarihle eklenir.

## 1. `main`'de seni bekleyenler (14 Kas)

| Ne | Nerede | Sahibi |
|---|---|---|
| 6 tür veri dosyası (9 JSON), **gerçek veri (`mock: false`, M2, `v0.1`)** | `web/public/data/` | Gümüş |
| Sözleşme tipleri | `web/src/lib/types.ts` | Gümüş |
| Para, aralık, flip ve öncelik hesabı | `web/src/lib/economics.ts` | Gümüş |
| Testler (22 vitest) | `web/src/lib/{economics,contract}.test.ts` | Gümüş |
| Dosya biçimlerinin tamamı | `docs/ARAYUZLER.md` §8–§10, `docs/contract/*.schema.json` | Gümüş |
| Sözlük metinleri (12 terim, EN + TR) | `docs/SOURCES.md` §10 → senin `strings.ts`'ine | Gümüş yazdı |

**Henüz yok, senin işin:** `web/package.json`, Vite + React + TS + Tailwind + shadcn/ui + Recharts + vitest iskeleti, `web/src/` altındaki her şey (lib hariç), Vercel bağlantısı (root = `web`).

## 2. İskeleti kurarken (benim testlerim de çalışsın diye)

- [ ] `package.json`'da `"test": "vitest"` olsun. `make test`, `cd web && npm test -- --run` çağırıyor.
- [ ] `devDependencies`: `vitest`, `typescript`, `@types/node`. Testler vitest 2.1.9 + TypeScript 5.6 `strict` ile geçti.
- [ ] `contract.test.ts` dosyaları `node:fs` ile okuyor ve `__dirname` kullanıyor. `src/lib/*.test.ts` için vitest ortamı **`node`** olmalı (`jsdom` değil). Bileşen testlerin `jsdom` istiyorsa `environmentMatchGlobs` ile ayır.
- [ ] `tsconfig`'te `strict: true` kalabilir; `types.ts` ve `economics.ts` sorunsuz derleniyor.
- [ ] `web/src/lib/` altına kendi dosyanı koyma (çakışma olmasın); yardımcıların için `src/utils/` gibi başka bir klasör kullan.

## 3. Veriyi yükleme

| Dosya | Ne zaman | Not |
|---|---|---|
| `/data/site_index.json` | açılışta | lokasyonlar, 3 rotasyon (**baz senaryo her zaman ilk**), derinlik sınıfları, strateji metinleri |
| `/data/defaults.json` | açılışta | fiyat, maliyet, destek, Ym (her biri V nesnesi) |
| `/data/validation.json` | açılışta | 5 kontrol (kanıt paneli) |
| `/data/results/{loc}.json` | lokasyon seçilince | toprak kartı + 216 satır (3 rotasyon × 3 derinlik × 24 yıl) |
| `/data/smap/{loc}.json` | lokasyon seçilince | her zaman var; `available: false` ise `latest: null`, listeler boş |
| `/data/ledger/{loc}.json` | Grafik B görünür olunca (lazy) | ~2 MB; 216 seri × **104 hafta** |

Tipler: `fetch(...).then(r => r.json()) as Promise<SiteIndex>` vb. (`types.ts`). Lokasyon id'leri `karapinar`, `develi`; rotasyon `fallow_wheat`, `chickpea_wheat`, `lentil_wheat`; derinlik `shallow`, `medium`, `deep`.

## 4. Para hesabı: sadece `economics.ts`'i çağır

```ts
import { inputsFromDefaults, summarize, flipTable, rankByPriority } from './lib/economics';
const inp = inputsFromDefaults(defaults, 'karapinar');           // kullanıcı değiştirince bu nesneyi güncelle
const cards = summarize(results, site, 'medium', inp);           // 3 kart: aralıklar, zarar olasılığı, baza göre farklar
const flips = flipTable(results, site, inp);                      // 9 hücre (derinlik × kurak/normal/ıslak)
const ranked = rankByPriority(cards, { water: 34, income: 33, soil: 33 }); // kaydırıcılar (toplam 100)
```

- Bileşenlerde para formülü yazma; imzalar donmuş (ARAYUZLER §9).
- Kullanıcı bir değeri değiştirince o sayının rozeti `user` olur.
- Başabaş verimi kartta: `wheat_break_even_kg_per_da`.

## 5. Gösterim kuralları (önemli)

- [ ] **Mock bandı:** yüklenen herhangi bir dosyada `mock: true` varsa görünür bant. **14 Kas'tan beri `main`'deki dosyalar gerçek veri** (`mock: false`). Bandı denemek ya da maliyet/Ym dolu sahte sayılarla çalışmak istersen yerelde `cd engine && python -m nobetsu.build --mock --out ../web/public/data` çalıştır, **ama bunu commit etme** (`git checkout web/public/data` ile geri al).
- [ ] **`value: null` = "bekleniyor".** V nesnelerinde değer `null` olabilir; ekranda **0 değil**, "bekleniyor / pending" yaz. `economics.ts` null'ı 0 sayıyor, yani:
  - [ ] **Gerçek veride şu an maliyetler ve Ym boş** (kaynak bulunamadı). Bunlar boşken para kartlarında "maliyet / verim verisi eksik, sonuç eksik" uyarısı göster; net kâr sayısını tek başına gösterme. (Mock'ta bu boşluklar `source: "MOCK…"` sahte sayılarla dolu, o yüzden mock'ta uyarı görünmez.)
- [ ] **Rozet:** her sayının `type`'ı var: `measured, model, official, statistic, literature, assumption, user`. `verified: false` olanlar en az "assumption" gibi görünmeli ya da yanında "doğrulanmadı" notu olmalı.
- [ ] **Yasak kelimeler:** "recommended", "best choice", "banned", "profit guaranteed" / "önerilen", "en iyi", "yasak", "kâr garantili". Sıralama başlığı: "Ranking under your priorities" / "Önceliklerine göre sıralama".
- [ ] Baz rotasyon "current practice / bugünkü uygulama" etiketli; diğerleri `delta_vs_baseline` ile fark olarak gösterilir.

## 6. Metinler nereden gelir

- **Strateji çekmecesi ("Neden bu strateji?"):** `site_index.rotations[].strategy` → `why`, `evidence[]` (metin + `source` + `source_url`), `benefits[]`, `gaps[]`, `local_review[]`. Hepsi `{en, tr}`.
- **Toprak özellikleri:** `rotations[].soil_traits` → `n_fixing` (bool), `tillage_passes` (V; nadas 3, baklagiller `null` = bekleniyor), `note`.
- **Lokasyon notu:** `locations[].note`.
- **Sözlük ipuçları:** `docs/SOURCES.md` §10 → kendi `strings.ts`'ine kopyala.
- **Toprak kartı:** `results.soil.properties[]` (kil, kum, silt, pH, organik karbon, azot, CEC, hacim ağırlığı, kaba parça; Q05 / Q50 / Q95, birim, `meaning`). Bunlar mock'ta bile **gerçek** SoilGrids değerleri. `meaning` metinleri şimdilik "[text pending]".
- **"Uydunun söyleyemedikleri" kutusu:** `results.soil.not_available_remotely` (fosfor, potasyum, mikro besinler, sıkışma).

## 7. Dikkat edilecek veri durumları

- [ ] **SMAP:** mock'ta **Karapınar `available: true`**, **Develi `available: false`**; iki ekran durumunu da kur ("yakında" yer tutucusu).
- [ ] **AWC (toprağın su tutma kapasitesi):** `results.soil.awc_mm_per_m` motorun **kullandığı** değer (doku → FAO-56 tablosu, taş düzeltmeli, `assumption`). SoilGrids'in kendi tahmini (58–67 mm/m) daha düşük ve kullanılmıyor; Ömer bunun da kartta "SoilGrids estimate (not used)" diye gösterilmesini önerdi. İstersen yaz, sözleşmeye eklerim (şu an JSON'da yok).
- [ ] **Kanıt paneli:** gerçek veride `precip_vs_mgm` şunu gösterecek: Karapınar'da NASA POWER yağışı yer istasyonundan **~%36 yüksek**, Develi'de ≈ −%8. Panelin altına "uydu/model verisi ile yer istasyonu" notu (PLAN_MVP §5.7) mutlaka girsin.
- [ ] Aylık diziler (24 eleman) 1 Temmuz `y`'den başlıyor: eleman 0 = Temmuz, eleman 23 = Haziran `y+2`.
- [ ] Birim notu: 1 mm su = 1 m³/da.

## 8. Senden beklediklerim

- [ ] Web iskeleti + Vercel linki gelince gruba yaz; `make test` web testlerini de çalıştırmaya başlar.
- [ ] Sözleşmede eksik ya da garip bir alan görürsen **kendi tipini yazma**, bana yaz (aynı saat içinde düzeltirim).

## 9. M2 yapıldı (14 Kas)

- `web/public/data/` artık gerçek NASA POWER + motor çıktısı, `mock: false`, etiket `v0.1`.
- [ ] Gerçek veride **maliyet ve Ym `null`** (kaynak bulunamadı) → para kartlarında "veri eksik" durumu şimdiden görünecek; §5'teki uyarıyı ilk sürümde kur.
- [ ] SMAP iki lokasyonda da `available: false` (mock'taki Karapınar örneği artık yok; "yakında" durumu ile başla).

## 10. SÖZLEŞME DEĞİŞTİ: 13 İç Anadolu lokasyonu (14 Kas)

Proje 2 noktadan **13 ile** genişledi (her ilden bir kuru tarım ilçesi): Karapınar (Konya), Develi (Kayseri), Polatlı (Ankara), Eskişehir, Aksaray, Karaman, Niğde, Nevşehir, Kaman (Kırşehir), Kırıkkale, Çankırı, Gemerek (Sivas), Boğazlıyan (Yozgat).

- [ ] **Sabit lokasyon listesi yazma.** `LocationId` artık `string`; liste `site_index.locations`'tan gelir (id, name, district, province, lat, lon, note). `defaults.values[id]` her lokasyon için var.
- [ ] **Lokasyon seçici:** 13 ilçe, ile göre gruplu açılır liste (`province` alanı).
- [ ] **Harita (E7, zaman kalırsa):** `lat/lon` ile 13 nokta; kullanıcı haritada bir yere tıklarsa **en yakın hesaplanmış ilçe** ve mesafe: "Bölgesel sonuç: en yakın hesaplanmış ilçe Kaman (23 km). Tarlanız değil, ilçenin tipik bir tarlası." Canlı hesap yok; her şey önceden hesaplı.
- [ ] Dosya yükleme aynı: `results/{id}.json`, `smap/{id}.json` lokasyon seçilince; `ledger/{id}.json` lazy (~2 MB her biri, 13 lokasyonda toplam ~26 MB; sadece seçilen yüklenir).
- **`main`'de 13 lokasyonlu gerçek veri var** (`mock: false`). Ömer'in bölge takvimi ve yağış düzeltmesi gelince aynı dosyalar yeniden üretilecek; biçim değişmeyecek.
- [ ] **Yağış uyarısı:** `validation.json` → `precip_vs_mgm` her ilçe için uydu (POWER) ile yer istasyonu farkını verir. Karaman **+83 %**, Eskişehir +39 %, Karapınar +36 %. Lokasyon kartında bu fark ±%20'yi aşıyorsa görünür bir not göster: "Bu ilçede uydu yağışı istasyondan %X yüksek; su sonuçları iyimser olabilir." Ömer düzeltme eklerse bu not küçülür.
