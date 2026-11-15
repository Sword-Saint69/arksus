// Unit tests for the fertilizer module (fertilizer.ts) — docs/GUBRE.md, ARAYUZLER §13. Owner: Gümüş (Rol B).
// Uses the real web/public/data/fertilizer.json; every expected number below is computed by hand in the comment.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FertilizerFile, ResultsFile } from './types';
import { completeSoil, lookup, matches, practiceNutrients, recommend, soilFlags, soilFromResults, type FertPlan } from './fertilizer';

const F = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/fertilizer.json'), 'utf-8')) as FertilizerFile;
const dose = (p: FertPlan, product: string, timing?: string) =>
  p.doses.find((d) => d.product === product && (!timing || d.timing === timing))?.kg_per_da;
const nut = (p: FertPlan, n: 'n' | 'p2o5' | 'k2o') => p.nutrients.find((l) => l.nutrient === n)!;

// A typical limy Central Anatolian lab report (0–20 cm), no zinc or salt test.
const LIMY = { om_pct: 1.5, p2o5_kg_per_da: 3.5, k2o_kg_per_da: 22, ph: 8.0, lime_pct: 18 };

describe('lookup and conditions', () => {
  const rows = [{ max: 1.0, kg_per_da: 9 }, { max: 2.0, kg_per_da: 8 }, { max: null, kg_per_da: 5 }];
  it('class bounds are inclusive upper limits', () => {
    expect(lookup(rows, 0)).toBe(9);
    expect(lookup(rows, 1.0)).toBe(9);
    expect(lookup(rows, 1.05)).toBe(8);
    expect(lookup(rows, 40)).toBe(5);
  });
  it('a missing value never matches a comparison, only missing: true', () => {
    const ctx = { flags: [], ph: 8 } as never;
    expect(matches({ ph: { gt: 7.7 } }, ctx)).toBe(true);
    expect(matches({ ph: { gt: 8 } }, ctx)).toBe(false);
    expect(matches({ lime_pct: { gt: 1 } }, ctx)).toBe(false);
    expect(matches({ lime_pct: { missing: true } }, ctx)).toBe(true);
    expect(matches({ flags_any: ['saline'] }, ctx)).toBe(false);
    expect(matches(undefined, ctx)).toBe(true);
  });
  it('flags: pH 8.0 > 7.5 alkaline, lime 18 > 15 high, no zinc test → zinc likely low', () => {
    expect(soilFlags(F, 'wheat', LIMY)).toEqual(['alkaline', 'high_lime', 'zn_likely_low']);
    expect(soilFlags(F, 'wheat', { ...LIMY, zn_ppm: 0.3 })).toEqual(['alkaline', 'high_lime', 'zn_low']);
    expect(soilFlags(F, 'wheat', { om_pct: 0.8, total_n_pct: 0.05, ec_ds_m: 7 })).toEqual(['low_om', 'low_total_n', 'saline']);
  });
  it('ppm → kg/da: 6 mg P/kg × 250 000 kg / 10⁶ × 2.29 = 3.435 kg P2O5/da', () => {
    const { soil, derived } = completeSoil(F, { olsen_p_ppm: 6, k_ppm: 100 });
    expect(soil.p2o5_kg_per_da).toBeCloseTo(3.435, 3);
    expect(soil.k2o_kg_per_da).toBeCloseTo(100 * 0.25 * 1.205, 6);
    expect(derived).toEqual(['p2o5_kg_per_da', 'k2o_kg_per_da']);
  });
});

