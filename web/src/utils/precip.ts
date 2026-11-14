import type { Location, ValidationFile } from '@/lib/types';

/**
 * Satellite (NASA POWER) vs ground station (MGM) rainfall gap for one district,
 * read from validation.json → precip_vs_mgm. The check's value is one text with
 * a "<district>: POWER … vs MGM … (+36 %); …" segment per district, keyed by the
 * district name or its id. Returns the percentage, or null if not listed.
 */
export function precipGapPct(validation: ValidationFile, loc: Location): number | null {
  const check = validation.checks.find((c) => c.id === 'precip_vs_mgm');
  if (!check?.value) return null;
  const keys = [loc.name, loc.id].map((k) => k.toLocaleLowerCase('tr'));
  for (const seg of check.value.split(';')) {
    const [head, ...rest] = seg.split(':');
    if (!rest.length || !keys.includes(head.trim().toLocaleLowerCase('tr'))) continue;
    const m = rest.join(':').match(/vs MGM[^()]*\(([+\-−]?\d+(?:[.,]\d+)?)\s*%\)/);
    if (m) return Number(m[1].replace('−', '-').replace(',', '.'));
  }
  return null;
}

/** ISMAIL_BAKMALI §10: warn when the gap is beyond ±20 %. */
export const PRECIP_WARN_PCT = 20;
