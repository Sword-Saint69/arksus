import type { Weights } from '@/lib/economics';

/**
 * Farmer-friendly priority choices. "balanced" is the team default from
 * defaults.decision.weights; the others are the farmer's own emphasis (shown
 * with the "your value" badge). The detailed analysis page still has the four
 * sliders for anyone who wants to fine-tune.
 */
export type PriorityId = 'balanced' | 'value' | 'yield' | 'soil' | 'water';
export const PRIORITY_IDS: PriorityId[] = ['balanced', 'value', 'yield', 'soil', 'water'];

export function weightsFor(p: PriorityId, defaults: Weights): Weights {
  switch (p) {
    case 'value': return { value: 0.6, yield: 0.2, soil: 0.1, water: 0.1 };
    case 'yield': return { value: 0.2, yield: 0.6, soil: 0.1, water: 0.1 };
    case 'soil': return { value: 0.2, yield: 0.2, soil: 0.5, water: 0.1 };
    case 'water': return { value: 0.2, yield: 0.2, soil: 0.1, water: 0.5 };
    default: return defaults;
  }
}
