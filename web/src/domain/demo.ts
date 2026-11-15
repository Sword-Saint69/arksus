// A clean, repeatable screen for the demo video: ?demo=<location_id> opens the
// result for that pilot district with fixed answers, whatever this browser
// remembered before. Answers are the plainest ones: rainfed; wheat, fallow,
// wheat in the last three harvests (so the first-year choice is due); medium
// depth; the team's balanced priorities; no soil test.

import type { Answers } from '@/state/store';
import type { SiteIndex, Location } from '@/lib/types';

export const DEMO_ANSWERS: Answers = {
  water: 'rainfed',
  history: ['wheat', 'fallow', 'wheat'] as Answers['history'],
  depth: 'medium',
  priority: 'balanced',
  hasSoilTest: false,
  soilTest: {},
};

/** The pilot location a ?demo= link asks for, or null when there is none or it is unknown. */
export function demoLocation(site: SiteIndex, search: string): Location | null {
  const id = new URLSearchParams(search).get('demo');
  if (!id) return null;
  return site.locations.find((l) => l.id === id) ?? null;
}
