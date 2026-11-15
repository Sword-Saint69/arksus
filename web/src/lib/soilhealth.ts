// Soil-health module — docs/GUBRE.md §10. Owner: Gümüş (Rol B).
// Which soil-protection practices apply to this field (rules from soil_health.json), the organic-matter class,
// and the engine's own numbers for the field (next wheat vs after fallow, bare and wind-exposed bare days) so
// the card can say "on this field the model finds…". No crop-specific code, no money.

import type { RotationSummary } from './economics';
import type { DepthId, SoilHealthFile, SoilPractice, Text, WaterRegime } from './types';
import { matches } from './fertilizer';

export interface SoilHealthContext {
  location_id?: string;
  depth: DepthId;
  depth_known: boolean;       // false when the farmer did not know and the page uses 'medium'
  water?: WaterRegime;
  om_pct?: number;            // lab value or SoilGrids estimate
  ec_ds_m?: number;           // lab value only
  practice?: string;          // what the farmer does today (domain/history practiceOf)
}

export interface RotationFact {
  rotation_id: string;
  is_baseline: boolean;
  wheat_vs_fallow: number | null;   // median next-wheat yield ratio ÷ that after fallow (1 for the baseline)
  passes_guardrail: boolean | null; // ≥ min ratio (defaults.decision.guardrails); null for the baseline
  bare_days: number;                // median bare days over the two years
  wind_days: number;                // median wind-exposed bare days
}

export interface SoilHealthPlan {
  om: { value: number; label: Text } | null;
  practices: SoilPractice[];
  model: RotationFact[];
}

/** Organic-matter class (Başar 2001): the first row whose max ≥ value. */
export function omClass(f: SoilHealthFile, om: number): Text {
  const row = f.om_classes.rows.find((r) => r.max === null || om <= r.max);
  if (!row) throw new Error('om_classes needs an open last row');
  return row.label;
}

/** The engine's numbers per rotation for the farmer's depth (from economics.summarize). */
export function modelFacts(summaries: RotationSummary[], minRatio: number): RotationFact[] {
  const base = summaries.find((s) => s.is_baseline);
  const baseWheat = base?.wheat_yield_ratio.p50 ?? 0;
  return summaries.map((s) => {
    const ratio = s.is_baseline ? 1 : baseWheat > 0 ? s.wheat_yield_ratio.p50 / baseWheat : null;
    return {
      rotation_id: s.rotation_id,
      is_baseline: s.is_baseline,
      wheat_vs_fallow: ratio,
      passes_guardrail: s.is_baseline || ratio === null ? null : ratio >= minRatio,
      bare_days: s.bare_days_p50,
      wind_days: s.wind_exposed_bare_days_p50,
    };
  });
}

export function soilHealthPlan(f: SoilHealthFile, ctx: SoilHealthContext, summaries: RotationSummary[] = [], minRatio = 0.85): SoilHealthPlan {
  const c = { ...ctx, flags: [] };
  return {
    om: ctx.om_pct !== undefined ? { value: ctx.om_pct, label: omClass(f, ctx.om_pct) } : null,
    practices: f.practices.filter((p) => matches(p.when, c)),
    model: modelFacts(summaries, minRatio),
  };
}

