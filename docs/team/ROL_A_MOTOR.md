# Rol A — Motor ve bilim (kritik yol)

**Kim:** Ömer *(geçici atama — Gümüş ile değişirse bu satırı ve TASKS.md başlığını değiştirin)*
**Branch öneki:** `omer/` · **Görev listen:** `TASKS.md` → "Ömer" bölümü
**Okuman gerekenler:** `docs/PROJE_OZETI.md` → `docs/ARAYUZLER.md` §2–§6, §10 → PLAN_MVP §5.2–§5.4, §5.7, §5.8, §5.10

## İşin bir paragrafta

NASA POWER'ın günlük hava verisinden, **her gün toprakta ne kadar su olduğunu** hesaplayan Python motorunu yazıyorsun (FAO-56: ET₀ + iki katmanlı, çift katsayılı su bütçesi). Motor 2 lokasyon × 3 rotasyon × 3 derinlik × 24 başlangıç yılı = 432 sekansı koşar ve her biri için suyu, buharlaşmayı, stresi, çıplak günleri ve **verim oranını (0–1)** üretir. **Para yok, TL yok, kg/da yok** — onlar sitede hesaplanır. Projenin kalbi sensin; gecikirsen M2 gecikir. Bu yüzden ilk dakikadan, kimseyi beklemeden başlayabilecek şekilde planlandı.

## Sahibi olduğun dosyalar

- `engine/config/crops.yaml`, `engine/config/soil.yaml`
- `engine/nobetsu/et0.py`, `waterbalance.py`, `rotations.py`, `yieldmodel.py`, `indicators.py`, `runner.py`, `validate.py`
- `engine/tests/test_et0.py`, `test_waterbalance.py`, `test_rotations.py`, `test_yieldmodel.py`, `test_indicators.py`, `test_runner.py`, `test_validate.py`, `engine/tests/fixtures.py`
- **Dokunmazsın:** `power.py`, `export.py`, `build.py`, `mock.py`, `config.py`, diğer YAML'lar, `web/` (hepsi Gümüş / İsmail). Bu dosyaları **sen oluşturma**; Gümüş iskelette koyar, sen sadece kendi modüllerini eklersin (aynı dosyayı iki kişi oluşturursa çakışır).
- Yeni Python paketi lazımsa Gümüş'e söyle (`pyproject.toml` onda).

## Uyum için bilmen gerekenler (ayrıntı ARAYUZLER.md'de)

- **Girdi:** `weather` = `pd.DataFrame`, sütunlar `precip_mm, tmax_c, tmin_c, tdew_c, rh_pct, u2_ms, u2max_ms, rs_mj_m2`; `df.attrs["lat"]`, `df.attrs["elevation_m"]`. NaN yok.
- **Toprak:** `data/soilgrids/{loc}.json` içindeki `awc_mm_per_m`; yoksa `soil.yaml`'daki yedek değer, `type: assumption`.
- **Çıktı:** `runner.run_location(location_id, weather, soilgrids) -> dict` — `awc_used`, `sequences` (216 satır, PLAN §4.2 anahtarları **birebir**), `ledger` (216 seri, PLAN §4.3), `diagnostics`.
- **Doğrulama:** `validate.run_checks(outputs, weather, refs) -> list[dict]` (PLAN §4.5, 5 kontrol, sabit sıra). Referans boşsa `pending`.
- **Sabit id'ler:** lokasyon `karapinar, develi` · rotasyon `fallow_wheat, chickpea_wheat, lentil_wheat` · derinlik `shallow, medium, deep` · ürün `wheat, chickpea, lentil, fallow`.
- Ay listeleri **24 eleman**, eleman 0 = y Temmuz. Yuvarlama yapma; export yapar.
- Rotasyon listesi ve hangi ürünlerin hangi sırayla olduğu Gümüş'ün `rotations.yaml`'ından okunur (`crops: ["chickpea","wheat"]`). Sen takvimi `crops.yaml`'dan kurarsın. **Ürüne özel `if` yok.**

## Adım adım

### T+0–2 · ET₀ (iskeleti beklemeden başla)
- `et0.py`: FAO-56 Penman–Monteith günlük (Denklem 6, Bölüm 3). Basınç yükseklikten. Rs ölçülü (POWER), Rso ile net uzun dalga.
- `test_et0.py`: **FAO-56 Örnek 18** girdilerini ve sonucunu kitaptan kopyala; ±0,1 mm/gün.
- POWER'ın `EVPTRNS` parametresi ET₀ **değildir**, kullanma.
- Ara adımları ayrı fonksiyon yap (`es`, `ea`, `delta`, `Ra`, `Rso`, `Rnl`); Örnek 18'in ara değerleriyle de test et — hatayı bulmayı çok hızlandırır.

