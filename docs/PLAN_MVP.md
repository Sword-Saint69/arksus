# NöbetSu — MVP Build Plan (4 people, ~24 hours)

> Read this file first. It is the single source of truth for the MVP.
> Later additions live in `PLAN_EXPANSION.md`. Nothing from that file is built before milestone M3 is green.
> This file supersedes the old `NOBETSU_BUILD_PLAN.md`.

---

## 0. The rule of this plan

**First make it run end to end, then make it good, then make it bigger.**
At every milestone the deployed site must work. A small working product beats a big broken one.
The stack and the architecture are final from minute one (no throwaway prototype, no Streamlit). "Simple" means fewer features, not a different skeleton.

---

## 1. Product in one page

**Name:** NöbetSu
**Challenge:** NASA Space Apps 2026 — *Field Shift: Adapting Farms with NASA Data*
**Tagline:** *Fallow saves water but leaves the soil bare. See the trade-off — water, soil and lira — across 24 years of NASA climate.*

**Problem.** After the 2025 drought and low 2026 grain prices, Central Anatolian farmers are again asking whether to leave land fallow for a year. On a one-season view, fallow always looks like a loss because it earns nothing. Its real value comes later: more stored soil water and a safer wheat crop the next year. But fallow has a soil cost too: the field sits bare and tilled for over a year. In Karapınar, fallow–cereal farming with heavy disc tillage is one of the causes the Ministry's Konya Soil, Water and Desertification Research Institute lists for the 1960s wind-erosion disaster. Nobody shows the water, soil and money sides of this decision together, with real climate data.

**What NöbetSu does.** For two pilot districts (Konya–Karapınar, Kayseri–Develi), three soil depth classes and three two-year rainfed rotations, it runs a daily FAO-56 soil water balance with NASA POWER weather for 24 historical sequences (2001–2024 start years). It then shows, for each rotation compared with the **current practice (fallow → wheat)**:
- **Water:** how much water each rotation leaves in the soil at wheat sowing, and in which months the wheat is usually under water or heat stress;
- **Soil:** how many days the field lies bare, in which months, and how many of those days are windy with a dry surface (wind-exposure index); whether the rotation includes a nitrogen-fixing crop;
- **Soil profile and minerals:** a regional soil card for each district (texture, pH, organic carbon, total nitrogen, CEC, bulk density, available water) from SoilGrids, each with its 90 % range and an "estimate, not your field" badge; a clear note that phosphorus, potassium and micronutrients cannot be estimated from satellites and need a soil test;
- **Soil wetness and saturation:** how full the soil water store is month by month for each rotation (model), and, when NASA SMAP data has arrived, the regional root-zone wetness (degree of saturation) with its typical seasonal range and the latest value;
- **Yield:** the range of wheat and legume yields that water allows (P10–P50–P90);
- **Money:** the two-year gross margin range and the chance of a loss, using the farmer's own price, cost and support values (sourced defaults, editable);
- **Where it flips:** soil depth × dry/normal/wet year;
- **Why and what we don't know:** for each strategy, why it is on the list, what evidence supports it, its benefits, the information gaps and the risks a local expert should review.
The farmer picks what matters most (save water, earn income, protect the soil) and the strategies are ranked by that priority.

**What it is not.** It is not a yield forecast for one field, not a price forecast, not a fertiliser advisor and not a recommendation engine. It supports the farmer's judgment and local expertise; it does not replace them.

**Rotations (MVP).** The challenge asks for at least three strategies including the existing one.

| id | Role | Year 1 (Jul y → Oct y+1) | Year 2 (Oct y+1 → Jul y+2) | Water source |
|---|---|---|---|---|
| `fallow_wheat` | **current practice (baseline)** | bare fallow | winter wheat | rainfed |
| `chickpea_wheat` | alternative | bare → spring chickpea → bare | winter wheat | rainfed |
| `lentil_wheat` | alternative | bare → spring lentil → bare | winter wheat | rainfed |

All three start on the same day after a simulated wheat harvest and end at the next wheat harvest. Only the middle period differs, so the comparison is fair. Alternatives are always shown as differences from the baseline.

**Definition of done (MVP = milestone M3).**
1. Public Vercel URL works on phone and laptop, in a private window.
2. Real (non-mock) results for 2 locations × 3 rotations × 3 depth classes × 24 sequences, including the soil indicators (§5.8), the regional soil card and the soil-fullness curve (§5.10). SMAP wetness is shown if its data arrived by T+12; otherwise it moves to E1 and the card says "coming".
3. Editable price, cost, support and Ym inputs, and a priority selector. Every number carries a source badge.
4. A strategy explanation (why / evidence / benefits / gaps / local review) for each rotation.
5. Evidence panel with the five MVP checks (§5.7) and a short "satellite and model data vs ground stations" note.
6. Public GitHub repo with README, AI-use disclosure and a one-command rebuild (`make data`).

---

## 2. Hard rules (for humans and agents)

