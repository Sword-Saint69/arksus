// Decision module — ARAYUZLER §9–§10. Owner: Gümüş (Rol B).
// 14 Nov team decision: the site shows NO money. Prices, supports and reference yields are used only INSIDE this
// module to estimate which rotation earns the farmer more; that estimate is balanced against wheat productivity,
// soil protection and stored water. Rotations that hurt the main crop or fail too often are blocked (guardrails),
// whatever they would earn. Outputs are 0–1 scores, a recommendation, its main reason and block reasons — no TL.
// İsmail only calls these functions; no scoring logic in components.

import type { SiteIndex, ResultsFile, DefaultsFile, SequenceRow, Rotation, V } from './types';

export type CropId = 'wheat' | 'chickpea' | 'lentil' | 'fallow';
export type Badge = 'measured' | 'model' | 'official' | 'statistic' | 'literature' | 'assumption' | 'user';

export interface CropInputs {
  ref_yield_kg_per_da?: number; // reference yield (not for fallow)
  price_tl_per_kg?: number;     // internal parameter (not for fallow)
  support_tl_per_da: number;
}
export type LocationInputs = Partial<Record<CropId, CropInputs>>;
export interface Weights { value: number; yield: number; soil: number; water: number }
export interface Guardrails { min_wheat_ratio_vs_baseline: number; min_first_crop_ratio: number }
export interface DecisionInputs {
  crops: LocationInputs;
  weights: Weights;          // default priorities (sliders start here)
  guardrails: Guardrails;
  close_call_margin: number;
}

const num = (v: V | undefined, fallback = 0): number => (v && typeof v.value === 'number' ? v.value : fallback);

export function inputsFromDefaults(d: DefaultsFile): DecisionInputs {
  const crops: LocationInputs = {};
  for (const c of ['wheat', 'chickpea', 'lentil'] as const) {
    const p = d.crops[c];
    crops[c] = {
      ref_yield_kg_per_da: num(p.ref_yield_kg_per_da),
      price_tl_per_kg: num(p.price_tl_per_kg),
      support_tl_per_da: num(p.support_tl_per_da),
    };
  }
  crops.fallow = { support_tl_per_da: num(d.crops.fallow.support_tl_per_da) };
  const w = d.decision.weights;
  const g = d.decision.guardrails;
  return {
    crops,
    weights: { value: num(w.value), yield: num(w.yield), soil: num(w.soil), water: num(w.water) },
    guardrails: { min_wheat_ratio_vs_baseline: num(g.min_wheat_ratio_vs_baseline), min_first_crop_ratio: num(g.min_first_crop_ratio) },
    close_call_margin: num(d.decision.close_call_margin, 0.05),
  };
}

export interface Range { p10: number; p50: number; p90: number }

/** Linear interpolation between closest ranks = numpy default ("type 7"). p in 0–100. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const h = (s.length - 1) * (Math.min(100, Math.max(0, p)) / 100);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export function range(values: number[]): Range {
  return { p10: percentile(values, 10), p50: percentile(values, 50), p90: percentile(values, 90) };
}

/**
 * INTERNAL two-year market value of one sequence (TL/da): Σ yield_ratio × ref_yield × price + Σ support.
 * Costs are not included (not sourced). NEVER display this number; it only feeds the "value" part of the score.
 */
export function sequenceValue(row: SequenceRow, rotation: Rotation, crops: LocationInputs): number {
  const first = rotation.crops[0];
  const w = crops.wheat ?? { support_tl_per_da: 0 };
  const f = crops[first] ?? { support_tl_per_da: 0 };
  const wheat = row.wheat.yield_ratio * (w.ref_yield_kg_per_da ?? 0) * (w.price_tl_per_kg ?? 0) + w.support_tl_per_da;
  const firstCrop = (row.first_crop ? row.first_crop.yield_ratio * (f.ref_yield_kg_per_da ?? 0) * (f.price_tl_per_kg ?? 0) : 0)
    + f.support_tl_per_da;
  return wheat + firstCrop;
}

export interface RotationSummary {
  rotation_id: string;
  depth_id: string;
  is_baseline: boolean;
  harvests_in_two_years: number;           // fallow → wheat: 1; legume → wheat: 2
  water_at_wheat_sowing_mm: Range;
  wheat_yield_ratio: Range;                // 0–1, share of the yield possible without water stress
  first_crop_yield_ratio: Range | null;    // null for fallow
  bare_days_p50: number;
  wind_exposed_bare_days_p50: number;
  wheat_stress_days_p50: number;
  delta_vs_baseline: {                     // null for the baseline
    water_p50: number; wheat_yield_ratio_p50: number; bare_days_p50: number; wind_exposed_p50: number;
  } | null;
}

function rowsFor(results: ResultsFile, rotationId: string, depthId: string, years?: Set<number>): SequenceRow[] {
  return results.sequences
    .filter((s) => s.rotation_id === rotationId && s.depth_id === depthId && (!years || years.has(s.start_year)))
    .sort((a, b) => a.start_year - b.start_year);
}

/** Agronomic summary per rotation (no money). */
export function summarize(results: ResultsFile, site: SiteIndex, depthId: string): RotationSummary[] {
  const out: RotationSummary[] = site.rotations.map((rot) => {
    const rows = rowsFor(results, rot.id, depthId);
    const firstRatios = rows.filter((r) => r.first_crop).map((r) => r.first_crop!.yield_ratio);
    return {
      rotation_id: rot.id,
      depth_id: depthId,
      is_baseline: rot.is_baseline,
      harvests_in_two_years: rot.crops[0] === 'fallow' ? 1 : 2,
      water_at_wheat_sowing_mm: range(rows.map((r) => r.water_at_wheat_sowing_mm)),
      wheat_yield_ratio: range(rows.map((r) => r.wheat.yield_ratio)),
      first_crop_yield_ratio: firstRatios.length ? range(firstRatios) : null,
      bare_days_p50: percentile(rows.map((r) => r.bare_days), 50),
      wind_exposed_bare_days_p50: percentile(rows.map((r) => r.wind_exposed_bare_days), 50),
      wheat_stress_days_p50: percentile(rows.map((r) => r.wheat.stress_days), 50),
      delta_vs_baseline: null,
    };
  });
  const base = out.find((s) => s.is_baseline);
  if (base) {
    for (const s of out) {
      if (s === base) continue;
      s.delta_vs_baseline = {
        water_p50: s.water_at_wheat_sowing_mm.p50 - base.water_at_wheat_sowing_mm.p50,
        wheat_yield_ratio_p50: s.wheat_yield_ratio.p50 - base.wheat_yield_ratio.p50,
        bare_days_p50: s.bare_days_p50 - base.bare_days_p50,
        wind_exposed_p50: s.wind_exposed_bare_days_p50 - base.wind_exposed_bare_days_p50,
      };
    }
  }
  return out;
}

export type BlockReason = 'wheat_yield_below_baseline' | 'first_crop_fails';
export interface RankedRotation {
  rotation_id: string;
  eligible: boolean;                 // false = blocked by a guardrail, never recommended
  blocked: BlockReason[];
  score: number;                     // 0–1
  parts: Weights;                    // each 0–1, relative to the best rotation on that criterion
  driver: keyof Weights;             // criterion that contributed most to the score
}
export interface Decision {
  depth_id: string;
  recommended: string | null;        // best eligible rotation ("most suitable for this land under your priorities")
  runner_up: string | null;
  close_call: boolean;               // top two eligible scores differ by less than close_call_margin
  ranking: RankedRotation[];         // eligible first (score high → low), then blocked
}

/** higher is better: x / best; lower is better: best / x. Keeps small differences small (no min–max stretching). */
function relative(xs: number[], higherIsBetter: boolean): number[] {
  if (higherIsBetter) {
    const best = Math.max(...xs);
    return xs.map((x) => (best > 0 ? Math.max(0, x) / best : 1));
  }
  const best = Math.min(...xs);
  return xs.map((x) => (x <= 0 ? 1 : Math.max(0, best) / x));
}

function normalise(w: Weights): Weights {
  const t = w.value + w.yield + w.soil + w.water;
  return t > 0
    ? { value: w.value / t, yield: w.yield / t, soil: w.soil / t, water: w.water / t }
    : { value: 0.25, yield: 0.25, soil: 0.25, water: 0.25 };
}

/**
 * Most suitable rotation for this location and depth: weighted score of value (internal), wheat yield, soil and water,
 * after guardrails. `years` restricts the climate years (used by flipTable).
 */
export function decide(
  results: ResultsFile, site: SiteIndex, depthId: string, inp: DecisionInputs,
  weights: Weights = inp.weights, years?: Set<number>,
): Decision {
  const rots = site.rotations;
  const baseline = rots.find((r) => r.is_baseline) ?? rots[0];
  const stats = rots.map((rot) => {
    const rows = rowsFor(results, rot.id, depthId, years);
    const first = rows.filter((r) => r.first_crop).map((r) => r.first_crop!.yield_ratio);
    return {
      rot,
      value: percentile(rows.map((r) => sequenceValue(r, rot, inp.crops)), 50),
      wheat: percentile(rows.map((r) => r.wheat.yield_ratio), 50),
      first: first.length ? percentile(first, 50) : null,
      water: percentile(rows.map((r) => r.water_at_wheat_sowing_mm), 50),
      wind: percentile(rows.map((r) => r.wind_exposed_bare_days), 50),
    };
  });
  const baseWheat = stats.find((s) => s.rot.id === baseline.id)?.wheat ?? NaN;
  const value = relative(stats.map((s) => s.value), true);
  const yld = relative(stats.map((s) => s.wheat), true);
  const water = relative(stats.map((s) => s.water), true);
  const soil = relative(stats.map((s) => s.wind), false);
  const w = normalise(weights);

  const ranking: RankedRotation[] = stats.map((s, i) => {
    const blocked: BlockReason[] = [];
    if (s.rot.id !== baseline.id && s.wheat < inp.guardrails.min_wheat_ratio_vs_baseline * baseWheat) {
      blocked.push('wheat_yield_below_baseline');
    }
    if (s.first !== null && s.first < inp.guardrails.min_first_crop_ratio) blocked.push('first_crop_fails');
    const parts: Weights = { value: value[i], yield: yld[i], soil: soil[i], water: water[i] };
    const contrib = { value: w.value * parts.value, yield: w.yield * parts.yield, soil: w.soil * parts.soil, water: w.water * parts.water };
    const driver = (Object.keys(contrib) as (keyof Weights)[]).reduce((a, b) => (contrib[b] > contrib[a] ? b : a));
    return {
      rotation_id: s.rot.id,
      eligible: blocked.length === 0,
      blocked,
      score: contrib.value + contrib.yield + contrib.soil + contrib.water,
      parts,
      driver,
    };
  });
  ranking.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
  const ok = ranking.filter((r) => r.eligible);
  return {
    depth_id: depthId,
    recommended: ok[0]?.rotation_id ?? null,
    runner_up: ok[1]?.rotation_id ?? null,
    close_call: ok.length > 1 && ok[0].score - ok[1].score < inp.close_call_margin,
    ranking,
  };
}

