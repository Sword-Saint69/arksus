# Ömer'in bakması gerekenler (Gümüş'ten)

Gümüş'ün işi sırasında çıkan, **Ömer'in dosyalarında** yapılması gereken şeyler ve Ömer'in sorularına yanıtlar. Gümüş bu dosyalara dokunmuyor (dosya sahipliği kuralı). Yaptığını `- [x]` ile işaretle.
Ters yön (Ömer → Gümüş): `docs/GUMUS_BAKMALI.md`. Yeni madde eklendikçe en alta tarihle yazılır.

## 1. Gümüş'ten yanıt (14 Kas, omer → main birleştirmesi)

- POWER hazır: `load_weather()` 2000-01-01 → 2026-11-09, `attrs` tam (lat/lon derece, `elevation_m` POWER hücresinden). Radyasyon birimi başlıktan okunuyor, kWh gelirse × 3,6. `gaps_filled` = en az bir değişkeni doldurulan **gün** sayısı.
- SoilGrids hazır: `data/soilgrids/{loc}.json`. **AWC düşük çıktı:** Karapınar 58,6 mm/m (Q05–Q95: 40,9–88,4), Develi 67,4 mm/m (51,1–77,1). SoilGrids `wv1500`'ü yüksek tahmin ediyor. Senin 150 mm/m yedeğinden çok farklı; hangisini kullanacağımızı konuşalım.
- Ledger 104 hafta: şema ve mock 104'e sabitlendi, ARAYUZLER §5'e yazıldı.
- pandas: bende 2.2.3, senin testlerin dahil 109 test geçiyor; sabitleme yok (`pandas>=2.1`).
- `engine/tests/__init__.py` **ekledim**: bazı makinelerde (ultralytics/roboflow kuruluysa) site-packages'ta bir `tests` paketi var ve namespace paketini gölgeliyor; `from tests.fixtures import ...` bu yüzden kırılıyordu. Senin import'ların aynen çalışıyor.
- Sıradaki: `build.py` gerçek koşu için `validate.py`'yi bekliyor; gelene kadar kontrolleri `pending` yazacak şekilde ayarlayacağım (M2).

## 2. AWC kararı (14 Kas)

Önerin **iki düzeltmeyle kabul**: doku SoilGrids'ten, AWC FAO-56 Tablo 19'dan. Sözleşme notu ARAYUZLER §3'te.

**Senin dosyalarında (`soil.yaml`, `runner.py`) yapılacaklar:**
- [x] AWC'yi `data/soilgrids/{loc}.json` → `texture_0_100cm.usda_class` ile Tablo 19 orta değerinden al, **× (1 − `cfvo_0_100cm_fraction.value`)**. Taşlar su tutmaz; tablo değeri ince toprak içindir. Develi'de taş %21,7 → fark büyük.
- [x] `awc_mm_per_m` (SoilGrids doğrudan) artık **bilgi amaçlı**; motor onu kullanmasın. (Şu an `_awc_used` onu okuyor; sen değiştirene kadar M2 koşusu 58,6 / 67,4 ile çıkar.)
- [x] `awc_used`: `type: "literature"`, `verified: false`, kaynak: "SoilGrids dokusu (siltli kil) → FAO-56 Tablo 19, taş düzeltmeli".
- [x] **TEW / REW** da aynı doku sınıfından gelsin (şu an "loam" yazıyor). Hafızadan: siltli kil ve kil için TEW 22–29 mm, REW 8–12 mm (Ze = 0,10 m) — kitaptan teyit.
- [x] Develi **killi tın** Tablo 19'da yok. En yakın: siltli killi tın (0,13–0,18) ya da kil (0,12–0,20). Hangisini seçtiğini kaynağa yaz.
- [x] Sınıf → değer eşlemesi `soil.yaml`'da dursun (kodda `if` yok).

**Veri (yeni çekim, 0–100 cm, ortalama haritalar):**

| | Doku | Kil / kum / silt % | Taş | SoilGrids doğrudan | Saxton–Rawls 2006 (taş düzeltmeli) | Tablo 19 orta × (1 − taş) (hafızadan) |
|---|---|---|---|---|---|---|
| Karapınar | siltli kil | 48,6 / 10,5 / 41,0 | 0,033 | 58,6 | 131,4 | 160 × 0,967 ≈ 155 |
| Develi | killi tın | 39,7 / 27,6 / 32,6 | 0,217 | 67,4 | 106,2 | ~155–160 × 0,783 ≈ 121–125 |

**Duyarlılık (senin motorun, gerçek hava, orta derinlik, 24 yıl ortancası):** nohut sonrası / nadas sonrası buğday Ya/Ym — AWC 60: Karapınar 0,98, Develi 0,96; AWC 160: 0,91 / 0,85. Konya denemesi 228/286 = 0,80. Yani 58 ile nadas avantajı neredeyse görünmüyor; senin tespitin doğru.

**Kanıt paneli önerisi:** `validate.py`'de (ya da `precip_vs_mgm` notunun yanında) "AWC: tablo X, Saxton–Rawls Y, SoilGrids doğrudan Z" satırı. Sözleşmede yeni check id'si gerekirse bana yaz; şimdilik mevcut 5 kontrol yeterli, metin `trial_ratio` notuna eklenebilir.

## 3. AWC uygulaması — eksik kalan taş düzeltmesi (14 Kas)

`omer` → `main` birleştirildi (151 test yeşil; gerçek havayla `build.py` uçtan uca çalıştı, 9 dosya şemadan geçti). AWC'yi dokudan alman tamam. Sen `main`'i 16:47'de çekmişsin; §2'deki karar ondan sonra geldiği için bir madde eksik kaldı:

