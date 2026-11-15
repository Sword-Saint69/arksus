import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FertilizerFile, SiteIndex } from '@/lib/types';
import { recommend } from '@/lib/fertilizer';
import { cropsForRotation, fieldTotal, groupByTiming, mergeSoil, parseNum } from './fertilizerView';

const read = <T>(f: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', f), 'utf-8')) as T;
const F = read<FertilizerFile>('fertilizer.json');
const site = read<SiteIndex>('site_index.json');

describe('fertilizer view helpers', () => {
  it('rotation crops without fallow', () => {
    expect(cropsForRotation(site, 'fallow_wheat')).toEqual(['wheat']);
    expect(cropsForRotation(site, 'chickpea_wheat')).toEqual(['chickpea', 'wheat']);
    expect(cropsForRotation(site, null)).toEqual(['wheat']);
  });
  it("the farmer's own values win and get the 'user' badge", () => {
    const pre = { soil: { ph: 7.8, om_pct: 2.2 }, badges: { ph: 'model', om_pct: 'model' } as const, needs_lab: [] };
    const m = mergeSoil(pre, { om_pct: 1.5, p2o5_kg_per_da: 3.5 });
    expect(m.soil).toEqual({ ph: 7.8, om_pct: 1.5, p2o5_kg_per_da: 3.5 });
    expect(m.badges).toEqual({ ph: 'model', om_pct: 'user', p2o5_kg_per_da: 'user' });
  });
  it('groups doses by timing with the crop labels (wheat irrigated: base, tillering, stem elongation)', () => {
    const plan = recommend(F, { crop: 'wheat', water: 'irrigated', soil: { om_pct: 1.5, p2o5_kg_per_da: 3.5, k2o_kg_per_da: 22, zn_ppm: 0.9 } });
    const g = groupByTiming(F, plan);
    expect(g.map((x) => x.timing)).toEqual(['base', 'top_1', 'top_2']);
    expect(g[0].label).toBeNull();
    expect(g[1].label?.tr).toBe('Kardeşlenme');
    expect(g[0].doses.map((d) => d.product)).toEqual(['dap', 'potassium_sulfate']);
  });
  it('field totals and number parsing', () => {
    expect(fieldTotal(7.7, 30)).toBeCloseTo(231, 9);
    expect(fieldTotal(7.7, null)).toBeNull();
    expect(parseNum('1,5')).toBe(1.5);
    expect(parseNum(' ')).toBeUndefined();
    expect(parseNum('abc')).toBeUndefined();
    expect(parseNum('-2')).toBeUndefined();
  });
});