### T+2–4 · Su bütçesi motoru → M1
`waterbalance.py` (~200 satır), PLAN §5.3'teki gibi:
- Çift katsayı: `ETc = (Kcb·Ks + Ke)·ET₀`.
- İki katman: katman 1 = kök bölgesi `Zr` (en az `Ze` ≈ 0,10 m), katman 2 = `D − Zr`. Yağış önce katman 1'i tarla kapasitesine kadar doldurur, fazlası katman 2'ye, kalanı derin süzülme.
- `Zr` büyürken katman 2'den yeni kazanılan bölümdeki su katman 1'e geçer (nadas suyunun buğdaya ulaşmasını sağlayan şey bu).
- `Ke`: FAO-56 Bölüm 7 (TEW, REW, `few`, evre 1 / evre 2 kuruma). Çıplak / nadas: `Kcb = 0`, `fc = 0`.
- `Ks = (TAW_r − Dr) / ((1 − p)·TAW_r)` eğer `Dr > RAW`, değilse 1.
- Kök: ekimde `Zr_min`'den orta dönem başında `min(Zr_max, D)`'ye doğrusal.
- Varsayımlar: yüzey akışı yok, kar yok, kapiler yükselme yok, anız etkisi yok, sulama yok.
- **İlk hedef:** Karapınar, `fallow_wheat`, `medium`, 2010 — bir sekans koş ve kütle dengesi özetini yazdır. POWER önbelleği T+2'de gelmediyse sentetik havayla yap.
- **Bu dosya için en güçlü modeli yüksek effort ile kullan**; diğerleri normal.

### T+4–6 · Rotasyonlar ve runner
- `rotations.py`: başlangıç yılı `y` için günlük takvim: (1) spin-up buğdayı 1 Ekim `y−1` → Temmuz `y` hasadı, %50 dolulukla başlar; (2) hasattan sonraki gün → Ekim `y+1` buğday ekimi: nadas **veya** çıplak → yazlık baklagil → çıplak; (3) buğday → Temmuz `y+2` hasadı.
- `runner.py`: tüm rotasyon × derinlik × yıl kombinasyonlarını koşar, `EngineOutput` döner. Paralellik gerekmez; önce doğru olsun.

### T+6–7 · Verim oranı
`yieldmodel.py`: `Ya/Ym = max(0, 1 − Ky·(1 − ΣETa/ΣETc))` ürün sezonu boyunca (FAO-33). **"Önceki ürün" çarpanı YOK** (suyu iki kez saymış oluruz; deneme rakamları sadece doğrulamada kullanılır).