1. **No invented numbers.** Every parameter lives in a YAML file with `value`, `unit`, `source`, `type` and `verified`. If a value is not verified it is shown as "assumption" in the UI. Seed values in this plan are marked VERIFY.
2. **Contract first.** The JSON contract in §4 is frozen at M0. A change needs agreement from the contract owner (Dev B) and a same-hour update to `web/src/lib/types.ts` and the mock files.
3. **Mock flag.** Every JSON file has `"mock": true|false`. The site shows a visible banner while any loaded file is mock.
4. **Honest wording.** Results are "for a typical field in the district, under 24 years of past climate, not your field's measured yield". Support totals are "gross, indicative, not an official eligibility decision". Never write "recommended", "best choice", "banned" or "profit guaranteed".
5. **Badges.** Every displayed number has one of five types: `measured`, `model`, `official`, `literature`, `assumption`, plus `user` once edited.
6. **Small PRs, green main.** `main` always builds and deploys. Each person works on their own branch and merges at least every 2 hours. Tests must pass before merge.
7. **File ownership** (§3.3) prevents merge conflicts. Edit another person's files only after asking.
8. **AI use is declared.** Keep a running list of which AI tools wrote what in `docs/AI_USE.md`.

---

## 3. Architecture

### 3.1 Shape

```
NASA POWER API ──► engine/ (Python, offline batch) ──► web/public/data/*.json ──► web/ (static React site on Vercel)
                     ▲                                                               ▲
     config/*.yaml (crops, locations, soil, defaults) ── Person D's verified values ──┘ economics computed in the browser (TS)
```

- The Python engine computes **physical results only**: water, ETa/ETc and yield **ratios** (Ya/Ym, 0–1).
- The browser turns ratios into kg/da and TL/da with the editable Ym, price, cost and support values. This keeps the economics interactive with no backend.
- No database, no server, no live API calls from the site in the MVP.

### 3.2 Stack (final)

- **Engine:** Python 3.11+, `requests`, `numpy`, `pandas`, `pyyaml`, `pytest`. No pyfao56 in the MVP (see §5.3 for the reason; a cross-check is in the expansion plan).
- **Web:** Vite + React + TypeScript + Tailwind + shadcn/ui + Recharts. `vitest` for the economics module.
- **Hosting:** GitHub (public) + Vercel (auto-deploy from `main`, preview per branch).

### 3.3 Repo layout and owners

```
nobetsu/
├── AGENTS.md                 # agent rules (short; points to docs/PLAN_MVP.md)   — B
├── CLAUDE.md                 # one line: @AGENTS.md (+ Claude-only notes)         — B
├── README.md                                                                     — B (+ D text)
├── Makefile                  # make data | make test | make web                  — B
├── docs/
│   ├── PLAN_MVP.md  PLAN_EXPANSION.md                                            — all (read)
│   ├── STATUS.md             # one line per person per milestone                  — all
│   ├── SOURCES.md            # every value Person D verified: value, unit, URL, date — D
│   └── AI_USE.md                                                                 — all
├── engine/
│   ├── config/
│   │   ├── locations.yaml    # id, name, lat, lon, district, province            — B
│   │   ├── crops.yaml        # calendars, Kcb, p, Zr, Ky                          — A (values from D)
│   │   ├── soil.yaml         # AWC per location, depth classes, TEW/REW            — A
│   │   ├── rotations.yaml    # baseline flag, soil traits, strategy explanations  — B (text from D)
│   │   └── defaults.yaml     # Ym, price, cost, support per location × crop       — B (values from D)
│   ├── nobetsu/
│   │   ├── power.py          # fetch + cache NASA POWER                           — B
│   │   ├── et0.py            # FAO-56 Penman–Monteith                             — A
│   │   ├── waterbalance.py   # daily two-layer dual-Kc bucket                     — A
│   │   ├── rotations.py      # builds daily crop calendars per sequence           — A
│   │   ├── yieldmodel.py     # Ky → Ya/Ym                                         — A
│   │   ├── validate.py       # MVP checks → validation.json                       — A
│   │   └── export.py         # writes the contract JSON                           — B
│   └── tests/                                                                    — A, B
├── data/raw/                 # cached POWER JSON (committed, small)               — B
└── web/
    ├── public/data/          # generated JSON (mock first, then real)            — B
    └── src/
        ├── lib/types.ts      # contract types                                     — B
        ├── lib/economics.ts  # + economics.test.ts                                — B
        └── (everything else) # pages, components, charts, styles                 — C
```

---

## 4. Data contract (frozen at M0)

All files in `web/public/data/`. Every file has `schema_version: "1.0"`, `mock: boolean` and `generated_at` (ISO).

### 4.1 `site_index.json`

