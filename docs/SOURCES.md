# SOURCES — doğrulanmış her değer (sahibi: Muhammet)

**Nasıl doldurulur:** Sadece boş hücreleri doldur. ID'yi değiştirme (Gümüş koda bu ID ile geçirir).
**Tür:** `official` (resmi kurum) · `statistic` (TÜİK) · `literature` (makale, rapor, ziraat odası) · `assumption` (bulunamadı; nedenini "Not"a yaz).
Bulamazsan: Değer = `bulunamadı`, Not = `denenen: ...`. **Uydurma yok.**
Gümüş koda geçirdiğinde "Kodda" sütununa ✅ koyar.

## 1. Fiyatlar

> **14 Kas kararı:** sitede para gösterilmez. Bu değerler sadece `economics.ts` içinde "hangi rotasyon daha çok kazandırır" tahmini için **iç parametre** olarak kullanılır (`engine/config/defaults.yaml` → `crops`).

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not | Kodda |
|---|---|---|---|---|---|---|---|---|
| price.wheat | 16,5 (16.500 TL/ton) | TL/kg | TMO 2026 hububat alım fiyatı | https://www.tarimorman.gov.tr/Haber/7092/2026-Yili-Hububat-Alim-Ve-Satis-Fiyatlari-Belirlendi | 2026-11-14 | official | grup/sınıf: 2. grup ekmeklik ve makarnalık (1. grup 16.750 TL/ton); 2 Haziran 2026 (Gümüş) | ✅ |
| price.chickpea | 80 | TL/kg | Gönen Ticaret Borsası haftalık bülteni, natürel nohut | https://gonentb.tobb.org.tr/docs/HAFTALIK%20B%C3%9CLTEN%20(1).pdf | 2026-11-14 | measured | bülten tarihi: 02.02.2026; Konya/Kayseri borsası 2026 bülteni bulunamadı, TMO nohut alım fiyatı yok (Gümüş) | ✅ |
| price.lentil | 32 (32.000 TL/ton) | TL/kg | TMO 2026 natürel yeşil mercimek alım fiyatı (haber) | https://www.cnbce.com/haberler/yesil-mercimekte-uretim-yuzde-62-artti-tmo-alim-fiyatini-acikladi-h36052 | 2026-11-14 | official | bülten tarihi, kırmızı/yeşil: yeşil; alım 31 Ağustos 2026'dan itibaren; kırmızı mercimek 2026 fiyatı bulunamadı; TMO duyurusu doğrudan görülmedi (Gümüş) | ✅ |

## 2. Destekler (kuru, TL/da)

> **14 Kas kararı:** sitede para gösterilmez. Bu değerler sadece `economics.ts` içinde "hangi rotasyon daha çok kazandırır" tahmini için **iç parametre** olarak kullanılır (`engine/config/defaults.yaml` → `crops`).

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not (hangi kalemler) | Kodda |
|---|---|---|---|---|---|---|---|---|
| support.karapinar.wheat | 954 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.karapinar.chickpea | 734 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.karapinar.lentil | 734 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.karapinar.fallow | 110,1 | TL/da | 2026 Destekleme Birim Fiyatları (nadas katsayısı 0,3) | https://www.tarimorman.gov.tr/BUGEM/Belgeler/Tarım%20Havzaları/2026%20Yılı%20Destekleme%20Birim%20Fiyatları.pdf | 2026-11-14 | assumption | ilk tablo 0,3×310 = 93 TL/da; güncel katsayıyla 0,3×367 = 110,1 (hesap Gümüş'ün, resmi tabloda görülmedi; ÇKS kayıtlı nadas) | ✅ |
| support.develi.wheat | 954 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.develi.chickpea | 734 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.develi.lentil | 734 | TL/da | 2026 bitkisel üretim destekleri (Dünya, 09.09.2026) | https://www.dunya.com/sektorler/tarim/bitkisel-uretimde-destekler-2026-icin-yuzde-184-artirildi-haberi-839219 | 2026-11-14 | official | temel destek + planlı üretim, 2026 üretim yılı, Eylül 2026 güncellemesi (katsayı 310→367; Karar 11781); sertifikalı tohum ve havza ek ödemesi koşullu, dahil değil; ulusal tutar, ilçe farkı yok (Gümüş) | ✅ |
| support.develi.fallow | 110,1 | TL/da | 2026 Destekleme Birim Fiyatları (nadas katsayısı 0,3) | https://www.tarimorman.gov.tr/BUGEM/Belgeler/Tarım%20Havzaları/2026%20Yılı%20Destekleme%20Birim%20Fiyatları.pdf | 2026-11-14 | assumption | ilk tablo 0,3×310 = 93 TL/da; güncel katsayıyla 0,3×367 = 110,1 (hesap Gümüş'ün, resmi tabloda görülmedi; ÇKS kayıtlı nadas) | ✅ |