- [x] **Taş (kaba parça) düzeltmesi:** `AWC = Tablo 19 orta değeri × (1 − cfvo)`. Taşlar su tutmaz, tablo değeri ince toprak içindir. `data/soilgrids/{loc}.json` → `cfvo_0_100cm_fraction.value`: Karapınar **0,033**, Develi **0,217**. Develi şu an 155 mm/m; düzeltmeyle ≈ **121**, Karapınar 160 → ≈ **155**. Düzeltme `soil.yaml`'da açılıp kapanabilir olsun (ör. `awc_cfvo_correction: true`), kaynak metnine "taş düzeltmeli (cfvo X)" eklensin.
- [x] (İsteğe bağlı, yapıldı: motor artık `texture_0_100cm` kullanıyor, yoksa 0–30 cm Q50) Doku sınıfı için 0–100 cm hazır: `texture_0_100cm.usda_class` (ortalama haritalar, 100'e ölçekli). Sen 0–30 cm Q50 kullanıyorsun; iki lokasyonda sonuç aynı sınıf (siltli kil / killi tın), değiştirmek şart değil — kök bölgesi 1 m'ye indiği için 0–100 cm daha tutarlı olur.
- Bilgi: `type: "assumption"` kullanman uygun; ARAYUZLER §3'ü buna göre düzelttim (`literature` yerine `assumption`).
- Senin "SoilGrids'in kendi AWC'si de kartta gösterilsin" önerin: kabul. `awc_alternatives` dosyada var; İsmail'le kartta nasıl görüneceğine karar verince sözleşmeye eklerim.

## 4. Muhammet'in referans değerleri geldi — 3 testin kırıldı (14 Kas)

Muhammet'in `ref.*` işini ben yaptım; `engine/config/references.yaml` artık gerçek değerlerle dolu (branch `gumus/muhammet-sources`):
- `trial_yields_kg_per_da`: 286 / 249 / 228 — Gültekin vd. 2017 makalesinde teyit edildi (`verified: true`), `years` metni güncellendi.
- `pse_range`: **0,08 / 0,30 → 0,11 / 0,29** (Ayday ve Oylukan 1984; Özbek vd. 1967). Literatür tanımı (nadas − ekili toprak suyu) / yıllık yağış; seninkiyle aynı değil, kontrol zaten `info`.
- `mgm_annual_precip_mm`: Karapınar **290,11** (WMO 17902), Develi için en yakın istasyon Kayseri Bölge **404,58** (WMO 17196, ~29 km). `precip_vs_mgm` artık iki lokasyonda da `info` (gerçek POWER ile): **Karapınar POWER 395 mm/yıl, MGM 290 → +36 %**; Develi POWER 374, Kayseri Bölge 405 → ≈ −8 %. Karapınar'da POWER yağışı belirgin yüksek; sonuçların dürüst sunumu için önemli (kanıt panelinde görünecek).
- `heat_threshold_c`: **30 → 31 °C** (Porter ve Gawith 1999). Isı günleri biraz azalır.

**Kırılan testler (`engine/tests/test_validate.py`)** gerçek `references.yaml`'daki eski yer tutucu değerlere bağlı:
- [x] `test_pse_is_info_with_model_value_and_literature_range`: `"8" in reference and "30" in reference` arıyor. Ya testte `refs["pse_range"]`'i açıkça 0.08/0.30'a ayarla, ya da `refs`'teki değerlerden beklenen metni üret.
- [x] `test_precip_vs_mgm_pending_when_normals_missing`: MGM'nin boş olduğunu varsayıyor. Testin başında iki lokasyonun `value`'sunu `None` yap.
- [x] `test_precip_vs_mgm_reports_percent_difference`: Develi'nin boş olduğunu varsayıyor. Develi `value`'sunu testte `None` yap.

Üçü düzelince `gumus/muhammet-sources`'u main'e alacağım (testler geçmeden merge yok). Diğer 152 test geçiyor.

Düzeldi (Ömer, `omer` 46b2e28): üç test kendi `refs` değerini ayarlıyor; `gumus/muhammet-sources` ile birlikte yeşil.

## 5. M2 yapıldı — gerçek sonuçlardan iki gözlem (14 Kas)

`main`'deki `web/public/data` artık senin motorunla gerçek veri (`mock: false`, etiket `v0.1`); AWC yuvarlaması düzeldi (Karapınar 154,7, Develi 121,4). Orta derinlik, 24 yıl ortancası:

| | nadas | nohut | mercimek |
|---|---|---|---|
| Karapınar: buğday ekiminde su (mm) | 103,9 | 0,1 | 12,6 |
| Karapınar: buğday Ya/Ym | 0,54 | 0,48 | 0,49 |
| Develi: buğday ekiminde su (mm) | 56,6 | 0,0 | 6,0 |
| Çıplak gün / rüzgâra açık (Karapınar) | 460 / 88 | 332 / 54 | 310 / 48 |

Kontrol etmeni istediğim iki şey (hata olduğunu söylemiyorum, emin olmak için):
- [ ] **Çiçeklenmede sıcak gün ortancası her rotasyonda 0** (eşik artık 31 °C, POWER `T2M_MAX`). POWER hücresi Karapınar'da 1236 m'de; çiçeklenme penceresi Mayıs sonu–Haziran başı mı? Sıfır mı çıkmalı, yoksa pencere/eşik eşleşmesinde bir sorun mu var?
- [ ] **Nohuttan sonra buğday ekiminde su ≈ 0 mm** (Temmuz ortası hasat → Ekim ekimi). Yaz kuraklığı düşünülünce makul olabilir; yine de 24 yılın P90'ı da 0'a yakınsa Ekim başı yağışlarının profile girişini bir kontrol et.