```jsonc
{
  "schema_version": "1.0", "mock": true, "generated_at": "...",
  "power_range": { "start": "2000-01-01", "end": "2026-11-10" },
  "locations": [
    { "id": "karapinar", "name": "Karapınar", "district": "Karapınar", "province": "Konya",
      "lat": 0, "lon": 0, "elevation_m": 0, "note": { "en": "...", "tr": "..." } }
  ],
  "rotations": [
    { "id": "fallow_wheat", "is_baseline": true, "crops": ["fallow", "wheat"],
      "label": { "en": "Fallow → Wheat", "tr": "Nadas → Buğday" },
      "soil_traits": { "n_fixing": false, "tillage_passes": V, "note": { "en": "...", "tr": "..." } },
      "strategy": {
        "why":          { "en": "...", "tr": "..." },
        "evidence":     [ { "text": { "en": "...", "tr": "..." }, "source": "...", "source_url": "..." } ],
        "benefits":     [ { "en": "...", "tr": "..." } ],
        "gaps":         [ { "en": "...", "tr": "..." } ],
        "local_review": [ { "en": "...", "tr": "..." } ]
      } },
    { "id": "chickpea_wheat", "is_baseline": false, "crops": ["chickpea", "wheat"], "label": { "en": "Chickpea → Wheat", "tr": "Nohut → Buğday" }, "soil_traits": {...}, "strategy": {...} },
    { "id": "lentil_wheat",   "is_baseline": false, "crops": ["lentil", "wheat"],   "label": { "en": "Lentil → Wheat",   "tr": "Mercimek → Buğday" }, "soil_traits": {...}, "strategy": {...} }
  ],
  // V = value object as in §4.4. Strategy text and soil traits come from engine/config/rotations.yaml (Person D writes, Dev B owns the file).
  "depth_classes": [
    { "id": "shallow", "depth_m": 0.6, "label": { "en": "Shallow (<60 cm)", "tr": "Sığ (<60 cm)" } },
    { "id": "medium",  "depth_m": 0.9, "label": { "en": "Medium (60–90 cm)", "tr": "Orta (60–90 cm)" } },
    { "id": "deep",    "depth_m": 1.2, "label": { "en": "Deep (>90 cm)", "tr": "Derin (>90 cm)" } }
  ],
  "start_years": [2001, 2024]
}
```

Lat/lon are filled by Dev B from `locations.yaml`; zeros above are placeholders.

### 4.2 `results/{location_id}.json`

```jsonc
{
  "schema_version": "1.0", "mock": true, "location_id": "karapinar",
  "soil": {
    "awc_mm_per_m": { "value": 0, "source": "...", "type": "model|assumption", "verified": false },
    "properties": [
      { "id": "clay|sand|silt|phh2o|soc|nitrogen|cec|bdod|cfvo", "label": { "en": "...", "tr": "..." },
        "depth": "0-30 cm", "q05": 0, "q50": 0, "q95": 0, "unit": "...",
        "source": "SoilGrids 2.0 (ISRIC)", "type": "model", "how_obtained": "wcs|gee|manual_viewer",
        "meaning": { "en": "...", "tr": "..." } }
    ],
    "not_available_remotely": ["phosphorus", "potassium", "micronutrients", "compaction"]
  },
  "sequences": [
    {
      "start_year": 2001, "rotation_id": "fallow_wheat", "depth_id": "medium",
      "pre_sowing_precip_mm": 0,          // precipitation 1 Jul y → wheat sowing (Oct y+1)
      "water_at_wheat_sowing_mm": 0,      // plant-available water in the whole profile at wheat sowing
      "fallow_storage_efficiency": 0.0,   // fallow only: ΔS / P over the fallow period; null otherwise
      "bare_days": 0,                     // days with no crop over the 24 months
      "wind_exposed_bare_days": 0,        // bare AND dry surface AND windy day (§5.8)
      "bare_by_month": [0, ...],          // 24 integers: bare days in each month of the sequence (month 0 = July y)
      "stress_by_month": [0, ...],        // 24 integers: crop days with Ks < 1 in each month
      "fullness_by_month": [0, ...],      // 24 numbers 0–100: % of the profile's available-water capacity filled at month end
      "first_crop": { "crop_id": "chickpea", "eta_mm": 0, "etc_mm": 0, "stress_days": 0, "yield_ratio": 0.0 } | null,
      "wheat":      { "eta_mm": 0, "etc_mm": 0, "stress_days": 0, "heat_days_flowering": 0, "yield_ratio": 0.0 }
    }
  ]
}
```

Size: 3 rotations × 3 depths × 24 years = 216 rows per location.

### 4.3 `ledger/{location_id}.json` (lazy-loaded, for the water ledger chart)

```jsonc
{
  "schema_version": "1.0", "mock": true, "location_id": "karapinar",
  "series": [
    { "start_year": 2001, "rotation_id": "fallow_wheat", "depth_id": "medium",
      "weeks": [ { "week_start": "2001-07-01", "p_mm": 0, "eta_mm": 0, "dp_mm": 0, "aw_mm": 0, "crop": "fallow" } ] }
  ]
}
```

`aw_mm` = plant-available water stored in the profile at week end; `dp_mm` = deep percolation. Weekly sums, not daily, to keep the file small.

### 4.3b `smap/{location_id}.json` (optional in the MVP; shown only when `available: true`)

```jsonc
{
  "schema_version": "1.0", "mock": true, "location_id": "karapinar", "available": false,
  "product": "SMAP L4 SPL4SMGP v8", "cell_km": 9,
  "latest": { "date": "YYYY-MM-DD", "rootzone_wetness": 0.0, "rootzone_m3m3": 0.0, "percentile_for_month": 0 },
  "monthly_climatology": [ { "month": 1, "p10": 0.0, "p50": 0.0, "p90": 0.0 } ],   // rootzone wetness, 2015-04 → latest
  "monthly_series": [ { "month_start": "2015-04-01", "rootzone_wetness": 0.0, "surface_wetness": 0.0 } ]
}
```

### 4.4 `defaults.json`

