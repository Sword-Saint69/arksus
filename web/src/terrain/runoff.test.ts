import { describe, expect, it } from 'vitest';
import { Runoff } from './runoff';

const N = 24, CELL = 10;
const grid = (f: (i: number, j: number) => number) => {
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = f(i, j);
  return h;
};
const run = (r: Runoff, minutes: number, rainMmH: number, infilMmH: number) => {
  for (let s = 0; s < minutes * 6; s++) r.step(10, rainMmH / 1000 / 3600, infilMmH / 1000 / 3600);
};

describe('Runoff', () => {
  it('conserves water: rain = soaked + left + still on the surface', () => {
    const r = new Runoff(grid((i, j) => 100 - i * 0.3 + Math.sin(j) * 0.2), N, N, CELL);
    run(r, 120, 40, 5);
    const accounted = r.infiltrated + r.outflow + r.stored;
    expect(Math.abs(r.rained - accounted) / r.rained).toBeLessThan(1e-4);
  });

  it('a bowl keeps its water', () => {
    const r = new Runoff(grid((i, j) => ((i - N / 2) ** 2 + (j - N / 2) ** 2) * 0.02), N, N, CELL);
    run(r, 60, 30, 0);
    expect(r.outflow).toBeLessThan(r.rained * 0.001);
    // and the water gathers at the bottom
    const c = (N / 2) * N + N / 2;
    expect(r.W[c]).toBeGreaterThan(r.W[1 * N + 1] * 5);
  });

  it('a slope sheds most of a short storm', () => {
    const r = new Runoff(grid((i) => 100 - i * 0.5), N, N, CELL);
    run(r, 180, 30, 0);
    expect(r.outflow / r.rained).toBeGreaterThan(0.5);
  });

  it('nothing moves when it does not rain', () => {
    const r = new Runoff(grid((i) => 100 - i), N, N, CELL);
    run(r, 30, 0, 0);
    expect(r.stored).toBe(0);
    expect(r.outflow).toBe(0);
  });
});
