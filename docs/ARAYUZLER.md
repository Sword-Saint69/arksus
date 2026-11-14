# Arayüzler — kimin kodu kime ne verir (M0'da donar)

Bu dosya, Ömer, Gümüş ve İsmail'in **birbirini beklemeden** kod yazıp sonra branch'leri sorunsuz birleştirmesi için var.
PLAN_MVP §4 dışarıya giden JSON'u tanımlar; bu dosya ayrıca **içerideki** bağlantıları (Python fonksiyonları, ara dosyalar, TypeScript API) tanımlar.

**Değişiklik kuralı.** Aşağıdaki fonksiyon adları, alan adları ve dosya yolları T+1'de (M0) donar. Bir şey değişmesi gerekirse:
1. Gümüş'e (sözleşme sahibi) yaz.
2. Gümüş aynı saat içinde **tek PR'da** bu dosyayı + `web/src/lib/types.ts` + `docs/contract/*.schema.json` + mock JSON'u günceller.
3. Gruba `SÖZLEŞME DEĞİŞTİ: <ne>` mesajı atar. Herkes `main`'i kendi branch'ine çeker.

Kimse "geçici olarak" yeni bir alan adı uydurmaz. AI ajanları da uydurmaz.

---

## 1. Büyük resim

```
                 Gümüş                         Ömer                           Gümüş                     İsmail
┌──────────────────────────┐   ┌───────────────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│ power.load_weather()     │──►│ runner.run_location()         │──►│ export.write_all()   │──►│ web/public/data/*.json
│ data/soilgrids/{loc}.json│──►│   et0 → waterbalance →        │   │  (+ şema doğrulama)  │   │   ↓ types.ts (Gümüş)
│ config: locations,       │   │   rotations → yield →         │   │                      │   │   ↓ economics.ts     │
│   rotations, defaults,   │   │   indicators                  │   │                      │   │     (Gümüş)          │
│   references             │   │ validate.run_checks()  ───────┼──►│                      │   │   ↓ React UI (İsmail)│
└──────────────────────────┘   └───────────────────────────────┘   └──────────────────────┘   └─────────────────────┘
                       build.py (Gümüş) hepsini sırayla çağırır:  make data   |   make mock (sahte runner ile)
```

Akış tek yönlü: kimse kendinden sonraki adımın koduna bakmak zorunda değil, sadece bu dosyadaki biçime uyar.

---

## 2. Hava verisi — `power.py` (Gümüş) → motor (Ömer)

```python
# engine/nobetsu/power.py
def load_weather(location_id: str) -> pd.DataFrame: ...
```

- **İndeks:** günlük, kesintisiz `DatetimeIndex` (adı `date`), 2000-01-01 → POWER'ın son tarihi.
- **Sütunlar (adlar ve birimler sabit):**

| Sütun | POWER parametresi | Birim |
|---|---|---|
| `precip_mm` | PRECTOTCORR | mm/gün |
| `tmax_c` | T2M_MAX | °C |
| `tmin_c` | T2M_MIN | °C |
| `tdew_c` | T2MDEW | °C |
| `rh_pct` | RH2M | % |
| `u2_ms` | WS2M | m/s |
| `u2max_ms` | WS2M_MAX | m/s |
| `rs_mj_m2` | ALLSKY_SFC_SW_DWN | MJ/m²/gün (başlıkta başka birim yazıyorsa Gümüş çevirir) |

- **`df.attrs`:** `location_id`, `lat`, `lon`, `elevation_m` (POWER başlığından), `first_date`, `last_date` (ISO), `gaps_filled` (int), `source` = `"NASA POWER daily, community=AG"`.
- `-999` → NaN; ≤ 3 günlük boşluklar doğrusal doldurulur. **Doldurulamayan NaN kalırsa `load_weather` hata verir** (motor NaN görmez).
- API'ye sadece önbellek yoksa gidilir: `data/raw/power_{location_id}.json`.

**Ömer beklerken:** testlerde kendi sentetik `DataFrame`'ini aynı sütun adlarıyla üretir (`engine/tests/fixtures.py`).

---

