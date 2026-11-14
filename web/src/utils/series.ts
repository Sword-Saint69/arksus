import type { RotationId } from '@/lib/types';
import type { Lang } from '@/strings';

/**
 * One fixed colour per rotation, the same on every chart (colour follows the
 * entity, never its rank). Validated with the dataviz palette checker against
 * the paper surface #fbfaf6: lightness, chroma, CVD and normal-vision separation
 * and 3:1 contrast all pass. Fallow is soil brown, chickpea gold, lentil blue.
 */
export const ROTATION_COLOR: Record<RotationId, string> = {
  fallow_wheat: '#94541f',
  chickpea_wheat: '#b8860b',
  lentil_wheat: '#127fa8',
};

/** Month labels for a 24-month sequence: index 0 = July of the start year (ISMAIL_BAKMALI §7). */
export function sequenceMonths(lang: Lang): string[] {
  const fmt = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short' });
  return Array.from({ length: 24 }, (_, i) => fmt.format(new Date(2001, (6 + i) % 12, 1)));
}
