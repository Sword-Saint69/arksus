// Unit tests for the decision module (economics.ts) — ARAYUZLER §9–§10. Owner: Gümüş (Rol B).
// Reference percentiles were computed with numpy.percentile (default "linear" = type 7).

import { describe, expect, it } from 'vitest';
import type { DefaultsFile, ResultsFile, Rotation, SequenceRow, SiteIndex, V } from './types';
import {
  decide, flipTable, inputsFromDefaults, percentile, range, sequenceValue, summarize,
  type DecisionInputs,
} from './economics';

// ---------- toy data ----------
// wheat ref 300 kg/da × 15 TL/kg + 300 support; chickpea 100 × 50 + 200; lentil 100 × 40 + 200; fallow support 100.
const INP: DecisionInputs = {
  crops: {
    wheat: { ref_yield_kg_per_da: 300, price_tl_per_kg: 15, support_tl_per_da: 300 },
    chickpea: { ref_yield_kg_per_da: 100, price_tl_per_kg: 50, support_tl_per_da: 200 },
    lentil: { ref_yield_kg_per_da: 100, price_tl_per_kg: 40, support_tl_per_da: 200 },
    fallow: { support_tl_per_da: 100 },
  },
  weights: { value: 0.4, yield: 0.3, soil: 0.2, water: 0.1 },
  guardrails: { min_wheat_ratio_vs_baseline: 0.85, min_first_crop_ratio: 0.3 },
  close_call_margin: 0.05,
};

const text = { en: '', tr: '' };
const pending: V = { value: null, unit: '', source: '', type: 'assumption', verified: false };
const rot = (id: Rotation['id'], first: Rotation['crops'][0], is_baseline = false): Rotation => ({
  id, is_baseline, crops: [first, 'wheat'], label: text,
  soil_traits: { n_fixing: first !== 'fallow', tillage_passes: pending, note: text },
  strategy: { why: text, evidence: [], benefits: [], gaps: [], local_review: [] },
});
const ROTATIONS = [rot('fallow_wheat', 'fallow', true), rot('chickpea_wheat', 'chickpea'), rot('lentil_wheat', 'lentil')];

const SITE = {
  schema_version: '1.0', mock: true, generated_at: '', power_range: { start: '', end: '' }, locations: [],
  rotations: ROTATIONS,
  depth_classes: (['shallow', 'medium', 'deep'] as const).map((id) => ({ id, depth_m: 1, label: text })),
  start_years: [2001, 2024],
} as SiteIndex;

function row(p: Partial<SequenceRow> & Pick<SequenceRow, 'start_year' | 'rotation_id' | 'depth_id'>, wheatRatio: number, firstRatio: number | null): SequenceRow {
  const legume = p.rotation_id === 'chickpea_wheat' ? 'chickpea' : 'lentil';
  return {
    pre_sowing_precip_mm: 0, water_at_wheat_sowing_mm: 0,
    fallow_storage_efficiency: firstRatio === null ? 0.2 : null,
    bare_days: 0, wind_exposed_bare_days: 0,
    bare_by_month: Array(24).fill(0), stress_by_month: Array(24).fill(0), fullness_by_month: Array(24).fill(50),
    first_crop: firstRatio === null ? null : { crop_id: legume, eta_mm: 0, etc_mm: 0, stress_days: 0, yield_ratio: firstRatio },
    wheat: { eta_mm: 0, etc_mm: 0, stress_days: 0, heat_days_flowering: 0, yield_ratio: wheatRatio },
    ...p,
  };
}

/** 24 years × 3 depths; year index i: precip 100 + i (dry → wet).
 *  fallow: wheat 0.8; chickpea: wheat = first = i/23 (good only in wet years); lentil: wheat 0.75, first 0.5. */