```jsonc
{
  "schema_version": "1.0", "mock": true,
  "values": {
    "karapinar": {
      "wheat":    { "ym_kg_per_da": V, "price_tl_per_kg": V, "cost_tl_per_da": V, "support_tl_per_da": V },
      "chickpea": { ... }, "lentil": { ... },
      "fallow":   { "cost_tl_per_da": V, "support_tl_per_da": V }
    },
    "develi": { ... }
  }
}
// V = { "value": number, "unit": "...", "source": "...", "source_url": "...",
//       "type": "official|statistic|literature|assumption", "verified": boolean, "as_of": "YYYY-MM-DD" }
```

### 4.5 `validation.json`

```jsonc
{
  "schema_version": "1.0", "mock": true,
  "checks": [
    { "id": "mass_balance" | "et0_fao56_ex18" | "pse_literature" | "trial_ratio" | "precip_vs_mgm",
      "status": "pass" | "fail" | "info" | "pending",
      "value": "...", "reference": "...", "note": { "en": "...", "tr": "..." } }
  ]
}
```

---

## 5. Science spec (MVP)

### 5.1 Weather: NASA POWER

- Endpoint: `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`, `time-standard=LST`, `format=JSON`, 2000-01-01 → latest available date.
- Parameters: `PRECTOTCORR, T2M_MAX, T2M_MIN, T2MDEW, RH2M, WS2M, WS2M_MAX, ALLSKY_SFC_SW_DWN` (`WS2M_MAX` is for the wind-exposure index in §5.8).
- Read units from the response header; do not assume. Replace `-999` with NaN; fill gaps of ≤ 3 days by linear interpolation and report the count.
- Cache raw JSON in `data/raw/power_{location_id}.json`. The engine never calls the API if the cache exists.
- Note in the UI: POWER is reanalysis/satellite-derived, ~50 km, not station measurement. Its precipitation is the weakest input (checked by `precip_vs_mgm`).

### 5.2 ET₀

- FAO-56 Penman–Monteith, daily (FAO-56 Eq. 6 and Chapter 3). Use elevation from the POWER header for pressure.
- `EVPTRNS` from POWER is **not** ET₀. Do not use it.
- Unit test: FAO-56 Example 18 must reproduce within ±0.1 mm/day.

### 5.3 Water balance engine (own code, ~200 lines)

**Why own code and not pyfao56 in the MVP:** each sequence runs continuously for ~2 years with three different land uses. A continuous daily loop with a changing crop calendar is simpler and easier to test than chaining separate pyfao56 seasons. A pyfao56 cross-check is expansion item E8.

**Structure.**
- FAO-56 dual crop coefficient: `ETc = (Kcb·Ks + Ke)·ET₀`.
- **Two-layer profile** over the full depth class `D` (0.6 / 0.9 / 1.2 m): layer 1 = current root zone `Zr` (never thinner than the evaporation layer `Ze`, ~0.10 m); layer 2 = `D − Zr`.
- Rain infiltrates layer 1 up to field capacity; the excess fills layer 2 up to field capacity; any further excess is deep percolation.
- When `Zr` grows, the water held in the newly reached part of layer 2 moves into layer 1. This is what makes stored fallow water available to the next wheat crop.
- Evaporation `Ke` follows FAO-56 Chapter 7 (TEW, REW, `few`, stage 1 / stage 2 drying). Bare soil and fallow: `Kcb = 0`, `fc = 0`.
- Transpiration stress: `Ks = (TAW_r − Dr) / ((1 − p)·TAW_r)` when `Dr > RAW`, else 1.
- Root growth: linear from `Zr_min` at sowing to `min(Zr_max(crop), D)` at the start of mid-season.
- **Stated assumptions (shown in the UI):** no runoff, no snow, no capillary rise, no stubble mulch effect, no irrigation.

**Sequence design.** For start year `y`:
1. Spin-up: simulate winter wheat from 1 Oct `y−1` to its harvest in July `y`, starting at 50 % of available water. This gives every rotation a realistic dry post-harvest profile.
2. From the day after harvest, run the rotation's year 1 (fallow, or bare → legume → bare) until wheat sowing in October `y+1`.
3. Run winter wheat until its harvest in July `y+2`.
Start years 2001–2024 (24 sequences; the 2024 sequence ends with the July 2026 harvest).

**Crop parameters** (`crops.yaml`, all VERIFY): sowing date, stage lengths (initial, development, mid, late), `Kcb_ini/mid/end` (FAO-56 Table 17), `p` (Table 22), `Zr_max` (Table 22), `h_max`, `Ky` (FAO-33). Seed calendars to replace with TAGEM values from Person D:
- winter wheat: sown ~15 Oct, harvested ~early–mid July; FAO-56 winter wheat with frozen-soil initial stage;
- chickpea (spring): sown ~1 Apr, harvested ~mid July;
- lentil (spring): sown ~mid March, harvested ~early July.
Every field has `source`; unverified fields set `verified: false`. No crop-specific `if` branches in code.

**Soil** (`soil.yaml`): one AWC (mm/m) per location, taken from the SoilGrids pull in §5.10 (`wv0033 − wv1500`, reduced by `cfvo`, depth-weighted to 100 cm). If that pull fails, use the FAO-56 Table 19 value for the dominant texture and mark `type: assumption`.

