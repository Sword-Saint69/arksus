// The two-year view of the field. Everything that moves comes from the engine's
// weekly water ledger (ledger/{id}.json): the water store is aw_mm over the root
// zone's capacity, rain is p_mm, and a crop shows only in the weeks the ledger
// has it in the field. Plant heights and colours are illustrative (the engine
// models water, not canopy size) and the page says so.

import type { DepthId, LedgerCrop, LedgerFile, LedgerSeries, ResultsFile, RotationId, SiteIndex } from '@/lib/types';
import { percentile } from '@/lib/economics';

export const ROTATION_COLOR: Record<RotationId, string> = {
  fallow_wheat: '#94541f',
  chickpea_wheat: '#b8860b',
  lentil_wheat: '#127fa8',
};
/** Lighter versions for use on the dark satellite map. */
export const ROTATION_COLOR_ON_MAP: Record<RotationId, string> = {
  fallow_wheat: '#e09a55',
  chickpea_wheat: '#f2c14e',
  lentil_wheat: '#4fb6dd',
};

export const WEEKS = 104;

/** The start year whose fallow → wheat yield is the median one: a typical year, not a good or a bad one. */
export function medianYear(results: ResultsFile, depth: DepthId): number {
  const rows = results.sequences
    .filter((s) => s.rotation_id === 'fallow_wheat' && s.depth_id === depth)
    .sort((a, b) => a.wheat.yield_ratio - b.wheat.yield_ratio || a.start_year - b.start_year);
  return rows[Math.floor((rows.length - 1) / 2)]?.start_year ?? results.sequences[0].start_year;
}

/** Root-zone capacity the engine works with: available water (mm/m) × depth class (m). Null when not sourced. */
export function rootZoneCapacityMm(site: SiteIndex, results: ResultsFile, depth: DepthId): number | null {
  const awc = results.soil.awc_mm_per_m.value;
  const d = site.depth_classes.find((c) => c.id === depth)?.depth_m;
  return awc !== null && d ? awc * d : null;
}

const isCrop = (c: LedgerCrop) => c === 'wheat' || c === 'chickpea' || c === 'lentil';

/**
 * Growth per week: rises from 0 to 1 across each run of weeks a crop is in the
 * field, −1 for the stubble left after it, 0 for bare or tilled soil.
 */
export function growthCurve(series: LedgerSeries): number[] {
  const w = series.weeks;
  const out = new Array<number>(w.length).fill(0);
  let i = 0;
  while (i < w.length) {
    const crop = w[i].crop;
    let j = i;
    while (j < w.length && w[j].crop === crop) j++;
    if (isCrop(crop)) {
      const len = j - i;
      // A run that starts in week 0 is the previous wheat still standing in July: show it ripe.
      for (let k = i; k < j; k++) out[k] = i === 0 ? 1 : Math.min(1, ((k - i + 1) / len) ** 0.8);
      for (let k = j; k < w.length && w[k].crop === 'bare'; k++) out[k] = -1;
    }
    i = j;
  }
  return out;
}

/** Illustrative canopy heights relative to ripe wheat. */
const HEIGHT: Record<LedgerCrop, number> = { wheat: 1, chickpea: 0.52, lentil: 0.4, fallow: 0, bare: 0 };
const STUBBLE_HEIGHT = 0.08;

const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t)))).join(' ')})`;
const GREEN: [number, number, number] = [104, 168, 62];
const GOLD: [number, number, number] = [226, 180, 62];
const LEGUME: [number, number, number] = [72, 148, 70];

export interface WeekView {
  crop: LedgerCrop;
  /** 0–1 share of ripe-wheat height. */
  height: number;
  color: string;
  /** 0–1 share of the root-zone store that is full; null when the capacity is unknown. */
  fullness: number | null;
  awMm: number;
  rainMm: number;
}

export function weekView(series: LedgerSeries, growth: number[], capacityMm: number | null, week: number): WeekView {
  const k = Math.min(series.weeks.length - 1, Math.max(0, Math.floor(week)));
  const w = series.weeks[k];
  const g = growth[k];
  let height = 0, color = w.crop === 'fallow' ? 'rgb(96 68 46)' : 'rgb(134 100 68)';
  if (g > 0) {
    height = HEIGHT[w.crop] * g;
    // Wheat turns from green to gold over the last third of its season.
    color = w.crop === 'wheat' ? mix(GREEN, GOLD, (g - 0.65) / 0.35) : mix(LEGUME, LEGUME, 0);
  } else if (g === -1) {
    height = STUBBLE_HEIGHT;
    color = 'rgb(204 178 122)';
  }
  return {
    crop: w.crop, height, color,
    fullness: capacityMm ? Math.min(1, Math.max(0, w.aw_mm / capacityMm)) : null,
    awMm: w.aw_mm, rainMm: w.p_mm,
  };
}

export interface SimSeries { rotationId: RotationId; series: LedgerSeries; growth: number[] }

/** The three ledger series (one per rotation) of one start year and depth. */
export function simSeries(site: SiteIndex, ledger: LedgerFile, depth: DepthId, year: number): SimSeries[] {
  const out: SimSeries[] = [];
  for (const rot of site.rotations) {
    const series = ledger.series.find((s) => s.rotation_id === rot.id && s.depth_id === depth && s.start_year === year);
    if (series) out.push({ rotationId: rot.id, series, growth: growthCurve(series) });
  }
  return out;
}

/** Median over the climate years of the month-end soil-water fullness (0–100), per rotation: 24 values each. */
export function medianFullness(site: SiteIndex, results: ResultsFile, depth: DepthId): { rotationId: RotationId; values: number[] }[] {
  return site.rotations.map((rot) => {
    const rows = results.sequences.filter((s) => s.rotation_id === rot.id && s.depth_id === depth);
    const values = Array.from({ length: 24 }, (_, m) => percentile(rows.map((r) => r.fullness_by_month[m]), 50));
    return { rotationId: rot.id, values };
  });
}
