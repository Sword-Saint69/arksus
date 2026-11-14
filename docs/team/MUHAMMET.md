# Muhammet — Araştırma, doğrulama, sunum (yazılım dışı)

**Kim:** Muhammet · **Kod yazmıyorsun.** · **Görev listen:** `TASKS.md` → "Muhammet" bölümü

## İşin bir paragrafta

Sitedeki **her sayının arkasında bir kaynak olmalı**; o kaynakları sen buluyorsun. Buğday fiyatı, destek tutarı, dekar başı maliyet, ilçe verimleri, ekim tarihleri, makalelerdeki deneme sonuçları... Hepsini resmi ya da güvenilir bir yerden bulup, linki ve tarihiyle `docs/SOURCES.md`'ye yazıyorsun. Gümüş bunları koda geçiriyor. Bulamazsan uydurmuyoruz; "bulunamadı" yazıyoruz ve site o değeri "varsayım" diye gösteriyor. Gecenin ikinci yarısından itibaren de **hikâyenin, slaytların, videonun ve teslimin sahibi** sensin.

## Çalışma şeklin

- **Tek dosyan:** `docs/SOURCES.md`. İçinde doldurman gereken her satır hazır, her birinin bir **ID**'si var (ör. `price.wheat`). Sadece boş sütunları dolduruyorsun.
- **Her değer için 6 şey:** değer · birim · kaynak adı · link · erişim tarihi · tür.
  - `official` = resmi kurum (TMO, Bakanlık, MGM)
  - `statistic` = resmi istatistik (TÜİK)
  - `literature` = makale, rapor, ziraat odası tablosu
  - `assumption` = bulamadık, makul bir varsayım (nedenini "not"a yaz)
- **Ekran görüntüsü al.** Özellikle destek hesaplayıcısı ve fiyat sayfaları için; `docs/pitch/ekran/` klasörüne ya da ekip klasörüne koy. Jüri sorarsa elimizde olsun.
- **Zaman sınırı:** Bir değeri **30 dakikada** bulamazsan satırına `bulunamadı — denenen: ...` yaz ve sıradakine geç.
- **AI kullanabilirsin** (Claude, ChatGPT) — ama sadece "nerede bulurum" diye. AI'ın söylediği sayıyı **asla doğrudan yazma**; mutlaka resmi sayfada kendi gözünle gör ve o sayfanın linkini koy. Kullandığın AI'ı `docs/AI_USE.md`'de kendi başlığına yaz.
- **Teslim ettiğinde haber ver.** Bir grup (ör. tüm fiyatlar) bitince ekip grubuna yaz: "Fiyatlar SOURCES.md'de, Gümüş geçirebilir." Takvimler bitince Ömer'e ayrıca yaz.

## GitHub'da dosya düzenleme (kod bilgisi gerekmez)

1. github.com'da repo'yu aç → `docs/SOURCES.md` dosyasına tıkla.
2. Sağ üstteki **kalem** simgesine bas.
3. Değerleri yaz. Tablo çizgilerini (`|`) silme.
4. Aşağıda **Commit changes** → mesaj yaz (ör. `SOURCES: fiyatlar`) → "Commit directly to the main branch" → onayla.
5. Görev bittiyse aynı şekilde `TASKS.md`'yi aç, **sadece "Muhammet" bölümündeki** satırda `- [ ]` yazan yeri `- [x]` yap, sonuna ` — ✅ 18:20` gibi saati ekle, commit et.

GitHub zor gelirse: ortak bir Google Doc'ta aynı tabloyu tut ve her 2 saatte bir Gümüş'e "aktar" de. Ama **tek bir yer** kullanın, iki ayrı liste olmasın.

## Adım adım

### T+0–1 · Yarışma kuralları
Space Apps resmi sayfasından ve yerel etkinlik organizatöründen öğren, ekibe 5 satırla yaz:
teslim saati (saat dilimiyle) · video mu slayt mı, süre/sayı sınırı · AI kullanım beyanı nasıl yapılıyor · proje sayfasında hangi alanlar var · jüri kriterleri.
**Teslim saati farklıysa** herkese hemen söyle; `TASKS.md` saatleri kayar.