## 3. Maliyetler (kira hariç, TL/da)

> **Kaldırıldı (14 Kas kararı):** maliyet kullanılmıyor; kaynak da bulunamamıştı. Satırlar arşiv için duruyor.

| ID | Değer | Birim | Kaynak adı | Link | Erişim tarihi | Tür | Not (yıl) | Kodda |
|---|---|---|---|---|---|---|---|---|
| cost.karapinar.wheat | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.karapinar.chickpea | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.karapinar.lentil | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.karapinar.fallow | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.develi.wheat | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.develi.chickpea | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.develi.lentil | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |
| cost.develi.fallow | bulunamadı | TL/da | — | — | 2026-11-14 | assumption | denenen: Konya/Karaman/Kayseri ziraat odası 2026, TZOB, ZMO, haberler; Orta Anadolu kuru dekar maliyeti yok (yalnız Adana buğday 2026 net 5.867 TL/da, kullanılmadı) (Gümüş) | YAML'da boş (pending) |

## 4. Verimler — TÜİK ilçe, kuru (kg/da)

> **14 Kas:** Ym yerine ürün başına **ulusal referans verim** kullanılıyor (iç parametre, ürünleri kıyaslamak için):
> buğday **296 kg/da** (TEPGE Buğday Durum-Tahmin 2025, TÜİK; rapor metninde görüldü) · nohut **125 kg/da** (575 bin t ÷ 4,6 milyon da, TEPGE Nohut Temmuz 2025; arama özetinden) · mercimek **169 kg/da** (405 bin t ÷ 2,4 milyon da kırmızı mercimek, TEPGE Mercimek Temmuz 2025; arama özetinden, rapor tablosundaki 1,25 t/ha ile tutarsız). Aşağıdaki ilçe tablosu artık zorunlu değil; doldurulursa ilçe bazında referans verime geçilebilir.

Kaynak: TÜİK Bitkisel Üretim İstatistikleri · Link: https://biruni.tuik.gov.tr/medas/?kn=92&locale=tr · Erişim tarihi: 2026-11-14 · Tür: statistic
**Durum (Gümüş):** bulunamadı. TÜİK ilçe veritabanı etkileşimli, otomatik okunamadı. Tek bulunan: Konya yatırım ofisi Karapınar profili, TÜİK 2018: buğday (durum hariç) ekilen 178.562 da, üretim 76.893 t (sulu+kuru karışık, kullanılmadı). `ym.*` YAML'da boş (pending).
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