## 3. Toprak verisi — SoilGrids (Gümüş) → motor (Ömer) ve export (Gümüş)

Gümüş her lokasyon için `data/soilgrids/{location_id}.json` yazar:

```jsonc
{
  "location_id": "karapinar",
  "how_obtained": "wcs | gee | manual_viewer",
  "properties": [ /* PLAN_MVP §4.2 soil.properties öğeleriyle birebir aynı */ ],
  "awc_mm_per_m": { "value": 0, "unit": "mm/m",
                    "source": "SoilGrids 2.0 wv0033−wv1500, cfvo düzeltmeli, 0–100 cm ağırlıklı",
                    "type": "model", "verified": false }
}
```

- Ömer AWC'yi buradan okur. **Dosya yoksa** `soil.yaml`'daki FAO-56 Tablo 19 değerini kullanır ve `type: "assumption"` yapar.
- Motorun **gerçekte kullandığı** AWC, `run_location` çıktısında `awc_used` olarak döner (§5); export bunu `results.soil.awc_mm_per_m`'ye yazar.

---

## 4. Config dosyaları ve değer nesnesi (V)

Tüm YAML'lar `engine/config/` altında. Okuma: `nobetsu.config.load("crops")` → `dict` (Gümüş yazar, 10 satır).

| Dosya | Sahibi | İçerik |
|---|---|---|
| `locations.yaml` | Gümüş | id, name, district, province, lat, lon, note |
| `rotations.yaml` | Gümüş (metin: Muhammet) | id, is_baseline, crops, label, soil_traits, strategy |
| `defaults.yaml` | Gümüş (değer: Muhammet) | Ym, fiyat, maliyet, destek — lokasyon × ürün |
| `references.yaml` | Gümüş (değer: Muhammet) | deneme verimleri, PSE aralığı, MGM normalleri, sıcak gün eşiği |
| `crops.yaml` | Ömer (takvim: Muhammet) | ekim, evre süreleri, Kcb, p, Zr_max, h_max, Ky |
| `soil.yaml` | Ömer | derinlik sınıfları (id, depth_m, label), Ze, TEW/REW, yedek AWC |

Her sayısal parametre **değer nesnesi (V)** biçimindedir (PLAN_MVP §4.4 ile aynı):

```yaml
cost_tl_per_da:
  value: 0
  unit: "TL/da"
  source: "Konya Ziraat Odası 2026 maliyet tablosu"
  source_url: "https://..."
  type: official | statistic | literature | assumption
  verified: false
  as_of: "2026-11-14"
```