### T+1–3 · Fiyatlar ve destekler
- **Buğday:** TMO 2026 hububat alım fiyatı. Resmi duyuru sayfasından (tmo.gov.tr). Hangi grup/sınıf olduğunu nota yaz. Birimi TL/kg'a çevir (TL/ton ÷ 1000) ve ikisini de yaz.
- **Nohut, mercimek:** TMO günlük bülten veya Konya Ticaret Borsası günlük bülteni. Tarih önemli; hangi gün olduğunu yaz.
- **Destekler:** `destekhesaplama.tarimorman.gov.tr`. Her biri için ayrı satır: **Karapınar** ve **Develi** × buğday, nohut, mercimek, nadas. **Kuru** (sulu değil) seç. TL/da olarak yaz; ekran görüntüsü al. Hangi destek kalemlerini topladığını nota yaz (ör. temel + planlı üretim).

### T+3 · (Sadece Gümüş "SoilGrids olmadı" derse) toprak değerleri
soilgrids.org haritasını aç → Gümüş'ün verdiği iki koordinata tıkla → 0–5, 5–15, 15–30 cm için kil, kum, silt, pH, organik karbon, azot, CEC; her birinin Q05 / Q50 / Q95 değerleri. `soil.*` satırlarına yaz, kaynak sütununa `manual_viewer` ekle.

### T+3–5 · Maliyetler ve verimler
- **Maliyet:** Konya ve Kayseri ziraat odası 2026 "dekar başı üretim maliyeti" tabloları. **Kira hariç** toplamı al. Nadas için: nadas yılındaki toprak işleme (sürüm) maliyeti. Bulamazsan en yakın yılın tablosunu yaz ve yılı belirt.
- **Verim:** TÜİK bitkisel üretim istatistikleri, **ilçe düzeyi**, 2004–2025: Karapınar ve Develi'de kuru buğday, nohut, mercimek verimi (kg/da). `SOURCES.md`'de yıllık tablo hazır; her yılı yaz. (Gümüş bundan "yüksek yüzdelik" değeri hesaplayacak.)

### T+5–6 · Ekim ve hasat takvimleri → Ömer
TAGEM, Geçit Kuşağı Tarımsal Araştırma Enstitüsü (GKTAEM), Bahri Dağdaş Uluslararası Tarımsal Araştırma Enstitüsü kaynakları: Konya ve Kayseri için **kışlık buğday, yazlık nohut, yazlık mercimek**: tipik ekim tarihi ve hasat tarihi. Bir aralık bulursan aralığı yaz ("10–25 Ekim"). Bitince **Ömer'e haber ver.**

### T+6–7 · Hikâye ve doğrulama kaynakları
- **Erozyon hikâyesi:** Konya Toprak Su ve Çölleşme Araştırma Enstitüsü'nün tarih/hakkımızda sayfası: 1960'larda Karapınar rüzgâr erozyonu, nadas–hububat + diskaro. Link + kısa alıntı (bir cümle).
- **Deneme makalesi:** Konya kuru koşulda ön bitki denemesi: nadastan sonra **286**, mercimekten sonra **249**, nohuttan sonra **228** kg/da buğday, 2011–2014. Makaleyi aç, **bu rakamların gerçekten orada olduğunu ve yılları** teyit et. Farklıysa doğrusunu yaz.
- **Nadas su depolama verimi:** Orta Anadolu için **%8–30** aralığını veren kaynak(lar)ı teyit et.
- **MGM normalleri:** Karapınar'a ve Develi'ye en yakın MGM istasyonunun **1991–2020 yıllık toplam yağış normali** (mm) ve istasyon adı (mgm.gov.tr, il/ilçe istatistikleri).

