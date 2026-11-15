// Fertilizer module — docs/GUBRE.md, ARAYUZLER §13. Owner: Gümüş (Rol B).
// Rules and every number come from fertilizer.json (engine/config/fertilizer.yaml). No crop-specific `if` here:
// a crop differs only by its YAML entry (soil tables, starter N, product choices, advice).
//
// Main method (official): TAGEM "Gübre Tavsiyeleri" Central Anatolia tables. The lab value (organic matter %,
// Olsen P2O5 kg/da, available K2O kg/da) picks a class; the class gives the pure nutrient to apply (kg/da).
// Cross-check / fallback (team report, not verified): nutrient balance = target yield × uptake − soil supply,
// divided by fertilizer efficiency. It is shown next to the table value, and used only where no table exists.
// Output is kg/da of nutrient and of product, with soil flags and advice. No money anywhere.
// İsmail only calls soilFromResults() and recommend(); no fertilizer arithmetic in components.

import type {
  Advice, Badge, ClassRow, FertCropId, FertilizerFile, GuideRow, Nutrient, Pred, ProductChoice, ResultsFile,
  SoilFlag, SoilTable, Sourced, Timing, V, WaterRegime, When,
} from './types';

/** Soil test values, as on a Turkish lab report (0–20 cm). Any may be missing. */
export interface SoilTest {
  om_pct?: number;          // organic matter, %
  p2o5_kg_per_da?: number;  // plant-available phosphorus (Olsen), kg P2O5/da
  k2o_kg_per_da?: number;   // plant-available potassium, kg K2O/da
  olsen_p_ppm?: number;     // alternative: Olsen P, mg P/kg (converted with the soil-layer assumption)
  k_ppm?: number;           // alternative: exchangeable K, mg K/kg (same)
  total_n_pct?: number;     // total nitrogen, %
  ph?: number;              // pH in water
  lime_pct?: number;        // CaCO3, %
  ec_ds_m?: number;         // salinity, dS/m (saturation extract)
  zn_ppm?: number;          // DTPA zinc, mg/kg
}
export type SoilKey = keyof SoilTest;
/** Values that change the plan; asked for when missing. */
const ESSENTIAL: SoilKey[] = ['om_pct', 'p2o5_kg_per_da', 'k2o_kg_per_da', 'ph', 'lime_pct', 'ec_ds_m', 'zn_ppm'];

export interface SoilPrefill {
  soil: SoilTest;
  badges: Partial<Record<SoilKey, Badge>>;   // 'model' for SoilGrids values; the user's own entries are 'user'
  needs_lab: SoilKey[];                      // essential values satellites / SoilGrids cannot give
}

export interface FertRequest {
  crop: FertCropId;
  water: WaterRegime;
  target_yield_kg_per_da?: number;           // default: crop.default_target_yield_kg_per_da[water] (may be pending)
  soil: SoilTest;
  inoculated?: boolean;                      // legume seed inoculated with Rhizobium (default false)
  drip?: boolean;                            // drip irrigation (only adds tank-mixing advice)
  banding?: boolean;                         // base fertilizer placed in a band with a combined seed drill
}

export type NutrientBasis = 'soil_table' | 'fixed_starter' | 'response_curve' | 'balance' | 'needs_soil_test' | 'pending';
export interface NutrientLine {
  nutrient: Nutrient;
  fertilizer_kg_per_da: number | null;       // pure nutrient to apply (null = unknown: see basis)
  basis: NutrientBasis;
  source: Sourced | null;                    // where fertilizer_kg_per_da comes from (badge for the UI)
  capped: boolean;                           // cut to the crop's N cap
  // cross-check (team report method, not verified): shown next to the table value
  need_kg_per_da: number | null;             // taken up by the target yield
  soil_supply_kg_per_da: number | null;      // usable from the soil
  balance_kg_per_da: number | null;          // (need − supply) / fertilizer efficiency
}
export interface DoseLine { product: string; timing: Timing; kg_per_da: number; supplies: Record<Nutrient, number> }
export interface FertPlan {
  crop: FertCropId;
  water: WaterRegime;
  target_yield_kg_per_da: number | null;
  target_badge: Badge | null;                // 'user' if entered, else the default's badge
  soil: SoilTest;                            // with p2o5 / k2o filled from ppm where needed
  derived: SoilKey[];                        // soil values computed from ppm (soil-layer assumption)
  flags: SoilFlag[];
  nutrients: NutrientLine[];                 // n, p2o5, k2o
  doses: DoseLine[];                         // products, kg/da, in timing order
  guide: GuideRow | null;                    // matching row of the crop's guide table (for comparison)
  advice: Advice[];                          // crop advice first, then general advice
  missing: SoilKey[];                        // soil-test values that would make the plan more precise
  better_for_salinity: FertCropId[];         // more salt-tolerant crops, when the soil is saline for this crop
}