Not (kuru/sulu ayrımı nasıl yapıldı, eksik yıllar): tablo doldurulamadı (Gümüş, 2026-11-14); TÜİK'ten elle indirilmeli

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
| ref.trial.after_fallow | 286 | kg/da | Gültekin vd. 2017, KSÜ Doğa Bil. Derg. 20(Özel Sayı):283–287 | https://doi.org/10.18016/ksudobil.349258 | 2026-11-14 | literature | yıllar: 2011–2014 (buğday hasatları 2012–2014), Konya Merkez kuru; GE+DE ve yılların ortalaması, makale metninde teyit edildi (Gümüş) | ✅ |
| ref.trial.after_lentil | 249 | kg/da | Gültekin vd. 2017 | https://doi.org/10.18016/ksudobil.349258 | 2026-11-14 | literature | teyit edildi; yeşil mercimek Sultan-1 (Gümüş) | ✅ |
| ref.trial.after_chickpea | 228 | kg/da | Gültekin vd. 2017 | https://doi.org/10.18016/ksudobil.349258 | 2026-11-14 | literature | teyit edildi; nohut Gökçe (Gümüş) | ✅ |
| ref.pse.low | 11 | % | Ayday ve Oylukan 1984, Adak 1999 içinde (TABMAE Derg. 8(1-2)) | https://dergipark.org.tr/tr/download/article-file/118589 | 2026-11-14 | literature | nadas yılında biriken nem yıllık yağışın %11–23'ü; planda 8 idi (Gümüş) | ✅ |
| ref.pse.high | 29 | % | Özbek vd. 1967, Demiralay "Nadasın Etkinliği" içinde | https://dergipark.org.tr/en/download/article-file/34779 | 2026-11-14 | literature | Orta Anadolu, 180 cm: %12,9–29,0; tanım (nadas − ekili toprak suyu)/yıllık yağış; planda 30 idi (Gümüş) | ✅ |
| ref.mgm.karapinar.station | Karapınar (WMO 17902) | — | WMO Climate Normals 1991–2020 (MGM verisi, NOAA NCEI arşivi) | https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/Karapinar_17902.csv | 2026-11-14 | official | 37.715 K, 33.526 D, 996 m (Gümüş) | ✅ |
| ref.mgm.karapinar.annual_precip | 290,11 | mm | WMO 1991–2020 normali, Karapınar 17902 | https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/Karapinar_17902.csv | 2026-11-14 | official | 30/30 yıl (Gümüş) | ✅ |
| ref.mgm.develi.station | Kayseri Bölge (WMO 17196) | — | WMO Climate Normals 1991–2020 | https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/Kayseri_Bolge_17196.csv | 2026-11-14 | official | Develi istasyonu WMO normallerinde yok; en yakın, ~29 km kuzey, 1094 m (Gümüş) | ✅ |
| ref.mgm.develi.annual_precip | 404,58 | mm | WMO 1991–2020 normali, Kayseri Bölge 17196 | https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/Kayseri_Bolge_17196.csv | 2026-11-14 | official | 30/30 yıl (Gümüş) | ✅ |
| ref.mgm.(11 yeni lokasyon) | Polatlı 369,26 · Eskişehir 356,73 · Aksaray 344,75 · Karaman 326,6 · Niğde 347,05 · Nevşehir 412,07 · Kaman 455,32 · Kırıkkale 385,56 · Çankırı 424,77 · Gemerek 398,45 · Boğazlıyan 344,35 | mm | WMO 1991–2020 normalleri (istasyon no'ları references.yaml'da) | https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/ | 2026-11-14 | official | 13 lokasyona genişletme; hepsi 30/30 yıl (Gümüş) | ✅ |
| ref.heat_threshold_flowering | 31 | °C | Porter ve Gawith 1999, Eur. J. Agron. 10:23–36 (ikincil atıf) | https://pmc.ncbi.nlm.nih.gov/articles/PMC7540836 | 2026-11-14 | literature | çiçeklenmede >31 °C tozlanmayı sınırlar; planda 30 idi; birincil metin görülmedi (Gümüş) | ✅ |

## 7. Hikâye ve toprak özellikleri

| ID | Değer / kısa alıntı | Kaynak adı | Link | Erişim tarihi | Tür | Kodda |
|---|---|---|---|---|---|---|
| story.erosion | "Karapınar'da Rüzgâr Erozyonunun Nedenleri": nadas-hububat tarımında soklu-diskli pulluk ve diskharrow kullanımı, aşırı otlatma, yakacak için bitki sökülmesi, kurak iklim; mücadele 1962'de TOPRAKSU ile başladı | Konya Toprak Su ve Çölleşme ile Mücadele Araştırma Enstitüsü, Tarihçe | https://arastirma.tarimorman.gov.tr/konyatopraksu/Menu/13/Tarihce | 2026-11-14 | official | ✅ |
| trait.n_fixing.chickpea | evet (Rhizobium ile kök nodülü) | Bakanlık TGSKMAE, AZOTEK-2 nohut | https://arastirma.tarimorman.gov.tr/toprakgubre/Belgeler/Mikrobiyal_Gubre/AZOTEK-2%20NOHUT.pdf | 2026-11-14 | literature | ✅ |
| trait.n_fixing.lentil | evet (baklagil, Rhizobium) | Adak 1999 (mercimeğin baklagil olarak toprak özelliklerini iyileştirmesi) | https://dergipark.org.tr/tr/download/article-file/118589 | 2026-11-14 | literature | ✅ |
| trait.tillage_passes.fallow | 3 (Mart–Nisan soklu pulluk, graham pulluğu, rodvider) | Çelebi ve Bal, Orta Anadolu Şartlarında Toprak İşleme ve Ekim Metotları | https://dergipark.org.tr/en/download/article-file/34778 | 2026-11-14 | literature | ✅ |
| trait.tillage_passes.legume | bulunamadı | denenen: Çelebi ve Bal, Adak 1999, Gültekin vd. 2017 | — | 2026-11-14 | assumption | YAML'da boş (pending) |

## 8. Toprak — SADECE Gümüş "SoilGrids olmadı" derse (manual_viewer)

**Gerek kalmadı:** SoilGrids WCS ile çekildi → `data/soilgrids/{karapinar,develi}.json` (Gümüş, 14 Kas).

Koordinat Karapınar: 37.72, 33.48 · Develi: 38.43, 35.47

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

**Gümüş yazdı (2026-11-14):** üç rotasyonun why / evidence / benefits / gaps / local_review metinleri (EN + TR) ve kaynakları `engine/config/rotations.yaml` içinde. Kaynaklar: Gültekin vd. 2017 (Konya denemesi), Demiralay ve Adak 1999 (nadas etkinliği), Konya TSÇMAE Tarihçe (erozyon), Çelebi ve Bal (toprak işleme), Bakanlık AZOTEK-2 (Rhizobium). Yasak kelimeler kontrol edildi.

