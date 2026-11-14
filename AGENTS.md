# AGENTS.md — NöbetSu (NASA Space Apps 2026, "Field Shift")

Tek doğru kaynak: `docs/PLAN_MVP.md`. Kod bağlantıları: `docs/ARAYUZLER.md`. Görev listesi: `TASKS.md`.

## Başlamadan
1. Kullanıcı hangi `.md` dosyalarını verdiyse sadece onları oku (bkz. CLAUDE.md "Dosya okuma kuralı"); otomatik okuma yok.
2. Tüm repoyu tarama. `data/raw/**` okuma.
3. Çok dosyalı değişiklikten önce plan çıkar; önce test, sonra kod.

## Sert kurallar (PLAN_MVP §2)
- **Uydurma sayı yok.** Her parametre YAML'da `value, unit, source, type, verified` ile durur. Doğrulanmamışsa `verified: false`, UI'da "assumption".
- **Sözleşme donmuş.** `docs/ARAYUZLER.md` ve PLAN_MVP §4'teki ad, alan ve yolları değiştirme. Gerekirse DUR ve kullanıcıya "Gümüş'e sözleşme değişikliği sorulmalı" de.
- **Mock bayrağı.** Her JSON'da `"mock": true|false`; site mock varken bant gösterir.
- **Dürüst dil.** Hiçbir metinde "recommended", "best choice", "banned", "profit guaranteed" (TR: "önerilen", "en iyi seçim", "yasak", "kâr garantili") yazma. "Ranking under your priorities" de.
- **Rozet.** Gösterilen her sayının türü var: measured, model, official, statistic, literature, assumption, user.
- **Ürüne özel `if` yok** (motor). Parametreler sadece `engine/config/*.yaml`'dan.
- Testler geçmeden merge yok. `main` her zaman build alır.

## Dosya sahipliği (sadece kendi dosyanı düzenle)
| Sahip | Dosyalar |
|---|---|
| Ömer (Rol A) | `engine/config/{crops,soil}.yaml`, `engine/nobetsu/{et0,waterbalance,rotations,yieldmodel,indicators,runner,validate}.py`, bunların testleri `engine/tests/test_{et0,waterbalance,rotations,yieldmodel,indicators,runner,validate}.py`, `engine/tests/fixtures.py` |
| Gümüş (Rol B) | `AGENTS.md`, `CLAUDE.md`, `Makefile`, `README.md`, `docs/ARAYUZLER.md`, `docs/contract/**`, `engine/pyproject.toml`, `engine/config/{locations,rotations,defaults,references}.yaml`, `engine/nobetsu/{__init__,config,power,soilgrids,smap,mock,export,build}.py`, `engine/tests/test_{power,export,contract}.py`, `data/**`, `web/public/data/**`, `web/src/lib/{types,economics,economics.test,contract.test}.ts` |
| İsmail | `web/` altındaki diğer her şey (`package.json`, Vite/Tailwind ayarları, `src/**`, `vercel.json`) |
| Muhammet | `docs/SOURCES.md`, `docs/pitch/**` |
| Herkes | `TASKS.md`, `docs/STATUS.md`, `docs/AI_USE.md` — **sadece kendi başlığının altı** |

Başkasının dosyasında değişiklik gerekiyorsa kendin yapma; kullanıcıya hangi değişikliğin kime sorulacağını yaz.
Yeni bir paket gerekiyorsa: Python → Gümüş (`pyproject.toml`), web → İsmail (`package.json`).

## Görev bitince: TASKS.md'yi işaretle (zorunlu)
Bir `TASKS.md` görevi bittiğinde (testler geçti, kod commit edildi):
1. `TASKS.md`'de **sadece kullanıcının kendi bölümündeki** o satırı `- [ ]` → `- [x]` yap; satır sonuna ` — ✅ HH:MM (<branch>)` ekle.
2. Başka satırları, başka bölümleri, satır sırasını değiştirme.
3. Değişikliği aynı branch'te `tick: <görev kısa adı>` mesajıyla commit et.
4. Yarım kaldıysa işaretleme; satır sonuna ` — ⏳ kalan: <kısa not>` ekle.
5. Hangi AI aracıyla ne yazıldığını `docs/AI_USE.md`'de kullanıcının başlığı altına bir satırla ekle.

## Komutlar
- `make test` — pytest + vitest
- `make mock` — sahte runner ile tüm mock JSON'u üretir
- `make data` — NASA POWER önbelleğinden gerçek JSON'u üretir
- `make web` — web build

## Git
- Branch: `omer/<iş>`, `gumus/<iş>`, `ismail/<iş>`. Küçük PR, en az 2 saatte bir `main`'e merge.
- Merge'den önce `main`'i kendi branch'ine çek, `make test` çalıştır.
