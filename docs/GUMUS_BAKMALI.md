# Gümüş'ün bakması gerekenler (Ömer'den)

> **14 Kas, main → omer birleştirmesi sonrası:** M0 iskeletin geldi; işaretli (`[x]`) maddeler senin iskeletinde zaten karşılanmış (Ömer kontrol etti). Motorun gerçek çıktısı sentetik havayla senin `export.write_all` + şemalarından **hatasız geçti** (9 dosya). Açık kalanlar: POWER, SoilGrids, `build.py`'nin motoru çağırması (`validate.py` gelince).

Ömer'in motor işi sırasında çıkan, **Gümüş'ün dosyalarında** yapılması gereken şeyler. Ömer bu dosyalara dokunmuyor (dosya sahipliği kuralı). Yaptığını `- [x]` ile işaretle.

Yeni madde eklendikçe en alta tarihle yazılır.

## 1. `engine/pyproject.toml`

- [x] Bağımlılıklar: `numpy`, `pandas`, `pyyaml`, `pytest` (planda zaten var; Ömer'in kodu başka paket kullanmıyor).
- [x] pytest ayarı: testler `from nobetsu import ...` ve `from tests.fixtures import ...` diye import ediyor. Bunun düz `pytest` komutuyla da çalışması için:

  ```toml
  [tool.pytest.ini_options]
  pythonpath = ["."]
  testpaths = ["tests"]
  ```

  Şu an sadece `cd engine && python -m pytest` ile çalışıyor.
- [x] pandas 3.x ile test edildi (3.1.1). Daha eski sürüme sabitlersen haber ver; `DatetimeIndex.day_of_year` kullanılıyor.

## 2. `engine/nobetsu/__init__.py`

- [x] Dosya henüz yok. Şu an `nobetsu` "namespace package" olarak çalışıyor; sen boş `__init__.py` ekleyince bir şey bozulmaz. `engine/tests/__init__.py` **ekleme** (gerek yok, eklersen import yolu değişir).

## 3. `Makefile`

- [x] `make test` Python tarafı: `cd engine && python -m pytest` (ya da madde 1'deki ayardan sonra `pytest`).

## 4. `.gitignore` (sahibi yok, repo düzeni sende)

- [x] `__pycache__/`, `.pytest_cache/`, `.venv/`, `node_modules/`, `web/dist/` eklenmeli. Şu an dosya yok; Ömer önbellekleri elle siliyor.

## 5. `power.load_weather()` — motorun beklediği

- [x] `df.attrs["lat"]` **derece** ve `df.attrs["elevation_m"]` zorunlu; eksikse `et0_from_weather` `KeyError` verir.
- [x] ET₀ şu sütunları kullanıyor: `tmax_c, tmin_c, tdew_c, u2_ms, rs_mj_m2`. Nem için `tdew_c` kullanılıyor (`rh_pct` değil). NaN görürse `ValueError` verir.
- [x] `rs_mj_m2` gerçekten MJ/m²/gün olmalı. POWER başlığı kWh/m²/gün derse × 3,6 ile çevir.

## 6. Ömer'in hazır verdiği

- `engine/nobetsu/et0.py` → `et0_from_weather(weather) -> pd.Series` (adı `et0_mm`, indeks hava tablosuyla aynı).
- `engine/tests/fixtures.py` → `synthetic_weather(start, end)`: ARAYUZLER §2 sütunları ve `attrs` ile sahte hava. `mock.py` ya da `test_power.py` için kullanabilirsin (import et, kopyalama).

## 7. Su bütçesi motoru geldikten sonra (14 Kas, `omer/waterbalance`)

- [x] **`nobetsu/config.py`** → `load("crops")` ve `load("soil")` YAML'ı **olduğu gibi düz `dict`** döndürmeli (V nesnelerini açma, `value`'ya indirgeme). Motor `cfg["wheat"]["kcb_mid"]["value"]` diye okuyor. Şimdilik testler `tests/fixtures.load_config()` ile aynı işi yapıyor; `config.py` gelince `runner.py` onu kullanacak.
- [x] **`rotations.yaml`** → `crops` listesi tam 2 eleman, `[ilk yıl, ana ürün]` sırasıyla ve id'ler `crops.yaml`'daki anahtarlarla aynı olmalı: `["fallow","wheat"]`, `["chickpea","wheat"]`, `["lentil","wheat"]`. Motor son elemanı ana ürün (spin-up + 2. yıl) sayıyor.
- [x] **`site_index.depth_classes`** → `engine/config/soil.yaml` içindeki `depth_classes` listesinden oku (id, depth_m, label sözleşmedekiyle aynı yazıldı).
- [x] **`load_weather()` aralığı** → her sekans 1 Ekim `y−1`'de başlıyor ve son buğday hasadına kadar sürüyor. 2001 sekansı için **2000-10-01**, 2024 sekansı için **2026-07-12**'ye kadar veri şart (şu anki takvimle). Eksikse `daily_inputs` `ValueError` verir.
- [x] **`data/soilgrids/{loc}.json`** → `awc_mm_per_m.value` gelmezse motor `soil.yaml`'daki yedek değeri (150 mm/m, `assumption`) kullanacak.
- [x] **Bilgi (sözleşme netleştirmesi, değişiklik değil):** `ledger.weeks` her seride **104 hafta** (1 Temmuz `y`'den başlayan, 24 aylık pencerenin içine tam sığan 7 günlük bloklar; Haziran `y+2`'nin son 2–3 günü dışarıda kalır). Şemada `weeks` uzunluğunu 104 olarak sabitleyebilirsin. Farklı istiyorsan Ömer'e yaz.
- [ ] **Bilgi:** aylık listeler (24 eleman) 1 Temmuz `y` → 30 Haziran `y+2` penceresini kapsıyor; buğday hasadı ~12 Temmuz `y+2` olduğu için buğdayın `eta_mm / etc_mm / stress_days` toplamları pencerenin 12 gün dışına taşıyor (sezonun tamamı sayılıyor). Sözleşmede buna aykırı bir şey yok, haberin olsun.

## 8. `runner.run_location()` hazır (14 Kas, `omer/runner`)

- [x] **`build.py`** → `from nobetsu.runner import run_location`; imza ARAYUZLER §5 ile aynı: `run_location(location_id, weather, soilgrids)`. (Ek, isteğe bağlı `start_years=[...]` parametresi sadece test/kısmi koşu için; verme.) Bir lokasyon ~9 sn sürüyor.
- [x] **`references.yaml`** → sıcak gün eşiği: motor senin sözleşmendeki `heat_threshold_c` anahtarını okuyor (Ömer kendi tarafını düzeltti). Anahtar yoksa 30 °C ile devam eder ve uyarı basar.
- [x] **`rotations.yaml`** → motor şu üç biçimden birini okur: en üstte liste `[{id, crops, ...}]`, ya da `rotations: [...]`, ya da `{fallow_wheat: {crops: [...]}, ...}`. Dosya yoksa üç sözleşme id'siyle devam eder ve uyarı basar.
- [x] **`config.py`** → `nobetsu.config.load(name)` gelince runner otomatik onu kullanır; yoksa YAML'ı kendisi okur. `load` dosya yoksa `FileNotFoundError` versin.
- [x] **`mock.fake_run_location()`** için biçim örneği: `engine/tests/test_runner.py` içindeki `SEQUENCE_KEYS`, `FIRST_CROP_KEYS`, `WHEAT_KEYS`, `WEEK_KEYS` listeleri gerçek çıktının anahtar sırası. Tipler: gün sayıları `int`, diğerleri `float`; `fallow_wheat` → `first_crop: None`, diğerleri → `fallow_storage_efficiency: None`.
- [ ] **Bilgi:** `stress_by_month` pencere içindeki **tüm ürün günlerini** sayıyor (spin-up buğdayının Temmuz `y` başındaki son günleri ve ilk yıl baklagili dahil), sadece 2. yıl buğdayını değil. `wheat.stress_days` ise sadece 2. yıl buğdayı.
- [ ] **Bilgi:** `crops.yaml`'daki tüm değerler şu an `verified: false`. `site_index` ya da UI'da ürün parametresi gösterilecekse rozet "assumption" olmalı.

## 9. `validate.run_checks()` hazır (14 Kas, `omer`)

- [ ] **`make data` artık senin `power.load_weather()`'ına bağlı.** `build.build(mock=False)` sentetik havayla baştan sona çalıştı; 9 dosyanın hepsi şemadan geçti. POWER gelince başka bir şey gerekmiyor.
- [ ] **`references.yaml`** → `precip_vs_mgm` iki lokasyonda da `value: null` olduğu için `pending`. Muhammet'in MGM normalleri gelince `value` ve `station` doldur; biri gelirse o lokasyon için `info` olur.
- [ ] **Bilgi:** `pse_range` oran (0–1) olarak okunuyor, `trial_yields_kg_per_da` kg/da, `years` metni referans satırında görünüyor. Muhammet farklı yıl bulursa `years`'ı güncelle.

## 10. AWC kararı: SoilGrids dokusu + FAO-56 tablosu (14 Kas, `omer`)

Senin "AWC düşük çıktı, hangisini kullanacağız" soruna Ömer'in kararı. **Senin dosyalarında değişiklik gerekmiyor**; sadece haberin olsun.

- Motor artık AWC'yi şöyle seçiyor (`engine/config/soil.yaml` → `awc_method: texture_table`):
  1. Doku sınıfı senin `data/soilgrids/{loc}.json` dosyandaki `clay / sand / silt` Q50 (0–30 cm) değerlerinden, USDA üçgeniyle: **Karapınar = siltli kil**, **Develi = killi tın** (FAO tablosunda yok → en yakın sınıf siltli killi tın).
  2. AWC, θFC, θWP ve REW o sınıfın FAO-56 Tablo 19 değerinden; TEW Denk. 73'ten.
  3. Sonuç: **Karapınar 160 mm/m, Develi 155 mm/m** (SoilGrids'in 58,6 / 67,4 değerleri yerine).
- `results.soil.awc_mm_per_m` → `type: "assumption"`, `verified: false`; `source` metni hem kullanılan tabloyu hem de SoilGrids'in verdiği ve kullanılmayan değeri yazıyor. Şemadan geçiyor.
- Geri almak gerekirse: `soil.yaml`'da `awc_method.value: soilgrids` → motor eskisi gibi senin değerini kullanır. Kod değişmez.
- [ ] **Öneri (UI / export, senin ve İsmail'in kararı):** toprak kartında SoilGrids'in kendi AWC değeri ve 90 % aralığı (`range_q05_q95`) da "SoilGrids estimate (not used by the engine)" diye gösterilebilir; şeffaflık için iyi olur. Gösterilecekse sözleşmeye nasıl gireceğine sen karar ver.
- **Gerçek veriyle etkisi (orta derinlik, ortanca):** Karapınar nadas buğday ekiminde 104 mm su bırakıyor (nohut 13, mercimek 26); nadas depolama verimi %23 (literatür %8–30 içinde). Deneme oranı modelde 0,90 / 0,91 (deneme 0,80 / 0,87).

## 11. `make data` kontrolü (14 Kas, `omer`)

- [x] `python -m nobetsu.build` `omer` üzerinde gerçek POWER + SoilGrids ile ~19 sn'de çalıştı (geçici klasöre yazıldı, `web/public/data`'ya dokunulmadı). 9 dosyanın hepsi şemadan ve `check_invariants`'tan geçti, hepsi `mock: false`, yasak kelime yok.
- [ ] **Senin adımın:** `omer` main'e girince `make data` → `web/public/data`'yı commit et → `v0.1` etiketi (M2).
- [ ] **Bilgi:** her `ledger/{loc}.json` 2,1 MB (mock ile aynı boyut); gzip'li ~0,12 MB. Vercel gzip/brotli ile sunduğu için sorun olmamalı; yine de İsmail lazy-load etsin (planda zaten öyle).
- [ ] **Bilgi:** `validation.json` → `precip_vs_mgm` MGM normalleri gelene kadar `pending`; `smap/*.json` `available: false`.

## 12. OMER_BAKMALI §2–3 uygulandı (14 Kas, `omer`)

- Taş düzeltmesi eklendi: `AWC = Tablo 19 orta × (1 − cfvo_0_100cm_fraction)`, `soil.yaml` → `awc_cfvo_correction: true` ile açılıp kapanıyor. Doku sınıfı artık `texture_0_100cm.usda_class`'tan (yoksa 0–30 cm Q50 + USDA üçgeni).
- Sonuç: **Karapınar 154,7 mm/m**, **Develi 121,4 mm/m**. `awc_used.source` metni kullanılmayan alternatifleri de yazıyor (SoilGrids doğrudan, Saxton–Rawls).
- `trial_ratio` değer satırına "soil available water used: X mm/m" ve notuna "sonuç AWC'ye çok bağlı, alternatifler toprak kartında" eklendi (yeni check id'si yok).
- `make data` yeniden koşuldu (geçici klasöre): 9 dosya şemadan geçti.
- [ ] **Senin tarafın (export):** `results.soil.awc_mm_per_m.value` yuvarlanmadan yazılıyor (Develi `121.36500000000001`). ARAYUZLER §10'a göre yuvarlama export'ta; `awc_mm_per_m.value`'yu da 1 ondalığa yuvarlar mısın?

## 13. Muhammet'in doğrulama referanslarını Ömer buldu → `references.yaml` (14 Kas)

Kullanıcı isteğiyle Ömer, Muhammet'in "doğrulama kaynakları" görevini yaptı. Değerler tam metinden okundu; `references.yaml` senin dosyan olduğu için geçirmeyi sana bırakıyorum.

- [ ] **`trial_yields_kg_per_da`** → değerler **doğru**: nadas 286, mercimek 249, nohut 228 kg/da. `verified: true` yapılabilir.
  - Kaynak: Gültekin İ., Partigöç F., Gültekin S., Kaya Y., Arısoy R.Z., Taner A. 2017. *Orta Anadolu Bölgesi Kuru Koşullarında Buğday Tabanlı Üretimde Doğrudan Ekim.* KSÜ Doğa Bil. Derg. 20 (Özel Sayı): 283–287. doi:10.18016/ksudobil.349258 — https://dergipark.org.tr/en/download/article-file/390551
  - `years`: "2011–2014 (buğday hasatları 2012, 2013, 2014; geleneksel + doğrudan ekim ortalaması)". Yer: Bahri Dağdaş, Konya merkez, kuru, killi alüviyal toprak.
- [ ] **`pse_range`** → literatür **%11–29** (plandaki %8–30 değil):
  - low **0.11**: nadas yılında biriken nem yıllık yağışın %11–23'ü — Ayday ve Oylukan 1984, aktaran Adak M.S. 1999, *Tarla Bitkileri Merkez Araştırma Enstitüsü Dergisi* 8(1–2) — https://dergipark.org.tr/tr/download/article-file/118589
  - high **0.29**: Orta Anadolu, 180 cm: %12,9–29,0 — Özbek, Aksoy, Çelebi 1967 (IAEA), aktaran Demiralay İ., "Nadasın etkinliği" (Atatürk Üniv. Ziraat Fak.) — https://dergipark.org.tr/en/download/article-file/34779 ; ayrıca Gültekin ve ark. 2017: "yağışların %29'una kadar".
  - Not: kaynaklar yüzdeyi **yıllık yağışa** göre veriyor; bizim model **nadas dönemi yağışına** (Temmuz y → Ekim y+1, ~15 ay) bölüyor. Karşılaştırma `info` kalmalı.
- [ ] **`mgm_annual_precip_mm`** → MGM'nin **ilçe sayfası yok**; en yakın yayımlanan normaller il merkezi istasyonları. Sayfa yıllık toplamı basmıyor, değerler 12 aylık 1991–2020 normalinin toplamı:
  - karapinar: **325.3** mm, `station: "Konya (il merkezi)"` — https://www.mgm.gov.tr/veridegerlendirme/il-ve-ilceler-istatistik.aspx?k=H&m=KONYA
  - develi: **408.2** mm, `station: "Kayseri (il merkezi)"` — https://www.mgm.gov.tr/veridegerlendirme/il-ve-ilceler-istatistik.aspx?k=H&m=KAYSERI
  - Bunlar ilçe değil, il merkezi; `source`'a yaz. Ekrana koymadan önce canlı sayfadan bir kez kontrol et (tablo HTML'den okundu).
- [ ] **`heat_threshold_c`** → literatür **31 °C** (30 değil): "temperatures higher than 31 °C limit the success of pollination" — Jacott & Boden 2020, *J. Exp. Bot.* 71(19): 5740–5751, doi:10.1093/jxb/eraa326, Porter & Gawith 1999'a atıfla — https://pmc.ncbi.nlm.nih.gov/articles/PMC7540836 . Kaynak bunun günlük maksimum olduğunu açıkça yazmıyor; biz `T2M_MAX`'a uyguluyoruz (not olarak ekle).

Bulunamayan: Kayseri'ye özel ekim/hasat takvimi (Develi'de Konya takvimi kullanılıyor), buğday çiçeklenme tarihi.

## 14. OMER_BAKMALI §4 (3 kırık test) düzeldi (14 Kas, `omer`)

- `test_validate.py`'deki 3 test artık gerçek `references.yaml` değerlerine bağlı değil (her biri kendi `refs` değerini ayarlıyor). Hem şu anki dosyayla hem senin `gumus/muhammet-sources` dosyanla **11/11 geçiyor** (dosyanı geçici olarak yerine koyup denedim, sonra geri aldım).
- §4 senin branch'inde olduğu için orada işaretleyemedim; birleştirince `[x]` sayabilirsin.
- [ ] **Dikkat, TASKS.md çakışacak:** ikimiz de Muhammet bölümündeki "takvim" ve "doğrulama kaynakları" satırlarını işaretledik (`omer`: "Ömer yaptı", senin branch: "gümüş yaptı"). Takvimleri ben `crops.yaml`'a kaynaklı geçirdim; doğrulama referanslarını ikimiz de bulduk (senin MGM değerin daha iyi: WMO Karapınar istasyonu). Birleştirirken iki notu da tutabilirsin.
- Bu notun §13'ündeki referans değerleri artık senin branch'inde var; §13'ü kapatabilirsin (MGM için senin WMO değerlerin geçerli).

## 16. E2 kurak / sıcak senaryolar — motor tarafı hazır (14 Kas, branch `exp/E2-scenarios`)

- **Senaryolar:** `engine/config/scenarios.yaml` (yeni dosya, motor parametresi; id'leri sözleşmede sen onayla): `baseline`, `dry10` (yağış ×0,9), `dry20` (×0,8), `warm1` (+1 °C), `warm2` (+2 °C), `dry10_warm1`. Her birinde `label {en, tr}` ve V biçiminde `precip_factor`, `temp_shift_c`. Sıcaklık kayması Tmax, Tmin ve Tdew'e birlikte uygulanıyor (bağıl nem yaklaşık sabit), ET₀ kaydırılmış havadan yeniden hesaplanıyor.
- **Motor API:** `runner.run_scenarios(location_id, weather, soilgrids, scenario_ids=None) -> {scenario_id: EngineOutput}` (her biri `run_location` ile aynı biçim). Tek senaryo için `runner.apply_scenario(weather, scenario)` + `run_location`. 6 senaryo × 2 lokasyon ≈ 2 dk.
- [ ] **Sözleşme (sende, PLAN_EXPANSION E2):** `results/{loc}__{scenario_id}.json` (aynı şema) + `site_index.scenarios: [{id, label}]` (`scenarios.yaml`'dan). `baseline` için mevcut `results/{loc}.json` kalabilir. Ledger senaryo başına gerekirse söyle (dosyalar büyük: 2,1 MB × 12).
- [ ] **`build.py`:** `for sid, out in run_scenarios(loc, w, sg).items(): ...` ile yazdır; `validation.json` sadece baseline'dan.
- **Gerçek veriyle sonuç (orta derinlik, ortanca, nadas / nohut / mercimek):**
  - Karapınar buğday oranı: baseline 0,54 / 0,48 / 0,49 → dry20 0,46 / 0,39 / 0,40 → warm2 0,52 / 0,46 / 0,47. Nadas ekimde su 104 → 59 mm (dry20).
  - Develi: baseline 0,55 / 0,50 / 0,50 → dry20 0,44 / 0,40 / 0,40.
  - Kuraklıkta nadas avantajı (nadas − nohut buğday oranı) 0,06'dan 0,07'ye çıkıyor: kuru iklimde nadasın su değeri biraz artıyor.
- **Sınır (UI notuna ekle):** ısınma bitki gelişimini hızlandırır, ama takvimler sabit (ekim/hasat tarihi değişmiyor). Bu yüzden `warm` senaryolarının etkisi muhtemelen olduğundan küçük görünüyor. "Projeksiyon değil, duyarlılık testi" etiketi şart.
