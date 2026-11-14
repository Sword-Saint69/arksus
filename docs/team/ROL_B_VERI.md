# Rol B — Veri, sözleşme, karar modülü, yayın

**Kim:** Gümüş *(geçici atama — Ömer ile değişirse bu satırı ve TASKS.md başlığını değiştirin)*
**Branch öneki:** `gumus/` · **Görev listen:** `TASKS.md` → "Gümüş" bölümü
**Gerektiğinde oku (adını verince):** `docs/ARAYUZLER.md` (sahibi sensin) → PLAN_MVP §1, §4, §5.5, §5.6, §5.9, §5.10 → `README.md` "Quick start"
**Güncelleme:** 15 Kas 2026

## İşin bir paragrafta

Herkesin kodunu birbirine bağlayan kişisin. **Sözleşmenin sahibisin**: dosya biçimleri, alan adları ve fonksiyon imzaları senin kontrolünde (`docs/ARAYUZLER.md`, `types.ts`, şemalar). NASA POWER, SoilGrids, SMAP ve IMERG verisini çekip Ömer'e hazır verirsin; Ömer'in motor çıktısını sitenin okuyacağı JSON'lara çevirirsin; sitedeki karar hesabını (`economics.ts`) yazarsın; Muhammet'in bulduğu değerleri ve metinleri YAML'lara geçirirsin; repo, Makefile, Vercel, etiketler ve merge düzeni de sende. **Sitede para yok**: fiyat ve destek sadece iç parametre.

## Proje şu an (15 Kas)

- **13 ilçe**, İç Anadolu'daki her ilden bir kuru tarım ilçesi: Karapınar, Develi, Polatlı, Eskişehir, Aksaray, Karaman, Niğde, Nevşehir, Kaman, Kırıkkale, Çankırı, Gemerek, Boğazlıyan.
- Lokasyon id'leri **açık liste**: `engine/config/locations.yaml`'dan gelir (biçim `^[a-z][a-z0-9_]*$`); web listeyi `site_index.locations`'tan okur. Noktalar bir WMO 1991–2020 istasyonuna 3–10 km uzaklıkta seçildi ve ESA WorldCover 2021 ile tarla olduğu kontrol edildi.
- 3 rotasyon (`fallow_wheat`, `chickpea_wheat`, `lentil_wheat`) × 3 derinlik (`shallow`, `medium`, `deep`) × 24 başlangıç yılı (2001–2024).
- **AWC** dokudan gelir (motor tarafı, Ömer): SoilGrids doku sınıfı → FAO-56 Tablo 19 orta değeri × (1 − iri taş payı). SoilGrids'in kendi AWC'si (`wv0033 − wv1500`) ve Saxton–Rawls tahmini `data/soilgrids/{loc}.json`'da karşılaştırma için durur.

## Karar modülü (`web/src/lib/economics.ts`)

| Ölçüt | Ne | Varsayılan ağırlık |
|---|---|---|
| `value` | iç: verim oranı × ulusal referans verim × fiyat + destek; **maliyet yok**, asla gösterilmez | 0,40 |
| `yield` | ortanca buğday verim oranı | 0,30 |
| `soil` | ortanca rüzgâra açık çıplak gün (az olan iyi) | 0,20 |
| `water` | ortanca buğday ekiminde topraktaki su | 0,10 |

- Referans verimler TEPGE/TÜİK ulusal ortalamaları: buğday 296, nohut 125, mercimek 169 kg/da. Fiyat ve destek `defaults.yaml`'da, iç parametre; ekrana çıkmaz.
- **Engeller** (`decision.guardrails`): ortanca buğday oranı < 0,85 × nadas sonrası buğday → `wheat_yield_below_baseline`; ilk yıl ürünü ortanca oranı < 0,30 → `first_crop_fails`. Engellenen rotasyon puanı ne olursa olsun seçilmez.
- `decide` çıktısı: `recommended`, `runner_up`, `close_call` (ilk iki uygun seçenek farkı < 0,05), 0–1 parçalı sıralama, `driver`, engel nedenleri. `flipTable`: derinlik × kurak/normal/ıslak yıl.
- Metinde dil: "Önceliklerine göre bu arazi için en uygun". Ağırlıklar, engeller ve marj `assumption`, `verified: false`.

