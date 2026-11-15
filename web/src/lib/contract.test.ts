// Mock/real JSON in web/public/data must fit types.ts. Owner: Gümüş (Rol B).
// Runtime shape checks (vitest) + compile-time assignment (tsc). Schema check itself lives in engine/tests/test_contract.py.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteIndex, ResultsFile, LedgerFile, SmapFile, DefaultsFile, ValidationFile, FertilizerFile, FertCropId, WaterRegime } from './types';
import { inputsFromDefaults, summarize, flipTable, decide } from './economics';
import { recommend, soilFromResults } from './fertilizer';

const DATA = resolve(__dirname, '../../public/data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(DATA, rel), 'utf-8')) as T;

const site = read<SiteIndex>('site_index.json');
const defaults = read<DefaultsFile>('defaults.json');
const validation = read<ValidationFile>('validation.json');
const fertilizer = read<FertilizerFile>('fertilizer.json');

describe('contract', () => {
  it('site_index has baseline first and fixed ids', () => {
    expect(site.schema_version).toBe('1.0');
    expect(site.rotations[0].is_baseline).toBe(true);
    expect(site.rotations.map((r) => r.id)).toEqual(['fallow_wheat', 'chickpea_wheat', 'lentil_wheat']);
    expect(site.depth_classes.map((d) => d.id)).toEqual(['shallow', 'medium', 'deep']);
    expect(site.start_years).toEqual([2001, 2024]);
    expect(site.scenarios[0].id).toBe('baseline');
  });

  it('validation has the six checks in order', () => {
    expect(validation.checks.map((c) => c.id)).toEqual(
      ['mass_balance', 'et0_fao56_ex18', 'pse_literature', 'trial_ratio', 'precip_vs_mgm', 'smap_anomaly']);
  });

  it('locations are a non-empty list with unique ids; defaults hold the four crops', () => {
    const ids = site.locations.map((l) => l.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(defaults.crops).sort()).toEqual(['chickpea', 'fallow', 'lentil', 'wheat']);
  });

  for (const loc of site.locations.map((l) => l.id)) {
    it(`${loc}: results, ledger, smap fit the types and economics runs`, () => {
      const results = read<ResultsFile>(`results/${loc}.json`);
      expect(results.scenario_id).toBe('baseline');
      for (const sc of site.scenarios.slice(1)) {
        const sr = read<ResultsFile>(`results/${loc}__${sc.id}.json`);
        expect(sr.scenario_id).toBe(sc.id);
        expect(sr.sequences).toHaveLength(216);
      }
      const ledger = read<LedgerFile>(`ledger/${loc}.json`);
      const smap = read<SmapFile>(`smap/${loc}.json`);
      expect(results.sequences).toHaveLength(216);
      expect(ledger.series).toHaveLength(216);
      for (const s of results.sequences) {
        expect(s.bare_by_month).toHaveLength(24);
        expect(s.stress_by_month).toHaveLength(24);
        expect(s.fullness_by_month).toHaveLength(24);
        expect(typeof s.wheat.yield_ratio).toBe('number');
      }
      if (!smap.available) expect(smap.latest).toBeNull();

      const inp = inputsFromDefaults(defaults);
      const summary = summarize(results, site, 'medium');
      expect(summary).toHaveLength(3);
      const d = decide(results, site, 'medium', inp);
      expect(d.ranking).toHaveLength(3);
      if (d.recommended) expect(d.ranking.find((r) => r.rotation_id === d.recommended)!.eligible).toBe(true);
      expect(flipTable(results, site, inp)).toHaveLength(9);

      // fertilizer: SoilGrids prefill → a plan for every crop and water regime, never a TL amount
      const pre = soilFromResults(results, fertilizer);
      expect(pre.soil.ph).toBeTypeOf('number');
      for (const crop of Object.keys(fertilizer.crops) as FertCropId[]) {
        for (const water of ['rainfed', 'limited', 'irrigated'] as WaterRegime[]) {
          const plan = recommend(fertilizer, { crop, water, soil: pre.soil });
          expect(plan.nutrients).toHaveLength(3);
          for (const d of plan.doses) expect(d.kg_per_da).toBeGreaterThan(0);
          expect(JSON.stringify(plan)).not.toMatch(/TL|₺/);
        }
      }
    });
  }
});