## 10. Sözlük (her biri en fazla 2 kısa cümle) → İsmail

_Gümüş yazdı (2026-11-14); İsmail `strings.ts`'e alır._

| ID | EN | TR |
|---|---|---|
| glossary.et | Evapotranspiration (ET) is water leaving the field as evaporation from soil plus transpiration from plants. ET₀ is the reference value calculated from weather alone. | Evapotranspirasyon (ET), topraktan buharlaşan ve bitkiden terlemeyle çıkan suyun toplamıdır. ET₀ yalnız hava verisinden hesaplanan referans değerdir. |
| glossary.water_balance | A daily account of soil water: rain comes in; evaporation, plant use and drainage go out. What is left is the water stored in the soil. | Toprak suyunun günlük hesabı: yağmur girer; buharlaşma, bitki kullanımı ve derine sızma çıkar. Kalan, toprakta depolanan sudur. |
| glossary.available_water | Water held between field capacity and wilting point, which roots can take up. 1 mm equals 1 m³ per decare. | Tarla kapasitesi ile solma noktası arasında tutulan, köklerin alabileceği sudur. 1 mm, dekar başına 1 m³ demektir. |
| glossary.field_capacity_vs_saturation | Saturation means all soil pores are full; the extra water drains away in a few days. Field capacity is what the soil still holds after that. | Doygunluk tüm gözeneklerin suyla dolu olmasıdır; fazla su birkaç günde süzülür. Tarla kapasitesi bundan sonra toprağın tuttuğu sudur. |
| glossary.soil_moisture_anomaly | How much wetter or drier the soil is than usual for the same month. It compares this year with the typical range of past years. | Toprağın aynı ay için normalden ne kadar ıslak ya da kuru olduğudur. Bu yılı geçmiş yılların tipik aralığıyla karşılaştırır. |
| glossary.ph | pH measures how acidic or alkaline the soil is (7 is neutral). The soils at both pilot points are alkaline, around 7.7. | pH toprağın ne kadar asidik ya da bazik olduğunu ölçer (7 nötrdür). İki pilot noktadaki toprak bazik, yaklaşık 7,7'dir. |
| glossary.organic_carbon | Carbon in soil organic matter from roots, residues and microbes. More organic carbon usually means better structure and water holding. | Kök, bitki artığı ve mikroorganizmalardan gelen organik maddedeki karbondur. Genellikle daha fazla organik karbon daha iyi yapı ve su tutma demektir. |
| glossary.cec | Cation exchange capacity (CEC) is how many nutrient ions, such as calcium, magnesium and potassium, the soil can hold. Clay and organic matter raise it. | Katyon değişim kapasitesi (KDK), toprağın kalsiyum, magnezyum, potasyum gibi besin iyonlarını ne kadar tutabildiğidir. Kil ve organik madde bunu artırır. |
| glossary.p10_p50_p90 | Across the 24 past climates: P10 is a poor year (only 10 % of years were lower), P50 the middle year, P90 a good year. | 24 geçmiş iklim içinde: P10 kötü bir yıl (yılların yalnız %10'u daha düşük), P50 ortanca yıl, P90 iyi bir yıldır. |
| glossary.fallow_storage_efficiency | The share of the rain during fallow that is still in the soil when fallow ends. The rest is lost, mostly to evaporation. | Nadas süresince düşen yağmurun, nadas bittiğinde hâlâ toprakta kalan payıdır. Geri kalanı çoğunlukla buharlaşmayla kaybolur. |
| glossary.nitrogen_fixation | Legumes such as chickpea and lentil host Rhizobium bacteria in root nodules. These bacteria turn nitrogen from the air into a form plants can use. | Nohut ve mercimek gibi baklagiller kök nodüllerinde Rhizobium bakterisi barındırır. Bu bakteriler havadaki azotu bitkinin kullanabileceği hale getirir. |
| glossary.wind_exposure | A count of days when the field is bare, its surface is dry and the wind is strong. It shows exposure to wind erosion, not measured soil loss. | Tarlanın çıplak, yüzeyinin kuru ve rüzgârın kuvvetli olduğu günlerin sayısıdır. Rüzgâr erozyonuna açıklığı gösterir, ölçülmüş toprak kaybı değildir. |

## 11. Yarışma kuralları özeti

- Teslim saati (saat dilimiyle):
- Video / slayt kuralı:
- AI kullanım beyanı:
- Proje sayfası alanları:
- Jüri kriterleri:
