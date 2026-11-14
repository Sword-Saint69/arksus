// Mock/real JSON in web/public/data must fit types.ts. Owner: Gümüş (Rol B).
// Runtime shape checks (vitest) + compile-time assignment (tsc). Schema check itself lives in engine/tests/test_contract.py.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteIndex, ResultsFile, LedgerFile, SmapFile, DefaultsFile, ValidationFile } from './types';
import { inputsFromDefaults, summarize, flipTable, rankByPriority } from './economics';

const DATA = resolve(__dirname, '../../public/data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(DATA, rel), 'utf-8')) as T;

const site = read<SiteIndex>('site_index.json');
const defaults = read<DefaultsFile>('defaults.json');
const validation = read<ValidationFile>('validation.json');

describe('contract', () => {
  it('site_index has baseline first and fixed ids', () => {
    expect(site.schema_version).toBe('1.0');
    expect(site.rotations[0].is_baseline).toBe(true);
    expect(site.rotations.map((r) => r.id)).toEqual(['fallow_wheat', 'chickpea_wheat', 'lentil_wheat']);
    expect(site.depth_classes.map((d) => d.id)).toEqual(['shallow', 'medium', 'deep']);
    expect(site.start_years).toEqual([2001, 2024]);
  });

  it('validation has the five checks in order', () => {
    expect(validation.checks.map((c) => c.id)).toEqual(
      ['mass_balance', 'et0_fao56_ex18', 'pse_literature', 'trial_ratio', 'precip_vs_mgm']);
  });

  for (const loc of ['karapinar', 'develi'] as const) {
    it(`${loc}: results, ledger, smap fit the types and economics runs`, () => {
      const results = read<ResultsFile>(`results/${loc}.json`);
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

      const inp = inputsFromDefaults(defaults, loc);
      const summary = summarize(results, site, 'medium', inp);
      expect(summary).toHaveLength(3);
      expect(summary[0].nets).toHaveLength(24);
      expect(flipTable(results, site, inp)).toHaveLength(9);
      expect(rankByPriority(summary, { water: 34, income: 33, soil: 33 })).toHaveLength(3);
    });
  }
});