function toyResults(): ResultsFile {
  const sequences: SequenceRow[] = [];
  for (const depth of SITE.depth_classes) {
    for (let i = 0; i < 24; i++) {
      const base = { start_year: 2001 + i, depth_id: depth.id, pre_sowing_precip_mm: 100 + i };
      const r = i / 23;
      sequences.push(row({ ...base, rotation_id: 'fallow_wheat', water_at_wheat_sowing_mm: 120, bare_days: 470, wind_exposed_bare_days: 90 }, 0.8, null));
      sequences.push(row({ ...base, rotation_id: 'chickpea_wheat', water_at_wheat_sowing_mm: 60, bare_days: 380, wind_exposed_bare_days: 60 }, r, r));
      sequences.push(row({ ...base, rotation_id: 'lentil_wheat', water_at_wheat_sowing_mm: 70, bare_days: 390, wind_exposed_bare_days: 65 }, 0.75, 0.5));
    }
  }
  return { schema_version: '1.0', mock: true, generated_at: '', location_id: 'karapinar',
    soil: { awc_mm_per_m: { value: 1, source: '', type: 'model', verified: false }, properties: [], not_available_remotely: [] },
    sequences };
}
const RES = toyResults();

// ---------- tests ----------

describe('percentile (numpy type 7)', () => {
  it('matches numpy on known arrays', () => {
    expect(percentile([1, 2, 3, 4], 10)).toBeCloseTo(1.3, 10);
    expect(percentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 10);
    expect(percentile([15, 20, 35, 40, 50], 40)).toBeCloseTo(29, 10);
    expect(percentile([-3, 10, -1, 4], 90)).toBeCloseTo(8.2, 10);
    expect(percentile([], 50)).toBeNaN();
  });
  it('range does not mutate input', () => {
    const xs = [4, 3, 2, 1];
    expect(range(xs).p50).toBe(2.5);
    expect(xs).toEqual([4, 3, 2, 1]);
  });
});

describe('inputsFromDefaults', () => {
  it('reads crops, weights, guardrails and margin', () => {
    const v = (value: number | null): V => ({ ...pending, value });
    const crop = { ref_yield_kg_per_da: v(296), price_tl_per_kg: v(16.5), support_tl_per_da: v(954) };
    const d = { schema_version: '1.0', mock: false, generated_at: '',
      crops: { wheat: crop, chickpea: crop, lentil: crop, fallow: { support_tl_per_da: v(110.1) } },
      decision: { weights: { value: v(0.4), yield: v(0.3), soil: v(0.2), water: v(0.1) },
        guardrails: { min_wheat_ratio_vs_baseline: v(0.85), min_first_crop_ratio: v(0.3) }, close_call_margin: v(0.05) },
    } as DefaultsFile;
    const inp = inputsFromDefaults(d);
    expect(inp.crops.wheat).toEqual({ ref_yield_kg_per_da: 296, price_tl_per_kg: 16.5, support_tl_per_da: 954 });
    expect(inp.crops.fallow).toEqual({ support_tl_per_da: 110.1 });
    expect(inp.weights).toEqual({ value: 0.4, yield: 0.3, soil: 0.2, water: 0.1 });
    expect(inp.guardrails.min_wheat_ratio_vs_baseline).toBe(0.85);
    expect(inp.close_call_margin).toBe(0.05);
  });
});

describe('sequenceValue (internal, hand-computed)', () => {
  it('fallow → wheat: wheat revenue + supports only', () => {
    // 0.8 × 300 × 15 = 3600, + 300 wheat support + 100 fallow support
    expect(sequenceValue(row({ start_year: 2010, rotation_id: 'fallow_wheat', depth_id: 'medium' }, 0.8, null), ROTATIONS[0], INP.crops)).toBeCloseTo(4000);
  });
  it('lentil → wheat: both harvests + supports', () => {
    // 0.75 × 300 × 15 = 3375 + 300; 0.5 × 100 × 40 = 2000 + 200
    expect(sequenceValue(row({ start_year: 2010, rotation_id: 'lentil_wheat', depth_id: 'medium' }, 0.75, 0.5), ROTATIONS[2], INP.crops)).toBeCloseTo(5875);
  });
});

describe('summarize (agronomy only, no money)', () => {
  const s = summarize(RES, SITE, 'medium');
  it('baseline first, harvest counts, ratios and deltas', () => {
    expect(s.map((x) => x.rotation_id)).toEqual(['fallow_wheat', 'chickpea_wheat', 'lentil_wheat']);
    expect(s.map((x) => x.harvests_in_two_years)).toEqual([1, 2, 2]);
    expect(s[0].wheat_yield_ratio.p50).toBeCloseTo(0.8);
    expect(s[0].first_crop_yield_ratio).toBeNull();
    expect(s[2].first_crop_yield_ratio?.p50).toBeCloseTo(0.5);
    expect(s[2].delta_vs_baseline).toEqual({ water_p50: -50, wheat_yield_ratio_p50: expect.closeTo(-0.05, 10), bare_days_p50: -80, wind_exposed_p50: -25 });
  });
  it('contains no money fields', () => {
    expect(JSON.stringify(s)).not.toMatch(/tl|net|price|income|cost/i);
  });
});

