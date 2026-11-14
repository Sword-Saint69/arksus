# NöbetSu

**Fallow saves water but leaves the soil bare. NöbetSu weighs water, soil, yield and what the farmer can earn across 24 years of NASA climate, and shows which rotation suits the land best.**

NASA Space Apps Challenge 2026 · *Field Shift: Adapting Farms with NASA Data*

NöbetSu helps rainfed farmers in Central Anatolia (Turkey) compare three two-year rotations before wheat:

| Rotation | Role |
|---|---|
| Fallow → Wheat | current practice (baseline) |
| Chickpea → Wheat | alternative |
| Lentil → Wheat | alternative |

For **13 districts** (one per Central Anatolian province), **3 soil depth classes** and **24 historical sequences** (start years 2001–2024), a daily FAO-56 soil water balance driven by **NASA POWER** weather shows, for each rotation compared with fallow:

- **Water:** plant-available water left in the soil at wheat sowing, and the months when wheat is under water or heat stress.
- **Soil:** bare days per month and windy, dry, bare days (wind-exposure count); nitrogen-fixing crops; a regional soil card from SoilGrids.
- **Yield:** the range of wheat and legume yields that water allows (P10 / P50 / P90).
- **Recommendation:** the rotation most suitable for this land under the farmer's priorities (earnings, wheat yield, soil, water). Prices and supports are used **internally** to judge what earns more; the site shows **no money**. Rotations that cut the next wheat below 85 % of after-fallow wheat, or whose year-1 crop fails in the median year, are **blocked** whatever they would earn.

It is **not** a yield forecast for one field, a price forecast or a fertiliser advisor. Every recommendation shows its main reason, the blocked options and whether the result is a close call; the final decision stays with the farmer and local experts.

---

## Status (14 Nov 2026)

| Part | State |
|---|---|
| Engine (FAO-56 ET₀, two-layer dual-Kc water balance, yield ratio, soil indicators) | done, 13 districts |
| Real data in `web/public/data/` (`mock: false`) | done, tag `v0.1` (2 districts), extended to 13 |
| Validation checks (5) | 2 pass, 3 info |
| Decision module (`web/src/lib/economics.ts`: score, guardrails, recommendation) | done, unit-tested |
| Reference yields, prices, supports (internal parameters), validation references | sourced (`docs/SOURCES.md`) |
| Production costs | not used (team decision 14 Nov: no money shown; costs not sourced) |
| NASA SMAP soil wetness | requested from AppEEARS, not yet in the data (`available: false`) |
| Web site (React) | not started yet |

---

## How it works

```
NASA POWER (daily weather, 2000→) ─┐
SoilGrids 2.0 (soil, 250 m) ───────┼─► engine/ (Python, offline) ─► web/public/data/*.json ─► web/ (static React site)
engine/config/*.yaml (crops, soil, ┘     FAO-56 water balance,          contract: docs/contract/     decision in the browser
 locations, prices, references)          yield ratio Ya/Ym                                         (priority sliders)
```

- The Python engine computes **physical results only** (water, ET, yield ratio 0–1). It runs once and writes JSON.
- The browser scores each rotation (earnings estimate from yield ratio × reference yield × price + support, wheat yield, soil, water), applies the guardrails and names the most suitable rotation. No TL is displayed. No server, no database, no live API calls.
- Every number carries a source and a type badge: `measured`, `model`, `official`, `statistic`, `literature`, `assumption`, `user`. Values not yet sourced are `null` and shown as pending, never as a number.

### Engine in short

- **ET₀:** FAO-56 Penman–Monteith (daily), tested against FAO-56 Example 18 (3.88 vs 3.9 mm/day).
- **Water balance:** daily, two-layer, dual crop coefficient (FAO-56 Ch. 7); roots grow into stored water. Mass balance closes to ~1e-12 mm over all 2,808 sequences.
- **Sequence:** spin-up wheat, then the rotation's year 1 (bare fallow, or bare → legume → bare), then winter wheat.
- **Yield:** `Ya/Ym = 1 − Ky (1 − ΣETa/ΣETc)` (FAO-33). No extra "previous crop" factor, because the water effect is already in the model.
- **Available water capacity (AWC):** soil texture class from SoilGrids → FAO-56 Table 19 midpoint × (1 − coarse fragments). SoilGrids' own AWC (wv0033 − wv1500) ranged from 58 to 144 mm/m and was implausibly low at several points (58 at Karapınar, 67 at Develi, 70 at Karaman) because its field-capacity estimate is low for these clay soils. It is kept in the data for comparison, together with a Saxton & Rawls (2006) estimate (106–154 mm/m).

---

## Quick start

Requirements: Python 3.11+, Git. Node.js 20+ only for the web part.

```bash
git clone https://github.com/muhammetgumus55/TerraShift.git
cd TerraShift
pip install -e "./engine[dev]"
```

| Command | What it does |
|---|---|
| `make test` | pytest (engine) + vitest (web, once `web/package.json` exists) |
| `make data` | builds the real JSON from the cached NASA POWER and SoilGrids data |
| `make mock` | builds fake JSON in the same format (for UI work; do not commit) |
| `make web` | builds the web site |

Without `make` (e.g. Windows without `winget install ezwinports.make`):

```bash
cd engine
python -m pytest -q                                  # tests
python -m nobetsu.build --out ../web/public/data      # make data
python -m nobetsu.build --mock --out ../web/public/data   # make mock
python -m nobetsu.power                               # fetch NASA POWER for locations without a cache
python -m nobetsu.soilgrids                           # pull SoilGrids for all locations
```