const NUTRIENTS: Nutrient[] = ['n', 'p2o5', 'k2o'];
const TIMING_ORDER: Timing[] = ['pre_plant', 'base', 'top_1', 'top_2', 'foliar'];

const val = (v: V | undefined): number | null => (v && typeof v.value === 'number' ? v.value : null);
const must = (v: V | undefined, what: string): number => {
  const x = val(v);
  if (x === null) throw new Error(`fertilizer.json: ${what} has no value`);
  return x;
};
const r1 = (x: number): number => Math.round(x * 10) / 10;
const sourced = (v: Sourced): Sourced => ({ source: v.source, source_url: v.source_url, type: v.type, verified: v.verified });

/** Prefill from results/{loc}.json: SoilGrids pH, total N and organic carbon (0–30 cm, median). */
export function soilFromResults(results: ResultsFile, f: FertilizerFile): SoilPrefill {
  const soil: SoilTest = {};
  const badges: Partial<Record<SoilKey, Badge>> = {};
  const prop = (id: string) => results.soil.properties.find((p) => p.id === id);
  const ph = prop('phh2o');
  if (ph) { soil.ph = ph.q50; badges.ph = ph.type; }
  const n = prop('nitrogen');                // g/kg → %
  if (n) { soil.total_n_pct = n.q50 / 10; badges.total_n_pct = n.type; }
  const soc = prop('soc');                   // g/kg organic carbon → % organic matter
  const socToOm = val(f.conversions.soc_to_om);
  if (soc && socToOm !== null) { soil.om_pct = Math.round((soc.q50 / 10) * socToOm * 100) / 100; badges.om_pct = soc.type; }
  return { soil, badges, needs_lab: ESSENTIAL.filter((k) => soil[k] === undefined) };
}

/** Fill p2o5 / k2o kg/da from ppm when only ppm is given: ppm × soil mass / 10⁶ × oxide factor. */
export function completeSoil(f: FertilizerFile, s: SoilTest): { soil: SoilTest; derived: SoilKey[] } {
  const out: SoilTest = { ...s };
  const derived: SoilKey[] = [];
  const mass = val(f.soil_layer.mass_kg_per_da);
  if (out.p2o5_kg_per_da === undefined && out.olsen_p_ppm !== undefined && mass !== null) {
    out.p2o5_kg_per_da = (out.olsen_p_ppm * mass / 1e6) * must(f.conversions.p_to_p2o5, 'p_to_p2o5');
    derived.push('p2o5_kg_per_da');
  }
  if (out.k2o_kg_per_da === undefined && out.k_ppm !== undefined && mass !== null) {
    out.k2o_kg_per_da = (out.k_ppm * mass / 1e6) * must(f.conversions.k_to_k2o, 'k_to_k2o');
    derived.push('k2o_kg_per_da');
  }
  return { soil: out, derived };
}

/** Soil flags for this crop. zn_likely_low = no zinc test, but the soil is alkaline or limy. */
export function soilFlags(f: FertilizerFile, crop: FertCropId, s: SoilTest): SoilFlag[] {
  const th = f.thresholds;
  const out: SoilFlag[] = [];
  const above = (x: number | undefined, t: V) => x !== undefined && val(t) !== null && x > val(t)!;
  const below = (x: number | undefined, t: V) => x !== undefined && val(t) !== null && x < val(t)!;
  if (above(s.ph, th.ph_alkaline)) out.push('alkaline');
  if (above(s.lime_pct, th.lime_high_pct)) out.push('high_lime');
  if (below(s.om_pct, th.om_low_pct)) out.push('low_om');
  if (below(s.total_n_pct, th.total_n_low_pct)) out.push('low_total_n');
  if (above(s.ec_ds_m, f.crops[crop].salinity_threshold_ec_ds_m)) out.push('saline');
  if (below(s.zn_ppm, th.zn_low_ppm)) out.push('zn_low');
  else if (s.zn_ppm === undefined && (out.includes('alkaline') || out.includes('high_lime'))) out.push('zn_likely_low');
  return out;
}

type Ctx = Record<string, unknown> & { flags: SoilFlag[] };

function predMatches(p: Pred, x: unknown): boolean {
  if (p.missing !== undefined) return p.missing === (x === undefined);
  if (x === undefined) return false;
  if (p.eq !== undefined && x !== p.eq) return false;
  if (p.in !== undefined && !p.in.includes(x as string | number)) return false;
  const bounds = [p.gt, p.gte, p.lt, p.lte];
  if (typeof x !== 'number') return bounds.every((b) => b === undefined);
  if (p.gt !== undefined && !(x > p.gt)) return false;
  if (p.gte !== undefined && !(x >= p.gte)) return false;
  if (p.lt !== undefined && !(x < p.lt)) return false;
  if (p.lte !== undefined && !(x <= p.lte)) return false;
  return true;
}

