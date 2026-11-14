// Economics in the browser — ARAYUZLER §9–§10, PLAN_MVP §5.5 and §5.9. Owner: Gümüş (Rol B).
// The signatures are frozen. İsmail only calls these; no money math in components.

import type { SiteIndex, ResultsFile, DefaultsFile, SequenceRow, Rotation, V } from './types';

export type CropId = 'wheat' | 'chickpea' | 'lentil' | 'fallow';
export type Badge = 'measured' | 'model' | 'official' | 'statistic' | 'literature' | 'assumption' | 'user';

export interface CropInputs {
  ym_kg_per_da?: number;      // not for fallow
  price_tl_per_kg?: number;   // not for fallow
  cost_tl_per_da: number;
  support_tl_per_da: number;
}
export type LocationInputs = Partial<Record<CropId, CropInputs>>;

/** Pending values (value: null) become 0 here; the UI shows them as "pending". */
const num = (v: V | undefined): number => (v && typeof v.value === 'number' ? v.value : 0);

export function inputsFromDefaults(d: DefaultsFile, locationId: string): LocationInputs {
  const loc = d.values[locationId as keyof DefaultsFile['values']];
  if (!loc) return {};
  const out: LocationInputs = {};
  for (const crop of ['wheat', 'chickpea', 'lentil'] as const) {
    const c = loc[crop];
    out[crop] = {
      ym_kg_per_da: num(c.ym_kg_per_da),
      price_tl_per_kg: num(c.price_tl_per_kg),
      cost_tl_per_da: num(c.cost_tl_per_da),
      support_tl_per_da: num(c.support_tl_per_da),
    };
  }
  out.fallow = { cost_tl_per_da: num(loc.fallow.cost_tl_per_da), support_tl_per_da: num(loc.fallow.support_tl_per_da) };
  return out;
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

export interface SequenceMoney {
  start_year: number;
  wheat_kg_per_da: number;
  first_crop_kg_per_da: number | null;
  income_tl_per_da: number;
  cost_tl_per_da: number;
  net_2yr_tl_per_da: number;
}

/** income = Σ yield_ratio × Ym × price + Σ support; cost = cost[year-1 crop] + cost[wheat]; fallow year: support and cost only. */
export function sequenceMoney(row: SequenceRow, rotation: Rotation, inp: LocationInputs): SequenceMoney {
  const first = rotation.crops[0];
  const w = inp.wheat ?? { cost_tl_per_da: 0, support_tl_per_da: 0 };
  const f = inp[first] ?? { cost_tl_per_da: 0, support_tl_per_da: 0 };
  const wheatKg = row.wheat.yield_ratio * (w.ym_kg_per_da ?? 0);
  const firstKg = row.first_crop ? row.first_crop.yield_ratio * (f.ym_kg_per_da ?? 0) : null;
  const income =
    wheatKg * (w.price_tl_per_kg ?? 0) + w.support_tl_per_da +
    (firstKg ?? 0) * (f.price_tl_per_kg ?? 0) + f.support_tl_per_da;
  const cost = f.cost_tl_per_da + w.cost_tl_per_da;
  return {
    start_year: row.start_year,
    wheat_kg_per_da: wheatKg,
    first_crop_kg_per_da: firstKg,
    income_tl_per_da: income,
    cost_tl_per_da: cost,
    net_2yr_tl_per_da: income - cost,
  };
}

/** (cost − support) / price; NaN when price ≤ 0. */
export function breakEvenYield(cost: number, support: number, price: number): number {
  return price > 0 ? (cost - support) / price : NaN;
}

export interface RotationSummary {
  rotation_id: string;
  depth_id: string;
  is_baseline: boolean;
  nets: number[];
  net_2yr: Range;
  loss_probability: number;
  wheat_kg_per_da: Range;
  first_crop_kg_per_da: Range | null;
  water_at_wheat_sowing_mm: Range;
  bare_days_p50: number;
  wind_exposed_bare_days_p50: number;
  wheat_stress_days_p50: number;
  wheat_break_even_kg_per_da: number;
  delta_vs_baseline: {
    net_2yr_p50: number; water_p50: number; bare_days_p50: number; wind_exposed_p50: number;
  } | null;
}

function rowsFor(results: ResultsFile, rotationId: string, depthId: string): SequenceRow[] {
  return results.sequences
    .filter((s) => s.rotation_id === rotationId && s.depth_id === depthId)
    .sort((a, b) => a.start_year - b.start_year);
}

export function summarize(results: ResultsFile, site: SiteIndex, depthId: string, inp: LocationInputs): RotationSummary[] {
  const w = inp.wheat ?? { cost_tl_per_da: 0, support_tl_per_da: 0 };
  const breakEven = breakEvenYield(w.cost_tl_per_da, w.support_tl_per_da, w.price_tl_per_kg ?? 0);
  const out: RotationSummary[] = site.rotations.map((rot) => {
    const rows = rowsFor(results, rot.id, depthId);
    const money = rows.map((r) => sequenceMoney(r, rot, inp));
    const nets = money.map((m) => m.net_2yr_tl_per_da);
    const firstKg = money.map((m) => m.first_crop_kg_per_da).filter((x): x is number => x !== null);
    return {
      rotation_id: rot.id,
      depth_id: depthId,
      is_baseline: rot.is_baseline,
      nets,
      net_2yr: range(nets),
      loss_probability: nets.length ? nets.filter((n) => n < 0).length / nets.length : NaN,
      wheat_kg_per_da: range(money.map((m) => m.wheat_kg_per_da)),
      first_crop_kg_per_da: firstKg.length ? range(firstKg) : null,
      water_at_wheat_sowing_mm: range(rows.map((r) => r.water_at_wheat_sowing_mm)),
      bare_days_p50: percentile(rows.map((r) => r.bare_days), 50),
      wind_exposed_bare_days_p50: percentile(rows.map((r) => r.wind_exposed_bare_days), 50),
      wheat_stress_days_p50: percentile(rows.map((r) => r.wheat.stress_days), 50),
      wheat_break_even_kg_per_da: breakEven,
      delta_vs_baseline: null,
    };
  });
  const base = out.find((s) => s.is_baseline);
  if (base) {
    for (const s of out) {
      if (s === base) continue;
      s.delta_vs_baseline = {
        net_2yr_p50: s.net_2yr.p50 - base.net_2yr.p50,
        water_p50: s.water_at_wheat_sowing_mm.p50 - base.water_at_wheat_sowing_mm.p50,
        bare_days_p50: s.bare_days_p50 - base.bare_days_p50,
        wind_exposed_p50: s.wind_exposed_bare_days_p50 - base.wind_exposed_bare_days_p50,
      };
    }
  }
  return out;
}

export type Tercile = 'dry' | 'normal' | 'wet';
export interface FlipCell { depth_id: string; tercile: Tercile; rotation_id: string; median_net: number; n_years: number }

/** Terciles from baseline + medium pre_sowing_precip_mm (ARAYUZLER §10); 3 depths × 3 terciles = 9 cells. */
export function flipTable(results: ResultsFile, site: SiteIndex, inp: LocationInputs): FlipCell[] {
  const baseline = site.rotations.find((r) => r.is_baseline) ?? site.rotations[0];
  const ref = [...rowsFor(results, baseline.id, 'medium')].sort(
    (a, b) => a.pre_sowing_precip_mm - b.pre_sowing_precip_mm || a.start_year - b.start_year,
  );
  const n = ref.length;
  const tercileOf = new Map<number, Tercile>();
  ref.forEach((r, i) => tercileOf.set(r.start_year, i < Math.round(n / 3) ? 'dry' : i < Math.round((2 * n) / 3) ? 'normal' : 'wet'));

  const cells: FlipCell[] = [];
  for (const depth of site.depth_classes) {
    for (const tercile of ['dry', 'normal', 'wet'] as const) {
      let best: FlipCell | null = null;
      for (const rot of site.rotations) {
        const nets = rowsFor(results, rot.id, depth.id)
          .filter((r) => tercileOf.get(r.start_year) === tercile)
          .map((r) => sequenceMoney(r, rot, inp).net_2yr_tl_per_da);
        const med = percentile(nets, 50);
        if (best === null || med > best.median_net) {
          best = { depth_id: depth.id, tercile, rotation_id: rot.id, median_net: med, n_years: nets.length };
        }
      }
      if (best) cells.push(best);
    }
  }
  return cells;
}

export interface Priorities { water: number; income: number; soil: number }
export interface RankedRotation {
  rotation_id: string;
  score: number;
  driver: 'water' | 'income' | 'soil';
  parts: { water: number; income: number; soil: number };
}

/** Min–max scale to 0–1 across rotations (higher = better). Ties on the main metric fall back to the tie-break metric. */
function scale(main: number[], tie: number[], higherIsBetter: boolean, tieHigherIsBetter: boolean): number[] {
  const mm = (xs: number[], hib: boolean): number[] | null => {
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    if (!(hi > lo)) return null;
    return xs.map((x) => (hib ? (x - lo) / (hi - lo) : (hi - x) / (hi - lo)));
  };
  return mm(main, higherIsBetter) ?? mm(tie, tieHigherIsBetter) ?? main.map(() => 1);
}

/** Weighted sum of scaled metrics (PLAN_MVP §5.9); sorted high to low. Wording in UI: "Ranking under your priorities". */
export function rankByPriority(s: RotationSummary[], pr: Priorities): RankedRotation[] {
  const total = pr.water + pr.income + pr.soil;
  const wt = total > 0
    ? { water: pr.water / total, income: pr.income / total, soil: pr.soil / total }
    : { water: 1 / 3, income: 1 / 3, soil: 1 / 3 };
  const water = scale(s.map((x) => x.water_at_wheat_sowing_mm.p50), s.map((x) => x.wheat_stress_days_p50), true, false);
  const income = scale(s.map((x) => x.net_2yr.p50), s.map((x) => x.loss_probability), true, false);
  const soil = scale(s.map((x) => x.wind_exposed_bare_days_p50), s.map((x) => x.bare_days_p50), false, false);
  return s
    .map((x, i) => {
      const parts = { water: water[i], income: income[i], soil: soil[i] };
      const contrib = { water: wt.water * parts.water, income: wt.income * parts.income, soil: wt.soil * parts.soil };
      const driver = (Object.keys(contrib) as (keyof typeof contrib)[]).reduce((a, b) => (contrib[b] > contrib[a] ? b : a));
      return { rotation_id: x.rotation_id, score: contrib.water + contrib.income + contrib.soil, driver, parts };
    })
    .sort((a, b) => b.score - a.score);
}
