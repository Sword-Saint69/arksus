# NöbetSu — Expansion Plan (after M3 only)

> Nothing here is started before `v0.2` (M3) is tagged and deployed.
> Work top to bottom. Each item lives on its own branch (`exp/E1-smap`, …) and is merged only if tests pass and the deployed site still works.
> If an item is not green by its timebox, drop it and move on. A half-finished feature is never merged.
> Expansion window: T+14 → T+19. Feature freeze at T+19.

## Priority order

Ranked by (match to the challenge text × jury value × NASA relevance) ÷ (time × risk).

| # | Item | Owner | Timebox | Why it is worth it |
|---|---|---|---|---|
| E1 | SMAP L4 anomaly check against the engine (+ SMAP panel if it missed the MVP) | A (+B data) | 2–3 h | The challenge names SMAP first; turns the SMAP data into a check of the water balance |
| E2 | Drier / warmer climate scenarios | A + C | 2 h | The challenge suggests rainfall/temperature sliders; this is the "changing conditions" part of Field Shift |
| E3 | GRACE / GRACE-FO basin water trend | B + C | 2 h | Third NASA dataset; shows the long-term water decline that makes the decision matter |
| E4 | Turkish language toggle | C (+D review) | 1 h | Local jury and real users read Turkish; strings already exist |
| E5 | "This season, now" panel | A + C | 3 h | Makes the tool about the 2026–27 decision, not just the past |
| E6 | Farmer constraints (market, equipment) | B + C | 1 h | The challenge asks for farmer constraints, not only priorities |
| E7 | Map of the pilot points (+ GRACE layer if E3 is done) | C | 1.5 h | Strong visual at low risk |
| E8 | Irrigated wheat → grain maize in Karapınar + policy receipt | A + B + C | 4 h | Brings back the groundwater-restricted basin story |
| E9 | Price uncertainty (min/expected/max) + tornado chart | B + C | 2 h | Shows which input moves the result most |
| E10 | Snow and stubble correction for fallow | A | 2 h | Fixes the weakest assumption in the fallow model |
| E11 | pyfao56 cross-check of the engine | A | 2 h | USDA-ARS reference implementation agrees (or the gap is reported) |
| E12 | Soil test entry + HWSD second opinion | B + C | 1.5 h | Lets a farmer type lab values (P, K, pH, organic matter) next to the regional estimate |
| E13 | Global sample point (US High Plains) | B | 1 h | The challenge says "farmers around the world"; rainfed wheat–fallow only |
| E14 | Sowing-date sensitivity (2 dates per crop) | A | 1.5 h | Answers "what if I sow later?" |
| E15 | GDD harvest window for wheat | A | 2 h | Nice to have; medium confidence at best |

Realistic expectation with three developers in five hours: E1, E2, E4, and either E3 or E5.

---

## E1 — SMAP L4 root-zone consistency check

- **Data:** SMAP L4 `SPL4SMGP` v8, `sm_rootzone` (0–100 cm), 9 km, 3-hourly → daily means, 2015-04 → latest, at both pilot points. Access, in order: AppEEARS point request (if one was already submitted) → Earth Engine `NASA/SMAP/SPL4SMGP/008` with `reduceRegion` at ~11 km scale → `earthaccess`.
- **Note:** the MVP already requests SMAP at T+1 and shows the wetness panel if the data arrived. E1 adds the comparison below; if the data missed the MVP, E1 also turns the panel on.
- **Method:** compare standardised anomalies of SMAP `sm_rootzone` with standardised anomalies of the engine's profile water for the **fallow** rotation (bare soil is closest to what SMAP's land model assumes). Report Spearman correlation of monthly anomalies and the timing of the main wet-up and dry-down each year.
- **Never claim** absolute volumetric agreement. SMAP root zone is model + assimilation, a 9 km mixed cell, and its model does not know about our rotations.
- **Output:** a sixth check `smap_anomaly` in `validation.json` with status `info` and a small chart in the evidence panel. Glossary entry "soil moisture anomaly" points here.
- **Done when:** the correlation and one chart are shown with the caveats above.

## E2 — Drier / warmer climate scenarios

