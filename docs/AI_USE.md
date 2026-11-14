# AI kullanımı — çalışan liste

Herkes **sadece kendi başlığının altına** ekler. Biçim: `- <araç / model> — <ne yazdı veya yardım etti> — <dosya(lar)>`
Teslimde Muhammet bunu AI kullanım beyanına çevirir.

## Muhammet

## İsmail

## Ömer
- Claude Code (Opus 5.5) — FAO-56 ET₀ modülü, Örnek 18 testleri, sentetik hava fixture'ı — `engine/nobetsu/et0.py`, `engine/tests/test_et0.py`, `engine/tests/fixtures.py`
- Claude Code (Fable 5.2) — iki katmanlı dual-Kc su bütçesi motoru, ürün takvimi, başlangıç config değerleri, testler; Gümüş için not listesi — `engine/nobetsu/waterbalance.py`, `engine/nobetsu/rotations.py`, `engine/config/{crops,soil}.yaml`, `engine/tests/test_{waterbalance,rotations}.py`, `docs/GUMUS_BAKMALI.md`
- Claude Code (Fable 5.2) — run_location, verim oranı, toprak/hassasiyet göstergeleri ve testleri — `engine/nobetsu/{runner,yieldmodel,indicators}.py`, `engine/tests/test_{runner,yieldmodel,indicators}.py`
- Claude Code (Opus 5.5) — validate.py (5 tutarlılık kontrolü) ve testleri; main birleştirmesi sonrası uyum kontrolü — `engine/nobetsu/validate.py`, `engine/tests/test_validate.py`
- Claude Code (Opus 5.5) — SoilGrids dokusundan FAO-56 Tablo 19 ile AWC seçimi (USDA doku üçgeni), testleri — `engine/config/soil.yaml`, `engine/nobetsu/{runner,waterbalance}.py`, `engine/tests/test_runner.py`
- Claude Code (Opus 5.5) + web-fetch — crops.yaml / soil.yaml / Örnek 18 değerlerini FAO-56 resmi HTML sürümüyle (fao.org/4/x0490e) karşılaştırma ve düzeltme — `engine/config/{crops,soil}.yaml`, `engine/tests/test_et0.py`, `engine/nobetsu/validate.py`

## Gümüş
- Claude Code (Opus 5.5) — M0 sözleşme iskeleti: paket, config, mock runner, export/build, JSON şemaları, testler, types.ts, economics.ts — `engine/`, `docs/contract/`, `web/src/lib/`, `Makefile`
- Claude Code (Opus 5.5) — NASA POWER çekimi, önbellek, birim/boşluk işleme ve testleri — `engine/nobetsu/power.py`, `engine/tests/test_power.py`
- Claude Code (Opus 5.5) — SoilGrids WCS çekimi, birim dönüşümü, AWC hesabı ve testleri — `engine/nobetsu/soilgrids.py`, `engine/tests/test_soilgrids.py`
- Claude Code (Opus 5.5) — economics.ts birim testleri (elle hesaplanmış örnekler, numpy ile karşılaştırmalı yüzdelik) — `web/src/lib/economics.test.ts`

## Ortak (plan ve görev dağılımı)
- Claude — görev dağılımı, kişi rehberleri, arayüz sözleşmesi taslağı, proje özeti — `TASKS.md`, `AGENTS.md`, `docs/ARAYUZLER.md`, `docs/PROJE_OZETI.md`, `docs/team/*`
