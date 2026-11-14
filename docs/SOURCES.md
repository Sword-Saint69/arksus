# SOURCES — doğrulanmış her değer (sahibi: Muhammet)

**Nasıl doldurulur:** Sadece boş hücreleri doldur. ID'yi değiştirme (Gümüş koda bu ID ile geçirir).
**Tür:** `official` (resmi kurum) · `statistic` (TÜİK) · `literature` (makale, rapor, ziraat odası) · `assumption` (bulunamadı; nedenini "Not"a yaz).
Bulamazsan: Değer = `bulunamadı`, Not = `denenen: ...`. **Uydurma yok.**
Gümüş koda geçirdiğinde "Kodda" sütununa ✅ koyar.

## 1. Fiyatlar

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not | Kodda |
|---|---|---|---|---|---|---|---|---|
| price.wheat | | TL/kg | TMO 2026 hububat alım fiyatı | | | official | grup/sınıf: | |
| price.chickpea | | TL/kg | | | | | bülten tarihi: | |
| price.lentil | | TL/kg | | | | | bülten tarihi, kırmızı/yeşil: | |

## 2. Destekler (kuru, TL/da)

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not (hangi kalemler) | Kodda |
|---|---|---|---|---|---|---|---|---|
| support.karapinar.wheat | | TL/da | Bakanlık destek hesaplayıcısı | destekhesaplama.tarimorman.gov.tr | | official | | |
| support.karapinar.chickpea | | TL/da | | | | official | | |
| support.karapinar.lentil | | TL/da | | | | official | | |
| support.karapinar.fallow | | TL/da | | | | official | | |
| support.develi.wheat | | TL/da | | | | official | | |
| support.develi.chickpea | | TL/da | | | | official | | |
| support.develi.lentil | | TL/da | | | | official | | |
| support.develi.fallow | | TL/da | | | | official | | |

## 3. Maliyetler (kira hariç, TL/da)

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not (yıl) | Kodda |
|---|---|---|---|---|---|---|---|---|
| cost.karapinar.wheat | | TL/da | Konya Ziraat Odası | | | literature | | |
| cost.karapinar.chickpea | | TL/da | | | | | | |
| cost.karapinar.lentil | | TL/da | | | | | | |
| cost.karapinar.fallow | | TL/da | (nadas yılı toprak işleme) | | | | | |
| cost.develi.wheat | | TL/da | Kayseri Ziraat Odası | | | literature | | |
| cost.develi.chickpea | | TL/da | | | | | | |
| cost.develi.lentil | | TL/da | | | | | | |
| cost.develi.fallow | | TL/da | | | | | | |

## 4. Verimler — TÜİK ilçe, kuru (kg/da)

Kaynak: TÜİK Bitkisel Üretim İstatistikleri · Link: ______ · Erişim tarihi: ______ · Tür: statistic
(Gümüş bu tablodan `ym.<ilçe>.<ürün>` = yüksek yüzdelik değerini hesaplar.)

| Yıl | Karapınar buğday | Karapınar nohut | Karapınar mercimek | Develi buğday | Develi nohut | Develi mercimek |
|---|---|---|---|---|---|---|
| 2004 | | | | | | |
| 2005 | | | | | | |
| 2006 | | | | | | |
| 2007 | | | | | | |
| 2008 | | | | | | |
| 2009 | | | | | | |
| 2010 | | | | | | |
| 2011 | | | | | | |
| 2012 | | | | | | |
| 2013 | | | | | | |
| 2014 | | | | | | |
| 2015 | | | | | | |
| 2016 | | | | | | |
| 2017 | | | | | | |
| 2018 | | | | | | |
| 2019 | | | | | | |
| 2020 | | | | | | |
| 2021 | | | | | | |
| 2022 | | | | | | |
| 2023 | | | | | | |
| 2024 | | | | | | |
| 2025 | | | | | | |

Not (kuru/sulu ayrımı nasıl yapıldı, eksik yıllar): ______

## 5. Ekim / hasat takvimleri → Ömer

| ID | Ekim | Hasat | Kaynak adı | Link | Erişim tarihi | Tür | Not | Kodda |
|---|---|---|---|---|---|---|---|---|
| calendar.konya.wheat | | | | | | literature | kışlık | |
| calendar.konya.chickpea | | | | | | literature | yazlık | |
| calendar.konya.lentil | | | | | | literature | yazlık | |
| calendar.kayseri.wheat | | | | | | literature | kışlık | |
| calendar.kayseri.chickpea | | | | | | literature | yazlık | |
| calendar.kayseri.lentil | | | | | | literature | yazlık | |

