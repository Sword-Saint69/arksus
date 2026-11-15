import { describe, expect, it } from 'vitest';
import { summarise } from './power';
import { parseCoords } from './geocode';

function series(startDay: Date, values: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  values.forEach((v, i) => {
    const d = new Date(startDay.getTime() + i * 86400_000);
    out[`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`] = v;
  });
  return out;
}

describe('NASA POWER recent rain', () => {
  it('sums the last 30 days that have data and skips the fill value', () => {
    // 40 days of 1 mm, then three days still missing (-999), as the near-real-time feed returns them
    const daily = series(new Date(Date.UTC(2026, 9, 1)), [...Array(40).fill(1), -999, -999, -999]);
    const r = summarise(daily, null)!;
    expect(r.days).toHaveLength(30);
    expect(r.totalMm).toBeCloseTo(30, 9);
    expect(r.from).toBe('2026-10-11');
    expect(r.to).toBe('2026-11-09');
    expect(r.usualMm).toBeNull();
  });

  it('builds the usual amount from the monthly climatology of the same days', () => {
    const daily = series(new Date(Date.UTC(2026, 9, 1)), Array(40).fill(0.5));   // 1 Oct … 9 Nov
    const clim = { JAN: 1, FEB: 1, MAR: 1, APR: 1, MAY: 1, JUN: 1, JUL: 1, AUG: 1, SEP: 1, OCT: 0.8, NOV: 1.2, DEC: 1, ANN: 1 };
    const r = summarise(daily, clim, 'January 2001 - December 2025')!;
    // 11–31 Oct = 21 days × 0.8, 1–9 Nov = 9 days × 1.2
    expect(r.usualMm).toBeCloseTo(21 * 0.8 + 9 * 1.2, 9);
    expect(r.totalMm).toBeCloseTo(15, 9);
    expect(r.usualRange).toBe('January 2001 - December 2025');
  });

  it('gives nothing rather than a partial sum when too few days have data', () => {
    expect(summarise(series(new Date(Date.UTC(2026, 9, 1)), Array(12).fill(2)), null)).toBeNull();
  });
});

describe('coordinate input', () => {
  it('reads a point written with dots or Turkish decimal commas', () => {
    expect(parseCoords('37.876, 34.6795')).toEqual({ lat: 37.876, lon: 34.6795 });
    expect(parseCoords('37,876 34,6795')).toEqual({ lat: 37.876, lon: 34.6795 });
    expect(parseCoords('Karapınar')).toBeNull();
    expect(parseCoords('95, 34')).toBeNull();
  });
});
