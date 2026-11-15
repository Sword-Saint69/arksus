// "Nasıl ekilir" module — docs/GUBRE.md §9. Owner: Gümüş (Rol B).
// Every number comes from sowing.json (engine/config/sowing.yaml); a crop differs only by its YAML entry.
// Seed rate (TİGEM Bölüm 4): kg/da = seeds per m² × thousand-kernel weight (g) × 10 ÷ (purity % × germination %).
// The seeds-per-m² point inside the source's range follows TİGEM's own rule: good seedbed and on time → low end,
// late or poor seedbed → high end, otherwise the middle. Output: dates, seeds, kg/da, depth, rows, advice. No money.

import type { Advice, R, SowCropId, SowExtra, SowRow, SowType, SowingFile, Sourced, Text, V, WaterRegime } from './types';
import { matches } from './fertilizer';

export type Seedbed = 'good' | 'normal' | 'poor';
export type SoilMoisture = 'moist' | 'dry';
export type Drill = 'separate_band' | 'same_band' | 'broadcast';

export interface SowRequest {
  crop: SowCropId;
  typeId?: string;                 // default: the crop's first type
  water: WaterRegime;
  locationId?: string;             // for the district notes and the lentil row-spacing rule
  late?: boolean;                  // sowing after the window
  seedbed?: Seedbed;               // default 'normal'
  soil?: SoilMoisture;             // topsoil at sowing
  drill?: Drill;                   // default 'same_band' (the common drill in the region, TİGEM)
  tkw_g?: number;                  // thousand-kernel weight, g (seed label or 4 × 100 seeds × 10)
  purity_pct?: number;             // purity, % (seed label)
  germination_pct?: number;        // germination, % (seed label or home test)
}

export type SeedRule = 'low' | 'mid' | 'high';
export type CalcInput = 'tkw_g' | 'purity_pct' | 'germination_pct';
export interface WindowNote { id: 'nearest_window' | 'cold_district'; text: Text; type: Sourced['type']; verified: boolean; source: string }

export interface SowPlan {
  crop: SowCropId;
  type: SowType;
  window: { from: string; to: string; source: Sourced } | null;   // MM-DD
  window_text: Text | null;
  window_notes: WindowNote[];
  seeds: { range: R; chosen: number; rule: SeedRule } | null;    // viable seeds per m²
  plants: R | null;                                              // target plants per m² (chickpea)
  guide: { range: R; extras: SowExtra[]; min: number; max: number } | null;  // source kg/da + extras that apply
  calc: { per_m2: number; kg_per_da: number } | null;            // from the formula and the farmer's seed values
  calc_missing: CalcInput[];
  depth: R;
  rows: SowRow[];
  annual_precip: (V & { station?: string }) | null;
  advice: Advice[];
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

/** TİGEM formula. purity and germination in %. */
export function seedKgPerDa(perM2: number, tkwG: number, purityPct: number, germinationPct: number): number {
  if (!(perM2 > 0 && tkwG > 0 && purityPct > 0 && germinationPct > 0)) throw new Error('seed formula needs positive inputs');
  return (perM2 * tkwG * 10) / (purityPct * germinationPct);
}

/** TİGEM: good seedbed and on time → low end; late or poor seedbed → high end; otherwise the middle. */
export function seedRule(late: boolean, seedbed: Seedbed): SeedRule {
  if (late || seedbed === 'poor') return 'high';
  if (seedbed === 'good') return 'low';
  return 'mid';
}
const pickInRange = (r: R, rule: SeedRule) => (rule === 'low' ? r.min : rule === 'high' ? r.max : (r.min + r.max) / 2);
const sourcedOf = (s: Sourced): Sourced => ({ source: s.source, source_url: s.source_url, type: s.type, verified: s.verified });

export function sowingPlan(f: SowingFile, req: SowRequest): SowPlan {
  const crop = f.crops[req.crop];
  if (!crop) throw new Error(`unknown crop ${req.crop}`);
  const type = crop.types.find((t) => t.id === req.typeId) ?? crop.types[0];
  const late = req.late ?? false;
  const seedbed = req.seedbed ?? 'normal';
  const drill = req.drill ?? 'same_band';
  const precip = req.locationId ? f.annual_precip_mm[req.locationId] ?? null : null;
  const ctx = {
    crop: req.crop, type: type.id, season: type.season, water: req.water, late, seedbed, soil: req.soil, drill,
    annual_precip_mm: typeof precip?.value === 'number' ? precip.value : undefined, flags: [],
  };

  const w = type.window?.[req.water] ?? null;
  const notes: WindowNote[] = [];
  if (req.locationId && w && f.nearest_window_note.districts.includes(req.locationId)) {
    const n = f.nearest_window_note;
    notes.push({ id: 'nearest_window', text: n.text, type: n.type, verified: n.verified, source: n.source });
  }
  if (req.locationId && type.season === 'autumn' && f.cold_districts.ids.includes(req.locationId)) {
    const c = f.cold_districts;
    notes.push({ id: 'cold_district', text: c.text, type: c.type, verified: c.verified, source: c.source });
  }

  const rule = seedRule(late, seedbed);
  const seeds = type.seeds_per_m2 ? { range: type.seeds_per_m2, chosen: pickInRange(type.seeds_per_m2, rule), rule } : null;
  const plants = type.plants_per_m2 ?? null;

  let guide: SowPlan['guide'] = null;
  if (type.guide_kg_per_da) {
    const extras = (crop.extra_kg_per_da ?? []).filter((e) => matches(e.when, ctx));
    const addMin = extras.reduce((s, e) => s + e.min, 0);
    const addMax = extras.reduce((s, e) => s + e.max, 0);
    guide = { range: type.guide_kg_per_da, extras, min: type.guide_kg_per_da.min + addMin, max: type.guide_kg_per_da.max + addMax };
  }

  const perM2 = seeds?.chosen ?? plants?.min ?? null;
  const missing: CalcInput[] = (['tkw_g', 'purity_pct', 'germination_pct'] as CalcInput[]).filter((k) => !(Number(req[k]) > 0));
  const calc = perM2 !== null && missing.length === 0
    ? { per_m2: perM2, kg_per_da: r1(seedKgPerDa(perM2, req.tkw_g!, req.purity_pct!, req.germination_pct!)) }
    : null;

  return {
    crop: req.crop, type,
    window: w ? { from: w.from, to: w.to, source: sourcedOf(w) } : null,
    window_text: type.window_text ?? null,
    window_notes: notes,
    seeds, plants, guide,
    calc, calc_missing: perM2 === null ? [] : missing,
    depth: type.depth_cm,
    rows: crop.rows.filter((r) => matches(r.when, ctx)),
    annual_precip: precip,
    advice: crop.advice.filter((a) => matches(a.when, ctx)),
  };
}

/** Is `today` before, inside or after the window (dates are MM-DD of the coming season)? */
export function windowStatus(from: string, to: string, today: Date): 'before' | 'open' | 'after' {
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (md < from) return 'before';
  if (md > to) return 'after';
  return 'open';
}
