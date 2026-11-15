import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LedgerFile, LedgerSeries, ResultsFile, SiteIndex } from '@/lib/types';
import { growthCurve, medianFullness, medianYear, rootZoneCapacityMm, simSeries, weekView, WEEKS } from './sim';

const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', rel), 'utf-8')) as T;
const site = read<SiteIndex>('site_index.json');
const results = read<ResultsFile>('results/nigde.json');
const ledger = read<LedgerFile>('ledger/nigde.json');

const fake = (crops: LedgerSeries['weeks'][number]['crop'][]): LedgerSeries => ({
  start_year: 2001, rotation_id: 'fallow_wheat', depth_id: 'medium',
  weeks: crops.map((crop, i) => ({ week_start: `2001-07-${String(i + 1).padStart(2, '0')}`, p_mm: 1, eta_mm: 1, dp_mm: 0, aw_mm: 10 * i, crop })),
});

describe('two-year field view', () => {
  it('the median year is one of the climate years', () => {
    const y = medianYear(results, 'medium');
    expect(y).toBeGreaterThanOrEqual(site.start_years[0]);
    expect(y).toBeLessThanOrEqual(site.start_years[1]);
    // half of the years have a lower or equal fallow → wheat yield
    const rows = results.sequences.filter((s) => s.rotation_id === 'fallow_wheat' && s.depth_id === 'medium');
    const mine = rows.find((r) => r.start_year === y)!.wheat.yield_ratio;
    expect(rows.filter((r) => r.wheat.yield_ratio <= mine).length).toBe(12);
  });

  it('capacity is available water × depth', () => {
    expect(rootZoneCapacityMm(site, results, 'medium')).toBeCloseTo(135.2 * 0.9, 6);
    expect(rootZoneCapacityMm(site, { ...results, soil: { ...results.soil, awc_mm_per_m: { ...results.soil.awc_mm_per_m, value: null } } }, 'medium')).toBeNull();
  });

  it('growth rises through a crop run, then stubble, and bare fallow stays at 0', () => {
    const g = growthCurve(fake(['wheat', 'wheat', 'bare', 'fallow', 'fallow', 'wheat', 'wheat', 'wheat', 'wheat', 'bare', 'bare']));
    expect(g.slice(0, 2)).toEqual([1, 1]);          // standing wheat at the start is ripe
    expect(g[2]).toBe(-1);                          // its stubble
    expect(g.slice(3, 5)).toEqual([0, 0]);          // tilled fallow
    expect(g[5]).toBeGreaterThan(0);
    expect(g[5]).toBeLessThan(g[6]);
    expect(g[8]).toBe(1);
    expect(g.slice(9)).toEqual([-1, -1]);
  });

  it('a week view carries the ledger numbers and a 0–1 store', () => {
    const s = fake(['fallow', 'wheat', 'wheat', 'bare']);
    const g = growthCurve(s);
    const v = weekView(s, g, 100, 2);
    expect(v.crop).toBe('wheat');
    expect(v.height).toBe(1);
    expect(v.fullness).toBeCloseTo(0.2, 9);
    expect(v.awMm).toBe(20);
    expect(v.rainMm).toBe(1);
    expect(weekView(s, g, 100, 0).height).toBe(0);
    expect(weekView(s, g, 100, 3).height).toBeGreaterThan(0);   // stubble
    expect(weekView(s, g, null, 2).fullness).toBeNull();
    expect(weekView(s, g, 15, 3).fullness).toBe(1);             // never above full
  });

  it('real ledger: three series of 104 weeks for the median year', () => {
    const series = simSeries(site, ledger, 'medium', medianYear(results, 'medium'));
    expect(series.map((s) => s.rotationId)).toEqual(['fallow_wheat', 'chickpea_wheat', 'lentil_wheat']);
    const cap = rootZoneCapacityMm(site, results, 'medium');
    for (const s of series) {
      expect(s.series.weeks).toHaveLength(WEEKS);
      expect(s.growth).toHaveLength(WEEKS);
      for (let w = 0; w < WEEKS; w++) {
        const v = weekView(s.series, s.growth, cap, w);
        expect(v.height).toBeGreaterThanOrEqual(0);
        expect(v.height).toBeLessThanOrEqual(1);
        expect(v.fullness!).toBeGreaterThanOrEqual(0);
        expect(v.fullness!).toBeLessThanOrEqual(1);
      }
    }
    // the legume strips grow a first-year crop; the fallow strip does not
    const firstYearCrops = (i: number) => new Set(series[i].series.weeks.slice(8, 52).map((w) => w.crop));
    expect(firstYearCrops(0).has('chickpea')).toBe(false);
    expect(firstYearCrops(1).has('chickpea')).toBe(true);
    expect(firstYearCrops(2).has('lentil')).toBe(true);
  });

  it('median fullness: 24 months per rotation, within 0–100', () => {
    const m = medianFullness(site, results, 'medium');
    expect(m).toHaveLength(3);
    for (const r of m) {
      expect(r.values).toHaveLength(24);
      for (const v of r.values) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    }
  });
});