/** Every key in `when` must match. No `when` = always. */
export function matches(when: When | undefined, ctx: Ctx): boolean {
  if (!when) return true;
  for (const [key, cond] of Object.entries(when)) {
    if (cond === undefined) continue;
    if (key === 'flags_any') { if (!(cond as SoilFlag[]).some((fl) => ctx.flags.includes(fl))) return false; continue; }
    if (key === 'flags_all') { if (!(cond as SoilFlag[]).every((fl) => ctx.flags.includes(fl))) return false; continue; }
    if (!predMatches(cond as Pred, ctx[key])) return false;
  }
  return true;
}

const firstMatch = (choices: ProductChoice[], ctx: Ctx) => choices.find((c) => matches(c.when, ctx))?.product ?? null;

/** Class lookup: the first row whose max ≥ value (max null = everything above). */
export function lookup(rows: ClassRow[], x: number): number {
  const row = rows.find((r) => r.max === null || x <= r.max);
  if (!row) throw new Error('soil table has no open last row');
  return row.kg_per_da;
}

/** Usable nutrient from the soil (team report method), kg/da; null when that soil value is missing. */
export function soilSupply(f: FertilizerFile, s: SoilTest): Record<Nutrient, number | null> {
  const ss = f.soil_supply;
  const mass = val(f.soil_layer.mass_kg_per_da);
  const nav = val(ss.n_available_fraction), nup = val(ss.n_uptake_fraction);
  const pup = val(ss.p_uptake_fraction), kup = val(ss.k_uptake_fraction);
  return {
    n: s.total_n_pct === undefined || mass === null || nav === null || nup === null ? null : mass * (s.total_n_pct / 100) * nav * nup,
    p2o5: s.p2o5_kg_per_da === undefined || pup === null ? null : s.p2o5_kg_per_da * pup,
    k2o: s.k2o_kg_per_da === undefined || kup === null ? null : s.k2o_kg_per_da * kup,
  };
}

