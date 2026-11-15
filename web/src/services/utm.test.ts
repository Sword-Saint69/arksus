import { describe, expect, it } from 'vitest';
import { haversineKm } from '@/domain/geo';
import { fromUtm, toUtm, zoneOf } from './utm';
import { ndvi, springWindow } from './sentinel';

describe('UTM', () => {
  it('zones of Turkey', () => {
    expect(zoneOf(27.1)).toBe(35);
    expect(zoneOf(34.68)).toBe(36);
    expect(zoneOf(41.0)).toBe(37);
  });

  it('the central meridian sits at 500 km east, the equator at 0 north', () => {
    const [e, n] = toUtm(33, 0, 36);
    expect(e).toBeCloseTo(500000, 6);
    expect(n).toBeCloseTo(0, 6);
  });

  it('a meridian arc has the right length: equator → 38°N is 4 207 498.02 m on WGS84', () => {
    // Reference from a separate numerical integration of the WGS84 meridian (Simpson, 200 000 steps).
    // UTM northing on the central meridian is that distance × 0.9996.
    const [, n] = toUtm(33, 38, 36);
    expect(n / 0.9996).toBeCloseTo(4207498.02, 1);
  });

  it('round-trips to under a millimetre (1e-8° is about 1 mm)', () => {
    for (const [lon, lat] of [[34.6795, 37.876], [30.6, 39.84], [35.9, 41.9], [36.0, 36.2]] as const) {
      const zone = zoneOf(lon);
      const [e, n] = toUtm(lon, lat, zone);
      const [lon2, lat2] = fromUtm(e, n, zone);
      expect(lon2).toBeCloseTo(lon, 8);
      expect(lat2).toBeCloseTo(lat, 8);
    }
  });

  it('grid distances match ground distances (scale 0.9996–1.0004 inside a zone)', () => {
    const a: [number, number] = [34.67, 37.87], b: [number, number] = [34.69, 37.89];
    const [ea, na] = toUtm(...a, 36), [eb, nb] = toUtm(...b, 36);
    const grid = Math.hypot(eb - ea, nb - na) / 1000;
    expect(grid / haversineKm(a, b)).toBeGreaterThan(0.998);
    expect(grid / haversineKm(a, b)).toBeLessThan(1.002);
  });

  it('the corner of Sentinel-2 tile 36SXG lands where its footprint says', () => {
    // proj:transform of the tile: origin (600000, 4200000); the item bbox is [34.123, 36.935, 35.387, 37.942]
    const [lon, lat] = fromUtm(600000, 4200000, 36);
    expect(lon).toBeGreaterThan(34.12); expect(lon).toBeLessThan(34.15);
    expect(lat).toBeGreaterThan(37.93); expect(lat).toBeLessThan(37.95);
  });
});

describe('greenness helpers', () => {
  it('NDVI from reflectance', () => {
    expect(ndvi(0.05, 0.45)).toBeCloseTo(0.8, 9);
    expect(ndvi(0.2, 0.25)).toBeCloseTo(0.1111, 3);
    expect(ndvi(0, 0)).toBeNull();
    expect(ndvi(-0.01, 0.2)).toBeNull();
  });

  it('"last spring" is the latest spring that is over', () => {
    expect(springWindow(new Date(2026, 10, 15))).toEqual(['2026-04-15', '2026-06-10']);
    expect(springWindow(new Date(2026, 4, 20))).toEqual(['2025-04-15', '2025-06-10']);
    expect(springWindow(new Date(2026, 5, 11))).toEqual(['2026-04-15', '2026-06-10']);
  });
});
