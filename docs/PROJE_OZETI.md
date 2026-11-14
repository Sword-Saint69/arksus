# NöbetSu — 5 dakikada proje

> Bu dosya herkes için. Yazılım bilmesen de anlaşılır olsun diye yazıldı. Ayrıntı `PLAN_MVP.md`'de.

## Tek cümlede

**Çiftçinin "Tarlamı bu yıl nadasa mı bırakayım, yoksa nohut ya da mercimek mi ekeyim?" sorusuna; su, toprak ve para tarafını birlikte, NASA'nın 24 yıllık iklim verisiyle gösteren bir web sitesi.**

Yarışma: NASA Space Apps 2026 — *Field Shift: Adapting Farms with NASA Data*.

## Sorun ne?

Orta Anadolu'da (Konya, Kayseri) kuru tarımda çiftçi buğdaydan sonra tarlayı genelde **bir yıl boş bırakır (nadas)**.

- **İyi tarafı:** Boş tarla yağmuru toprağın içinde biriktirir, **kumbara gibi**. Ertesi yıl ekilen buğday bu suyu kullanır, kurak yılda daha güvenli olur.
- **Kötü tarafı 1 — para:** Nadas yılı hiç ürün yok, gelir yok. Tek yıla bakınca hep zarar gibi görünür.
- **Kötü tarafı 2 — toprak:** Tarla bir yıldan uzun süre çıplak ve sürülmüş kalır. Rüzgâr toprağı uçurur. Karapınar'da 1960'larda yaşanan büyük rüzgâr erozyonunun resmi nedenlerinden biri nadas–hububat sistemi ve diskaro ile sık toprak işlemedir.
- **Alternatif:** Nadas yerine **nohut** veya **mercimek** ekmek. Gelir getirir, havadan azot bağlar, toprağı daha kısa süre çıplak bırakır. Ama toprakta daha az su bırakır; buğday kurak yılda daha çok zorlanabilir.

2025 kuraklığı ve düşük 2026 hububat fiyatlarıyla çiftçiler bu soruyu yine soruyor. **Bu üç tarafı (su, toprak, para) birlikte gösteren bir araç yok.** Biz onu yapıyoruz.

## Ne yapıyoruz?

Bir web sitesi. Kullanıcı şunları seçer:

| Seçim | Seçenekler |
|---|---|
| İlçe | Konya–Karapınar, Kayseri–Develi |
| Toprak derinliği | Sığ, orta, derin |
| Öncelik | Su biriktir / gelir kazan / toprağı koru (kaydırıcılar) |
| Kendi rakamları | Fiyat, maliyet, destek, beklenen en yüksek verim (hazır gelir, değiştirilebilir) |

Site üç seçeneği yan yana gösterir:

1. **Nadas → Buğday** (bugünkü uygulama, karşılaştırma noktası)
2. **Nohut → Buğday**
3. **Mercimek → Buğday**

Her biri için: buğday ekiminde toprakta ne kadar su kaldı · tarla kaç gün çıplak kaldı, kaçı rüzgârlı ve kuruydu · buğday verimi aralığı · iki yıllık kâr/zarar aralığı ve zarar etme ihtimali · hangi durumda hangisi öne geçiyor (kurak/normal/ıslak yıl × toprak derinliği) · neden bu seçenek, kanıtı ne, neyi bilmiyoruz.

**Tek bir yıl değil, geçmiş 24 yılın her biri için ayrı ayrı hesaplıyoruz** (2001–2024 başlangıçlı). Böylece "ortalama" değil, **aralık** görünür: kötü yılda ne olur, iyi yılda ne olur.

## Nasıl çalışıyor? (4 adım)

```
1. NASA POWER        2. Su hesabı (motor)        3. Verim oranı           4. Para (sitede)
günlük hava    ──►   toprağı bir su deposu  ──►  "su yeterse en       ──►  oran × çiftçinin
(yağmur, sıcaklık,   gibi her gün hesaplar:      yüksek verimin           verimi × fiyatı
rüzgâr, güneş)       yağmur girer, buharlaşma    yüzde kaçı?"             − maliyet + destek
24+ yıl              ve bitki çıkarır            (0 ile 1 arası)
                     (FAO-56 yöntemi)
```

- **1–3. adımlar** bilgisayarda bir kez çalışır (Python), sonuçları dosyaya yazar.
- **4. adım** sitede çalışır. Çiftçi fiyatı değiştirdiği an kâr/zarar yeniden hesaplanır. Sunucu yok, veritabanı yok; site çok basit ve sağlam.

Kullandığımız NASA verileri: **NASA POWER** (hava, ana veri), **NASA SMAP** (toprak nemi, uydu; gelirse), genişletmede **GRACE** (havzadaki toplam su kaybı). Toprak özellikleri için **SoilGrids** (ISRIC).