describe('wheat, rainfed, limy soil (TAGEM Kuru rows)', () => {
  const p = recommend(F, { crop: 'wheat', water: 'rainfed', soil: LIMY });
  it('pure nutrient from the official tables', () => {
    // N: OM 1.5 → class 1.1–2.0 → 8; P2O5: 3.5 → class 3.1–4.0 → 6; K2O: 22 → class 20.1–25 → 4
    expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 8, basis: 'soil_table' });
    expect(nut(p, 'p2o5')).toMatchObject({ fertilizer_kg_per_da: 6, basis: 'soil_table' });
    expect(nut(p, 'k2o')).toMatchObject({ fertilizer_kg_per_da: 4, basis: 'soil_table' });
    expect(nut(p, 'n').source!.type).toBe('official');
  });
  it('products: zinc compound for P, K2SO4 for K, CAN for the rest of N', () => {
    // zinc likely low → 20-20-0+Zn: 6 / 0.20 = 30 kg (gives 6 N); K2SO4 4 / 0.50 = 8 kg; CAN (8 − 6) / 0.26 = 7.7 kg
    expect(dose(p, 'npk_20_20_0_zn', 'base')).toBe(30);
    expect(dose(p, 'potassium_sulfate', 'base')).toBe(8);
    expect(dose(p, 'can', 'top_1')).toBe(7.7);
    expect(p.doses.map((d) => d.timing)).toEqual(['base', 'base', 'top_1']);
  });
  it('default target 296 kg/da (TÜİK) picks the Toros 250–300 guide row; balance shown as cross-check', () => {
    expect(p.target_yield_kg_per_da).toBe(296);
    expect(p.target_badge).toBe('statistic');
    expect(p.guide).toMatchObject({ min: 250, max: 300 });
    // need N = 0.296 t × 24 kg/t = 7.1; no total N given → no soil supply, no balance
    expect(nut(p, 'n')).toMatchObject({ need_kg_per_da: 7.1, soil_supply_kg_per_da: null, balance_kg_per_da: null });
  });
  it('advice and missing tests', () => {
    const ids = p.advice.map((a) => a.id);
    expect(ids).toEqual(['cereal_can_not_urea', 'cereal_zinc', 'zn_check', 'banding', 'foliar_timing']);
    expect(p.missing).toEqual(['ec_ds_m', 'zn_ppm']);
    expect(p.better_for_salinity).toEqual([]);
  });
  it('band placement: 2 kg/da less compound (Toros) → 28 kg, and CAN makes up the N', () => {
    const b = recommend(F, { crop: 'wheat', water: 'rainfed', soil: LIMY, banding: true });
    // 28 kg 20-20-0+Zn = 5.6 N; CAN (8 − 5.6) / 0.26 = 9.2 kg
    expect(dose(b, 'npk_20_20_0_zn')).toBe(28);
    expect(dose(b, 'can')).toBe(9.2);
    expect(b.advice.map((a) => a.id)).not.toContain('banding');
  });
  it('with a zinc test above 0.5 mg/kg the plain DAP is used', () => {
    const z = recommend(F, { crop: 'wheat', water: 'rainfed', soil: { ...LIMY, zn_ppm: 0.9 } });
    // DAP 6 / 0.46 = 13.04 → 13.0 kg (2.35 N); CAN (8 − 2.348) / 0.26 = 21.7 kg
    expect(dose(z, 'dap')).toBe(13);
    expect(dose(z, 'can')).toBe(21.7);
  });
});

describe('wheat irrigated splits top dressing 60/40 (Sulu rows)', () => {
  const p = recommend(F, { crop: 'wheat', water: 'irrigated', soil: { ...LIMY, zn_ppm: 0.9 } });
  it('Sulu: N 15, P2O5 7, K2O 6', () => {
    // OM 1.5 → 15; P 3.5 → 7; K 22 → 6
    expect(p.nutrients.map((l) => l.fertilizer_kg_per_da)).toEqual([15, 7, 6]);
    // DAP 7 / 0.46 = 15.2 kg (2.739 N); rest 12.261 N → CAN 0.6 × 12.261 / 0.26 = 28.3, 0.4 × … = 18.9
    expect(dose(p, 'dap')).toBe(15.2);
    expect(dose(p, 'can', 'top_1')).toBe(28.3);
    expect(dose(p, 'can', 'top_2')).toBe(18.9);
    expect(p.guide).toMatchObject({ min: 500, max: 600 });   // default target 550 (assumption)
  });
});

describe('legumes', () => {
  it('inoculated chickpea: 3 kg N starter (GKGM), P from the table', () => {
    const p = recommend(F, { crop: 'chickpea', water: 'rainfed', soil: LIMY, inoculated: true });
    expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 3, basis: 'fixed_starter' });
    // P 3.5 → 4; DAP 4 / 0.46 = 8.7 kg (1.565 N); CAN (3 − 1.565) / 0.26 = 5.5 kg at sowing
    expect(nut(p, 'p2o5').fertilizer_kg_per_da).toBe(4);
    expect(dose(p, 'dap', 'base')).toBe(8.7);
    expect(dose(p, 'can', 'base')).toBe(5.5);
    expect(nut(p, 'k2o').basis).toBe('pending');            // no TAGEM row, no sourced uptake
    expect(p.advice.map((a) => a.id)).not.toContain('legume_inoculate');
  });
  it('not inoculated: the TAGEM table N (OM 1.5 → 4) and advice to inoculate', () => {
    const p = recommend(F, { crop: 'chickpea', water: 'rainfed', soil: LIMY });
    expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 4, basis: 'soil_table' });
    expect(dose(p, 'can', 'base')).toBe(9.4);                // (4 − 1.565) / 0.26
    expect(p.advice[0].id).toBe('legume_inoculate');
  });
  it('lentil inoculated: 2.3 kg N, P 3.5 → 6 kg P2O5 → DAP 13.0', () => {
    const p = recommend(F, { crop: 'lentil', water: 'rainfed', soil: LIMY, inoculated: true });
    expect(nut(p, 'n').fertilizer_kg_per_da).toBe(2.3);
    expect(dose(p, 'dap')).toBe(13);
    expect(dose(p, 'can')).toBeUndefined();                   // DAP already gives 2.35 N ≥ 2.3
  });
  it('irrigated or limited chickpea / lentil: the Kuru table, badged as an assumption (was: no dose at all)', () => {
    for (const crop of ['chickpea', 'lentil'] as const) {
      for (const water of ['limited', 'irrigated'] as const) {
        const p = recommend(F, { crop, water, soil: { om_pct: 1.5 } });
        expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 4, basis: 'soil_table' });   // OM 1.5 → 4
        expect(nut(p, 'n').source).toMatchObject({ type: 'assumption', verified: false });
        expect(nut(p, 'p2o5').basis).toBe('needs_soil_test');
        expect(dose(p, 'can', 'base')).toBe(15.4);            // 4 / 0.26
      }
    }
  });
});

