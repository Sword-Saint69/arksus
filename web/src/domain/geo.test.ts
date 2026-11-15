import { describe, expect, it } from 'vitest';
import {
  areaM2, bboxOf, centroidOf, edgeQuads, gridCells, haversineKm, localFrame, longAxisAngle, openRing,
  perimeterM, pointInAny, squareAround, stripIndex, type Polygon,
} from './geo';

// A real parcel as TKGM returns it (Niğde, Sazlıca/Yeni 220/28; registered area 60 074.32 m²).
const NIGDE_220_28: Polygon = [[
  [34.67754, 37.87657], [34.67756, 37.87608], [34.67759, 37.87564], [34.67762, 37.87532], [34.67986, 37.87595],
  [34.68065, 37.87615], [34.68159, 37.87638], [34.68178, 37.87643], [34.68213, 37.87653], [34.68193, 37.87691],
  [34.68149, 37.87776], [34.68137, 37.87799], [34.68062, 37.87772], [34.67999, 37.87748], [34.67929, 37.87721],
  [34.67754, 37.87657],
]];

describe('geo', () => {
  it('drops the closing point of a ring', () => {
    expect(openRing(NIGDE_220_28[0])).toHaveLength(15);
    expect(openRing([[0, 0], [1, 0], [1, 1]])).toHaveLength(3);
  });

  it('local frame round-trips and measures metres', () => {
    const f = localFrame([34.68, 37.876]);
    const [x, y] = f.fwd([34.69, 37.886]);
    const back = f.inv(x, y);
    expect(back[0]).toBeCloseTo(34.69, 9);
    expect(back[1]).toBeCloseTo(37.886, 9);
    // 0.01° of latitude is about 1110 m; of longitude at 37.9°N about 879 m
    expect(y).toBeGreaterThan(1105); expect(y).toBeLessThan(1115);
    expect(x).toBeGreaterThan(870); expect(x).toBeLessThan(885);
  });

  it('a 100 m square is one hectare', () => {
    const sq = squareAround([33.48, 37.67], 100);
    expect(areaM2([sq])).toBeCloseTo(10_000, 0);
    expect(perimeterM([sq])).toBeCloseTo(400, 1);
  });

  it('matches the registered area of a real TKGM parcel within 2 %', () => {
    const a = areaM2([NIGDE_220_28]);
    expect(Math.abs(a - 60_074.32) / 60_074.32).toBeLessThan(0.02);
  });

  it('holes are subtracted', () => {
    const outer = squareAround([33.48, 37.67], 100)[0];
    const hole = squareAround([33.48, 37.67], 20)[0];
    expect(areaM2([[outer, hole]])).toBeCloseTo(10_000 - 400, 0);
  });

  it('centroid and bbox sit on the parcel', () => {
    const c = centroidOf([NIGDE_220_28]);
    expect(pointInAny(c, [NIGDE_220_28])).toBe(true);
    const [w, s, e, n] = bboxOf([NIGDE_220_28]);
    expect(w).toBe(34.67754); expect(e).toBe(34.68213); expect(s).toBe(37.87532); expect(n).toBe(37.87799);
    expect(pointInAny([34.60, 37.80], [NIGDE_220_28])).toBe(false);
  });

  it('haversine: Niğde pilot point to Nevşehir pilot point is about 74 km', () => {
    const km = haversineKm([34.6795, 37.876], [34.6477, 38.5385]);
    expect(km).toBeGreaterThan(72); expect(km).toBeLessThan(76);
  });

  it('long axis follows the longest edge', () => {
    // 300 m east–west by 100 m north–south rectangle: long axis is east (0 rad, or π)
    const f = localFrame([33, 38]);
    const rect: Polygon = [[f.inv(-150, -50), f.inv(150, -50), f.inv(150, 50), f.inv(-150, 50)]];
    const a = longAxisAngle([rect]);
    expect(Math.abs(Math.sin(a))).toBeLessThan(1e-6);
  });

  it('grid cells stay inside, respect the cap and are deterministic', () => {
    const g = gridCells([NIGDE_220_28], { maxCells: 600 });
    expect(g.cells.length).toBeGreaterThan(300);
    expect(g.cells.length).toBeLessThanOrEqual(660);   // the cap is on the estimate, edges add a little slack
    for (const c of g.cells) {
      const cx = (c.ring[0][0] + c.ring[2][0]) / 2, cy = (c.ring[0][1] + c.ring[2][1]) / 2;
      expect(pointInAny([cx, cy], [NIGDE_220_28])).toBe(true);
      expect(c.ring).toHaveLength(4);
    }
    const again = gridCells([NIGDE_220_28], { maxCells: 600 });
    expect(again.cells.map((c) => c.k)).toEqual(g.cells.map((c) => c.k));
    // covered area is close to the parcel area when cells are not inset
    const full = gridCells([NIGDE_220_28], { maxCells: 600, fillU: 1, fillV: 1 });
    const covered = full.cells.length * full.sizeM * full.sizeM;
    expect(Math.abs(covered - areaM2([NIGDE_220_28])) / areaM2([NIGDE_220_28])).toBeLessThan(0.06);
  });

  it('small fields never get cells below the minimum size', () => {
    const tiny = squareAround([33.48, 37.67], 30);
    const g = gridCells([tiny], { maxCells: 900, minSizeM: 3 });
    expect(g.sizeM).toBe(3);
    expect(g.cells.length).toBeGreaterThan(60);
    expect(g.cells.length).toBeLessThanOrEqual(121);
  });

  it('strips split the cells into equal parts along the long axis', () => {
    const g = gridCells([NIGDE_220_28], { maxCells: 600 });
    const s = stripIndex(g.cells, 3);
    const n = [0, 1, 2].map((i) => s.filter((x) => x === i).length);
    expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(1);
    // strip 0 lies before strip 2 along u
    const maxU0 = Math.max(...g.cells.filter((_, i) => s[i] === 0).map((c) => c.u));
    const minU2 = Math.min(...g.cells.filter((_, i) => s[i] === 2).map((c) => c.u));
    expect(maxU0).toBeLessThanOrEqual(minU2);
  });

  it('edge quads: one per boundary edge, each a thin 4-corner ring', () => {
    const sq = squareAround([33.48, 37.67], 100);
    const q = edgeQuads([sq], 2);
    expect(q).toHaveLength(4);
    for (const ring of q) {
      expect(ring).toHaveLength(4);
      expect(areaM2([[ring]])).toBeCloseTo(200, 0);   // 100 m × 2 m
    }
  });
});
