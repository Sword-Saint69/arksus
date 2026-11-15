import { describe, expect, it } from 'vitest';
import { FRAMES, HEIGHT, PALETTE, runs, WIDTH } from './sprite';

describe('farmer sprite', () => {
  it('every frame is the same size and uses only palette colours', () => {
    for (const [name, g] of Object.entries(FRAMES)) {
      expect(g.length, name).toBe(HEIGHT);
      for (const row of g) {
        expect(row.length, name).toBe(WIDTH);
        for (const ch of row) expect(ch === '.' || ch in PALETTE, `${name}: ${ch}`).toBe(true);
      }
    }
  });
  it('frames differ from the resting one only where they should', () => {
    const diffRows = (a: string[][], b: string[][]) => a.map((r, y) => (r.join('') === b[y].join('') ? -1 : y)).filter((y) => y >= 0);
    expect(diffRows(FRAMES.idle, FRAMES.blink)).toEqual([8]);
    expect(diffRows(FRAMES.idle, FRAMES.talkOpen)).toEqual([11, 12]);
    expect(diffRows(FRAMES.idle, FRAMES.waveA).every((y) => y >= 7 && y <= 21)).toBe(true);
  });
  it('runs cover every coloured pixel exactly once', () => {
    const g = FRAMES.idle;
    const coloured = g.flat().filter((c) => c !== '.').length;
    expect(runs(g).reduce((s, r) => s + r.w, 0)).toBe(coloured);
  });
});
