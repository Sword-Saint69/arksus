import { describe, expect, it } from 'vitest';
import { S } from './strings';

// AGENTS.md "Para gösterilmez" and "Öneri dili": no amounts of money and none of
// the forbidden phrases. Saying a price "moves ±20 %" is allowed; a TL figure,
// profit or cost is not.
const FORBIDDEN = [/profit guaranteed/i, /kâr garantili/i, /\bcertain\b/i, /\bkesin/i, /\bbanned\b/i, /\byasak\b/i, /\bTL\b/, /₺/,
  /\bkâr\b/i, /\bprofit\b/i, /\bcost\b/i, /\bmaliyet/i, /\bgelir/i, /\bincome\b/i];

describe('strings', () => {
  it('every key has both languages filled', () => {
    for (const [key, v] of Object.entries(S)) {
      expect(v.en, `${key}.en`).not.toBe('');
      expect(v.tr, `${key}.tr`).not.toBe('');
    }
  });

  it('no forbidden or money words', () => {
    for (const [key, v] of Object.entries(S)) {
      for (const re of FORBIDDEN) {
        expect(re.test(v.en), `${key}.en matches ${re}`).toBe(false);
        expect(re.test(v.tr), `${key}.tr matches ${re}`).toBe(false);
      }
    }
  });

  it('both languages use the same placeholders', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, v] of Object.entries(S)) expect(vars(v.en), key).toBe(vars(v.tr));
  });

  it('the suggestion is worded as the team agreed', () => {
    expect(S.recTitle.tr).toBe('Önceliklerine göre bu arazi için en uygun');
    expect(S.recTitle.en).toBe('Most suitable for this land under your priorities');
  });
});
