// Which pilot district's results stand for a field. The engine computes one
// representative point per district (site_index.locations); a field gets the
// nearest one, and the page always says how far it is and that the result
// describes the district, not the field.

import type { Location, SiteIndex } from '@/lib/types';
import { haversineKm, type LngLat } from './geo';

/**
 * Beyond this distance a pilot point is not offered as the field's result.
 * Same reach the map application used (pilots.nearest, 80 km): a display rule,
 * not a model parameter.
 */
export const COVERAGE_KM = 80;

export interface Nearest { location: Location; km: number }

export function nearestPilot(site: SiteIndex, at: LngLat): Nearest | null {
  let best: Nearest | null = null;
  for (const location of site.locations) {
    const km = haversineKm(at, [location.lon, location.lat]);
    if (!best || km < best.km) best = { location, km };
  }
  return best;
}

export interface Coverage { location: Location | null; km: number; covered: boolean }

export function coverageOf(site: SiteIndex, at: LngLat): Coverage {
  const n = nearestPilot(site, at);
  if (!n) return { location: null, km: Infinity, covered: false };
  return { location: n.location, km: n.km, covered: n.km <= COVERAGE_KM };
}
