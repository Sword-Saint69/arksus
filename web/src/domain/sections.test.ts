import { describe, expect, it } from 'vitest';
import { ADVANCED_ONLY, isCustom, normalizePrefs, showFor, visible } from './sections';

describe('result sections by mode', () => {
  it('simple mode hides the advanced sections, advanced shows everything', () => {
    const simple = { mode: 'simple' as const, show: showFor('simple') };
    for (const id of ADVANCED_ONLY) expect(visible(simple, id)).toBe(false);
    expect(visible(simple, 'fertilizer')).toBe(true);
    expect(Object.values(showFor('advanced')).every(Boolean)).toBe(true);
  });
  it('the suggestion is always shown, even if switched off by hand', () => {
    expect(visible({ mode: 'simple', show: { ...showFor('simple'), summary: false } }, 'summary')).toBe(true);
  });
  it('notices hand-picked sections and repairs old or broken prefs', () => {
    expect(isCustom({ mode: 'simple', show: { ...showFor('simple'), calendar: true } })).toBe(true);
    expect(normalizePrefs(null)).toEqual({ mode: 'simple', show: showFor('simple') });
    expect(normalizePrefs({ mode: 'advanced', show: { calendar: false } }).show.calendar).toBe(false);
  });
});
