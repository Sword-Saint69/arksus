// Numbers behind the two result charts: the field calendar (Chart C) and the
// wheat yield of each of the 24 past climates (Chart A). Pure functions over
// results/{id}.json so they can be tested without a page.

import type { DepthId, ResultsFile, RotationId, SiteIndex } from '@/lib/types';
import { percentile } from '@/lib/economics';

/** Days in each month of the 24-month window, index 0 = July of the start year (February as 28, as the engine counts). */
export const MONTH_DAYS = [31, 31, 30, 31, 30, 31, 31, 28, 31, 30, 31, 30];
const daysIn = (m: number) => MONTH_DAYS[m % 12];

export interface CalendarRow { rotationId: RotationId; bare: number[]; stress: number[] }

/** Median share (0–1) of each month the field lies bare, and the share wheat is short of water, across the years. */
export function fieldCalendar(site: SiteIndex, results: ResultsFile, depth: DepthId): CalendarRow[] {
  return site.rotations.map((rot) => {
    const rows = results.sequences.filter((s) => s.rotation_id === rot.id && s.depth_id === depth);
    const share = (pick: (m: number) => number[]) => Array.from({ length: 24 }, (_, m) => {
      const v = percentile(pick(m), 50);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v / daysIn(m))) : 0;
    });
    return {
      rotationId: rot.id,
      bare: share((m) => rows.map((r) => r.bare_by_month[m])),
      stress: share((m) => rows.map((r) => r.stress_by_month[m])),
    };
  });
}

export interface YearRow { rotationId: RotationId; years: { year: number; ratio: number }[]; p10: number; p50: number; p90: number }

/** Wheat yield ratio for every start year, per rotation, with its P10/P50/P90. */
export function wheatByYear(site: SiteIndex, results: ResultsFile, depth: DepthId): YearRow[] {
  return site.rotations.map((rot) => {
    const years = results.sequences
      .filter((s) => s.rotation_id === rot.id && s.depth_id === depth)
      .map((s) => ({ year: s.start_year, ratio: s.wheat.yield_ratio }))
      .sort((a, b) => a.year - b.year);
    const r = years.map((y) => y.ratio);
    return { rotationId: rot.id, years, p10: percentile(r, 10), p50: percentile(r, 50), p90: percentile(r, 90) };
  });
}