- Precompute offline variants of the full run: precipitation × 0.8 and × 0.9; temperature +1 °C and +2 °C (shift `T2M_MAX`, `T2M_MIN` and `T2MDEW` together so relative humidity stays roughly constant, then recompute ET₀). Optionally one combined "−10 % rain, +1 °C".
- These are simple sensitivity tests ("delta change"), **not** climate projections. Label: "What if the same 24 years were drier or warmer?"
- Contract: `results/{location_id}__{scenario_id}.json` with the same schema, plus `scenarios` list in `site_index.json` (B adds types first).
- UI: a scenario selector next to the depth selector; cards and charts update; a small note shows how the baseline's median water and loss probability change.
- **Done when:** switching scenarios updates every card and chart, and the note shows the change.

## E3 — GRACE / GRACE-FO basin water trend

- **Data:** GRACE / GRACE-FO mascon terrestrial water storage anomaly (e.g. JPL mascons via Earth Engine or PO.DAAC), monthly, 2002 → latest, averaged over a box or the cells covering the Konya closed basin.
- **Show:** one line chart "Total water storage anomaly, Konya basin" with the GRACE / GRACE-FO gap marked, and the trend computed from the data (report the number only from the computation).
- **Framing:** context, not input. GRACE sees total water (groundwater, soil, surface) at a few hundred km scale; it does not measure one field. It explains why water decisions matter here.
- **Done when:** the chart and its caveat are in a "Why water matters here" section.

## E4 — Turkish language toggle

- Fill every `tr` string in `src/strings.ts`; add a TR/EN switch in the header; remember the choice per browser (wrapped in try/catch).
- Person D reviews the Turkish for farmer-friendly wording (nadas, kuru tarım, dekar, anız).
- **Done when:** the whole page reads correctly in both languages on a phone.

## E5 — "This season, now"

- Run the engine from the 2026 wheat harvest (July 2026) to the latest POWER date for each location and depth (bare soil so far for all three rotations).
- Show today's stored available water and compare it with the same date in the 24 past years (percentile).
- Analog-year ensemble: from today's state, replay the remaining months to next October with the weather of each past year (24 runs) and show P10–P50–P90 water at wheat sowing in October 2027 for fallow vs chickpea vs lentil.
- New contract file `now/{location_id}.json` (B adds types first).
- Label: "Based on NASA POWER up to {date}. Future months use past years' weather, not a forecast."
- **Done when:** one panel shows today's water, its percentile and the three-rotation ensemble range.

## E6 — Farmer constraints

- Toggles: "I have no buyer for lentil / chickpea nearby", "I don't have a planter for legumes", "I can't afford a loss in a dry year" (hides strategies whose P10 two-year net is below zero, or marks them).
- Hidden or marked strategies stay visible as greyed cards with the reason, so nothing disappears silently.
- **Done when:** each toggle changes the card list and says why.

## E7 — Map

- MapLibre GL with a free basemap; two markers; click selects the location. If E3 is done, add the GRACE box outline. Optional Konya closed basin outline only if a public-domain shape is at hand.
- **Done when:** the map works on mobile and does not slow the first load (lazy-load).

## E8 — Irrigated wheat → grain maize in Karapınar + policy receipt

- New rotation `wheat_maize_irrigated` (irrigated only in Karapınar). Irrigation rule: refill to field capacity when depletion reaches RAW; report net irrigation in mm and m³/da. State clearly that the irrigation amount is a model assumption, not a measurement.
- Policy receipt per crop and production year with separate components (basic, planned production, groundwater restriction), each with status `eligible | not_eligible | not_verified | not_announced`, coefficient, TL/da and legal reference. 367 TL/da (2026) and 442 TL/da (2027) are **multipliers**, not payments. Grain maize in the groundwater-restricted districts is `not_eligible` with a conflict note on drip irrigation. Seed regression tests from the earlier plan (e.g. Karapınar irrigated wheat 2026 = 477.1 + 477.1 + 513.8 = 1,468.0 TL/da) are used **only after** Person D confirms them with the Ministry calculator.
- Footer line: "Not an official eligibility decision. Check with your provincial or district agriculture directorate."
- **Done when:** the fourth card shows water use, net irrigation and the receipt, and the policy tests pass.