**Engine tests (pytest, must pass before M2):**
- mass balance per sequence: `P − ETa − DP − ΔS` closes within 0.01 mm;
- no negative storage, no storage above field capacity;
- `Ks = 1` whenever `Dr ≤ RAW`;
- root depth never decreases within a season and never exceeds `D`;
- synthetic wet winter on bare soil: `ΔS ≥ 0`;
- `yield_ratio` stays in [0, 1];
- `bare_by_month` sums to `bare_days`; `wind_exposed_bare_days ≤ bare_days`; fallow has more bare days than the legume rotations;
- every catalogue field has a `source`.

### 5.4 Yield (ratio only)

- `Ya/Ym = max(0, 1 − Ky·(1 − ΣETa/ΣETc))` over the crop season (FAO-33). The engine outputs this ratio.
- The browser multiplies by `Ym` (kg/da) from `defaults.json`. Default `Ym` = the district's high-percentile rainfed yield from TÜİK statistics (Person D), labelled `statistic`. Until delivered: `assumption`.
- **Do not multiply by a "previous crop" factor.** The fallow advantage in field trials is mostly water, which the model already computes. Applying a trial multiplier on top would count the same water twice. The trial numbers are used for validation instead (§5.7).
- Label on every yield: "Expected range for a typical field in this district under 24 past climates. Not your field's measured yield."

### 5.5 Economics (browser, `economics.ts`, pure functions + vitest)

For each sequence:
- `yield_kg_per_da = yield_ratio × Ym` for each crop;
- `income = Σ yield × price + Σ support` (fallow: support only);
- `net_2yr = income − Σ cost`.

Across the 24 sequences per rotation × depth:
- P10 / P50 / P90 of `net_2yr` (empirical percentiles; no Monte Carlo in the MVP);
- loss probability = share of sequences with `net_2yr < 0`;
- wheat break-even yield = `(cost − support) / price`.

**Where it flips:** for each depth class × tercile of `pre_sowing_precip_mm` (dry / normal / wet, terciles over the 24 years per location), the rotation with the highest median `net_2yr` under the current inputs. Recompute live when inputs change.

Unit tests: hand-computed example for one sequence; percentiles on a known array; break-even formula; flip table on a toy dataset.

### 5.6 Defaults (Person D → `docs/SOURCES.md` → Dev B → `defaults.yaml`)

| Value | Default source to find | Type |
|---|---|---|
| Wheat price | TMO 2026 purchase price, 2nd group durum/bread as applicable (reported 16,500 TL/ton; VERIFY on TMO site) | official |
| Chickpea, lentil price | TMO daily market bulletin or Konya Commodity Exchange daily bulletin | official / measured |
| Cost per crop (TL/da, rent excluded) | Konya or Kayseri chamber of agriculture 2026 cost tables | literature |
| Fallow cost (tillage passes) | same source | literature |
| Support per crop and for fallow | Ministry support calculator `destekhesaplama.tarimorman.gov.tr` for both districts, rainfed | official |
| Ym per crop | TÜİK district rainfed yields, 2004–2025, high percentile | statistic |

Anything not found by M3 stays `assumption` with an honest note. The user can edit every value in the UI.

### 5.7 Evidence panel (MVP checks)

| id | What | Pass rule |
|---|---|---|
| `mass_balance` | engine water balance closure, all sequences | < 0.01 mm |
| `et0_fao56_ex18` | ET₀ against FAO-56 Example 18 | ±0.1 mm/day |
| `pse_literature` | modelled fallow storage efficiency vs Central Anatolian literature range (report cites ~8–30 %; Person D verifies the papers) | `info`: show value and range, no pass/fail |
| `trial_ratio` | modelled median wheat yield ratio after chickpea and after lentil, relative to after fallow, vs the Konya dryland trial (report: 228 / 249 / 286 kg/da after chickpea / lentil / fallow, 2011–2014; Person D verifies the paper) | `info`: show both side by side |
| `precip_vs_mgm` | POWER mean annual precipitation vs MGM 1991–2020 normals at the nearest station | `info`: show the difference in % |

Honest framing: these are consistency checks, not field validation.

Add a short plain-language note under the panel: NASA POWER is satellite- and model-derived (~50 km), MGM stations are ground measurements at one point; the `precip_vs_mgm` check shows how far apart they are, and combining both (station correction) is on the post-event list.

### 5.8 Soil-health and vulnerability indicators (engine, cheap)

The challenge is about soil health as much as water. These indicators come from data the engine already has.

- **Bare days:** days with no crop (Kcb = 0) over the 24-month sequence, total and per month (`bare_by_month`). This answers "when are fields typically bare?".
- **Wind-exposure index:** bare days on which the surface layer is in stage-2 drying (De > REW) **and** `WS2M_MAX` is above the location's own 75th percentile of daily maximum wind. It is an exposure count, **not** an erosion measurement; the label says so. Threshold choice is a stated assumption.
- **Vulnerable months for wheat:** `stress_by_month` (Ks < 1 days per month) and `heat_days_flowering` (days with `T2M_MAX` > 30 °C in the flowering window from the crop calendar; the 30 °C threshold is a literature value, VERIFY).
- **Nitrogen-fixing:** a qualitative trait in `rotations.yaml` (chickpea and lentil fix nitrogen). **No kg N/da number** is shown; the note says the amount depends on the season and should be checked with a soil test.
- **Tillage passes:** typical number of tillage passes in the fallow year vs the legume year (Person D, with source), shown as a trait. More passes mean more cost and more exposure.