## Ne DEĞİL?

- Senin tarlanın kesin verim tahmini değil → "bölgedeki tipik bir tarla, geçmiş 24 yılın iklimi".
- Fiyat tahmini değil → fiyatı çiftçi girer.
- Gübre danışmanı değil → fosfor, potasyum gibi şeyler uydudan ölçülemez, toprak analizi gerekir; bunu açıkça yazıyoruz.
- "Şunu ek" diyen bir sistem değil → seçenekleri dürüstçe gösterir, kararı çiftçi ve yerel uzman verir.

## Kim ne yapıyor?

| Kişi | Ne yapıyor | Basitçe |
|---|---|---|
| **Muhammet** | Araştırma, doğrulama, sunum | Fiyat, maliyet, destek, verim, ekim tarihlerini resmi kaynaklardan bulur; strateji metinlerini yazar; slayt, video, proje sayfası, teslim |
| **İsmail** | Web sitesi | Kullanıcının gördüğü her şey: kartlar, grafikler, kaydırıcılar, telefon uyumu |
| **Ömer** *(geçici)* | Motor (Rol A) | Toprak su hesabını yapan Python kodu: "her gün toprakta ne kadar su var, bitki ne kadar zorlandı" |
| **Gümüş** *(geçici)* | Veri ve bağlantı (Rol B) | NASA verisini indirir, motorun çıktısını siteye uygun dosyalara çevirir, para hesabı kodu, repo ve yayın |

**Herkes nasıl birbirini beklemeden çalışıyor?**

```
Muhammet ──(rakamlar, metinler)──► Gümüş ──(hava verisi)──► Ömer ──(su sonuçları)──► Gümüş ──(JSON dosyaları)──► İsmail ──► SİTE
```

İlk saatte Gümüş **sahte (mock) ama doğru biçimli** dosyalar koyar. İsmail siteyi bu sahte verilerle yapar. Ömer motoru kendi test verisiyle yazar. Gece yarısına doğru sahte veri gerçek veriyle değişir; dosyaların biçimi aynı olduğu için hiçbir şey bozulmaz. Bu biçim `docs/ARAYUZLER.md`'de yazılı ve **ilk saatten sonra değişmez**.

## Çalışma kuralları (5 madde)

1. **Uydurma sayı yok.** Her sayının kaynağı var. Bulamadıysak "varsayım" diye yazarız.
2. **Herkes kendi dosyasında.** Başkasının dosyasına dokunmadan önce sor.
3. **Her yazılımcı kendi branch'inde.** En az 2 saatte bir birleştirir; ana dal her zaman çalışır.
4. **Biten görev `TASKS.md`'de işaretlenir** (AI ajanı da kendi işaretler, sadece senin bölümünde).
5. **Her milestone'da site çalışır olmalı.** Küçük ama çalışan > büyük ama bozuk.

## Zaman çizelgesi (T0 = Cumartesi 15:00)

| Saat | Ne olmalı |
|---|---|
| 16:00 (M0) | Repo, sözleşme, sahte veriler hazır; boş site yayında |
| 19:00 (M1) | Her parça tek başına çalışıyor |
| 00:00 (M2) | Gerçek NASA verisiyle uçtan uca çalışıyor → `v0.1` (güvenlik ağı) |
| 05:00 (M3) | MVP tamam → `v0.2` (demo sürümü) |
| 05:00–10:00 | Zaman kalırsa ekstralar (SMAP karşılaştırması, kurak/sıcak senaryolar, Türkçe dil...) |
| 10:00 | Özellik dondurma; sadece hata düzeltme |
| 10:00–13:30 | Video, slayt, proje sayfası, teslim |

## Mini sözlük

| Terim | Anlamı |
|---|---|
| Nadas | Tarlayı bir sezon ekmeden bırakmak |
| Rotasyon | İki yıllık ürün sırası (ör. nohut → buğday) |
| ET / ET₀ | Topraktan ve bitkiden havaya giden su (buharlaşma + terleme). ET₀ = "referans" değer, hava koşullarından hesaplanır |
| FAO-56 | BM Gıda ve Tarım Örgütü'nün bu hesap için standart yöntemi |
| Su bütçesi | Toprağa giren su − çıkan su = depoda kalan su |
| Tarla kapasitesi | Toprağın süzüldükten sonra tutabildiği su ("depo dolu") |
| P10 / P50 / P90 | 24 yılın kötü / orta / iyi ucu. P50 = ortanca |
| Mock | Sahte ama doğru biçimli veri; site erken yapılabilsin diye |
| Sözleşme | Dosyaların ve alanların adları; herkesin kodu buna uyar |
| Branch / merge | Herkesin kendi kopyası / kopyaları ana dala birleştirmek |
| Milestone | Kontrol noktası; o saatte belli şeyler çalışıyor olmalı |