Raw downloads are cached in `data/` and committed, so `make data` needs no network.

### Add a district

1. Add a point to `engine/config/locations.yaml` (id, name, district, province, lat, lon, note).
2. `python -m nobetsu.power` and `python -m nobetsu.soilgrids`.
3. Add its WMO 1991–2020 precipitation normal to `engine/config/references.yaml` and a block to `engine/config/defaults.yaml`.
4. `make data && make test`.

---

## Repository layout

```
engine/
  config/        locations, crops, soil, rotations (texts), defaults (decision parameters), references (validation)
  nobetsu/       power, soilgrids, et0, waterbalance, rotations, yieldmodel, indicators, runner, validate, export, build, mock
  tests/         pytest
web/
  public/data/   generated JSON (the contract)
  src/lib/       types.ts (contract types), economics.ts (+ tests)
data/            cached NASA POWER, SoilGrids, SMAP request files
docs/            PLAN_MVP.md, ARAYUZLER.md (interfaces), contract/*.schema.json, SOURCES.md, AI_USE.md
```

---

## Data sources

| Data | Use | Access |
|---|---|---|
| **NASA POWER** daily (PRECTOTCORR, T2M_MAX/MIN, T2MDEW, RH2M, WS2M, WS2M_MAX, ALLSKY_SFC_SW_DWN), community AG | weather for the engine, 2000-01-01 → 2026-11-09 | [power.larc.nasa.gov](https://power.larc.nasa.gov/) API |
| **NASA SMAP L4** `SPL4SMGP.008` (root-zone and surface wetness, 9 km) | regional soil wetness panel | AppEEARS point request (`data/smap/appeears_request.json`) |
| **SoilGrids 2.0** (ISRIC), 250 m | soil card, texture class, coarse fragments | WCS |
| **WMO Climate Normals 1991–2020** (Turkish State Meteorological Service stations) | check of POWER precipitation | [NOAA NCEI archive](https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/Region-6-WMO-Normals-9120/Turkiye/CSV/) |
| **ESA WorldCover 2021** (10 m) | check that each point lies on cropland | AWS open data |
| FAO-56 (Allen et al. 1998), FAO-33 | method and crop/soil parameters | [fao.org/4/x0490e](https://www.fao.org/4/x0490e/x0490e00.htm) |
| Gültekin et al. 2017, KSÜ Doğa Bil. Derg. 20: 283–287 | Konya dryland trial (wheat after fallow / lentil / chickpea) | [doi:10.18016/ksudobil.349258](https://doi.org/10.18016/ksudobil.349258) |
| TEPGE/TÜİK national yields, TMO 2026 prices, 2026 supports | internal decision parameters (never displayed) | see `docs/SOURCES.md` |

Every value, its link and access date are listed in `docs/SOURCES.md`; the YAML files repeat them next to each number.

---

## Validation (consistency checks, not field validation)

| Check | Result |
|---|---|
| Mass balance, all sequences | pass (< 0.01 mm) |
| ET₀ vs FAO-56 Example 18 | pass (±0.1 mm/day) |
| Fallow storage efficiency vs Central Anatolian literature (11–29 %) | info: model 8–23 % |
| Wheat yield after chickpea / lentil relative to after fallow vs the Konya trial (0.80 / 0.87) | info: model 0.89 / 0.90 at Karapınar |
| NASA POWER annual precipitation vs WMO station normal | info: see below |

---

## Assumptions and limitations

- **Results describe a typical field in the district** under 24 past climates, not a measured field.
- **NASA POWER is ~50 km, model/satellite-based.** Its precipitation differs from the nearest station by −14 % to +13 % in 10 districts, but by **+36 % (Karapınar), +39 % (Eskişehir) and +83 % (Karaman)**. Water results in those three districts are likely optimistic. A station correction is planned.
- **One crop calendar** (Konya) is used for all districts so far; colder districts (Sivas, Yozgat, Çankırı, Kayseri) may sow and harvest at other dates.
- No runoff, snow, capillary rise, stubble mulch or irrigation in the water balance.
- The wind-exposure index is a **count of windy, dry, bare days**, not a measured soil loss.
- **Nitrogen fixation** is shown as a trait only; no kg N/da is estimated (needs a soil test).
- Phosphorus, potassium, micronutrients and compaction cannot be estimated from satellites; the site says so.
- ESA WorldCover does not separate irrigated from rainfed cropland.
- **Earnings are an internal estimate** from national reference yields, 2026 prices and supports; production costs are not included. The chickpea price (one exchange, Feb 2026) is the least certain parameter and pushes several districts towards chickpea.
- Supports are national 2026 amounts (basic + planned production); conditional extras are not included.

---

## Team

| Person | Role |
|---|---|
| Ömer | engine and science |
| Gümüş | data, contract, decision module, delivery |
| İsmail | web site |
| Muhammet | research, sources, pitch |

AI tools were used; who used which tool for what is listed in [`docs/AI_USE.md`](docs/AI_USE.md).

---

## Türkçe özet

NöbetSu, İç Anadolu'daki kuru tarım çiftçisi için "nadas mı, nohut mu, mercimek mi?" sorusunun su, toprak ve para tarafını, NASA POWER'ın 24 yıllık iklim verisiyle birlikte gösterir. 13 ilin her birinden bir ilçe, 3 toprak derinliği ve 3 rotasyon için hesaplanır. Bir tarla için verim tahmini değildir, "şunu ek" demez; seçenekleri yan yana koyar, kararı çiftçi ve yerel uzman verir. Kurulum ve komutlar yukarıda; tüm kaynaklar `docs/SOURCES.md`'de.