### 5.10 Soil profile, minerals and saturation (MVP)

**What can and cannot be known without a lab** — say this plainly in the UI:

| Soil property | Can we show it? | From where | Label |
|---|---|---|---|
| Texture (clay / sand / silt), bulk density, coarse fragments | Yes, regional estimate | SoilGrids 2.0, 250 m | "estimate, not your field" + 90 % range |
| pH, organic carbon (SOC), total nitrogen, CEC | Yes, regional estimate | SoilGrids 2.0, 250 m | same |
| Field capacity / wilting point → available water | Yes, regional estimate | SoilGrids `wv0033`, `wv1500` | same; feeds the engine |
| Soil water fullness (how full the store is) | Yes, model | NöbetSu engine (FAO-56) with NASA POWER | "model" |
| Root-zone wetness / degree of saturation | Yes, regional (9 km) | NASA SMAP L4 `sm_rootzone_wetness` | "satellite + model, 9 km cell" |
| Plant-available phosphorus, potassium, micronutrients (Zn, Fe…) | **No** | — | "needs a soil test" |
| Compaction / hardpan, real rooting depth on your field | **No** | — | "needs a field check"; the depth selector covers it |

**SoilGrids pull (Dev B, 45-minute timebox, T+2):** for each location, properties `clay, sand, silt, bdod, cfvo, phh2o, soc, nitrogen, cec, wv0033, wv1500` at 0–5, 5–15, 15–30 cm (and the deeper layers to 100 cm for the water properties), quantiles Q05 / Q50 / Q95. Report 0–30 cm depth-weighted values for the card. Access via WCS or Earth Engine; **not** the REST API. Apply the SoilGrids unit conversion factors from the official documentation (raw values are scaled integers, e.g. pH × 10). **Fallback:** Person D clicks the two coordinates on the SoilGrids web viewer and copies the values into `docs/SOURCES.md` with `how_obtained: manual_viewer`.

**Soil fullness (Dev A, engine):** `fullness = available water in profile / available-water capacity of profile × 100`, recorded at each month end (`fullness_by_month`). This is not saturation: 100 % means field capacity. The glossary explains the difference: saturation = all pores full of water (it drains within days); field capacity = what the soil holds after draining; plants use water between field capacity and wilting point.

**SMAP wetness (Dev B data, Dev C UI):** at T+1 Dev B submits a NASA AppEEARS point request for `SPL4SMGP` v8 layers `sm_rootzone`, `sm_rootzone_wetness`, `sm_surface_wetness` at both points, 2015-04-01 → latest (needs an Earthdata login; takes minutes to submit, results usually arrive within hours). Earth Engine `NASA/SMAP/SPL4SMGP/008` is the backup. When the data arrives, build `smap/{location_id}.json`: monthly climatology (P10 / P50 / P90 of root-zone wetness), monthly series and the latest value with its percentile for that calendar month. If the data has not arrived by T+12, set `available: false` and continue; it becomes part of E1.

**Soil-health effects of each rotation** (qualitative, with sources from Person D, in `rotations.yaml`): nitrogen fixation (legumes yes, no kg N number), ground cover and bare days (from the engine), tillage passes in the fallow year (more passes → more exposure and faster organic-matter loss), and the wind-exposure count. No composite "soil health score": every indicator is shown separately so nothing is hidden inside a made-up number.

**Tests:** soil property values within physical bounds after unit conversion (pH 3–10, fractions sum to ~100 %); `fullness_by_month` within 0–100; SMAP wetness within 0–1; when `available: false`, the UI renders the "coming" state.

### 5.9 Farmer priorities (browser, `economics.ts`)

- Three priorities: **Save water** (median water at wheat sowing, higher is better; tie-break by wheat stress days), **Earn income** (median two-year net, tie-break by loss probability), **Protect soil** (median wind-exposed bare days, lower is better).
- The farmer sets three weights (sliders summing to 100 %, default 34 / 33 / 33). Each metric is min–max scaled across the three rotations; the score is the weighted sum. Cards are sorted by score.
- Wording: "Ranking under your priorities", never "recommended". Show which metric drove the ranking.
- Unit tests: equal weights on a toy dataset; 100 % on each priority reproduces the single-metric order.

---

## 6. Frontend brief (MVP, Dev C)

**Feel:** a clean "agronomy field report", calm and readable, not a flashy dashboard. Light theme first, works on a phone. One page with anchored sections.

**Sections, top to bottom:**
1. **Header:** the question ("Fallow, chickpea or lentil before wheat?"), location toggle (Karapınar / Develi), depth class selector, the mock banner when needed.
2. **Your priorities:** three sliders (save water / earn income / protect soil). Cards below re-sort live.
3. **Three rotation cards**, the baseline marked "current practice", alternatives showing differences from it. Each card has four rows: **Water** (water at wheat sowing, median and P10–P90, mm and m³/da; 1 mm = 1 m³/da), **Soil** (bare days, wind-exposed bare days, N-fixing badge), **Yield** (wheat range, kg/da), **Money** (2-year net range TL/da, loss probability). A "Why this strategy?" button opens the strategy explanation: why / evidence (with links) / benefits / information gaps / ask a local expert about. Badges on every number.
3b. **Soil health section:**
   - *Your district's soil (regional estimate):* a compact card per property (texture triangle or bar, pH, organic carbon, total nitrogen, CEC, available water) with Q50 and the 90 % range, and one plain sentence on what each means for the rotations (e.g. low organic carbon → bare fallow and tillage matter more).
   - *What satellites can't tell you:* a fixed box: phosphorus, potassium, micronutrients and compaction need a soil test or a field check; link to how to get a soil test.
   - *How full is the soil?* `fullness_by_month` for the three rotations (median across years, P10–P90 band), 100 % line = field capacity.
   - *Regional wetness from NASA SMAP:* when `smap.available`, the typical seasonal wetness band and the latest value with its percentile ("wetter / drier than usual for November"); otherwise a "coming" placeholder.
