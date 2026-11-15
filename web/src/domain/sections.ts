// The result's sections, and which of them each mode shows. Simple mode keeps
// what a farmer acts on (the suggestion, what to sow and how, fertilizer, soil health);
// advanced mode adds the charts and models behind it. A farmer may also pick
// sections one by one in the settings.

export const SECTION_IDS = [
  'summary', 'options', 'climates', 'twoYears', 'calendar', 'whatIf', 'terrain',
  'now', 'fertilizer', 'sowing', 'soilHealth', 'greenness', 'ai', 'details',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export type Mode = 'simple' | 'advanced';

/** Shown only in advanced mode. */
export const ADVANCED_ONLY: readonly SectionId[] = ['climates', 'twoYears', 'calendar', 'whatIf', 'terrain', 'now'];

/** Always shown: without it the page has no answer. */
export const ALWAYS: readonly SectionId[] = ['summary'];

export type Show = Record<SectionId, boolean>;
export interface Prefs { mode: Mode; show: Show }

export function showFor(mode: Mode): Show {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, mode === 'advanced' || !ADVANCED_ONLY.includes(id)])) as Show;
}

export const DEFAULT_PREFS: Prefs = { mode: 'simple', show: showFor('simple') };

/** True when the farmer has changed sections by hand since picking the mode. */
export function isCustom(p: Prefs): boolean {
  const d = showFor(p.mode);
  return SECTION_IDS.some((id) => d[id] !== p.show[id]);
}

export function visible(p: Prefs, id: SectionId): boolean {
  return ALWAYS.includes(id) || p.show[id] !== false;
}

/** Prefs read from storage may be old or partial: fill the gaps from the mode. */
export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw ?? {}) as Partial<Prefs>;
  const mode: Mode = r.mode === 'advanced' ? 'advanced' : 'simple';
  const base = showFor(mode);
  const show = { ...base };
  if (r.show && typeof r.show === 'object') for (const id of SECTION_IDS) if (typeof r.show[id] === 'boolean') show[id] = r.show[id];
  return { mode, show };
}