### T+7–9 · Strateji metinleri, toprak özellikleri, sözlük → Gümüş ve İsmail
Her rotasyon için (Nadas→Buğday, Nohut→Buğday, Mercimek→Buğday), **sade İngilizce** (sonra Türkçesi), her madde 1–2 cümle, kanıtın yanına kaynak:
- **Why** — neden listede? (1 madde)
- **Evidence** — hangi kanıt destekliyor? (1–3 madde, her biri kaynak + link)
- **Benefits** — faydaları (2–3 madde)
- **Gaps** — neyi bilmiyoruz? (2–3 madde)
- **Ask a local expert** — yerel uzmana sorulacaklar (2–3 madde)

Ayrıca: nohut ve mercimek **azot bağlar** (kaynak; kg sayısı YAZMIYORUZ); **nadas yılında kaç kez toprak işlenir** vs baklagil yılında kaç kez (kaynak).
Sözlük: 12 terim, her biri **en fazla 2 kısa cümle** (liste `SOURCES.md`'de).
**Yazmayacağın kelimeler:** "recommended", "best choice", "banned", "profit guaranteed" / "önerilen", "en iyi", "yasak", "kâr garantili".

### T+9–12 · Sunum hazırlığı
- **7 slayt iskeleti** (PLAN_MVP §8): Karapınar erozyon tarihi → su mu toprak mı para mı → tek sezon neden yanıltır → nasıl çalışıyor → sonuç → nerede değişiyor → kanıt, boşluklar, sınırlar → sonraki adım (MUSTECH, daha çok ilçe, SMAP, GRACE).
- **Proje sayfası** İngilizce taslak, **AI kullanım beyanı** taslağı (ekibin `AI_USE.md`'sinden), **jüri soru-cevap** listesi (PLAN_MVP §8'deki sorular + cevapları).
- Sunumda **challenge kontrol listesini** madde madde göster (PLAN_MVP §8).

### T+12–14 · Kullanıcı testi
Siteyi (Vercel linki) telefonda ve bilgisayarda bir çiftçi gibi kullan. Anlaşılmayan her yeri **ekran görüntüsüyle** İsmail'e yaz. Mümkünse bir çiftçiden ya da MUSTECH'ten 5 dakikalık görüş al; isim kullanmak için **izin iste**.

### T+14–22.5 · Hikâye, video, teslim
- **Hero cümlesi:** M3'teki gerçek sonuçlardan, PLAN_MVP §8'deki kalıpla. Sadece gerçek sayılar; sayı çarpıcı değilse soruyla aç.
- **30 sn video** (İngilizce altyazı): 0–5 sn soru + tarla · 5–12 sn seçimler ve 3 kart · 12–22 sn tarla takvimi, Grafik A, flip ızgarası · 22–26 sn "Why this strategy?" · 26–30 sn "NASA POWER + FAO-56, 24 climates, open source" + link.
- Slaytları gerçek ekran görüntüleriyle doldur; İsmail'in Türkçe metinlerini çiftçi diliyle gözden geçir (nadas, kuru tarım, dekar, anız).
- **Teslim kontrol listesi:** proje sayfası · demo linki · GitHub linki · video/slaytlar · AI beyanı · NASA verisi adı geçiyor. Hepsini **gizli pencerede** aç, sonra **TESLİM ET**.

## Senden bekleyenler

| Kim | Ne | Ne zaman |
|---|---|---|
| Herkes | Yarışma kuralları özeti, teslim saati | T+1 |
| Gümüş | Fiyat, destek | T+3 |
| Gümüş | Maliyet, verim | T+5 |
| Ömer | Ekim/hasat takvimleri | T+6 |
| Gümüş → Ömer | Deneme verimleri, PSE aralığı, MGM normalleri | T+7 |
| Gümüş, İsmail | Strateji metinleri, toprak özellikleri, sözlük | T+9 |
| İsmail | Kullanıcı testi notları | T+14 |

## Senin beklediklerin

| Kimden | Ne | Ne zaman |
|---|---|---|
| Gümüş | İki lokasyonun koordinatları | T+0:30 |
| İsmail | Vercel linki (test için) | T+4'ten itibaren |
| Herkes | M3'teki gerçek sonuçlar (hero cümlesi için) | T+14 |
