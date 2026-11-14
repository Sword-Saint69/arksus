# GUBRE.md — Gübre önerisi: ne yapar, nasıl çağrılır, simülasyonda nasıl gösterilir

Sahibi: Gümüş (Rol B). Okuyucu: İsmail (web, simülasyon). 15 Kas 2026.
Sözleşme: `docs/ARAYUZLER.md` §13 · Kod: `web/src/lib/fertilizer.ts` · Kurallar: `engine/config/fertilizer.yaml` → `web/public/data/fertilizer.json`

## 1. Bir cümlede

Kullanıcı ürünü, sulama durumunu ve toprak analizini (ya da SoilGrids'ten gelen ön değerleri) verir. Modül de dekara kaç kg saf N, P2O5 ve K2O gerektiğini, bunun hangi gübreden kaç kg olduğunu ve ne zaman verileceğini söyler. Uyarıları, eksik analizleri ve her sayının kaynağını da ekler.

## 2. Hesap nasıl yapılıyor (sistem neye bakarak önerir)

| Adım | Ne | Kaynak (rozet) |
|---|---|---|
| 1. Saf besin | **TAGEM "Gübre Tavsiyeleri", Orta Anadolu çizelgeleri.** Organik madde (%) → N; Olsen P (kg P2O5/da) → P2O5; yarayışlı K (kg K2O/da) → K2O. Değer bir sınıfa düşer, sınıf dekara saf besini verir. "Kuru" satırları `rainfed`, "Sulu" satırları `limited` ve `irrigated` için kullanılır. | official ✓ |
| 1b. Baklagil | Tohum Rhizobium ile **aşılıysa** azot tablodan değil, başlangıç dozundan gelir: nohut 3 kg N/da (GKGM 2–4), mercimek 2,3 kg N/da (GKGM 12–14 kg DAP). Aşısızsa TAGEM tablosu kullanılır ve "aşılayın" uyarısı çıkar. | official ✓ |
| 1c. Tablo yoksa | Önce verim eğrisi (soğan, Albayrak ve Elmacı 2017: tepe noktası 13 kg N/da), o da yoksa raporun **besin dengesi**: hedef verim × birim alım − topraktan alınan, sonuç gübre etkinliğine bölünür. Hiçbiri yoksa `pending` döner. | literature / **assumption** |
| 2. Gübre seçimi | Taban gübre fosforu karşılar (N ve K'sı da sayılır). Kalan K için potasyum sülfat, kalan N üst gübreye gider ve dönemlere bölünür (buğday sulu %60 kardeşlenme, %40 sapa kalkma). | YAML'daki koşullar |
| 3. Toprak bayrakları | pH > 7,5 alkali · kireç > %15 yüksek · organik madde < %1 çok az · toplam N < %0,09 az · EC > ürün eşiği tuzlu · Zn < 0,5 mg/kg eksik · çinko analizi yoksa ve toprak alkali/kireçliyse "çinko muhtemelen eksik" | OGM, Başar 2001, FAO 29, Cakmak 1996 ✓ |
| 4. Uyarılar | Bayraklara ve isteğe göre: çinkolu kompoze, CAN mı üre mi, bant uygulama, tuzlulukta arpa, patateste pH > 7,7 ise kükürt, damla tankında kalsiyum nitrat karıştırma vb. | her uyarının kendi kaynağı |
| 5. Karşılaştırma | Buğdayda Toros rehberinin hedef verime göre ürün dozları (`guide`) yan yana gösterilir. Besin dengesi sonucu da (`balance_kg_per_da`) "çapraz kontrol" olarak durur. | literature ✓ / assumption |

Örnek: buğday, kuru tarım, organik madde %1,5, P2O5 3,5 kg/da, K2O 22 kg/da, pH 8,0, kireç %18.
- TAGEM'e göre gereken saf besin: N 8, P2O5 6, K2O 4 kg/da.
- Çinko analizi yok ve toprak kireçli, bu yüzden taban gübre 30 kg/da çinkolu 20-20-0 (6 kg N'yi de karşılar).
- Potasyum için 8 kg/da potasyum sülfat.
- Kalan 2 kg N için kardeşlenmede 7,7 kg/da CAN.
- Toros rehberinin 250–300 kg/da satırı yanında gösterilir: 12 kg DAP ya da 26 kg çinkolu 20-20-0, üstüne 14 kg CAN.

## 3. Kapsanan ürünler

| id | Ürün | Rotasyonda mı? | TAGEM satırları |
|---|---|---|---|
| `wheat` | Buğday | evet | N, P, K: Kuru + Sulu |
| `barley` | Arpa | hayır | N, P: Kuru + Sulu (K satırı yok → denge, ABD alım değeri) |
| `chickpea` | Nohut | evet | N, P: Kuru (K yok → `pending`) |
| `lentil` | Mercimek | evet | N, P: Kuru (K yok → denge, zayıf kaynak) |
| `sugar_beet` | Şeker pancarı | hayır | N, P, K: Sulu (N tavanı 15) |
| `potato` | Patates | hayır | N, P, K: Sulu |
| `onion` | Kuru soğan | hayır | N, P: Sulu; K: "Sebze" satırı (**kabul**) |

Pancar, patates ve soğan kuru tarımda yetiştirilmez. `rainfed` seçilirse tablo yoktur, plan `pending` ya da verim eğrisi gösterir. Simülasyonda bu üç ürün için kuru tarım seçeneğini gri gösterin ya da hiç sunmayın.

## 4. API (İsmail sadece bunları çağırır; bileşende gübre hesabı yok)

```ts
import type { FertilizerFile, ResultsFile } from './lib/types';
import { soilFromResults, recommend, type SoilTest, type FertPlan } from './lib/fertilizer';

const fert: FertilizerFile = await (await fetch('/data/fertilizer.json')).json();

// 1) İlçe seçildi → SoilGrids'ten ön değer (pH, toplam N, organik madde). Rozet: model
const pre = soilFromResults(results, fert);   // { soil, badges, needs_lab }

// 2) Kullanıcı analiz raporundan girer (rozet: user). Boş bırakılan alan undefined kalır.
const soil: SoilTest = { ...pre.soil, p2o5_kg_per_da: 3.5, k2o_kg_per_da: 22, lime_pct: 18 };

// 3) Plan
const plan: FertPlan = recommend(fert, {
  crop: 'wheat', water: 'rainfed', soil,
  target_yield_kg_per_da: undefined,   // boşsa YAML varsayılanı (buğday kuru 296, TÜİK); tablolar hedef istemez
  inoculated: false,                   // sadece baklagil
  banding: false,                      // kombine mibzer: kompoze −2, DAP −1 kg/da (Toros)
  drip: false,                         // sadece uyarı ekler
});
```

`SoilTest` alanları Türk laboratuvar raporundaki gibidir: `om_pct`, `p2o5_kg_per_da`, `k2o_kg_per_da`, `total_n_pct`, `ph`, `lime_pct`, `ec_ds_m`, `zn_ppm`. Rapor ppm veriyorsa `olsen_p_ppm` / `k_ppm` da girilebilir. Bunlar 0–20 cm ve 250 000 kg toprak/da kabulüyle kg/da'ya çevrilir ve `plan.derived` listesine düşer; rozeti **assumption** olur.

`FertPlan` içinde gösterilecekler:

| Alan | Ne göster |
|---|---|
| `nutrients[]` | N, P2O5, K2O için `fertilizer_kg_per_da` + `source.type` rozeti. `basis`: `soil_table` "Resmi tablo (TAGEM)"; `fixed_starter` "Baklagil başlangıç dozu"; `response_curve` "Verim eğrisi"; `balance` "Hesap (doğrulanmamış katsayılar)"; `needs_soil_test` "Toprak analizi gerekli"; `pending` "Kaynak bekleniyor" (sayı değil). |
| `doses[]` | Gübre adı (`fert.products[id].label`), kg/da, zaman (`timing`: `base` ekimle/taban, `top_1`, `top_2` → etiket `fert.crops[crop].n_split[water][i].label`). |
| `flags[]` | Rozet chip'leri: alkali, kireçli, organik madde çok az, tuzlu, çinko eksik / muhtemelen eksik. |
| `advice[]` | `text.tr` / `text.en` + kaynak + rozet. Sıra: önce ürüne ait, sonra genel. |
| `missing[]` | "Bu değerleri analiz ettirirsen plan netleşir: …" |
| `better_for_salinity[]` | Tuzluysa: "Bu tuzlulukta daha dayanıklı: arpa, şeker pancarı". |
| `guide` | Buğday için "Toros rehberi bu verim sınıfında: …" karşılaştırma satırı. |
| `need_kg_per_da`, `soil_supply_kg_per_da`, `balance_kg_per_da` | İsteğe bağlı "çapraz kontrol" açılır kutusu, rozet **assumption** (rapor katsayıları kaynakta bulunamadı). |

## 5. Simülasyon akışı (öneri)

1. **İlçe seç:** `results/{loc}.json` → `soilFromResults`. pH, organik madde ve toplam N **model** rozetiyle dolu gelir. P, K, kireç, EC ve Zn boş kalır (`needs_lab`). Yanlarına "uydu ölçemez, analiz gerekir" yazın.
2. **Ürün ve sulama seç:** 7 ürün; `water` kuru / kısıtlı sulu / sulu. Rotasyon ekranından gelindiyse ürün `wheat`, `chickpea` ya da `lentil`, sulama `rainfed` olur.
3. **Toprak analizini gir (isteğe bağlı):** her alan ayrı bir kaydırıcı ya da kutu. Değiştikçe `recommend` yeniden çağrılır (hesap anlık, ağ isteği yok).
4. **Sonuç kartı:**
   - Üstte cümle: "Bu tarla ve ürün için önerilen gübre planı: …"
   - Altta zaman çizelgesi: ekimle, kardeşlenme, sapa kalkma.
   - Her satırda gübre adı, kg/da ve rozet.
5. **"Neden?" bölümü:** hangi tablo sınıfına düşüldü (ör. "organik madde %1,5 → 1,1–2,0 sınıfı → 8 kg N/da"), bayraklar ve uyarılar.
6. **Rotasyon bağlantısı:** "Nohut → Buğday" seçildiyse önce nohut planını (aşılı varsayılan), sonra buğday planını gösterin. Gübre kararı rotasyon puanına **girmez**; sadece bilgi olarak durur.

## 6. Gösterim kuralları (AGENTS.md)

- **Para yok:** TL, fiyat, maliyet ya da tasarruf yazılmaz. Sadece kg/da gösterilir. "Gübreden tasarruf" yerine "daha az gübre yeter" denir.
- **Öneri dili:** "önerilir", "önerilen plan". "Kesin", "mutlaka", "yasak" ya da "garanti" yazılmaz.
- **Rozet:** her sayının yanında `source.type` olur (official, literature, statistic, model, assumption, user). `verified: false` olanlar "doğrulanmadı" olarak işaretlenir.
- **`null` sayı değildir:** `fertilizer_kg_per_da: null` ise "toprak analizi gerekli" ya da "kaynak bekleniyor" yazın, asla 0 yazmayın.
- **Yuvarlama:** modül 0,1 kg/da'ya yuvarlar. Arayüzde tam sayı göstermek serbest, ama hesapta modülün değeri kullanılır.

## 7. Rapordan alınmayanlar ve neden

15 Kasım'daki ekip raporunun (yapay zekâ destekli özet) sayıları kaynaklarında tek tek arandı:

| Rapordaki iddia | Durum |
|---|---|
| Toros buğday tablosu (DAP 13–14 / CAN 28–32 …) | **Yanlış**: Toros sayfası farklı (kuru 300–400: DAP 14, CAN 16). Gerçek değerler `guide_table`'da. |
| Pancar için topraktaki P2O5'e göre tablo (altinkukurt) | Sayfada **yok**; yerine TAGEM Çizelge 22 kullanıldı. |
| Pancar "4–5 kg N/da kaldırır" | Kaynak bulunamadı. TAGEM'de N en çok 15, bu tavan olarak kullanıldı. |
| Patates damla sulama takvimi (25.–85. günler) | Kaynak bulunamadı; Toros "uzmana danışın" diyor. Takvim yerine bu uyarı veriliyor. |
| Patateste 60–70 kg/da kükürt (uyuz) | Bulunamadı. Toros: pH > 7,7 ise dikimden bir ay önce toz kükürt (doz yok). |
| Patates 55–60 kg 15.15.15 / 40–45 kg 20.20.0 | Bulunamadı; TAGEM tablosu kullanılıyor. |
| Soğanda "ekonomik optimum 12,91 kg N" | 12,91 makalede **fiyatla** hesaplanmış ekonomik doz, bu yüzden kullanılmadı. Verimin tepe noktası 13 kg N/da (Yalova denemesi). |
| Bant uygulamada %10–15 azaltma | Toros: kompoze −2 kg, DAP −1 kg/da. Bu kullanıldı. |
| Toprak kütlesi 250 000 kg/da; %5, %40 yarayışlılık; %60/30/50 gübre etkinliği | Kaynakta bulunamadı. Sadece ppm çevirisinde ve çapraz kontrolde, **assumption** rozetiyle. |
| Nohut "aşılıysa 2–3 kg N" | GKGM 2–4 diyor; orta değer 3 kullanıldı. |
| Hava durumu API'si ile üre ya da yaprak gübresi zamanlaması | Yok. Sadece metin uyarısı var: "sıcakta ve 5–10 gün yağışsız dönemde üre kaybı"; yaprak gübresini sabah ya da akşam uygulayın. |

## 8. Değiştirmek gerekirse

- Sayı ya da kural değişikliği: `engine/config/fertilizer.yaml` (Gümüş). Ardından `cd engine && python -m nobetsu.build --out ../web/public/data` ya da sadece export.
- Testler: `engine/tests/test_fertilizer.py` (YAML bütünlüğü, TAGEM spot değerleri, para ve yasak kelime yok) ve `web/src/lib/fertilizer.test.ts` (elle hesaplanmış planlar).
- Yeni ürün eklemek için kod yazılmaz; YAML'a yeni bir `crops.<id>` girilir. Yalnız ürün `FertCropId` tipine ve şemanın `crops` listesine de eklenmeli (sözleşme değişikliği, Gümüş).