4. **Chart A — "24 climates, one decision":** per rotation, the 24 two-year nets as a strip plot with P10–P50–P90 marked, plus a zero line.
5. **Chart B — water ledger:** weekly available water over the 24 months for a selected start year (default: median year), the three rotations overlaid, crop periods shaded. Year selector.
6. **Chart C — field calendar:** for each rotation, 24 month cells. Cell shade = share of years the field is bare that month; a marker shows months where wheat is under water stress in most years. Answers "when is the field bare, when is the crop vulnerable".
7. **Where it flips:** a 3 × 3 grid (depth × dry/normal/wet) showing the rotation with the highest median two-year net in each cell under the current inputs.
8. **Your numbers:** editable price, cost, support and Ym per crop, with source badge, `as_of` date and a "reset to defaults" button.
9. **Evidence:** the five checks with status chips and short notes, plus the satellite vs ground note.
10. **Footer:** data sources (NASA POWER first), assumptions list (§5.3, §5.8), "this tool supports, it does not replace, farmer judgment and local expertise", AI-use link, GitHub link.

**Glossary tooltips** (text from Person D, short and plain): evapotranspiration (ET, ET₀), water balance, available water, field capacity vs saturation, soil moisture anomaly, pH, organic carbon, CEC, P10/P50/P90, fallow storage efficiency, nitrogen fixation, wind exposure.

**Rules:** all strings in `src/strings.ts` with `en` and `tr` keys (EN filled in the MVP; TR is expansion E4). Never render "recommended", "best" or "banned". Keep it accessible: colour is never the only signal.

**Build order for Dev C:** layout + header + cards on mock → Chart A → Chart B → inputs wired to `economics.ts` → priority sliders → strategy explanation drawer → Chart C → flip grid → evidence → glossary tooltips → footer → mobile pass. The soil health section goes in right after the priority sliders. If time is short at M3, drop in this order: flip grid → Chart C → SMAP panel (stays as placeholder). The strategy explanation, priority sliders, soil card and soil-fullness curve are not dropped.

---

## 7. Team, workstreams and milestones

T0 = the moment everyone opens the repo. Example clock assumes T0 = Sat 15:00 and submission at T+23. Shift the clock once the official deadline is confirmed.

| Milestone | Time | Must be true |
|---|---|---|
| **M0 — Skeleton** | T+1 (16:00) | Repo, AGENTS.md, contract types, mock JSON for all contract files, Vercel shows the empty layout |
| **M1 — Each part runs alone** | T+4 (19:00) | A: ET₀ test green, engine runs one sequence. B: POWER cached for both locations, `economics.ts` tests green. C: all sections render from mock on Vercel. D: first verified defaults in SOURCES.md |
| **M2 — End to end, real data** | T+9 (00:00) | `make data` produces real JSON for everything; site shows it; `mock: false`. **Tag `v0.1`. This is the safety net.** |
| **M3 — MVP complete** | T+14 (05:00) | Evidence panel real, Person D's defaults in, flip grid, mobile pass, README. **Tag `v0.2` = demo version** |
| Expansion window | T+14 → T+19 | Items from PLAN_EXPANSION.md in priority order, each on its own branch, merged only if green |
| **Feature freeze** | T+19 (10:00) | Only bug fixes after this |
| Pitch production | T+19 → T+22 | Video, slides, project page, final README |
| **Submit** | T+22.5 (13:30) | Submitted, links tested in a private window |
| Buffer | T+22.5 → T+23 | — |

**Dev A — Engine & science (critical path).** et0.py, waterbalance.py, rotations.py, yieldmodel.py, validate.py, the soil and vulnerability indicators (§5.8), crops.yaml, soil.yaml, engine tests. Best fit: the strongest Python person. Use the most capable model with high effort for waterbalance.py only; normal effort for the rest.

**Dev B — Data, contract, economics, delivery.** power.py, export.py, locations.yaml, rotations.yaml, defaults.yaml, mock JSON, types.ts, economics.ts (+ priority score, §5.9) with tests, Makefile, Vercel, README, merging. Owner of the contract. Transcribes Person D's values and texts.

**Dev C — Frontend.** Everything in `web/src/` except `lib/types.ts` and `lib/economics.ts`. Works only from the contract and mock files until M2.

**Person D — Research, verification and pitch (non-software).** Finds and verifies every default value (§5.6) and every literature claim used in the evidence panel; writes them into `docs/SOURCES.md` with URL and date. Writes the strategy explanations (why / evidence / benefits / gaps / local review) for the three rotations, the soil traits and the glossary texts, all with sources. Owns the story, slides, 30-second video, project page text, AI-use statement and the submission checklist. Gets one 5-minute reaction from a farmer or the MUSTECH contact if possible.