## Sahibi olduğun dosyalar (AGENTS.md ile birebir)

- Kök: `AGENTS.md`, `CLAUDE.md`, `Makefile`, `README.md`
- `docs/ARAYUZLER.md`, `docs/contract/**`
- `engine/pyproject.toml`, `engine/config/{locations,rotations,defaults,references}.yaml`
- `engine/nobetsu/{__init__,config,power,soilgrids,smap,imerg,mock,export,build}.py`
- `engine/tests/test_{power,export,contract,soilgrids,imerg,smap}.py`, `data/imerg/`
- `data/**`, `web/public/data/**`
- `web/src/lib/{types,economics,economics.test,contract.test}.ts`
- Herkesle ortak, **sadece kendi başlığının altı**: `TASKS.md`, `docs/STATUS.md`, `docs/AI_USE.md`
- **Dokunmazsın:** Ömer'in modülleri (`et0, waterbalance, rotations, yieldmodel, indicators, runner, validate`), `crops.yaml`, `soil.yaml`, onların testleri ve `fixtures.py`; `web/` altındaki diğer her şey (İsmail); `docs/SOURCES.md`, `docs/pitch/**` (Muhammet).

## Not dosyaları

| Kimden → kime | Dosya | Sen ne yaparsın |
|---|---|---|
| Ömer → Gümüş | `docs/GUMUS_BAKMALI.md` | okursun, bitenleri `- [x]` ile işaretlersin; yazmazsın |
| Gümüş → Ömer | `docs/OMER_BAKMALI.md` | yazarsın |
| Gümüş → İsmail | `docs/ISMAIL_BAKMALI.md` | yazarsın; İsmail işaretler |

## Sözleşme sahibi olarak kuralların

- Değişiklik isteği gelirse: tek PR'da `ARAYUZLER.md` + `types.ts` + şema + mock JSON, aynı saat içinde. Gruba `SÖZLEŞME DEĞİŞTİ: ...` yaz.
- `make test` her zaman **mock ve gerçek** çıktıyı şemayla doğrular. Şema testi kırmızıysa merge yok.
- Ömer ve İsmail'in PR'larını merge etmeden önce `main`'i çekip `make test && make web` çalıştır.
- Fiyat ve destek ekrana gitmez; `defaults.json` sadece karar girdisidir (iç parametre).

## Durum (yapıldı)

- **M0 sözleşme iskeleti:** `pyproject.toml`, `config.py`, `Makefile`, `types.ts`, şemalar, `mock.py`, `contract` testleri.
- **`power.py`:** NASA POWER önbelleği, 13 nokta, `load_weather()`.
- **`soilgrids.py`:** WCS çekimi, doku sınıfı, `cfvo`, Saxton–Rawls, toprak kartı anlam metinleri.
- **`export.py` + `build.py`:** mock runner ile uçtan uca, şema doğrulamalı.
- **M2 gerçek veri:** `mock: false`, etiket `v0.1`; sonra 13 ilçeye genişletildi.
- **Muhammet'in Rol B araştırmaları YAML'da:** fiyatlar, destekler, doğrulama referansları (13 istasyonun WMO normalleri dahil), strateji metinleri, sözlük.
- **Karar modülü** (`economics.ts` + vitest), maliyetler çıkarıldı; README ve PLAN_MVP güncellendi.
- **E2 senaryo sözleşmesi:** `results/{loc}__{scenario}.json`, `site_index.scenarios`, 5 senaryo × 13 ilçe.
- **E1:** 6. kontrol `smap_anomaly` sözleşmesi ve build bağlantısı (SMAP gelene kadar `pending`).
- **IMERG** modülü artık sende; `precip_vs_mgm` içinde POWER'ın yanında.
- **`smap.py`** AppEEARS CSV'sine hazır ve test edildi.

## Kalanlar