export type PricedCrop = 'wheat' | 'chickpea' | 'lentil';
export interface PriceRobustness {
  depth_id: string;
  recommended: string | null;   // decide() with the given inputs
  stable: boolean;              // true if every tested price change keeps the same recommendation
  sensitive_to: { crop: PricedCrop; change: number; recommended: string | null }[]; // the cases that flip it
  tested_changes: number[];     // fractions, e.g. [-0.2, 0.2]
}

/**
 * Does the recommendation survive price changes? For each crop (wheat, chickpea, lentil) and each change, only that
 * crop's internal price is multiplied by (1 + change) and decide() is re-run; cases whose recommendation differs from
 * the base one are listed in `sensitive_to`.
 *
 * The default ±20 % is a sensitivity step chosen by the team (type: assumption), NOT a price forecast. The least
 * certain input is the chickpea price (one exchange, Feb 2026). A crop without a numeric price is skipped.
 * Pure: `inp` is not mutated. The output carries no TL amounts or prices — only crop ids, change fractions and
 * rotation ids.
 */
export function priceRobustness(
  results: ResultsFile, site: SiteIndex, depthId: string, inp: DecisionInputs,
  weights: Weights = inp.weights, changes: number[] = [-0.2, 0.2],
): PriceRobustness {
  const base = decide(results, site, depthId, inp, weights).recommended;
  const sensitive_to: PriceRobustness['sensitive_to'] = [];
  for (const crop of ['wheat', 'chickpea', 'lentil'] as const) {
    const c = inp.crops[crop];
    if (!c || typeof c.price_tl_per_kg !== 'number') continue;
    for (const change of changes) {
      const shifted: DecisionInputs = {
        ...inp,
        crops: { ...inp.crops, [crop]: { ...c, price_tl_per_kg: c.price_tl_per_kg * (1 + change) } },
      };
      const rec = decide(results, site, depthId, shifted, weights).recommended;
      if (rec !== base) sensitive_to.push({ crop, change, recommended: rec });
    }
  }
  return { depth_id: depthId, recommended: base, stable: sensitive_to.length === 0, sensitive_to, tested_changes: [...changes] };
}

export type Tercile = 'dry' | 'normal' | 'wet';
export interface FlipCell { depth_id: string; tercile: Tercile; rotation_id: string | null; close_call: boolean; n_years: number }

/** Terciles from baseline + medium pre_sowing_precip_mm (ARAYUZLER §10); per depth × tercile, the decide() result. 9 cells. */
export function flipTable(results: ResultsFile, site: SiteIndex, inp: DecisionInputs, weights: Weights = inp.weights): FlipCell[] {
  const baseline = site.rotations.find((r) => r.is_baseline) ?? site.rotations[0];
  const ref = [...rowsFor(results, baseline.id, 'medium')].sort(
    (a, b) => a.pre_sowing_precip_mm - b.pre_sowing_precip_mm || a.start_year - b.start_year,
  );
  const n = ref.length;
  const byTercile: Record<Tercile, Set<number>> = { dry: new Set(), normal: new Set(), wet: new Set() };
  ref.forEach((r, i) => byTercile[i < Math.round(n / 3) ? 'dry' : i < Math.round((2 * n) / 3) ? 'normal' : 'wet'].add(r.start_year));

  const cells: FlipCell[] = [];
  for (const depth of site.depth_classes) {
    for (const tercile of ['dry', 'normal', 'wet'] as const) {
      const d = decide(results, site, depth.id, inp, weights, byTercile[tercile]);
      cells.push({ depth_id: depth.id, tercile, rotation_id: d.recommended, close_call: d.close_call, n_years: byTercile[tercile].size });
    }
  }
  return cells;
}
