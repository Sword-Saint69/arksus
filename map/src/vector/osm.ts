// Turns Overpass `out geom` elements into mercator polygons.
// Used both at runtime (fields) and by the build script (islands), so it has
// no DOM or three.js dependencies.

import { lonLatToMerc, ringArea, type Polygon } from '../geo';

export type LatLon = { lat: number; lon: number };
export type OverpassElement = {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: LatLon[];
  members?: { type: string; role: string; geometry?: LatLon[] }[];
};

export type OsmArea = {
  osmType: 'way' | 'relation';
  osmId: number;
  tags: Record<string, string>;
  polys: Polygon[];
};

function toFlat(points: LatLon[]): Float64Array {
  // Drop the closing duplicate; rings are implicitly closed everywhere else.
  let n = points.length;
  if (n > 1 && points[0].lat === points[n - 1].lat && points[0].lon === points[n - 1].lon) n--;
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const m = lonLatToMerc(points[i].lon, points[i].lat);
    out[i * 2] = m.x;
    out[i * 2 + 1] = m.y;
  }
  return out;
}

const same = (a: LatLon, b: LatLon) => a.lat === b.lat && a.lon === b.lon;

/** Join open way segments end-to-end into closed rings (multipolygon members are often split). */
export function stitchRings(segments: LatLon[][]): LatLon[][] {
  const pool = segments.filter((s) => s.length > 1).map((s) => s.slice());
  const rings: LatLon[][] = [];
  while (pool.length) {
    let ring = pool.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      const tail = ring[ring.length - 1];
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (same(s[0], tail)) ring = ring.concat(s.slice(1));
        else if (same(s[s.length - 1], tail)) ring = ring.concat(s.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    // An unclosed ring means the relation was clipped by the query bbox; keep it
    // anyway, closing it straight across, because dropping it loses the field.
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function ringContains(outer: Float64Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = outer.length - 2; i < outer.length; j = i, i += 2) {
    const xi = outer[i], yi = outer[i + 1], xj = outer[j], yj = outer[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function elementToArea(el: OverpassElement): OsmArea | null {
  const tags = el.tags ?? {};
  if (el.type === 'way') {
    if (!el.geometry || el.geometry.length < 4) return null;
    return { osmType: 'way', osmId: el.id, tags, polys: [[toFlat(el.geometry)]] };
  }
  if (el.type === 'relation' && el.members) {
    const outers = stitchRings(el.members.filter((m) => m.role !== 'inner' && m.geometry).map((m) => m.geometry!)).map(toFlat);
    const inners = stitchRings(el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry!)).map(toFlat);
    if (!outers.length) return null;
    const polys: Polygon[] = outers.map((o) => [o]);
    for (const inner of inners) {
      const owner = polys.find((p) => ringContains(p[0], inner[0], inner[1]));
      if (owner) owner.push(inner);
    }
    return { osmType: 'relation', osmId: el.id, tags, polys };
  }
  return null;
}

/** Douglas–Peucker on a flat ring; tolerance in the ring's own units. */
export function simplifyRing(ring: Float64Array, tol: number): Float64Array {
  const n = ring.length / 2;
  if (n <= 4) return ring;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = ring[a * 2], ay = ring[a * 2 + 1], bx = ring[b * 2], by = ring[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const px = ring[i * 2], py = ring[i * 2 + 1];
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  let count = 0;
  for (let i = 0; i < n; i++) count += keep[i];
  if (count < 3) return ring;
  const out = new Float64Array(count * 2);
  for (let i = 0, k = 0; i < n; i++) if (keep[i]) { out[k++] = ring[i * 2]; out[k++] = ring[i * 2 + 1]; }
  return out;
}

export function isDegenerate(ring: Float64Array): boolean {
  return ring.length < 6 || Math.abs(ringArea(ring)) < 1;
}
