# Gümüş'ün bakması gerekenler (Ömer'den)

Ömer'in motor işi sırasında çıkan, **Gümüş'ün dosyalarında** yapılması gereken şeyler. Ömer bu dosyalara dokunmuyor (dosya sahipliği kuralı). Yaptığını `- [x]` ile işaretle.

Yeni madde eklendikçe en alta tarihle yazılır.

## 1. `engine/pyproject.toml`

- [ ] Bağımlılıklar: `numpy`, `pandas`, `pyyaml`, `pytest` (planda zaten var; Ömer'in kodu başka paket kullanmıyor).
- [ ] pytest ayarı: testler `from nobetsu import ...` ve `from tests.fixtures import ...` diye import ediyor. Bunun düz `pytest` komutuyla da çalışması için:

  ```toml
  [tool.pytest.ini_options]
  pythonpath = ["."]
  testpaths = ["tests"]
  ```

  Şu an sadece `cd engine && python -m pytest` ile çalışıyor.
- [ ] pandas 3.x ile test edildi (3.1.1). Daha eski sürüme sabitlersen haber ver; `DatetimeIndex.day_of_year` kullanılıyor.

## 2. `engine/nobetsu/__init__.py`

- [ ] Dosya henüz yok. Şu an `nobetsu` "namespace package" olarak çalışıyor; sen boş `__init__.py` ekleyince bir şey bozulmaz. `engine/tests/__init__.py` **ekleme** (gerek yok, eklersen import yolu değişir).

## 3. `Makefile`

- [ ] `make test` Python tarafı: `cd engine && python -m pytest` (ya da madde 1'deki ayardan sonra `pytest`).

## 4. `.gitignore` (sahibi yok, repo düzeni sende)

- [ ] `__pycache__/`, `.pytest_cache/`, `.venv/`, `node_modules/`, `web/dist/` eklenmeli. Şu an dosya yok; Ömer önbellekleri elle siliyor.

## 5. `power.load_weather()` — motorun beklediği

- [ ] `df.attrs["lat"]` **derece** ve `df.attrs["elevation_m"]` zorunlu; eksikse `et0_from_weather` `KeyError` verir.
- [ ] ET₀ şu sütunları kullanıyor: `tmax_c, tmin_c, tdew_c, u2_ms, rs_mj_m2`. Nem için `tdew_c` kullanılıyor (`rh_pct` değil). NaN görürse `ValueError` verir.
- [ ] `rs_mj_m2` gerçekten MJ/m²/gün olmalı. POWER başlığı kWh/m²/gün derse × 3,6 ile çevir.

## 6. Ömer'in hazır verdiği

- `engine/nobetsu/et0.py` → `et0_from_weather(weather) -> pd.Series` (adı `et0_mm`, indeks hava tablosuyla aynı).
- `engine/tests/fixtures.py` → `synthetic_weather(start, end)`: ARAYUZLER §2 sütunları ve `attrs` ile sahte hava. `mock.py` ya da `test_power.py` için kullanabilirsin (import et, kopyalama).

## 7. Su bütçesi motoru geldikten sonra (14 Kas, `omer/waterbalance`)

- [ ] **`nobetsu/config.py`** → `load("crops")` ve `load("soil")` YAML'ı **olduğu gibi düz `dict`** döndürmeli (V nesnelerini açma, `value`'ya indirgeme). Motor `cfg["wheat"]["kcb_mid"]["value"]` diye okuyor. Şimdilik testler `tests/fixtures.load_config()` ile aynı işi yapıyor; `config.py` gelince `runner.py` onu kullanacak.
- [ ] **`rotations.yaml`** → `crops` listesi tam 2 eleman, `[ilk yıl, ana ürün]` sırasıyla ve id'ler `crops.yaml`'daki anahtarlarla aynı olmalı: `["fallow","wheat"]`, `["chickpea","wheat"]`, `["lentil","wheat"]`. Motor son elemanı ana ürün (spin-up + 2. yıl) sayıyor.
- [ ] **`site_index.depth_classes`** → `engine/config/soil.yaml` içindeki `depth_classes` listesinden oku (id, depth_m, label sözleşmedekiyle aynı yazıldı).
- [ ] **`load_weather()` aralığı** → her sekans 1 Ekim `y−1`'de başlıyor ve son buğday hasadına kadar sürüyor. 2001 sekansı için **2000-10-01**, 2024 sekansı için **2026-07-12**'ye kadar veri şart (şu anki takvimle). Eksikse `daily_inputs` `ValueError` verir.
- [ ] **`data/soilgrids/{loc}.json`** → `awc_mm_per_m.value` gelmezse motor `soil.yaml`'daki yedek değeri (150 mm/m, `assumption`) kullanacak.
- [ ] **Bilgi (sözleşme netleştirmesi, değişiklik değil):** `ledger.weeks` her seride **104 hafta** (1 Temmuz `y`'den başlayan, 24 aylık pencerenin içine tam sığan 7 günlük bloklar; Haziran `y+2`'nin son 2–3 günü dışarıda kalır). Şemada `weeks` uzunluğunu 104 olarak sabitleyebilirsin. Farklı istiyorsan Ömer'e yaz.
- [ ] **Bilgi:** aylık listeler (24 eleman) 1 Temmuz `y` → 30 Haziran `y+2` penceresini kapsıyor; buğday hasadı ~12 Temmuz `y+2` olduğu için buğdayın `eta_mm / etc_mm / stress_days` toplamları pencerenin 12 gün dışına taşıyor (sezonun tamamı sayılıyor). Sözleşmede buna aykırı bir şey yok, haberin olsun.

## 8. `runner.run_location()` hazır (14 Kas, `omer/runner`)

- [ ] **`build.py`** → `from nobetsu.runner import run_location`; imza ARAYUZLER §5 ile aynı: `run_location(location_id, weather, soilgrids)`. (Ek, isteğe bağlı `start_years=[...]` parametresi sadece test/kısmi koşu için; verme.) Bir lokasyon ~9 sn sürüyor.
- [ ] **`references.yaml`** → sıcak gün eşiği şu anahtarla, V biçiminde olmalı:

  ```yaml
  heat_threshold_flowering_c:
    value: 30
    unit: "°C"
    source: "..."        # SOURCES.md ref.heat_threshold_flowering
    type: literature
    verified: false
  ```

  Anahtar yoksa motor plandaki 30 °C ile devam eder ve uyarı (`UserWarning`) basar.
- [ ] **`rotations.yaml`** → motor şu üç biçimden birini okur: en üstte liste `[{id, crops, ...}]`, ya da `rotations: [...]`, ya da `{fallow_wheat: {crops: [...]}, ...}`. Dosya yoksa üç sözleşme id'siyle devam eder ve uyarı basar.
- [ ] **`config.py`** → `nobetsu.config.load(name)` gelince runner otomatik onu kullanır; yoksa YAML'ı kendisi okur. `load` dosya yoksa `FileNotFoundError` versin.
- [ ] **`mock.fake_run_location()`** için biçim örneği: `engine/tests/test_runner.py` içindeki `SEQUENCE_KEYS`, `FIRST_CROP_KEYS`, `WHEAT_KEYS`, `WEEK_KEYS` listeleri gerçek çıktının anahtar sırası. Tipler: gün sayıları `int`, diğerleri `float`; `fallow_wheat` → `first_crop: None`, diğerleri → `fallow_storage_efficiency: None`.
- [ ] **Bilgi:** `stress_by_month` pencere içindeki **tüm ürün günlerini** sayıyor (spin-up buğdayının Temmuz `y` başındaki son günleri ve ilk yıl baklagili dahil), sadece 2. yıl buğdayını değil. `wheat.stress_days` ise sadece 2. yıl buğdayı.
- [ ] **Bilgi:** `crops.yaml`'daki tüm değerler şu an `verified: false`. `site_index` ya da UI'da ürün parametresi gösterilecekse rozet "assumption" olmalı.
