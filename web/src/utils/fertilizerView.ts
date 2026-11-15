import type { Badge, FertCropId, FertilizerFile, SiteIndex, Timing, WaterRegime } from '@/lib/types';
import type { DoseLine, FertPlan, SoilKey, SoilPrefill, SoilTest } from '@/lib/fertilizer';

// Display helpers for the fertilizer card. All arithmetic stays in lib/fertilizer.ts;
// here we only group, label and multiply by the field's own area.

/** Crops of a rotation that get fertilizer, in sowing order (fallow gets none). */
export function cropsForRotation(site: SiteIndex, rotationId: string | null | undefined): FertCropId[] {
  const rot = site.rotations.find((r) => r.id === rotationId);
  const crops = (rot?.crops ?? ['wheat']).filter((c) => c !== 'fallow') as FertCropId[];
  return crops.length ? crops : ['wheat'];
}

/** The soil the plan uses: the farmer's own values win; SoilGrids fills the rest. */
export function mergeSoil(pre: SoilPrefill, own: SoilTest | undefined): { soil: SoilTest; badges: Partial<Record<SoilKey, Badge>> } {
  const soil: SoilTest = { ...pre.soil };
  const badges: Partial<Record<SoilKey, Badge>> = { ...pre.badges };
  for (const [k, v] of Object.entries(own ?? {}) as [SoilKey, number | undefined][]) {
    if (typeof v === 'number' && isFinite(v)) { soil[k] = v; badges[k] = 'user'; }
  }
  return { soil, badges };
}

export type TimingGroup = { timing: Timing; label: { en: string; tr: string } | null; doses: DoseLine[] };

/** Doses grouped by when they go on the field. Top-dressing labels come from the crop's n_split. */
export function groupByTiming(f: FertilizerFile, plan: FertPlan): TimingGroup[] {
  const split = f.crops[plan.crop].n_split[plan.water as WaterRegime] ?? [];
  const out: TimingGroup[] = [];
  for (const d of plan.doses) {
    let g = out.find((x) => x.timing === d.timing);
    if (!g) {
      const part = d.timing === 'base' ? null : split.find((s) => s.timing === d.timing);
      g = { timing: d.timing, label: part ? part.label : null, doses: [] };
      out.push(g);
    }
    g.doses.push(d);
  }
  return out;
}

/** kg for the whole field (1 dönüm = 1 dekar); null when the field has no area. */
export const fieldTotal = (kgPerDa: number, areaDonum: number | null): number | null =>
  areaDonum !== null && areaDonum > 0 ? kgPerDa * areaDonum : null;

/** "1,5" or "1.5" → 1.5; empty or invalid → undefined. */
export function parseNum(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  if (s === '') return undefined;
  const n = Number(s);
  return isFinite(n) && n >= 0 ? n : undefined;
}
