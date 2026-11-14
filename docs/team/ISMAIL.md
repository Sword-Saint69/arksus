# İsmail — Web arayüzü

**Kim:** İsmail · **Branch öneki:** `ismail/` · **Görev listen:** `TASKS.md` → "İsmail" bölümü
**Okuman gerekenler:** `docs/PROJE_OZETI.md` → `docs/ARAYUZLER.md` §8–§11 → PLAN_MVP §4 ve §6

## İşin bir paragrafta

Kullanıcının gördüğü her şey senin: tek sayfalık, sakin bir "tarım raporu" sitesi. Lokasyon ve derinlik seçimi, öncelik kaydırıcıları, üç rotasyon kartı, grafikler, toprak sağlığı bölümü, kanıt paneli. **Veriyi sen üretmiyorsun, para hesabını da sen yapmıyorsun:** veri `web/public/data/*.json`'dan gelir (Gümüş), para hesabı `src/lib/economics.ts`'ten gelir (Gümüş). Sen bunları güzel, anlaşılır ve telefonda çalışır şekilde gösteriyorsun. İlk 8 saat **sadece mock veriyle** çalışırsın; gerçek veri gelince hiçbir şey değişmemeli çünkü biçim aynı.

## Sahibi olduğun dosyalar

- `web/` altındaki her şey: `package.json`, Vite / Tailwind / shadcn ayarları, `vercel.json`, `src/**`
- **Hariç (Gümüş'ün):** `web/src/lib/types.ts`, `web/src/lib/economics.ts`, `economics.test.ts`, `contract.test.ts`, `web/public/data/**`
- Gümüş'ün bu dosyalarında bir şey eksikse (alan, fonksiyon) → kendin ekleme, Gümüş'e yaz.
- Python tarafına hiç dokunmazsın.

## Uyum için 6 kural

1. **Tipler sadece `types.ts`'ten.** Kendi tipini yazma; JSON'u `import type { ResultsFile, ... } from '@/lib/types'` ile kullan.
2. **Para ve sıralama sadece `economics.ts`'ten** (`summarize`, `flipTable`, `rankByPriority`, `sequenceMoney`, `breakEvenYield`). Yüzdelik, ortanca, kâr hesabı yazmak yasak — iki yerde hesap olursa sonuçlar ayrışır.
3. **Mock bandı:** yüklenen dosyalardan **herhangi birinde** `mock: true` varsa sayfanın üstünde görünür bir bant.
4. **Her sayının yanında rozet:** `measured / model / official / statistic / literature / assumption / user`. Kullanıcı bir değeri değiştirince o değerin rozeti `user` olur. Renk tek başına anlam taşımaz (yazı da olsun).
5. **Tüm metinler `src/strings.ts`'te**, `{ en: '...', tr: '...' }` biçiminde. MVP'de `en` dolu; `tr` anahtarı var ama boş ya da İngilizce kopyası olabilir (E4'te doldurulur).
6. **Yasak kelimeler:** "recommended", "best", "best choice", "banned", "profit guaranteed". Sıralama başlığı: **"Ranking under your priorities"** ve hangi ölçütün belirlediği (`driver`).

## Veri yükleme

| Dosya | Ne zaman |
|---|---|
| `/data/site_index.json`, `/data/defaults.json`, `/data/validation.json` | sayfa açılınca |
| `/data/results/{loc}.json`, `/data/smap/{loc}.json` | lokasyon seçilince |
| `/data/ledger/{loc}.json` | Grafik B ekrana gelince (lazy) |

Öneri: `src/data/useSiteData.ts` içinde tek bir hook; uygulama durumu (lokasyon, derinlik, öncelikler, kullanıcı girdileri) basit `useState`/context ile. Girdileri tarayıcıda saklamak istersen `localStorage`'ı `try/catch` içine al.

## Adım adım (PLAN_MVP §6 sırası)

### T+0–1 · İskelet → M0
`web/` içinde Vite + React + TypeScript + Tailwind + shadcn/ui + Recharts + **vitest** (Gümüş'ün ekonomi testleri için gerekli) kur. `@/` alias'ı ayarla. Boş bir layout (başlık + bölüm başlıkları) Vercel'de açılsın (proje root = `web`). Vercel linkini gruba at.
Bu sırada Gümüş `types.ts`, mock JSON ve `economics.ts`'i ekliyor; çakışma olmaz çünkü farklı dosyalar.

### T+1–4 · Mock ile tek sayfa → M1
Başlık (soru: *"Fallow, chickpea or lentil before wheat?"*), lokasyon düğmesi (Karapınar / Develi), derinlik seçici, mock bandı, **3 rotasyon kartı**. Baz senaryo kartında **"current practice"** etiketi; diğer kartlar **bazdan farkı** gösterir (`delta_vs_baseline`).
Her kartta 4 satır: **Water** (buğday ekiminde su, ortanca ve P10–P90, mm ve m³/da; 1 mm = 1 m³/da) · **Soil** (çıplak gün, rüzgâra açık çıplak gün, azot bağlama rozeti) · **Yield** (buğday aralığı, kg/da) · **Money** (2 yıllık net aralığı TL/da, zarar olasılığı). Rozet bileşenini burada bir kez yaz, her yerde kullan.

### T+4–6 · Grafik A — "24 climates, one decision"
Rotasyon başına 24 iki yıllık net (`RotationSummary.nets`) şerit/nokta grafiği; P10–P50–P90 işaretli; sıfır çizgisi.

### T+6–8 · Grafik B — su defteri
Seçilen başlangıç yılı için (varsayılan: ortanca yıl) 24 aylık haftalık `aw_mm`; üç rotasyon üst üste; ürün dönemleri gölgeli (`crop` alanı); yıl seçici. `ledger` dosyası lazy yüklenir.

### T+8–9 · "Your numbers" paneli → M2
Ürün başına fiyat, maliyet, destek, Ym girişleri; rozet, `as_of` tarihi, "reset to defaults" düğmesi. `inputsFromDefaults()` ile başla, değişiklikte tüm kartlar ve grafikler yeniden hesaplansın. Gümüş gerçek JSON'u koyunca bant kaybolmalı.

### T+9–10.5 · Öncelik kaydırıcıları + "Why this strategy?" çekmecesi
Üç kaydırıcı (save water / earn income / protect soil), toplam %100, varsayılan 34/33/33. Kartlar `rankByPriority()` sırasıyla dizilir. Çekmece: `strategy.why`, `evidence` (linkli), `benefits`, `gaps`, `local_review`. **M3'te düşürülmez.**

### T+10.5–12 · Toprak sağlığı bölümü
- İlçe toprak kartı: her özellik için Q50 + %90 aralık (Q05–Q95), "estimate, not your field" rozeti, her birine bir sade cümle (`meaning`).
- Sabit kutu "What satellites can't tell you": fosfor, potasyum, mikro elementler, sıkışma → toprak analizi / tarla kontrolü.
- Doluluk eğrisi: `fullness_by_month`, üç rotasyon, ortanca + P10–P90 bandı, %100 çizgisi = tarla kapasitesi. (Bu yüzdelikleri de `economics.ts`'teki `range()` ile al.)
- SMAP paneli: `available: true` ise mevsimsel bant + son değer ve yüzdeliği ("wetter / drier than usual for November"); değilse "coming" yer tutucusu. **M3'te düşürülmez** (yer tutucu hâliyle).

### T+12–13.5 · Grafik C, flip ızgarası, kanıt, sözlük, footer
- Grafik C (tarla takvimi): rotasyon başına 24 ay hücresi; gölge = o ay çıplak olan yılların payı; buğdayın çoğu yılda stres yaşadığı aylarda işaret.
- Flip ızgarası: 3 × 3 (derinlik × dry/normal/wet), `flipTable()`.
- Kanıt paneli: `validation.json`'daki 5 kontrol, durum rozetleri, notlar + "satellite and model data vs ground stations" kısa notu.
- Sözlük ipuçları (metinler Muhammet'ten, `strings.ts`'e sen koyarsın).
- Footer: veri kaynakları (NASA POWER ilk), varsayımlar listesi, "supports, does not replace, farmer judgment and local expertise", AI_USE ve GitHub linkleri.
- Zaman yetmezse **önce flip ızgarası, sonra Grafik C** düşer.

### T+13.5–14 · Telefon geçişi → M3
375 px genişlikte her bölümü kontrol et; rozetler, metin cilası.

### T+14–19 · Genişletme (sırayla, her biri ayrı branch, yeşil değilse merge yok)
E4 Türkçe dil düğmesi (Muhammet gözden geçirir) → E2 senaryo seçici (Gümüş tipleri ekledikten sonra) → E3 GRACE grafiği → E7 harita (lazy-load).

## Bağımlılıkların

| Ne | Kimden | Ne zaman | Gecikirse |
|---|---|---|---|
| `types.ts`, mock JSON, `economics.ts` imzaları | Gümüş | T+1 | Layout ve bileşen iskeletiyle devam et; kendi tipini yazma |
| Gerçek JSON (`mock: false`) | Gümüş | T+9 | Mock'la devam; bant görünür kalır |
| Strateji metinleri | Muhammet → Gümüş → `site_index.json` | T+9 | "text pending" yer tutucusu |
| Sözlük metinleri | Muhammet (`SOURCES.md` → glossary) | T+9 | Kısa İngilizce yer tutucu |
| Kullanıcı testi notları | Muhammet | T+12–14 | — |

## AI ajan başlangıç promptları

Her görev için yeni oturum. Önce şunu söyle: **"Ben İsmail'im."**

**1 — İskelet (T+0):**
```
Ben İsmail'im. AGENTS.md'yi ve docs/team/ISMAIL.md'yi oku. web/ klasöründe Vite + React + TypeScript + Tailwind +
shadcn/ui + Recharts + vitest kur; @/ alias'ı ayarla. web/src/lib/types.ts, economics.ts ve web/public/data/ Gümüş'ün,
bunlara dokunma. Boş bir tek sayfa layout yap (PLAN_MVP §6'daki bölüm başlıkları). `npm run build` ve `npm test`
geçince dur. Bitince TASKS.md'de sadece İsmail bölümündeki ilgili satırı işaretle.
```

**2 — Mock ile sayfa (T+1):**
```
Ben İsmail'im. AGENTS.md, docs/ARAYUZLER.md §8–§11 ve docs/PLAN_MVP.md §4 ve §6'yı oku.
Sadece web/public/data/ altındaki mock JSON'dan tek sayfa site kur, §6 build sırasıyla. Tipleri sadece
web/src/lib/types.ts'ten al; para, yüzdelik ve sıralamayı sadece web/src/lib/economics.ts'ten çağır, asla yeniden yazma.
Tüm metinler src/strings.ts'te (en dolu, tr anahtarı var). Mock bandını göster. Baz rotasyon "current practice",
diğerleri farkı gösterir. Her sayıda rozet. "recommended/best/banned" kelimelerini kullanma. 375 px'te kontrol et.
Bu görev: <BURAYA TASKS.md'deki satır>. Bitince TASKS.md'de sadece İsmail bölümündeki o satırı işaretle.
```

**3 — Sonraki her görev:** 2. promptu kullan, sadece "Bu görev:" satırını değiştir.

## Takılırsan

- JSON'da beklediğin bir alan yok → Gümüş'e yaz, uydurma.
- Bir grafik 1 saati geçti ve bitmiyor → en basit hâliyle (ör. tablo) bırak, sonraki maddeye geç; sonra dönersin.
- Build kırıldı → `main`'e merge etme. Son çalışan commit'e dön.