**Night shift note:** the hours around T+12 → T+15 (03:00–06:00) are when mistakes happen. Put low-risk work there (tests, polish, README, checking numbers) and keep risky refactors out.

---

## 8. Pitch kit (Person D owns, everyone feeds)

- **Story spine:** Karapınar is where Turkey learned the soil cost of fallow (1960s dust storms; fallow–cereal farming with disc tillage is one of the official causes). Today drought and prices push farmers back to fallow for its water. NöbetSu shows both sides with NASA data.
- **Hero sentence (fill from real results at M3):** "In Karapınar, on medium-depth soil, fallow left a median X mm more water at wheat sowing than chickpea — but kept the field bare for Y more days, Z of them windy and dry." Use only real numbers. If the result is not striking, open with the question instead of a number.
- **30-second video:** 0–5 s the question and a Central Anatolian field; 5–12 s pick location, depth and priorities, the three cards; 12–22 s field calendar, Chart A and the flip grid; 22–26 s "Why this strategy?" drawer; 26–30 s "NASA POWER + FAO-56, 24 climates, open source" + URL. English subtitles.
- **Slides (≤ 7):** problem (water vs soil vs income) → why one season lies → how (NASA POWER → FAO-56 → yield ratio → your prices and priorities) → the result → where it flips → evidence, gaps and limits → what's next (MUSTECH, more districts, SMAP, GRACE).
- **Challenge checklist (say it out loud in the pitch):** NASA Earth observations ✔ · local soil information (depth classes, regional soil card, soil fullness, SMAP wetness) ✔ · honest about what needs a lab (P, K) ✔ · crop characteristics ✔ · farmer priorities ✔ · ≥ 3 strategies including the existing one ✔ · why / evidence / benefits / gaps / risks per strategy ✔ · when fields are bare and when crops are vulnerable ✔ · uncertainty shown ✔ · supports, does not replace, local expertise ✔.
- **Q&A prep:** "Why not a yield forecast?" "Why POWER and not stations?" "How do you know the water balance is right?" "Is the wind index an erosion measurement?" (no — exposure count) "Why no AI model?" (24 years × 2 districts is too little data for a learned model; a transparent physical model plus statistics is easier to check, and the uncertainty is visible) "What about snow and stubble?" "Why only two districts?" Answers come from §5 and the evidence panel.
- **Submission checklist:** project page in English, demo link, GitHub link, video ≤ 30 s with subtitles or ≤ 7 slides, AI-use disclosure, NASA data named, all links tested in a private window.

---

## 9. Token and session discipline (all devs using AI agents)

- One agent session per task; `/clear` (or a new chat) between tasks. Start each session by pointing the agent at `AGENTS.md` and the relevant section of this file, not the whole repo.
- Keep `data/raw/` out of the agent's reads (Claude Code: `Read(./data/raw/**)` deny rule in `.claude/settings.json`).
- Use plan mode before multi-file changes. Ask for tests first, code second.
- Do not let two agents edit the same file. File ownership in §3.3 is the rule.

---

## Appendix A — Agent kickoff prompts

**Dev B (run first, M0):**
```
Read docs/PLAN_MVP.md sections 2, 3 and 4. Bootstrap the repo exactly as in §3.3:
AGENTS.md (≤60 lines: hard rules from §2, file ownership, how to run tests), CLAUDE.md containing "@AGENTS.md",
Makefile (data/test/web), engine package skeleton with empty modules, Vite+React+TS+Tailwind+shadcn app in web/,
web/src/lib/types.ts matching §4 exactly, and mock JSON for every contract file in §4 with mock:true and plausible
but obviously fake numbers. Add vitest and pytest. Do not implement science. Stop when `make test` and `make web` pass.
```

**Dev A (after M0):**
```
Read docs/PLAN_MVP.md §5.2–5.4 and §5.7. Write tests first: FAO-56 Example 18 for ET0, then the engine tests in §5.3.
Implement et0.py, then waterbalance.py (two-layer, dual-Kc, as specified), then rotations.py and yieldmodel.py,
then the soil and vulnerability indicators in §5.8 and fullness_by_month (§5.10).
Parameters come only from engine/config/*.yaml; every field has source and verified. No crop-specific branches.
Run one sequence (karapinar, fallow_wheat, medium, 2010) and print a mass-balance summary before scaling up.
```

**Dev C (after M0):**
```
Read docs/PLAN_MVP.md §4 and §6. Build the single-page site from the mock JSON only, in the build order in §6.
Use shadcn/ui and Recharts. All strings in src/strings.ts (en filled, tr keys present). Show the mock banner.
The baseline rotation is labelled "current practice"; alternatives show differences from it.
Import economics from src/lib/economics.ts; do not reimplement it. Check the layout at 375 px width.
```

**Dev B (after M0, second task):**
```
Read docs/PLAN_MVP.md §5.1, §5.5, §5.6 and §5.9. Implement power.py with caching, then economics.ts with the unit tests
listed in §5.5 and §5.9, then export.py that writes all five contract files from engine outputs. Validate every written file
against web/src/lib/types.ts (a small zod or JSON-schema check in tests).
Also: submit the AppEEARS SMAP request (§5.10) at T+1, and do the SoilGrids pull (§5.10) with a 45-minute timebox.
```