## E9 — Price uncertainty and tornado

- Inputs become min / expected / max for price and cost. Client-side Monte Carlo (e.g. 5,000 draws) over price × cost × the 24 climate years.
- Tornado chart: how much the median two-year net moves when each input goes from min to max.
- **Done when:** Chart A shows the wider band and the tornado lists inputs in order of effect.

## E10 — Snow and stubble correction for fallow

- Degree-day snow model (accumulate when T < 0 °C, melt with a degree-day factor) so winter precipitation enters the soil at melt.
- Optional stubble cover after harvest reduces `few` / `Ke` for the first months of fallow, and lowers the wind-exposure count for those days.
- Re-run and show the change in fallow storage efficiency against the literature range.
- **Done when:** a toggle in the evidence panel shows "with / without snow and stubble" values.

## E11 — pyfao56 cross-check

- Run pyfao56 (USDA-ARS) for one wheat season per location with the same weather and parameters; compare seasonal ETa and final depletion with our engine.
- Report the difference in the evidence panel as `pyfao56_crosscheck`.
- **Done when:** the difference is shown, whatever it is.

## E12 — Soil test entry + HWSD second opinion

- A small form: the farmer types values from a soil lab report (P, K, pH, organic matter, EC). They are shown next to the regional SoilGrids estimate. Interpretation bands (low / medium / high) only if Person D finds an official Turkish source for them; otherwise values are shown without judgment.
- Values stay in the browser (try/catch storage), nothing is uploaded.
- Optional: HWSD v2.0 rootable depth and AWC as a second opinion next to SoilGrids, and re-run deep / shallow classes at SoilGrids Q05 and Q95 AWC.
- **Done when:** a typed lab value appears next to the estimate with its source marked "your lab report".

## E13 — Global sample point

- One US High Plains point, rainfed wheat–fallow only, same engine. Local prices are not modelled: show water, bare days and yield ratio only.
- **Done when:** a "Same engine, another continent" strip shows the fallow storage efficiency and bare days there.

## E14 — Sowing-date sensitivity

- Two sowing dates per crop (e.g. early and late), recomputed offline. Add a date selector.
- **Done when:** the cards and charts react to the selector.

## E15 — GDD harvest window

- Growing degree days (base 0 °C) with a simple vernalisation rule for winter wheat; window = P10–P90 of the harvest date across the 24 years. Confidence label "medium" at most.
- **Done when:** the wheat card shows a harvest window.

---

## Not in this hackathon (decided, do not reopen)

| Idea | Why not now |
|---|---|
| Fertiliser / NPK advice | Cannot be measured from space; needs a soil lab test |
| Price forecasting | Not defensible; prices stay user inputs |
| Exact yield for one field | Not defensible without field data; ranges only |
| ML / LSTM yield models, multi-sensor "AI fusion" | 2 districts × 24 years is far too little data; a transparent model is easier to check |
| ECOSTRESS, GEDI, Landsat/HLS NDVI, MODIS | Useful later; field-scale imagery needs field boundaries and more than 24 hours to do well |
| IMERG precipitation | Useful as a third precipitation source later; POWER vs MGM already covers "satellite vs ground" |
| Daily cron jobs, FastAPI backend, arbitrary coordinates | Post-event; the MVP is static by design |
| AquaCrop / DSSAT / APSIM | Need calibration we do not have |
| Legume nitrogen credit in kg N/da | Highly variable; would be a made-up number |
| Wheat → chickpea as a fourth rotation | A different decision; adds UI weight without a new insight |
| MGM daily quantile mapping | Daily MGM data is paid and slow to obtain; normals comparison is enough for now |

## After the event (MUSTECH track)

1. Monthly MGM scaling of POWER precipitation, then quantile mapping with daily station data.
2. Any Central Anatolian coordinate (small API with caching).
3. Barley, vetch, safflower rotations; cover-crop options.
4. HLS-based check of which fields were really fallow; field-level erosion hotspots with SRTM slope.
5. Farmer interviews in Konya and Kayseri; user test of the range charts.
6. Static ET₀ and soil-water feed for MUSTECH products.
