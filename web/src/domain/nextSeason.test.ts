import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DefaultsFile, ResultsFile, SiteIndex } from '@/lib/types';
import { buildVerdict } from './verdict';
import { nextSeason } from './nextSeason';

const read = <T>(rel: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/data', rel), 'utf-8')) as T;
const site = read<SiteIndex>('site_index.json');
const defaults = read<DefaultsFile>('defaults.json');

describe('next season', () => {
  for (const id of ['nigde', 'karapinar', 'eskisehir']) {
    const v = buildVerdict(site, defaults, read<ResultsFile>(`results/${id}.json`), 'medium');
    it(`${id}: after a cereal, the coming crop is the suggested first-year crop`, () => {
      const n = nextSeason('choose_first_year', v, 2026)!;
      expect(n.crop).toBe(v.recommended!.rotation.crops[0]);
      expect(n.then).toBe('wheat');
      expect(n.harvestYear).toBe(2027);
      expect(n.alternatives.map((a) => a.crop)).not.toContain(n.crop);
      // only options that pass the guardrails are offered
      for (const a of n.alternatives) expect(v.blocked.some((b) => b.rotation.id === a.rotationId)).toBe(false);
    });
    it(`${id}: after fallow, wheat comes first and the choice follows`, () => {
      const n = nextSeason('wheat_after_fallow', v, 2026)!;
      expect(n.crop).toBe('wheat');
      expect(n.wheatNow).toBe(true);
      expect(n.then).toBe(v.recommended!.rotation.crops[0]);
    });
  }
});