describe('decide', () => {
  const d = decide(RES, SITE, 'medium', INP);
  it('blocks chickpea: it earns more than fallow but cuts the next wheat below 85 % of after-fallow', () => {
    const chick = d.ranking.find((r) => r.rotation_id === 'chickpea_wheat')!;
    expect(chick.eligible).toBe(false);
    expect(chick.blocked).toContain('wheat_yield_below_baseline');   // 0.5 / 0.8 = 0.625 < 0.85
    expect(chick.parts.value).toBeGreaterThan(d.ranking.find((r) => r.rotation_id === 'fallow_wheat')!.parts.value);
  });
  it('recommends lentil with default weights (hand-computed scores)', () => {
    // parts relative to best: value 4000/5875 (fallow), 1 (lentil); yield 1 / 0.9375; soil 60/90 / 60/65; water 1 / 70/120
    const score = (id: string) => d.ranking.find((r) => r.rotation_id === id)!.score;
    expect(score('fallow_wheat')).toBeCloseTo(0.4 * (4000 / 5875) + 0.3 * 1 + 0.2 * (60 / 90) + 0.1 * 1, 6);
    expect(score('lentil_wheat')).toBeCloseTo(0.4 * 1 + 0.3 * 0.9375 + 0.2 * (60 / 65) + 0.1 * (70 / 120), 6);
    expect(d.recommended).toBe('lentil_wheat');
    expect(d.runner_up).toBe('fallow_wheat');
    expect(d.close_call).toBe(false);
    expect(d.ranking.map((r) => r.eligible)).toEqual([true, true, false]);  // blocked ones last
  });
  it('priorities change the answer; a blocked rotation is never recommended', () => {
    expect(decide(RES, SITE, 'medium', INP, { value: 0, yield: 1, soil: 0, water: 0 }).recommended).toBe('fallow_wheat');
    const soilOnly = decide(RES, SITE, 'medium', INP, { value: 0, yield: 0, soil: 1, water: 0 });
    expect(soilOnly.ranking.find((r) => r.rotation_id === 'chickpea_wheat')!.parts.soil).toBe(1); // best soil, but blocked
    expect(soilOnly.recommended).toBe('lentil_wheat');
  });
  it('first-crop guardrail blocks a legume that fails too often', () => {
    const strict = { ...INP, guardrails: { min_wheat_ratio_vs_baseline: 0, min_first_crop_ratio: 0.6 } };
    const lentil = decide(RES, SITE, 'medium', strict).ranking.find((r) => r.rotation_id === 'lentil_wheat')!;
    expect(lentil.blocked).toEqual(['first_crop_fails']);
  });
  it('close call when the top two are within the margin', () => {
    expect(decide(RES, SITE, 'medium', { ...INP, close_call_margin: 0.2 }).close_call).toBe(true);
  });
  it('exposes no money: no money-named fields, every number is a 0–1 score', () => {
    const keys: string[] = [];
    const nums: number[] = [];
    const walk = (x: unknown): void => {
      if (typeof x === 'number') nums.push(x);
      else if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { keys.push(k); walk(v); }
    };
    walk(d);
    expect(keys.filter((k) => /tl|price|income|cost|net|money/i.test(k))).toEqual([]);
    expect(nums.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('flipTable', () => {
  const cells = flipTable(RES, SITE, INP);
  it('9 cells, 8 years each', () => {
    expect(cells).toHaveLength(9);
    expect(cells.every((c) => c.n_years === 8)).toBe(true);
  });
  it('chickpea only where it does not hurt the wheat (wet years)', () => {
    for (const depth of ['shallow', 'medium', 'deep']) {
      const by = Object.fromEntries(cells.filter((c) => c.depth_id === depth).map((c) => [c.tercile, c.rotation_id]));
      expect(by).toEqual({ dry: 'lentil_wheat', normal: 'lentil_wheat', wet: 'chickpea_wheat' });
    }
  });
});