### T+7–7.5 · Göstergeler (`indicators.py`)
- `bare_days`, `bare_by_month` (24) — `Kcb = 0` günleri.
- `wind_exposed_bare_days`: çıplak **ve** yüzey evre-2 kurumada (`De > REW`) **ve** `u2max_ms` > lokasyonun tüm kayıttaki günlük maksimum rüzgârının 75. yüzdeliği. (Eşik bir varsayım; `soil.yaml`'da V olarak dursun.)
- `stress_by_month` (24) — ürün günlerinde `Ks < 1`.
- `heat_days_flowering` — çiçeklenme penceresinde `tmax_c > 30` (eşik `references.yaml`'dan, Gümüş koyar; literatür değeri, VERIFY).
- `fullness_by_month` (24) — ay sonunda profildeki kullanılabilir su / profil kapasitesi × 100. (Bu **doygunluk değil**: %100 = tarla kapasitesi.)
- `fallow_storage_efficiency` (sadece nadas) = nadas dönemi ΔS / P.
- `pre_sowing_precip_mm` = 1 Temmuz `y` → buğday ekimi (Ekim `y+1`) yağışı.

### T+7.5–9 · Tam koşu → M2
2 × 3 × 3 × 24 tam koşu. Gümüş'ün `build.py`'si `mock.fake_run_location` yerine senin `run_location`'ını çağırır. Birlikte `make data` çalıştırın, sitede gerçek sayıları görün.

### T+9–12 · `validate.py`
`mass_balance` (< 0,01 mm, tüm sekanslar) · `et0_fao56_ex18` (±0,1) · `pse_literature` (info: değer + literatür aralığı) · `trial_ratio` (info: nohut/mercimek sonrası buğday oranı ÷ nadas sonrası, deneme ile yan yana) · `precip_vs_mgm` (info: POWER yıllık ortalama vs MGM normali, % fark). Referanslar `references.yaml`'da (Muhammet → Gümüş); boşsa `pending`.

### T+12–14 · Gerçek takvimler → M3
Muhammet'in TAGEM/GKTAEM/Bahri Dağdaş takvimlerini `crops.yaml`'a geçir (her alanda `source`, `verified: true`), yeniden koş, sonuçları gözle kontrol et (su değerleri mantıklı mı, nadas > baklagil suyu mu, çıplak gün nadasta en çok mu). Takvim erken gelirse erken geçir. Gece 03–06 arası riskli refactor yapma.

### T+14–19 · Genişletme (her biri ayrı branch, yeşil değilse merge yok)
E1 SMAP anomali karşılaştırması (nadas profil suyu vs SMAP kök bölgesi, aylık anomalilerin Spearman korelasyonu; mutlak uyum iddia etme) → E2 kurak/sıcak senaryo koşuları (yağış ×0,8 / ×0,9; sıcaklık +1 / +2 °C, `tmax/tmin/tdew` birlikte; Gümüş sözleşmeyi önce ekler) → zaman kalırsa E5 veya E10.

## Motor testleri (M2'den önce hepsi geçmeli)

- Kütle dengesi: `P − ETa − DP − ΔS` her sekansta < 0,01 mm
- Negatif depo yok, tarla kapasitesi üstünde depo yok
- `Dr ≤ RAW` iken `Ks = 1`
- Kök derinliği sezon içinde azalmaz, `D`'yi aşmaz
- Sentetik ıslak kış, çıplak toprak: `ΔS ≥ 0`
- `yield_ratio` ∈ [0, 1]
- `sum(bare_by_month) == bare_days`; `wind_exposed_bare_days ≤ bare_days`; nadas çıplak günü > baklagil rotasyonları
- `fullness_by_month` ∈ [0, 100], 24 eleman
- Her config alanında `source` var
- `run_location` çıktısının anahtarları PLAN §4.2 / §4.3 ile birebir (Gümüş'ün şema testi de bunu yakalar)

## Bağımlılıkların

| Ne | Kimden | Ne zaman | Gecikirse |
|---|---|---|---|
| Repo + engine iskeleti | Gümüş | T+0:10–1 | ET₀'yu yerelde yaz, sonra taşı |
| POWER önbelleği + `load_weather()` | Gümüş | T+2 | `fixtures.py`'deki sentetik hava |
| SoilGrids AWC | Gümüş | T+2:45 | `soil.yaml` yedek AWC (`assumption`) |
| Ekim/hasat takvimleri | Muhammet | T+6 | FAO-56 başlangıç değerleri (`verified: false`) |
| Doğrulama referansları | Muhammet → Gümüş (`references.yaml`) | T+7 | Kontrol `pending` |

**Senden bekleyen:** Gümüş, T+7:30'da gerçek `run_location()` çıktısı.

## AI ajan başlangıç promptları

Her görev için yeni oturum. Önce şunu söyle: **"Ben Ömer'im (Rol A)."**

**1 — ET₀:**
```
Ben Ömer'im (Rol A). AGENTS.md, docs/team/ROL_A_MOTOR.md ve docs/PLAN_MVP.md §5.2'yi oku.
Önce testi yaz: engine/tests/test_et0.py, FAO-56 Örnek 18 (girdileri ve sonucu ben kitaptan vereceğim, uydurma),
ara değerler için de testler. Sonra engine/nobetsu/et0.py: FAO-56 Penman–Monteith günlük, ara adımlar ayrı fonksiyon.
Girdi sütunları docs/ARAYUZLER.md §2'deki adlarla. Testler geçince dur ve TASKS.md'de sadece Ömer bölümündeki
ET₀ satırını işaretle.
```

**2 — Su bütçesi (en güçlü model, yüksek effort):**
```
Ben Ömer'im (Rol A). AGENTS.md, docs/team/ROL_A_MOTOR.md, docs/ARAYUZLER.md §2–§5 ve docs/PLAN_MVP.md §5.3'ü oku.
Önce engine testlerini yaz (ROL_A_MOTOR.md "Motor testleri"), sonra engine/nobetsu/waterbalance.py: iki katmanlı,
dual-Kc, PLAN'daki gibi. Parametreler sadece engine/config/*.yaml'dan; her alanda source ve verified; ürüne özel if yok.
Sentetik hava için engine/tests/fixtures.py yaz. Karapınar, fallow_wheat, medium, 2010 tek sekansını koş ve kütle
dengesi özetini yazdır. Testler geçince dur, TASKS.md'de sadece Ömer bölümündeki satırı işaretle.
```

**3 — Sonraki görevler (rotations/runner, yield, indicators, validate):**
```
Ben Ömer'im (Rol A). AGENTS.md, docs/team/ROL_A_MOTOR.md ve docs/ARAYUZLER.md §5–§6, §10'u oku.
Bu görev: <TASKS.md'deki satır>. İlgili PLAN_MVP bölümü: <§>. Çıktı biçimi ARAYUZLER.md'deki ile birebir olmalı;
alan adı uydurma, değiştirmek gerekiyorsa dur ve bana söyle. Önce test, sonra kod. Bitince TASKS.md'de
sadece Ömer bölümündeki o satırı işaretle.
```

## Takılırsan

- Kütle dengesi kapanmıyor → tek gün, tek katman, sabit hava ile küçült; her terimi yazdır.
- 1 saatten fazla aynı hatadaysan gruba yaz; Gümüş ya da İsmail ikinci göz olur.
- Zaman daralırsa sıra: motor + göstergeler (M2) > validate > takvim güncellemesi. Validate'teki `info` kontrolleri basit bırakılabilir, `mass_balance` ve `et0` bırakılamaz.
