// Unit tests for the soil-health module (soilhealth.ts) — docs/GUBRE.md §10. Owner: Gümüş (Rol B).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResultsFile, SiteIndex, SoilHealthFile } from './types';
import { summarize } from './economics';
import { modelFacts, omClass, soilHealthPlan } from './soilhealth';

const read = <T>(f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', f), 'utf-8')) as T;
const F = read<SoilHealthFile>('soil_health.json');
const site = read<SiteIndex>('site_index.json');
const ids = (p: { practices: { id: string }[] }) => p.practices.map((x) => x.id);

describe('organic matter classes (Başar 2001)', () => {
  it('bounds are inclusive upper limits', () => {
    expect(omClass(F, 0.8).tr).toBe('çok az');
    expect(omClass(F, 1.0).tr).toBe('çok az');
    expect(omClass(F, 1.5).tr).toBe('az');
    expect(omClass(F, 2.21).tr).toBe('orta');
    expect(omClass(F, 5).tr).toBe('yüksek');
  });
});

describe('which practices apply', () => {
  it('shallow soil: the shallow-fallow note, not the deep one; stubble first, support last', () => {
    const p = soilHealthPlan(F, { depth: 'shallow', depth_known: true, location_id: 'develi', om_pct: 2.21 });
    expect(ids(p)).toContain('fallow_shallow');
    expect(ids(p)).not.toContain('fallow_deep');
    expect(ids(p)[0]).toBe('stubble');
    expect(ids(p).at(-1)).toBe('support');
    expect(ids(p)).not.toContain('organic_matter');   // 2.21 % is not below 2
    expect(p.om?.label.tr).toBe('orta');
  });
  it('Karapınar gets the wind-erosion practice; low organic matter adds the OM practice', () => {
    const p = soilHealthPlan(F, { depth: 'medium', depth_known: true, location_id: 'karapinar', om_pct: 1.4 });
    expect(ids(p)).toEqual(expect.arrayContaining(['fallow_deep', 'organic_matter', 'wind_erosion']));
  });
  it('salinity only with a lab EC of 4 dS/m or more; no OM value → no OM class', () => {
    expect(ids(soilHealthPlan(F, { depth: 'deep', depth_known: true, ec_ds_m: 5 }))).toContain('salinity');
    const p = soilHealthPlan(F, { depth: 'deep', depth_known: true, ec_ds_m: 2 });
    expect(ids(p)).not.toContain('salinity');
    expect(p.om).toBeNull();
  });
});

describe("the engine's numbers for the field", () => {
  const results = read<ResultsFile>('results/karapinar.json');
  const facts = modelFacts(summarize(results, site, 'medium'), 0.85);
  it('baseline first at 1; legumes as a ratio of wheat after fallow, checked against the 85 % guardrail', () => {
    const base = facts.find((x) => x.is_baseline)!;
    expect(base).toMatchObject({ rotation_id: 'fallow_wheat', wheat_vs_fallow: 1, passes_guardrail: null });
    for (const x of facts.filter((y) => !y.is_baseline)) {
      expect(x.wheat_vs_fallow).toBeGreaterThan(0);
      expect(x.passes_guardrail).toBe(x.wheat_vs_fallow! >= 0.85);
    }
  });
  it('a legume year leaves the field bare fewer days than fallow', () => {
    const base = facts.find((x) => x.is_baseline)!;
    for (const x of facts.filter((y) => !y.is_baseline)) expect(x.bare_days).toBeLessThan(base.bare_days);
  });
});
