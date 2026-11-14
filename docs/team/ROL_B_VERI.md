# Rol B — Veri, sözleşme, ekonomi, yayın

**Kim:** Gümüş *(geçici atama — Ömer ile değişirse bu satırı ve TASKS.md başlığını değiştirin)*
**Branch öneki:** `gumus/` · **Görev listen:** `TASKS.md` → "Gümüş" bölümü
**Okuman gerekenler:** `docs/PROJE_OZETI.md` → `docs/ARAYUZLER.md` (hepsi; sahibi sensin) → PLAN_MVP §2–§4, §5.1, §5.5, §5.6, §5.9, §5.10

## İşin bir paragrafta

Herkesin kodunu birbirine bağlayan kişisin. **Sözleşmenin sahibisin**: dosya biçimleri, alan adları ve fonksiyon imzaları senin kontrolünde (`docs/ARAYUZLER.md`, `types.ts`, şema). NASA POWER ve SoilGrids verisini çekip Ömer'e hazır verirsin; Ömer'in motor çıktısını sitenin okuyacağı JSON'lara çevirirsin; sitedeki para ve sıralama hesabını (`economics.ts`) yazarsın; Muhammet'in bulduğu değerleri ve metinleri YAML'lara geçirirsin; repo, Makefile, Vercel, etiketler ve merge düzeni de sende. İlk saatteki işin en kritik olanı: **herkes senin koyduğun mock dosyalar ve imzalarla çalışmaya başlayacak.**

## Sahibi olduğun dosyalar

- Kök: `AGENTS.md`, `CLAUDE.md`, `Makefile`, `README.md`
- `docs/ARAYUZLER.md`, `docs/contract/*.schema.json`
- `engine/pyproject.toml`, `engine/nobetsu/{__init__,config,power,soilgrids,smap,mock,export,build}.py`
- `engine/config/{locations,rotations,defaults,references}.yaml`
- `engine/tests/test_{power,export,contract}.py`
- `data/**` (POWER önbelleği, SoilGrids, SMAP), `web/public/data/**`
- `web/src/lib/{types,economics,economics.test,contract.test}.ts`
- **Dokunmazsın:** Ömer'in modülleri (`et0, waterbalance, rotations, yieldmodel, indicators, runner, validate`), `crops.yaml`, `soil.yaml`; `web/` altındaki diğer her şey (İsmail). Ömer'in dosyalarını iskelette **boş bile oluşturma** — o kendisi ekler.

## Sözleşme sahibi olarak kuralların

- M0'dan sonra değişiklik isteği gelirse: tek PR'da `ARAYUZLER.md` + `types.ts` + şema + mock JSON, aynı saat içinde. Gruba `SÖZLEŞME DEĞİŞTİ: ...` yaz.
- `make test` her zaman **mock ve gerçek** çıktıyı şemayla doğrular. Şema testi kırmızıysa merge yok.
- Ömer ve İsmail'in PR'larını merge etmeden önce `main`'i çekip `make test && make web` çalıştır.

## Adım adım

### T+0–0:10 · Repo
GitHub'da public repo `nobetsu` aç. Bu paketteki hazır dosyaları (`AGENTS.md`, `CLAUDE.md`, `TASKS.md`, `docs/…`) ve PLAN dosyalarını push et. Ömer, İsmail, Muhammet'i ekle. Link gruba.

