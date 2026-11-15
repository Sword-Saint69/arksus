// Unit tests for the sowing module (sowing.ts) — docs/GUBRE.md §9. Owner: Gümüş (Rol B).
// Uses the real web/public/data/sowing.json; expected numbers are computed by hand in the comments.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SowingFile } from './types';
import { seedKgPerDa, seedRule, sowingPlan, windowStatus } from './sowing';

const F = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/sowing.json'), 'utf-8')) as SowingFile;
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('seed formula (TİGEM Bölüm 4)', () => {
  it("Gerek-79 example: 525 × 38 × 10 / (98 × 95) = 21.4 kg/da, not the printed '20' (quality correction skipped there)", () => {
    expect(seedKgPerDa(525, 38, 98, 95)).toBeCloseTo(21.43, 2);
    expect((525 * 38) / 1000).toBeCloseTo(19.95, 2);     // what the printed example shows
  });
  it('rejects zero inputs', () => {
    expect(() => seedKgPerDa(500, 0, 98, 95)).toThrow();
  });
  it('rule: good and on time → low; late or poor → high; else middle', () => {
    expect(seedRule(false, 'good')).toBe('low');
    expect(seedRule(false, 'normal')).toBe('mid');
    expect(seedRule(true, 'good')).toBe('high');
    expect(seedRule(false, 'poor')).toBe('high');
  });
});

describe('wheat, rainfed, Develi', () => {
  const base = { crop: 'wheat' as const, water: 'rainfed' as const, locationId: 'develi' };
  it('window 15 Sep–10 Oct (TİGEM) with the nearest-window and cold-district notes', () => {
    const p = sowingPlan(F, base);
    expect(p.window).toMatchObject({ from: '09-15', to: '10-10' });
    expect(ids(p.window_notes)).toEqual(['nearest_window', 'cold_district']);
    expect(p.depth).toMatchObject({ min: 4, max: 6 });
  });
  it('seeds: Gerek-79 type 500–550; normal seedbed → middle 525; with label values → 21.4 kg/da', () => {
    const p = sowingPlan(F, { ...base, typeId: 'bread_high_tiller', tkw_g: 38, purity_pct: 98, germination_pct: 95 });
    expect(p.seeds).toMatchObject({ chosen: 525, rule: 'mid' });
    expect(p.calc).toEqual({ per_m2: 525, kg_per_da: 21.4 });
    expect(p.guide).toMatchObject({ min: 18, max: 19 });
  });
  it('late sowing → top of the range (550) and the late advice', () => {
    const p = sowingPlan(F, { ...base, late: true });
    expect(p.seeds).toMatchObject({ chosen: 550, rule: 'high' });
    expect(ids(p.advice)).toContain('cereal_late');
  });
  it('broadcast + poor seedbed: guide 18–19 + (3–5) + (3–5) = 24–29 kg/da', () => {
    const p = sowingPlan(F, { ...base, drill: 'broadcast', seedbed: 'poor' });
    expect(p.guide).toMatchObject({ min: 24, max: 29 });
    expect(p.guide!.extras).toHaveLength(2);
  });
  it('dry soil and fertilizer in the seed band → depth and band advice; separate band drops the band advice', () => {
    const p = sowingPlan(F, { ...base, soil: 'dry', drill: 'same_band' });
    expect(ids(p.advice)).toEqual(expect.arrayContaining(['cereal_dry_depth', 'cereal_fert_band']));
    const q = sowingPlan(F, { ...base, soil: 'dry', drill: 'separate_band' });
    expect(ids(q.advice)).not.toContain('cereal_fert_band');
  });
  it('missing label values are listed instead of guessing', () => {
    const p = sowingPlan(F, { ...base, tkw_g: 38 });
    expect(p.calc).toBeNull();
    expect(p.calc_missing).toEqual(['purity_pct', 'germination_pct']);
  });
  it('Karapınar (Konya) gets no nearest-window note', () => {
    expect(sowingPlan(F, { ...base, locationId: 'karapinar' }).window_notes).toEqual([]);
  });
});

describe('lentil and chickpea', () => {
  it('lentil rows: Karapınar 290 mm < 350 → 30 cm; Develi 405 mm → 15–20 cm', () => {
    const k = sowingPlan(F, { crop: 'lentil', water: 'rainfed', locationId: 'karapinar' });
    expect(k.rows.map((r) => [r.min, r.max])).toEqual([[30, 30]]);
    expect(k.annual_precip?.value).toBeCloseTo(290.11, 2);
    const d = sowingPlan(F, { crop: 'lentil', water: 'rainfed', locationId: 'develi' });
    expect(d.rows.map((r) => [r.min, r.max])).toEqual([[15, 20]]);
  });
  it('default lentil type is spring (the engine sows lentil on 1 March)', () => {
    const p = sowingPlan(F, { crop: 'lentil', water: 'rainfed' });
    expect(p.type.id).toBe('spring_large');
    expect(p.type.season).toBe('spring');
  });
  it('winter lentil adds the 1–2 kg/da winter-kill margin: large green 14–15 → 15–17', () => {
    const p = sowingPlan(F, { crop: 'lentil', water: 'rainfed', typeId: 'winter_large' });
    expect(p.guide).toMatchObject({ min: 15, max: 17 });
    expect(p.window).toMatchObject({ from: '10-01', to: '10-31' });
  });
  it('spring lentil has the source words, not invented dates', () => {
    const p = sowingPlan(F, { crop: 'lentil', water: 'rainfed', typeId: 'spring_small' });
    expect(p.window).toBeNull();
    expect(p.window_text?.tr).toBe('Şubat sonu–Mart başı');
    expect(p.guide).toMatchObject({ min: 7, max: 8 });
  });
  it('chickpea: 100 plants/m² with a 400 g thousand-seed weight → 100 × 400 × 10 / (98 × 90) = 45.4 kg/da (the conflict note explains)', () => {
    const p = sowingPlan(F, { crop: 'chickpea', water: 'rainfed', tkw_g: 400, purity_pct: 98, germination_pct: 90 });
    expect(p.seeds).toBeNull();
    expect(p.calc).toEqual({ per_m2: 100, kg_per_da: 45.4 });
    expect(p.guide).toMatchObject({ min: 8, max: 10 });
    expect(ids(p.advice)).toContain('chickpea_seed_conflict');
    expect(p.rows).toHaveLength(2);    // machine hoe 45 cm and hand hoe 30–35 cm
  });
});

describe('window status', () => {
  it('before / open / after', () => {
    expect(windowStatus('09-15', '10-10', new Date(2026, 8, 1))).toBe('before');
    expect(windowStatus('09-15', '10-10', new Date(2026, 9, 10))).toBe('open');
    expect(windowStatus('09-15', '10-10', new Date(2026, 10, 15))).toBe('after');
  });
});
