import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResultsFile, SiteIndex } from '@/lib/types';
import { fieldCalendar, wheatByYear } from './charts';

const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', rel), 'utf-8')) as T;
const site = read<SiteIndex>('site_index.json');
const results = read<ResultsFile>('results/nigde.json');
const nYears = site.start_years[1] - site.start_years[0] + 1;

describe('field calendar', () => {
  const cal = fieldCalendar(site, results, 'medium');
  it('has one row per rotation, 24 months each, shares between 0 and 1', () => {
    expect(cal.map((r) => r.rotationId)).toEqual(site.rotations.map((r) => r.id));
    for (const r of cal) for (const v of [...r.bare, ...r.stress]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(cal.every((r) => r.bare.length === 24 && r.stress.length === 24)).toBe(true);
  });
  it('fallow leaves the field bare longer than a legume in the first year', () => {
    const sum = (id: string) => cal.find((r) => r.rotationId === id)!.bare.slice(0, 12).reduce((a, b) => a + b, 0);
    expect(sum('fallow_wheat')).toBeGreaterThan(sum('chickpea_wheat'));
  });
});

describe('wheat by year', () => {
  const rows = wheatByYear(site, results, 'medium');
  it('lists every climate year once, in order, with ordered percentiles', () => {
    for (const r of rows) {
      expect(r.years).toHaveLength(nYears);
      expect(r.years[0].year).toBe(site.start_years[0]);
      expect(r.p10).toBeLessThanOrEqual(r.p50);
      expect(r.p50).toBeLessThanOrEqual(r.p90);
    }
  });
});
