import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteIndex } from '@/lib/types';
import { COVERAGE_KM, coverageOf, nearestPilot } from './pilots';

const site = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/site_index.json'), 'utf-8')) as SiteIndex;

describe('pilot districts', () => {
  it('finds the nearest pilot point', () => {
    const n = nearestPilot(site, [34.6798, 37.8766])!;   // a parcel next to the Niğde pilot point
    expect(n.location.id).toBe('nigde');
    expect(n.km).toBeLessThan(1);
  });

  it('a field near a pilot point is covered; one far away is not', () => {
    const near = coverageOf(site, [33.50, 37.70]);        // by Karapınar
    expect(near.covered).toBe(true);
    expect(near.location?.id).toBe('karapinar');

    const istanbul = coverageOf(site, [28.98, 41.01]);
    expect(istanbul.covered).toBe(false);
    expect(istanbul.km).toBeGreaterThan(COVERAGE_KM);
    expect(istanbul.location).not.toBeNull();             // still named, so the page can say how far it is
  });

  it('every pilot point covers itself', () => {
    for (const l of site.locations) {
      const c = coverageOf(site, [l.lon, l.lat]);
      expect(c.location?.id, l.id).toBe(l.id);
      expect(c.km).toBeLessThan(0.01);
    }
  });
});