**M0 netleştirmeleri (Gümüş):**
- `value: null` = değer henüz kaynaklı değil (**pending**). Sitede sayı yerine "bekleniyor" gösterilir; `economics.ts` bunu 0 sayar. Mock build'de pending değerler sahte sayıyla ve `source: "MOCK ..."` ile doldurulur.
- `soil.yaml` (Ömer) derinlik sınıflarını `depth_classes: [{id, depth_m, label: {en, tr}}]` olarak tutar (`depth_m` sayı veya V). Dosya yoksa export PLAN_MVP §4.1'deki 0.6 / 0.9 / 1.2 m değerlerini kullanır.
- `references.yaml` anahtarları (Ömer `validate.py`'de bunları okur): `trial_yields_kg_per_da.{after_fallow, after_lentil, after_chickpea}`, `pse_range.{low, high}` (oran, 0–1), `mgm_annual_precip_mm.{karapinar, develi}` (+ `station`), `heat_threshold_c`. Hepsi V.

Derinlik sınıfı id'leri sabit: `shallow`, `medium`, `deep`. Rotasyon id'leri sabit: `fallow_wheat`, `chickpea_wheat`, `lentil_wheat`. Lokasyon id'leri sabit: `karapinar`, `develi`. Ürün id'leri sabit: `wheat`, `chickpea`, `lentil`, `fallow`.

---

## 5. Motor çıktısı — `runner.py` (Ömer) → `export.py` (Gümüş)

```python
# engine/nobetsu/runner.py
def run_location(location_id: str, weather: pd.DataFrame, soilgrids: dict | None) -> dict: ...
```

Dönüş (`EngineOutput`):

```python
{
  "location_id": "karapinar",
  "awc_used": { "value": ..., "unit": "mm/m", "source": "...", "type": "model|assumption", "verified": False },
  "sequences": [ ... ],   # 216 satır = 3 rotasyon × 3 derinlik × 24 yıl; her satır PLAN_MVP §4.2 'sequences' öğesiyle BİREBİR aynı anahtarlar
  "ledger":    [ ... ],   # 216 seri; her biri PLAN_MVP §4.3 'series' öğesiyle BİREBİR aynı
  "diagnostics": { "max_mass_balance_error_mm": 0.0, "n_sequences": 216 }
}
```

Kurallar:
- `start_year` 2001…2024 (dahil). Ay listeleri (`bare_by_month`, `stress_by_month`, `fullness_by_month`) **tam 24 eleman**, eleman 0 = y yılının Temmuzu.
- `fallow_wheat` için `first_crop: None`; diğerlerinde `fallow_storage_efficiency: None`.
- `ledger.weeks[].week_start`: 1 Temmuz y'den başlayan 7 günlük bloklar (ISO tarih). `crop` alanı haftadaki günlerin çoğunluğu: `"fallow" | "bare" | "wheat" | "chickpea" | "lentil"` (nadas rotasyonundaki boş dönem `fallow`, baklagil rotasyonlarındaki boş dönem `bare`).
- Sayılar ham `float`/`int` döner; **yuvarlamayı export yapar** (§10).
- Para, fiyat, TL **yok**. Motor sadece fizik ve oran üretir.

---

## 6. Doğrulama — `validate.py` (Ömer) → `export.py` (Gümüş)

```python
# engine/nobetsu/validate.py
def run_checks(outputs: dict[str, dict], weather: dict[str, pd.DataFrame], refs: dict) -> list[dict]: ...
```

- `outputs`: `{location_id: EngineOutput}`; `refs`: `config.load("references")`.
- Dönüş: PLAN_MVP §4.5 `checks` listesi (5 kontrol, bu sırayla): `mass_balance`, `et0_fao56_ex18`, `pse_literature`, `trial_ratio`, `precip_vs_mgm`.
- Referans değeri henüz yoksa (`refs` içinde boş) o kontrol `status: "pending"` döner, hata vermez.

---

## 7. Export ve build — Gümüş

```python
# engine/nobetsu/export.py
def write_all(outputs: dict[str, dict], checks: list[dict], mock: bool, out_dir: str = "web/public/data",
              weather_meta: dict[str, dict] | None = None) -> None: ...
# weather_meta = {loc: load_weather(loc).attrs} → site_index.locations[].elevation_m ve power_range

# engine/nobetsu/build.py   →  make data  /  make mock
#   for loc in locations: w = load_weather(loc); s = soilgrids json; out[loc] = run_location(loc, w, s)
#   checks = run_checks(out, weathers, refs); write_all(out, checks, mock=False)
#   --mock: run_location yerine mock.fake_run_location (aynı biçim) kullanılır, mock=True
```

`mock.fake_run_location()` §5'teki biçimi sahte sayılarla üretir. Böylece **export ve web ilk saatten gerçek kod yoluyla test edilir**; Ömer'in motoru gelince sadece fonksiyon değişir.

---

## 8. JSON sözleşmesi — export (Gümüş) → web (İsmail)

Biçim: PLAN_MVP §4. Dosyalar `web/public/data/` altında:

| Dosya | Ne zaman yüklenir |
|---|---|
| `site_index.json` | sayfa açılınca |
| `results/{location_id}.json` | lokasyon seçilince |
| `defaults.json` | sayfa açılınca |
| `validation.json` | sayfa açılınca |
| `smap/{location_id}.json` | lokasyon seçilince (**her zaman vardır**; veri yoksa `available: false`, `latest: null`, listeler boş). Mock'ta Karapınar `available: true`, Develi `false` (iki UI durumu da denenebilsin) |
| `ledger/{location_id}.json` | Grafik B görünür olunca (lazy) |

Netleştirmeler:
- `site_index.start_years: [2001, 2024]` = **[ilk, son]**, ikisi dahil.
- `rotations` dizisinde baz senaryo (`is_baseline: true`) **her zaman ilk** sırada.
- `source_url` her yerde isteğe bağlıdır (boş olabilir); `source` zorunludur.
- Her dosyada `schema_version: "1.0"`, `mock`, `generated_at`.
- Şema dosyaları: `docs/contract/*.schema.json` (Gümüş). `pytest` hem mock hem gerçek çıktıyı bunlarla doğrular. `web/src/lib/contract.test.ts` mock JSON'u `types.ts` tiplerine atayarak tip kaymasını yakalar.

---

## 9. Ekonomi API'si — `economics.ts` (Gümüş) → web (İsmail)

İsmail **para hesabını kendisi yapmaz**; sadece bu fonksiyonları çağırır. Gümüş M0'da bu imzaları basit çalışan bir sürümle koyar; T+4'e kadar testli gerçek sürümle değiştirir. İmzalar değişmez.

```ts
// web/src/lib/economics.ts
import type { SiteIndex, ResultsFile, DefaultsFile, SequenceRow, Rotation } from './types';

export type CropId = 'wheat' | 'chickpea' | 'lentil' | 'fallow';
export type Badge = 'measured' | 'model' | 'official' | 'statistic' | 'literature' | 'assumption' | 'user';

export interface CropInputs {
  ym_kg_per_da?: number;      // fallow'da yok
  price_tl_per_kg?: number;   // fallow'da yok
  cost_tl_per_da: number;
  support_tl_per_da: number;
}
export type LocationInputs = Partial<Record<CropId, CropInputs>>;

export function inputsFromDefaults(d: DefaultsFile, locationId: string): LocationInputs;

export interface Range { p10: number; p50: number; p90: number }
export function percentile(values: number[], p: number): number;   // p: 0–100, §10'daki yöntem
export function range(values: number[]): Range;

export interface SequenceMoney {
  start_year: number;
  wheat_kg_per_da: number;
  first_crop_kg_per_da: number | null;
  income_tl_per_da: number;
  cost_tl_per_da: number;
  net_2yr_tl_per_da: number;
}
export function sequenceMoney(row: SequenceRow, rotation: Rotation, inp: LocationInputs): SequenceMoney;

export function breakEvenYield(cost: number, support: number, price: number): number; // (cost − support) / price

export interface RotationSummary {
  rotation_id: string;
  depth_id: string;
  is_baseline: boolean;
  nets: number[];                         // 24 değer, start_year sırasıyla (Grafik A)
  net_2yr: Range;
  loss_probability: number;               // 0–1
  wheat_kg_per_da: Range;
  first_crop_kg_per_da: Range | null;
  water_at_wheat_sowing_mm: Range;
  bare_days_p50: number;
  wind_exposed_bare_days_p50: number;
  wheat_stress_days_p50: number;
  wheat_break_even_kg_per_da: number;
  delta_vs_baseline: {                    // baz senaryoda null
    net_2yr_p50: number; water_p50: number; bare_days_p50: number; wind_exposed_p50: number;
  } | null;
}
export function summarize(results: ResultsFile, site: SiteIndex, depthId: string, inp: LocationInputs): RotationSummary[];

export type Tercile = 'dry' | 'normal' | 'wet';
export interface FlipCell { depth_id: string; tercile: Tercile; rotation_id: string; median_net: number; n_years: number }
export function flipTable(results: ResultsFile, site: SiteIndex, inp: LocationInputs): FlipCell[]; // 9 hücre

export interface Priorities { water: number; income: number; soil: number }  // 0–100, toplam 100
export interface RankedRotation {
  rotation_id: string;
  score: number;                           // 0–1
  driver: 'water' | 'income' | 'soil';     // sıralamayı en çok belirleyen ölçüt
  parts: { water: number; income: number; soil: number };
}
export function rankByPriority(s: RotationSummary[], pr: Priorities): RankedRotation[]; // yüksekten düşüğe
```

Para kuralı (PLAN_MVP §5.5): `income = Σ (yield_ratio × Ym × price) + Σ support`; `cost = cost[ilk yıl ürünü] + cost[wheat]`; nadas yılı: sadece destek ve maliyet.

---

## 10. Ortak tanımlar (Python ve TypeScript aynı sonucu versin)

- **Yüzdelik:** doğrusal ara değer, numpy varsayılanı (`np.percentile(x, p)`, "type 7"). TS'de aynısı yazılır ve aynı örnek dizi ile test edilir.
- **Tercile (kurak/normal/ıslak):** her lokasyonda 24 başlangıç yılı, `fallow_wheat` + `medium` satırlarındaki `pre_sowing_precip_mm`'e göre sıralanır: en düşük 8 = `dry`, orta 8 = `normal`, en yüksek 8 = `wet`. (Yağış rotasyona ve derinliğe göre değişmez; bu sadece hangi satırdan okunacağını sabitler.)
- **Yuvarlama (export'ta):** mm → 1 ondalık; oranlar ve verimlilik → 3 ondalık; `fullness` → 1 ondalık; gün sayıları → tam sayı.
- **Tarihler:** ISO `YYYY-MM-DD`, yerel saat (POWER `time-standard=LST`).
- **Birim notu (UI):** 1 mm su = 1 m³/da.

---

## 11. Mock stratejisi — herkes ilk dakikadan çalışabilsin

| Kim | Neyi beklemeden ne ile çalışır |
|---|---|
| İsmail | `web/public/data/` altındaki mock JSON + M0 `economics.ts` |
| Gümüş | `mock.fake_run_location()` ile export/build; Ömer'in motoru gelince tek satır değişir |
| Ömer | Sentetik hava `DataFrame`'i (§2 sütunları) ile testler; POWER önbelleği gelince gerçek sekans |
| Muhammet | Hiçbir koda bağlı değil; `docs/SOURCES.md` satırlarını doldurur |

Mock sayılar "makul ama belli ki sahte" olur (ör. tüm yıllar düzgün bir eğri), `mock: true` ve sitede bant görünür.

---

## 12. Teslim takvimi — kim, kime, ne, ne zaman

| Saat | Kimden → Kime | Ne | Gecikirse |
|---|---|---|---|
| T+0:10 | Gümüş → herkes | Repo + AGENTS.md + bu dosya | — |
| T+0:30 | Gümüş → Muhammet | İki lokasyonun koordinatları | Muhammet ilçe merkezini kullanır, not düşer |
| T+1 | İsmail → herkes | Web iskeleti + Vercel linki | — |
| T+1 | Gümüş → İsmail | `types.ts`, mock JSON, `economics.ts` imzaları | İsmail PLAN §4'ten geçici yerel tip yazmaz, bekler; bu arada layout yapar |
| T+2 | Gümüş → Ömer | POWER önbelleği + `load_weather()` | Ömer sentetik havayla devam eder |
| T+2:45 | Gümüş → Ömer | `data/soilgrids/*.json` (AWC) | FAO-56 Tablo 19 yedek AWC (`assumption`) |
| T+3 → T+5 | Muhammet → Gümüş | Fiyat, destek, maliyet, Ym (`SOURCES.md`) | `assumption` olarak kalır |
| T+6 | Muhammet → Ömer | Ekim/hasat takvimleri | FAO-56 başlangıç değerleri |
| T+7 | Muhammet → Gümüş → Ömer | Deneme verimleri, PSE aralığı, MGM normalleri (`references.yaml`) | İlgili kontrol `pending` |
| T+7:30 | Ömer → Gümüş | `run_location()` gerçek çıktı | M2 mock ile değil, kısmi gerçek veriyle |
| T+9 | Muhammet → Gümüş / İsmail | Strateji metinleri → `rotations.yaml`; sözlük → `strings.ts` | "metin bekleniyor" yer tutucusu |
| T+9 | Gümüş → İsmail | Gerçek JSON (`mock: false`) | mock kalır, bant görünür |
| T+12–14 | Muhammet → İsmail | Kullanıcı testi notları | — |