### T+0:10–1 · Sözleşme iskeleti → M0
- `engine/pyproject.toml` (requests, numpy, pandas, pyyaml, pytest, jsonschema), `engine/nobetsu/__init__.py`, `config.py` (`load(name) -> dict`), boş `power.py`, `export.py`, `build.py`, `mock.py`.
- `Makefile`: `make test` (pytest + `cd web && npm test`), `make mock`, `make data`, `make web`.
- `web/src/lib/types.ts`: PLAN §4'ün birebir TS karşılığı (6 dosya türü).
- `docs/contract/*.schema.json` + `test_contract.py` (web/public/data altındaki her dosyayı doğrular) + `web/src/lib/contract.test.ts` (mock JSON'u tiplere atar).
- `mock.py`: `fake_run_location()` ARAYUZLER §5 biçiminde sahte çıktı üretir; `build.py --mock` bunu `export.write_all(mock=True)`'dan geçirir → `make mock` 6 tür JSON'u yazar (2 lokasyon × 216 satır, tam boyut).
- `web/src/lib/economics.ts`: ARAYUZLER §9 imzalarıyla **basit çalışan** sürüm (İsmail hemen kullanabilsin).
- `web/` iskeletini İsmail kuruyor (Vite, Tailwind, vitest, Vercel). Sen sadece kendi dosyalarını eklersin; çakışma olmaz.

### T+0:30 · Koordinatlar
`locations.yaml`'a Karapınar ve Develi'nin tarım alanı içindeki nokta koordinatlarını yaz (ilçe merkezinin hemen dışında, yerleşim değil tarla), Muhammet'e gönder.

### T+1 · SMAP isteği (5 dk)
NASA AppEEARS (Earthdata hesabı) → nokta isteği: `SPL4SMGP` v8, `sm_rootzone`, `sm_rootzone_wetness`, `sm_surface_wetness`; iki nokta; 2015-04-01 → bugün. Sonuç saatler içinde gelir.

### T+1–2 · `power.py` → Ömer'e haber
ARAYUZLER §2: tek seferlik çekim (`community=AG`, `time-standard=LST`, `format=JSON`, 2000-01-01 → son tarih, 8 parametre), `data/raw/power_{loc}.json` önbelleği (commit et, küçük), birimleri başlıktan oku, `-999` → NaN, ≤ 3 gün doğrusal doldur, sabit sütun adları, `attrs`. `test_power.py`: önbellekten okur, sütunlar/birimler doğru, NaN yok. Bitince **Ömer'e "POWER hazır"** yaz.

### T+2–2.75 · SoilGrids (45 dk sınır)
WCS veya Earth Engine (REST değil): `clay, sand, silt, bdod, cfvo, phh2o, soc, nitrogen, cec, wv0033, wv1500`; 0–5, 5–15, 15–30 cm (su özellikleri 100 cm'e kadar); Q05/Q50/Q95; resmi dönüşüm çarpanları. `data/soilgrids/{loc}.json` (ARAYUZLER §3) ve `awc_mm_per_m`. Fiziksel sınır testi (pH 3–10, fraksiyonlar ≈ %100). **45 dakikada olmazsa bırak**, Muhammet'e "SoilGrids'i web haritasından elle oku" de; geldiğinde aynı dosyayı `how_obtained: manual_viewer` ile yaz.

### T+2.75–4 · `economics.ts` + vitest → M1
ARAYUZLER §9 ve §10: `percentile` (numpy type 7), `range`, `sequenceMoney`, `summarize`, `breakEvenYield`, `flipTable`, `rankByPriority`.
Testler: tek sekans için elle hesaplanmış örnek · bilinen dizide yüzdelik · başabaş formülü · oyuncak veride flip tablosu · eşit ağırlık ve her önceliğe %100 ile tek ölçüt sırası.
İmzalar değişmez; İsmail zaten bunlara bağlı.

### T+4–7 · `export.py` + `build.py`
- `write_all()`: `site_index` (locations + rotations.yaml + soil.yaml'daki derinlik sınıfları + `power_range` + `start_years`), `results/{loc}` (soilgrids properties + `awc_used` + sequences), `ledger/{loc}`, `defaults` (defaults.yaml), `validation` (checks), `smap/{loc}` (veri yoksa `available: false`). Yuvarlama ARAYUZLER §10. `generated_at`, `schema_version`, `mock`.
- `build.py`: ARAYUZLER §7 sırası. `test_export.py`: mock runner ile yazılan her dosya şemadan geçer.

### T+7–9 · Gerçek veri → M2
Ömer'in `run_location`'ı gelince `build.py` onu çağırır. `make data` → `mock: false` → commit → Vercel'de görünüyor → **`git tag v0.1 && git push --tags`**.

### T+9–14 · Değerleri ve metinleri geçir → M3
Her 2 saatte bir `docs/SOURCES.md`'yi oku:
- `price.*, cost.*, support.*, ym.*` → `defaults.yaml` (V biçimi, `verified: true`, `as_of`). Ym = TÜİK ilçe yıllık verimlerinin yüksek yüzdeliği (ör. P90; hangi yüzdeliği seçtiğini `source`'a yaz), tür `statistic`.
- `ref.*` → `references.yaml` (deneme verimleri, PSE aralığı, MGM normalleri, sıcak gün eşiği).
- `strategy.*, trait.*` → `rotations.yaml`.
- Sözlük İsmail'e gider (`strings.ts`).
- Bulunamayanlar `type: assumption`, `verified: false` + not.
README teknik kısım (kurulum, `make data`, veri kaynakları, varsayımlar). M3'te **`v0.2` etiketi**.

### SMAP geldiğinde
`smap.py`: aylık klimatoloji (kök bölgesi ıslaklığı P10/P50/P90), aylık seri, son değer ve o takvim ayındaki yüzdeliği → `smap/{loc}.json`, `available: true`. Test: ıslaklık 0–1. T+12'ye kadar gelmezse `available: false` kalır, E1'e geçer.

### T+14–19 · Genişletme (her biri ayrı branch, yeşil değilse merge yok)
E1 veri tarafı (SMAP günlük seri Ömer'e) + **E2 sözleşmesi** (`results/{loc}__{scenario}.json`, `site_index.scenarios`; önce tipler ve mock, sonra Ömer/İsmail) → E3 GRACE havza su trendi (veri + trend hesabı) → E6 kısıtlar veya E9 fiyat belirsizliği.

### T+19–22 · Yayın
Son build, tüm linkler, repo temizliği, `docs/AI_USE.md` derlemesi (Muhammet beyana çevirir).

## Bağımlılıkların

| Ne | Kimden | Ne zaman | Gecikirse |
|---|---|---|---|
| Web iskeleti (vitest dahil) | İsmail | T+1 | `economics.test.ts`'i yazmaya devam et, iskelet gelince çalıştır |
| `run_location()` gerçek çıktı | Ömer | T+7:30 | M2'yi kısmi gerçek veriyle (ör. tek lokasyon) yap |
| `validate.run_checks()` | Ömer | T+12 | `validation.json`'da kontroller `pending` |
| Fiyat, destek / maliyet, Ym | Muhammet | T+3 / T+5 | `assumption` |
| Referanslar | Muhammet | T+7 | `references.yaml` boş, kontroller `pending` |
| Strateji metinleri | Muhammet | T+9 | "text pending" yer tutucusu |

**Senden bekleyenler:** herkes (T+0:10 repo) · İsmail (T+1 types + mock + economics; T+9 gerçek JSON) · Ömer (T+2 POWER, T+2:45 AWC) · Muhammet (T+0:30 koordinatlar).

## AI ajan başlangıç promptları

Her görev için yeni oturum. Önce şunu söyle: **"Ben Gümüş'üm (Rol B)."**

**1 — Sözleşme iskeleti (T+0:10):**
```
Ben Gümüş'üm (Rol B). AGENTS.md, docs/team/ROL_B_VERI.md, docs/ARAYUZLER.md ve docs/PLAN_MVP.md §2–§4'ü oku.
Sadece benim dosyalarımı oluştur: engine/pyproject.toml, engine/nobetsu/{__init__,config,power,export,build,mock}.py
(power/export şimdilik iskelet), Makefile (test/mock/data/web), web/src/lib/types.ts (PLAN §4'ün birebir karşılığı),
docs/contract/*.schema.json, engine/tests/test_contract.py, web/src/lib/contract.test.ts, ve ARAYUZLER §9 imzalarıyla
basit çalışan web/src/lib/economics.ts. mock.fake_run_location() ARAYUZLER §5 biçiminde, sahte ama makul sayılar,
tam boyut (2 lokasyon × 216 satır); `make mock` 6 tür JSON'u mock:true ile web/public/data/ altına yazsın.
Ömer'in modüllerini (et0, waterbalance, rotations, yieldmodel, indicators, runner, validate) ve web iskeletini
OLUŞTURMA. Bilim kodu yazma. `make mock` ve `pytest` geçince dur, TASKS.md'de sadece Gümüş bölümünü işaretle.
```

**2 — power.py, SoilGrids, economics, export (sırayla, her biri yeni oturum):**
```
Ben Gümüş'üm (Rol B). AGENTS.md, docs/team/ROL_B_VERI.md ve docs/ARAYUZLER.md'yi oku.
Bu görev: <TASKS.md'deki satır>. İlgili PLAN_MVP bölümü: <§5.1 / §5.10 / §5.5+§5.9 / §4>.
Önce test, sonra kod. Sözleşmedeki adları ve biçimleri birebir kullan. Bitince TASKS.md'de sadece Gümüş
bölümündeki o satırı işaretle.
```

**3 — Değer aktarımı (T+9'dan itibaren, her 2 saatte):**
```
Ben Gümüş'üm (Rol B). docs/SOURCES.md'de dolu olup henüz YAML'a geçmemiş satırları bul. Her birini ID'sine göre
defaults.yaml / references.yaml / rotations.yaml'a V biçiminde (value, unit, source, source_url, type, verified, as_of)
geçir. Değeri değiştirme, yuvarlama, tahmin etme; boş olanlara dokunma. Sonra `make data && make test` çalıştır.
```

## Takılırsan

- POWER API yavaş/hata → yeniden dene; önbellek bir kez yazılınca bir daha çağrılmaz. Son çare: POWER web arayüzünden JSON indir, aynı yola koy.
- SoilGrids 45 dakikayı geçti → bırak, Muhammet'e devret.
- AppEEARS sonucu gelmedi → T+12'de `available: false`, gerisi E1.
- İki kişinin PR'ı çakıştı → dosya sahipliği tablosuna bak; sahibinin sürümü kazanır.