describe('irrigated crops and fallbacks', () => {
  it('sugar beet: N 15 at OM ≤ 1 (= the cap, not cut), 15-15-15 base', () => {
    const p = recommend(F, { crop: 'sugar_beet', water: 'irrigated', soil: { ...LIMY, om_pct: 0.8 } });
    expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 15, capped: false });
    // P 3.5 → 7; 15-15-15: 7 / 0.15 = 46.7 kg (7 N, 7 K2O); K 22 → 9 → K2SO4 (9 − 7) / 0.5 = 4 kg
    expect(dose(p, 'npk_15_15_15')).toBe(46.7);
    expect(dose(p, 'potassium_sulfate')).toBe(4);
    // AS (15 − 7) / 0.21 = 38.1 → 19.0 + 19.0
    expect(dose(p, 'ammonium_sulfate', 'top_1')).toBe(19);
    expect(dose(p, 'ammonium_sulfate', 'top_2')).toBe(19);
    expect(p.target_yield_kg_per_da).toBeNull();               // tables do not need a target
  });
  it('rainfed onion has no TAGEM row: N from the response curve top (215.40 / 16.58 = 13.0)', () => {
    const p = recommend(F, { crop: 'onion', water: 'rainfed', soil: LIMY });
    expect(nut(p, 'n')).toMatchObject({ fertilizer_kg_per_da: 13, basis: 'response_curve' });
    expect(nut(p, 'p2o5').basis).toBe('pending');
  });
  it('potato on pH 8.0 gets the sulfur advice (Toros: pH > 7.7)', () => {
    const p = recommend(F, { crop: 'potato', water: 'irrigated', soil: LIMY, drip: true });
    expect(p.advice.map((a) => a.id)).toEqual(expect.arrayContaining(['potato_sulfur', 'potato_drip_program', 'drip_no_ca_mix']));
  });
  it('saline soil for wheat (EC 7 > 6): barley (8) and sugar beet (7) tolerate it', () => {
    const p = recommend(F, { crop: 'wheat', water: 'rainfed', soil: { ...LIMY, ec_ds_m: 7 } });
    expect(p.flags).toContain('saline');
    expect(p.better_for_salinity).toEqual(['barley', 'sugar_beet']);
    expect(p.advice.map((a) => a.id)).toContain('wheat_saline_barley');
  });
});

describe('SoilGrids prefill only (no lab)', () => {
  const results = {
    soil: {
      properties: [
        { id: 'phh2o', q50: 7.69, type: 'model' }, { id: 'nitrogen', q50: 1.04, type: 'model' },
        { id: 'soc', q50: 12.83, type: 'model' },
      ],
    },
  } as unknown as ResultsFile;
  const pre = soilFromResults(results, F);
  it('pH, total N (g/kg → %) and organic matter (SOC × 1.724)', () => {
    // 12.83 g/kg = 1.283 % C × 1.724 = 2.21 % OM
    expect(pre.soil.ph).toBe(7.69);
    expect(pre.soil.total_n_pct).toBeCloseTo(0.104, 9);
    expect(pre.soil.om_pct).toBe(2.21);
    expect(pre.badges.om_pct).toBe('model');
    expect(pre.needs_lab).toEqual(['p2o5_kg_per_da', 'k2o_kg_per_da', 'lime_pct', 'ec_ds_m', 'zn_ppm']);
  });
  it('wheat: N only (OM 2.21 → 7), all as CAN; P and K wait for a soil test', () => {
    const p = recommend(F, { crop: 'wheat', water: 'rainfed', soil: pre.soil });
    expect(nut(p, 'n').fertilizer_kg_per_da).toBe(7);
    expect(nut(p, 'p2o5').basis).toBe('needs_soil_test');
    expect(dose(p, 'can')).toBe(26.9);                       // 7 / 0.26
    expect(p.advice.map((a) => a.id)).toContain('soil_test');
    // cross-check: supply = 250 000 × 0.104 % × 0.05 × 0.40 = 5.2; need 7.1; balance (7.104 − 5.2) / 0.6 = 3.2
    expect(nut(p, 'n')).toMatchObject({ soil_supply_kg_per_da: 5.2, balance_kg_per_da: 3.2 });
  });
});

describe('farmer practice (Cihanbeyli 2023 survey)', () => {
  it('21 kg DAP + 11.12 kg urea = 3.78 + 5.12 = 8.9 kg N and 9.7 kg P2O5 per dekar', () => {
    expect(practiceNutrients(F, 'wheat')).toEqual({ n: 8.9, p2o5: 9.7, k2o: 0 });
  });
  it('no survey for other crops', () => {
    expect(practiceNutrients(F, 'chickpea')).toBeNull();
  });
});