| İş | Neye bağlı | Not |
|---|---|---|
| SMAP verisi → `smap/{loc}.json`, `available: true` | AppEEARS (istek gönderildi, kuyrukta) | gelince aşağıdaki prompt 1 |
| Site Vercel'de görünüyor (M2'nin son adımı) | İsmail'in web iskeleti | gerçek JSON hazır |
| `v0.2` etiketi (M3) | site çalışınca | `git tag v0.2 && git push --tags` |
| GitHub collaborator'ları eklemek | elle | Ömer, İsmail, Muhammet |
| E3 GRACE havza su trendi | Earthdata indirmesi | genişletme, MVP değil |
| Baklagil yılında toprak işleme sayısı | kaynak bulunamadı | `rotations.yaml`'da boş / `assumption` |

## Komutlar (README "Quick start")

| Komut | Ne yapar |
|---|---|
| `make test` | pytest + vitest |
| `make data` | önbellekten gerçek JSON |
| `make mock` | aynı biçimde sahte JSON (commit etme) |
| `make web` | web build |

`make` yoksa (Windows):
```bash
cd engine
python -m pytest -q
python -m nobetsu.build --out ../web/public/data                 # make data
python -m nobetsu.build --out ../web/public/data --no-scenarios  # E2 senaryoları olmadan, hızlı
python -m nobetsu.build --mock --out ../web/public/data          # make mock
python -m nobetsu.smap <csv>                                     # AppEEARS SMAP CSV → data/smap/{loc}.json
```

## Bağımlılıkların

| Ne | Kimden | Gecikirse |
|---|---|---|
| Web iskeleti + Vercel | İsmail | gerçek JSON hazır bekler; `ISMAIL_BAKMALI.md` güncel tut |
| Motor değişiklikleri (`run_location`, `validate`) | Ömer | son çıktı kalır; değişince veriyi yenile (prompt 2) |
| SMAP sonucu | NASA AppEEARS | `available: false`, `smap_anomaly` `pending` |
| Yeni kaynak / metin | Muhammet (`docs/SOURCES.md`) | `type: assumption`, `verified: false` |

**Senden bekleyenler:** İsmail (güncel sözleşme, gerçek JSON, `economics.ts` API'si) · Ömer (`GUMUS_BAKMALI.md`'deki maddelere yanıt) · herkes (merge düzeni, etiketler).

## AI ajan başlangıç promptları

Her görev için yeni oturum. Önce şunu söyle: **"Ben Gümüş'üm (Rol B)."**

**1 — SMAP verisi geldi:**
```
Ben Gümüş'üm (Rol B). docs/ARAYUZLER.md'yi oku. AppEEARS SMAP CSV'si geldi: data/smap/<dosya>.csv.
cd engine && python -m nobetsu.smap ../data/smap/<dosya>.csv ile data/smap/{loc}.json üret, sonra
python -m nobetsu.build --out ../web/public/data çalıştır. smap/{loc}.json available:true olmalı, wetness 0–1,
validation.json'da smap_anomaly artık pending olmamalı. pytest geçsin. Sadece benim dosyalarıma dokun.
Bitince TASKS.md'de sadece Gümüş bölümündeki SMAP satırını işaretle.
```

**2 — Ömer'in değişikliklerinden sonra veriyi yenile:**
```
Ben Gümüş'üm (Rol B). docs/GUMUS_BAKMALI.md ve docs/ARAYUZLER.md'yi oku. main'i (Ömer'in son değişiklikleri)
kendi branch'ime çek. cd engine && python -m pytest -q, sonra python -m nobetsu.build --out ../web/public/data.
Şema testi ve contract testleri geçsin; sözleşmede değişiklik gerekiyorsa DUR ve bana sor. Ömer'in dosyalarına
dokunma. GUMUS_BAKMALI.md'de biten maddeleri - [x] ile işaretle, Ömer'e notu OMER_BAKMALI.md'ye yaz.
```

## Takılırsan

- POWER API yavaş/hata → yeniden dene; önbellek bir kez yazılınca bir daha çağrılmaz.
- AppEEARS sonucu gelmedi → `available: false` kalır, gerisi çalışır.
- Build uzun sürüyor → `--no-scenarios` ile E2'siz çalıştır, son build'de tam haliyle.
- İki kişinin PR'ı çakıştı → dosya sahipliği tablosuna bak; sahibinin sürümü kazanır.