export function recommend(f: FertilizerFile, req: FertRequest): FertPlan {
  const crop = f.crops[req.crop];
  if (!crop) throw new Error(`unknown crop ${req.crop}`);
  const def = crop.default_target_yield_kg_per_da[req.water];
  const target = req.target_yield_kg_per_da ?? val(def);
  const { soil: s, derived } = completeSoil(f, req.soil);
  const flags = soilFlags(f, req.crop, s);
  const ctx: Ctx = { ...s, water: req.water, inoculated: req.inoculated ?? false, drip: req.drip ?? false,
    banding: req.banding ?? false, crop: req.crop, flags };

  // 1. pure nutrient per nutrient
  const supply = soilSupply(f, s);
  const nutrients: NutrientLine[] = NUTRIENTS.map((nu) => {
    const up = val(crop.uptake_kg_per_t[nu]);
    const eff = val(f.fertilizer_efficiency[nu]);
    const needKg = up === null || target === null ? null : (target / 1000) * up;
    const balance = needKg === null || eff === null || supply[nu] === null ? null : Math.max(0, needKg - supply[nu]!) / eff;

    let fert: number | null = null;
    let basis: NutrientBasis;
    let src: Sourced | null = null;
    const table: SoilTable | undefined = crop.soil_tables[nu]?.[req.water];
    const by = f.soil_table_by[nu];
    if (nu === 'n' && ctx.inoculated && crop.fixed_n_kg_per_da) {
      fert = must(crop.fixed_n_kg_per_da.inoculated, 'fixed_n_kg_per_da.inoculated');
      basis = 'fixed_starter'; src = sourced(crop.fixed_n_kg_per_da.inoculated);
    } else if (table) {
      const x = s[by];
      if (x === undefined) basis = 'needs_soil_test';
      else { fert = lookup(table.rows, x); basis = 'soil_table'; }
      src = sourced(table);
    } else if (nu === 'n' && crop.n_response) {
      const b = must(crop.n_response.b, 'n_response.b');
      const c = must(crop.n_response.c, 'n_response.c');
      if (!(c < 0)) throw new Error(`${req.crop}: n_response.c must be negative`);
      fert = -b / (2 * c); basis = 'response_curve'; src = sourced(crop.n_response.c);
    } else if (balance !== null) {
      fert = balance; basis = 'balance';
      src = { source: 'Besin dengesi (ekip raporu yöntemi): hedef verim × birim alım − topraktan alınabilen, gübre etkinliğine bölünmüş', type: 'model', verified: false };
    } else {
      basis = needKg !== null && eff !== null ? 'needs_soil_test' : 'pending';
    }
    let capped = false;
    const cap = nu === 'n' ? val(crop.n_cap_kg_per_da) : null;
    if (fert !== null && cap !== null && fert > cap) { fert = cap; capped = true; }
    return {
      nutrient: nu, fertilizer_kg_per_da: fert === null ? null : r1(fert), basis, source: src, capped,
      need_kg_per_da: needKg === null ? null : r1(needKg),
      soil_supply_kg_per_da: supply[nu] === null ? null : r1(supply[nu]!),
      balance_kg_per_da: balance === null ? null : r1(balance),
    };
  });
  const amount = (nu: Nutrient) => nutrients.find((l) => l.nutrient === nu)!.fertilizer_kg_per_da;

  // 2. products: P from the base product (its N and K count), K top-up, remaining N split into top dressings
  const doses: DoseLine[] = [];
  const minDose = val(f.min_dose_kg_per_da) ?? 0;
  const supplied: Record<Nutrient, number> = { n: 0, p2o5: 0, k2o: 0 };
  const add = (product: string, timing: Timing, kg: number) => {
    const p = f.products[product];
    if (!p) throw new Error(`unknown product ${product}`);
    if (!(kg > 0) || kg < minDose) return;
    const sup = { n: kg * p.n / 100, p2o5: kg * p.p2o5 / 100, k2o: kg * p.k2o / 100 };
    for (const nu of NUTRIENTS) supplied[nu] += sup[nu];
    doses.push({ product, timing, kg_per_da: r1(kg), supplies: { n: r1(sup.n), p2o5: r1(sup.p2o5), k2o: r1(sup.k2o) } });
  };

  const p = amount('p2o5');
  const base = firstMatch(crop.base_products, ctx);
  if (p !== null && p > 0 && base) {
    const prod = f.products[base];
    let kg = p / (prod.p2o5 / 100);
    if (ctx.banding && prod.band_minus_kg) kg = Math.max(0, kg - prod.band_minus_kg);
    add(base, 'base', kg);
  }
  const k = amount('k2o');
  if (k !== null && k - supplied.k2o > 0) add(crop.k_product, 'base', (k - supplied.k2o) / (f.products[crop.k_product].k2o / 100));
  const n = amount('n');
  if (n !== null && n - supplied.n > 0) {
    const top = firstMatch(crop.top_products, ctx);
    if (top) {
      const remaining = n - supplied.n;
      for (const part of crop.n_split[req.water]) add(top, part.timing, (remaining * part.fraction) / (f.products[top].n / 100));
    }
  }
  doses.sort((a, b) => TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing));

  // 3. guide row, advice, salinity alternatives, missing tests
  let guide: GuideRow | null = null;
  if (crop.guide_table && target !== null) {
    guide = crop.guide_table.rows.find((row) =>
      (row.min === null || target >= row.min) && (row.max === null || target < row.max)
      && (!row.water || row.water.includes(req.water))) ?? null;
  }
  const advice = [...crop.advice, ...f.advice].filter((a) => matches(a.when, ctx));
  let better: FertCropId[] = [];
  if (flags.includes('saline') && s.ec_ds_m !== undefined) {
    better = (Object.keys(f.crops) as FertCropId[])
      .filter((id) => id !== req.crop && (val(f.crops[id].salinity_threshold_ec_ds_m) ?? -Infinity) >= s.ec_ds_m!)
      .sort((a, b) => val(f.crops[b].salinity_threshold_ec_ds_m)! - val(f.crops[a].salinity_threshold_ec_ds_m)!);
  }
  const missing = ESSENTIAL.filter((key) => s[key] === undefined);
  const nLine = nutrients[0];
  if (s.total_n_pct === undefined && (nLine.basis === 'needs_soil_test' || nLine.basis === 'pending') && !crop.soil_tables.n?.[req.water]) {
    missing.push('total_n_pct');
  }

  return {
    crop: req.crop, water: req.water, target_yield_kg_per_da: target,
    target_badge: req.target_yield_kg_per_da !== undefined ? 'user' : (target === null ? null : def.type),
    soil: s, derived, flags, nutrients, doses, guide, advice, missing, better_for_salinity: better,
  };
}

/** Pure nutrient in the farmers' usual doses (product kg × grade), for the comparison line. null without survey data. */
export function practiceNutrients(f: FertilizerFile, crop: FertCropId): Record<Nutrient, number> | null {
  const fp = f.crops[crop]?.farmer_practice;
  if (!fp) return null;
  const out: Record<Nutrient, number> = { n: 0, p2o5: 0, k2o: 0 };
  for (const d of fp.doses) {
    const p = f.products[d.product];
    if (!p) throw new Error(`unknown product ${d.product}`);
    for (const nu of NUTRIENTS) out[nu] += (d.kg_per_da * p[nu]) / 100;
  }
  return { n: r1(out.n), p2o5: r1(out.p2o5), k2o: r1(out.k2o) };
}

