// What the farmer grew in the last three years, and what that says about the
// coming season. The engine does not take crop history as an input: here it only
// (1) places the field in the two-year sequence, so the advice starts with the
// right step, and (2) names the practice the farmer follows today. No agronomic
// numbers are derived from it.

import type { CropId } from '@/lib/types';

export type PastCrop = 'wheat' | 'barley' | 'chickpea' | 'lentil' | 'fallow' | 'other';
export const PAST_CROPS: PastCrop[] = ['wheat', 'barley', 'chickpea', 'lentil', 'fallow', 'other'];

/** Oldest first; the last entry is the latest finished harvest. `null` = not answered. */
export type History = [PastCrop | null, PastCrop | null, PastCrop | null];
export const EMPTY_HISTORY: History = [null, null, null];

/**
 * The three most recent harvest years that are over. The farming year turns in
 * July, the month the engine's 24-month sequences start (results: index 0 = July).
 */
export function harvestYears(today: Date): [number, number, number] {
  const last = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return [last - 2, last - 1, last];
}

export type Stage =
  | 'choose_first_year'     // a cereal was just harvested: fallow, chickpea or lentil comes next
  | 'wheat_after_fallow'    // the field was fallow: wheat is sown now
  | 'wheat_after_legume'    // a legume was just harvested: wheat is sown now
  | 'unknown';

const isCereal = (c: PastCrop | null) => c === 'wheat' || c === 'barley';
const isLegume = (c: PastCrop | null) => c === 'chickpea' || c === 'lentil';

export function stageOf(h: History): Stage {
  const last = h[2];
  if (isCereal(last)) return 'choose_first_year';
  if (last === 'fallow') return 'wheat_after_fallow';
  if (isLegume(last)) return 'wheat_after_legume';
  return 'unknown';
}

export type Practice = 'fallow_cereal' | 'legume_cereal' | 'cereal_every_year' | 'other' | 'unknown';

export function practiceOf(h: History): Practice {
  if (h.some((c) => c === null)) return 'unknown';
  if (h.some((c) => c === 'other')) return 'other';
  if (h.some(isLegume)) return 'legume_cereal';
  if (h.some((c) => c === 'fallow')) return 'fallow_cereal';
  return 'cereal_every_year';
}

export interface PlanYear { harvestYear: number; crop: CropId }

/**
 * The chosen rotation ([first-year crop, 'wheat']) laid on the next two harvest
 * years. When the field has just been fallow or under a legume, wheat is the
 * crop of this season and the first-year choice follows it.
 */
export function twoYearPlan(stage: Stage, crops: [CropId, CropId], lastHarvestYear: number): [PlanYear, PlanYear] {
  const [first, second] = crops;
  const wheatNow = stage === 'wheat_after_fallow' || stage === 'wheat_after_legume';
  return wheatNow
    ? [{ harvestYear: lastHarvestYear + 1, crop: second }, { harvestYear: lastHarvestYear + 2, crop: first }]
    : [{ harvestYear: lastHarvestYear + 1, crop: first }, { harvestYear: lastHarvestYear + 2, crop: second }];
}
