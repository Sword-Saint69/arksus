// What to plant in the coming season, from the suggested sequence and what the
// farmer said was last on the field. The engine compares two-year sequences
// (first-year crop, then wheat); the farmer only needs the next step:
//  - a cereal just came off: the next crop is the sequence's first-year crop,
//    and the other sequences that pass the guardrails are the alternatives;
//  - the field was fallow or under a legume: wheat is due now, and the choice
//    of first-year crop comes the year after.

import type { CropId } from '@/lib/types';
import type { Verdict } from './verdict';
import type { Stage } from './history';

export interface Alternative { crop: CropId; rotationId: string; close: boolean }

export interface NextSeason {
  /** Crop for the coming harvest year. */
  crop: CropId;
  harvestYear: number;
  /** True when the coming season is wheat and the first-year choice follows it. */
  wheatNow: boolean;
  /** The crop that follows, one year later. */
  then: CropId;
  /** Other first-year crops that pass the guardrails, best first. */
  alternatives: Alternative[];
}

export function nextSeason(stage: Stage, verdict: Verdict, lastHarvestYear: number): NextSeason | null {
  const rec = verdict.recommended;
  if (!rec) return null;
  const [first, second] = rec.rotation.crops;
  const wheatNow = stage === 'wheat_after_fallow' || stage === 'wheat_after_legume';
  const alternatives = verdict.options
    .filter((o) => o.status === 'eligible' && o.rotation.id !== rec.rotation.id && o.rotation.crops[0] !== first)
    .map((o) => ({ crop: o.rotation.crops[0], rotationId: o.rotation.id, close: verdict.closeCall && verdict.runnerUp?.rotation.id === o.rotation.id }));
  return wheatNow
    ? { crop: second, harvestYear: lastHarvestYear + 1, wheatNow, then: first, alternatives }
    : { crop: first, harvestYear: lastHarvestYear + 1, wheatNow, then: second, alternatives };
}