## 6. Doğrulama referansları

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not | Kodda |
|---|---|---|---|---|---|---|---|---|
| ref.trial.after_fallow | | kg/da | Konya kuru koşul ön bitki denemesi | | | literature | planda 286, teyit et; yıllar: | |
| ref.trial.after_lentil | | kg/da | | | | literature | planda 249 | |
| ref.trial.after_chickpea | | kg/da | | | | literature | planda 228 | |
| ref.pse.low | | % | Orta Anadolu nadas su depolama verimi | | | literature | planda 8 | |
| ref.pse.high | | % | | | | literature | planda 30 | |
| ref.mgm.karapinar.station | | — | MGM | | | official | istasyon adı/no | |
| ref.mgm.karapinar.annual_precip | | mm | MGM 1991–2020 normali | | | official | | |
| ref.mgm.develi.station | | — | MGM | | | official | | |
| ref.mgm.develi.annual_precip | | mm | MGM 1991–2020 normali | | | official | | |
| ref.heat_threshold_flowering | | °C | | | | literature | planda 30 °C, teyit et | |

## 7. Hikâye ve toprak özellikleri

| ID | Değer / kısa alıntı | Kaynak adı | Link | Erişim tarihi | Tür | Kodda |
|---|---|---|---|---|---|---|
| story.erosion | | Konya Toprak Su ve Çölleşme Araştırma Enstitüsü | | | official | |
| trait.n_fixing.chickpea | evet / hayır (kg N YAZMA) | | | | literature | |
| trait.n_fixing.lentil | | | | | literature | |
| trait.tillage_passes.fallow | (nadas yılında kaç kez) | | | | literature | |
| trait.tillage_passes.legume | (baklagil yılında kaç kez) | | | | literature | |

## 8. Toprak — SADECE Gümüş "SoilGrids olmadı" derse (manual_viewer)

Koordinat Karapınar: ______ · Develi: ______ (Gümüş verir)

| ID | Derinlik | Q05 | Q50 | Q95 | Birim (haritadaki) | Kodda |
|---|---|---|---|---|---|---|
| soil.karapinar.clay | 0–5 / 5–15 / 15–30 | | | | | |
| soil.karapinar.sand | | | | | | |
| soil.karapinar.silt | | | | | | |
| soil.karapinar.phh2o | | | | | | |
| soil.karapinar.soc | | | | | | |
| soil.karapinar.nitrogen | | | | | | |
| soil.karapinar.cec | | | | | | |
| soil.develi.clay | | | | | | |
| soil.develi.sand | | | | | | |
| soil.develi.silt | | | | | | |
| soil.develi.phh2o | | | | | | |
| soil.develi.soc | | | | | | |
| soil.develi.nitrogen | | | | | | |
| soil.develi.cec | | | | | | |

## 9. Strateji açıklamaları (önce İngilizce, sade; sonra Türkçe)

Her maddeye kaynak ekle. Yasak: "recommended", "best", "banned", "profit guaranteed".

### strategy.fallow_wheat (current practice)
- **why:**
- **evidence:** (metin — kaynak — link)
  -
- **benefits:**
  -
- **gaps:**
  -
- **local_review:**
  -

### strategy.chickpea_wheat
- **why:**
- **evidence:**
  -
- **benefits:**
  -
- **gaps:**
  -
- **local_review:**
  -

### strategy.lentil_wheat
- **why:**
- **evidence:**
  -
- **benefits:**
  -
- **gaps:**
  -
- **local_review:**
  -

## 10. Sözlük (her biri en fazla 2 kısa cümle) → İsmail

| ID | EN | TR |
|---|---|---|
| glossary.et | | |
| glossary.water_balance | | |
| glossary.available_water | | |
| glossary.field_capacity_vs_saturation | | |
| glossary.soil_moisture_anomaly | | |
| glossary.ph | | |
| glossary.organic_carbon | | |
| glossary.cec | | |
| glossary.p10_p50_p90 | | |
| glossary.fallow_storage_efficiency | | |
| glossary.nitrogen_fixation | | |
| glossary.wind_exposure | | |

## 11. Yarışma kuralları özeti

- Teslim saati (saat dilimiyle):
- Video / slayt kuralı:
- AI kullanım beyanı:
- Proje sayfası alanları:
- Jüri kriterleri:
