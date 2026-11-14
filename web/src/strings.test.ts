import { describe, expect, it } from 'vitest';
import { S } from './strings';

// AGENTS.md "Para gösterilmez" and "Öneri dili": no amounts of money and none of
// the forbidden phrases. Saying a price "moves ±20 %" is allowed (§14); a TL
// figure, profit or cost is not.
const FORBIDDEN = [/profit guaranteed/i, /kâr garantili/i, /\bcertain\b/i, /\bkesin/i, /\bbanned\b/i, /\byasak\b/i, /\bTL\b/, /\bkâr\b/i, /\bprofit\b/i, /\bcost\b/i, /\bmaliyet/i, /\bgelir/i, /\bincome\b/i];

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
});
