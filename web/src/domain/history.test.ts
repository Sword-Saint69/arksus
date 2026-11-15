import { describe, expect, it } from 'vitest';
import { harvestYears, practiceOf, stageOf, twoYearPlan, type History } from './history';

describe('crop history', () => {
  it('the last three finished harvests: July is the turn of the farming year (engine sequences start in July)', () => {
    expect(harvestYears(new Date(2026, 10, 15))).toEqual([2024, 2025, 2026]);   // November 2026
    expect(harvestYears(new Date(2026, 6, 1))).toEqual([2024, 2025, 2026]);     // 1 July
    expect(harvestYears(new Date(2026, 5, 30))).toEqual([2023, 2024, 2025]);    // 30 June: this year's harvest is not in yet
    expect(harvestYears(new Date(2027, 0, 10))).toEqual([2024, 2025, 2026]);
  });

  it('where the field stands in the two-year sequence', () => {
    expect(stageOf(['fallow', 'wheat', 'fallow'])).toBe('wheat_after_fallow');
    expect(stageOf(['wheat', 'fallow', 'wheat'])).toBe('choose_first_year');
    expect(stageOf(['wheat', 'fallow', 'barley'])).toBe('choose_first_year');
    expect(stageOf(['wheat', 'wheat', 'chickpea'])).toBe('wheat_after_legume');
    expect(stageOf(['wheat', 'wheat', 'lentil'])).toBe('wheat_after_legume');
    expect(stageOf(['wheat', 'wheat', 'other'])).toBe('unknown');
    expect(stageOf([null, null, null])).toBe('unknown');
  });

  it('names the practice the farmer follows today', () => {
    expect(practiceOf(['fallow', 'wheat', 'fallow'])).toBe('fallow_cereal');
    expect(practiceOf(['wheat', 'fallow', 'barley'])).toBe('fallow_cereal');
    expect(practiceOf(['chickpea', 'wheat', 'lentil'])).toBe('legume_cereal');
    expect(practiceOf(['wheat', 'chickpea', 'fallow'])).toBe('legume_cereal');
    expect(practiceOf(['wheat', 'barley', 'wheat'])).toBe('cereal_every_year');
    expect(practiceOf(['other', 'wheat', 'other'])).toBe('other');
    expect(practiceOf(['wheat', null, 'fallow'])).toBe('unknown');
  });

  it('lays the chosen rotation on the coming seasons', () => {
    const h: History = ['wheat', 'fallow', 'wheat'];
    const years = harvestYears(new Date(2026, 10, 15));
    // wheat just harvested: the first-year choice is now, wheat follows
    expect(twoYearPlan(stageOf(h), ['chickpea', 'wheat'], years[2])).toEqual([
      { harvestYear: 2027, crop: 'chickpea' },
      { harvestYear: 2028, crop: 'wheat' },
    ]);
    // fallow just finished: wheat goes in now, the choice comes after it
    expect(twoYearPlan('wheat_after_fallow', ['lentil', 'wheat'], 2026)).toEqual([
      { harvestYear: 2027, crop: 'wheat' },
      { harvestYear: 2028, crop: 'lentil' },
    ]);
    expect(twoYearPlan('wheat_after_legume', ['fallow', 'wheat'], 2026)).toEqual([
      { harvestYear: 2027, crop: 'wheat' },
      { harvestYear: 2028, crop: 'fallow' },
    ]);
    // not known where the field stands: show the rotation in its own order
    expect(twoYearPlan('unknown', ['fallow', 'wheat'], 2026)).toEqual([
      { harvestYear: 2027, crop: 'fallow' },
      { harvestYear: 2028, crop: 'wheat' },
    ]);
  });
});
