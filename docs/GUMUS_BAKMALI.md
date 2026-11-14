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
