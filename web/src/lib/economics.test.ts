// Unit tests for economics.ts — PLAN_MVP §5.5, §5.9; ARAYUZLER §9–§10. Owner: Gümüş (Rol B).
// Reference percentiles were computed with numpy.percentile (default "linear" = type 7).

import { describe, expect, it } from 'vitest';
import type { DefaultsFile, ResultsFile, Rotation, SequenceRow, SiteIndex, V } from './types';
import {
  breakEvenYield, flipTable, inputsFromDefaults, percentile, range, rankByPriority, sequenceMoney, summarize,
  type LocationInputs, type RotationSummary,
} from './economics';

// ---------- toy data ----------

const INP: LocationInputs = {
  wheat: { ym_kg_per_da: 400, price_tl_per_kg: 15, cost_tl_per_da: 2000, support_tl_per_da: 300 },
  chickpea: { ym_kg_per_da: 150, price_tl_per_kg: 50, cost_tl_per_da: 1800, support_tl_per_da: 200 },
  lentil: { ym_kg_per_da: 150, price_tl_per_kg: 50, cost_tl_per_da: 1800, support_tl_per_da: 200 },
  fallow: { cost_tl_per_da: 600, support_tl_per_da: 100 },
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

/** 24 years × 3 depths. Year index i: precip = 100 + i (dry → wet).
 *  fallow: wheat 0.8 every year → net 2600.  chickpea: ratios r = i/23 → net 13500 r − 3300.  lentil: ratios 0 → net −3300. */
function toyResults(): ResultsFile {
  const sequences: SequenceRow[] = [];
  for (const depth of SITE.depth_classes) {
    for (let i = 0; i < 24; i++) {
      const base = { start_year: 2001 + i, depth_id: depth.id, pre_sowing_precip_mm: 100 + i };
      const r = i / 23;
      sequences.push(row({ ...base, rotation_id: 'fallow_wheat', water_at_wheat_sowing_mm: 120, bare_days: 470, wind_exposed_bare_days: 90 }, 0.8, null));
      sequences.push(row({ ...base, rotation_id: 'chickpea_wheat', water_at_wheat_sowing_mm: 60, bare_days: 380, wind_exposed_bare_days: 60 }, r, r));
      sequences.push(row({ ...base, rotation_id: 'lentil_wheat', water_at_wheat_sowing_mm: 70, bare_days: 390, wind_exposed_bare_days: 65 }, 0, 0));
    }
  }
  return { schema_version: '1.0', mock: true, generated_at: '', location_id: 'karapinar',
    soil: { awc_mm_per_m: { value: 1, source: '', type: 'model', verified: false }, properties: [], not_available_remotely: [] },
    sequences };
}

// ---------- tests ----------

describe('percentile (numpy type 7)', () => {
  it('matches numpy on known arrays', () => {
    expect(percentile([1, 2, 3, 4], 10)).toBeCloseTo(1.3, 10);
    expect(percentile([1, 2, 3, 4], 50)).toBeCloseTo(2.5, 10);
    expect(percentile([1, 2, 3, 4], 90)).toBeCloseTo(3.7, 10);
    expect(percentile([15, 20, 35, 40, 50], 40)).toBeCloseTo(29, 10);
    expect(percentile([-3, 10, -1, 4], 10)).toBeCloseTo(-2.4, 10);   // unsorted input
    expect(percentile([-3, 10, -1, 4], 90)).toBeCloseTo(8.2, 10);
    expect(percentile([7], 50)).toBe(7);
  });
  it('handles edges', () => {
    expect(percentile([], 50)).toBeNaN();
    expect(percentile([3, 1, 2], 0)).toBe(1);
    expect(percentile([3, 1, 2], 100)).toBe(3);
  });
  it('range gives P10 / P50 / P90 and does not mutate input', () => {
    const xs = [4, 3, 2, 1];
    expect(range(xs)).toEqual({ p10: expect.closeTo(1.3, 10), p50: 2.5, p90: expect.closeTo(3.7, 10) });
    expect(xs).toEqual([4, 3, 2, 1]);
  });
});

describe('sequenceMoney (hand-computed)', () => {
  it('chickpea → wheat', () => {
    const m = sequenceMoney(row({ start_year: 2010, rotation_id: 'chickpea_wheat', depth_id: 'medium' }, 0.5, 0.6), ROTATIONS[1], INP);
    // chickpea 0.6×150 = 90 kg × 50 = 4500 + 200 support; wheat 0.5×400 = 200 kg × 15 = 3000 + 300 support
    expect(m.first_crop_kg_per_da).toBeCloseTo(90);
    expect(m.wheat_kg_per_da).toBeCloseTo(200);
    expect(m.income_tl_per_da).toBeCloseTo(8000);
    expect(m.cost_tl_per_da).toBe(3800);
    expect(m.net_2yr_tl_per_da).toBeCloseTo(4200);
  });
  it('fallow → wheat: fallow year has only support and cost', () => {
    const m = sequenceMoney(row({ start_year: 2010, rotation_id: 'fallow_wheat', depth_id: 'medium' }, 0.8, null), ROTATIONS[0], INP);
    // wheat 320 kg × 15 = 4800 + 300; fallow support 100; cost 600 + 2000
    expect(m.first_crop_kg_per_da).toBeNull();
    expect(m.income_tl_per_da).toBeCloseTo(5200);
    expect(m.cost_tl_per_da).toBe(2600);
    expect(m.net_2yr_tl_per_da).toBeCloseTo(2600);
  });
  it('missing inputs count as zero', () => {
    const m = sequenceMoney(row({ start_year: 2010, rotation_id: 'lentil_wheat', depth_id: 'medium' }, 1, 1), ROTATIONS[2], {});
    expect(m.net_2yr_tl_per_da).toBe(0);
  });
});

describe('breakEvenYield', () => {
  it('(cost − support) / price', () => {
    expect(breakEvenYield(2000, 300, 15)).toBeCloseTo(113.333, 3);
    expect(breakEvenYield(100, 300, 10)).toBe(-20);
    expect(breakEvenYield(2000, 300, 0)).toBeNaN();
  });
});

describe('inputsFromDefaults', () => {
  it('pending (null) values become 0, real values pass through', () => {
    const v = (value: number | null): V => ({ ...pending, value });
    const crop = { ym_kg_per_da: v(400), price_tl_per_kg: v(null), cost_tl_per_da: v(2000), support_tl_per_da: v(300) };
    const d = { schema_version: '1.0', mock: false, generated_at: '',
      values: { karapinar: { wheat: crop, chickpea: crop, lentil: crop, fallow: { cost_tl_per_da: v(600), support_tl_per_da: v(null) } } },
    } as unknown as DefaultsFile;
    const inp = inputsFromDefaults(d, 'karapinar');
    expect(inp.wheat).toEqual({ ym_kg_per_da: 400, price_tl_per_kg: 0, cost_tl_per_da: 2000, support_tl_per_da: 300 });
    expect(inp.fallow).toEqual({ cost_tl_per_da: 600, support_tl_per_da: 0 });
    expect(inputsFromDefaults(d, 'develi')).toEqual({});
  });
});

describe('summarize', () => {
  const s = summarize(toyResults(), SITE, 'medium', INP);
  it('one summary per rotation, baseline first, 24 nets in year order', () => {
    expect(s.map((x) => x.rotation_id)).toEqual(['fallow_wheat', 'chickpea_wheat', 'lentil_wheat']);
    expect(s[0].is_baseline).toBe(true);
    expect(s[1].nets).toHaveLength(24);
    expect(s[1].nets[0]).toBeCloseTo(-3300);
    expect(s[1].nets[23]).toBeCloseTo(10200);
  });
  it('loss probability, ranges and break-even', () => {
    expect(s[0].loss_probability).toBe(0);
    expect(s[2].loss_probability).toBe(1);
    // chickpea net < 0 when 13500 i/23 < 3300 → i ≤ 5 → 6 of 24
    expect(s[1].loss_probability).toBeCloseTo(6 / 24);
    expect(s[0].net_2yr).toEqual({ p10: 2600, p50: 2600, p90: 2600 });
    expect(s[0].first_crop_kg_per_da).toBeNull();
    expect(s[1].first_crop_kg_per_da?.p50).toBeCloseTo(75);   // 150 × median(i/23) = 150 × 0.5
    expect(s[0].wheat_break_even_kg_per_da).toBeCloseTo(113.333, 3);
  });
  it('differences from the baseline', () => {
    expect(s[0].delta_vs_baseline).toBeNull();
    expect(s[1].delta_vs_baseline).toEqual({
      net_2yr_p50: expect.closeTo(13500 * 0.5 - 3300 - 2600, 6), water_p50: -60, bare_days_p50: -90, wind_exposed_p50: -30,
    });
  });
});

describe('flipTable', () => {
  const cells = flipTable(toyResults(), SITE, INP);
  it('9 cells, 8 years each', () => {
    expect(cells).toHaveLength(9);
    expect(cells.every((c) => c.n_years === 8)).toBe(true);
  });
  it('picks the rotation with the highest median net per depth × tercile', () => {
    for (const depth of ['shallow', 'medium', 'deep']) {
      const by = Object.fromEntries(cells.filter((c) => c.depth_id === depth).map((c) => [c.tercile, c]));
      expect(by.dry.rotation_id).toBe('fallow_wheat');          // chickpea median net −1245 < 2600
      expect(by.normal.rotation_id).toBe('chickpea_wheat');     // 13500 × 11.5/23 − 3300 = 3450
      expect(by.wet.rotation_id).toBe('chickpea_wheat');
      expect(by.normal.median_net).toBeCloseTo(3450);
    }
  });
  it('recomputes with new inputs (a large fallow support makes fallow win every cell)', () => {
    const subsidised = { ...INP, fallow: { cost_tl_per_da: 600, support_tl_per_da: 20000 } };
    expect(flipTable(toyResults(), SITE, subsidised).every((c) => c.rotation_id === 'fallow_wheat')).toBe(true);
  });
});

describe('rankByPriority', () => {
  const mk = (id: string, water: number, net: number, wind: number, stress = 0, loss = 0): RotationSummary => ({
    rotation_id: id, depth_id: 'medium', is_baseline: id === 'A', nets: [],
    net_2yr: { p10: net, p50: net, p90: net }, loss_probability: loss,
    wheat_kg_per_da: { p10: 0, p50: 0, p90: 0 }, first_crop_kg_per_da: null,
    water_at_wheat_sowing_mm: { p10: water, p50: water, p90: water },
    bare_days_p50: 0, wind_exposed_bare_days_p50: wind, wheat_stress_days_p50: stress,
    wheat_break_even_kg_per_da: 0, delta_vs_baseline: null,
  });
  const S = [mk('A', 100, 0, 50), mk('B', 50, 1000, 10), mk('C', 0, 500, 30)];

  it('100 % on one priority reproduces that single-metric order', () => {
    expect(rankByPriority(S, { water: 100, income: 0, soil: 0 }).map((r) => r.rotation_id)).toEqual(['A', 'B', 'C']);
    expect(rankByPriority(S, { water: 0, income: 100, soil: 0 }).map((r) => r.rotation_id)).toEqual(['B', 'C', 'A']);
    expect(rankByPriority(S, { water: 0, income: 0, soil: 100 }).map((r) => r.rotation_id)).toEqual(['B', 'C', 'A']);
    expect(rankByPriority(S, { water: 100, income: 0, soil: 0 })[0].driver).toBe('water');
  });
  it('equal weights: min–max parts, weighted score, driver', () => {
    const r = rankByPriority(S, { water: 34, income: 33, soil: 33 });
    expect(r[0].rotation_id).toBe('B');
    expect(r[0].parts).toEqual({ water: 0.5, income: 1, soil: 1 });
    expect(r[0].score).toBeCloseTo(0.34 * 0.5 + 0.33 + 0.33);
    expect(r[0].driver).toBe('income');
    expect(r.every((x) => x.score >= 0 && x.score <= 1)).toBe(true);
  });
  it('ties on the main metric fall back to the tie-break metric', () => {
    const tie = [mk('A', 80, 0, 0, 20), mk('B', 80, 0, 0, 5), mk('C', 80, 0, 0, 10)];
    expect(rankByPriority(tie, { water: 100, income: 0, soil: 0 }).map((r) => r.rotation_id)).toEqual(['B', 'C', 'A']);
  });
  it('weights are normalised; all-zero weights count as equal', () => {
    const a = rankByPriority(S, { water: 1, income: 1, soil: 1 });
    const b = rankByPriority(S, { water: 0, income: 0, soil: 0 });
    expect(a.map((x) => x.score)).toEqual(b.map((x) => x.score));
  });
});
