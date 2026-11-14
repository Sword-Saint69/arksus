// Web Mercator helpers and the scene coordinate frame.
//
// The scene uses mercator metres relative to a fixed origin in central Turkey.
// A world-centred origin would leave ~4 m of float32 jitter at street level
// (coordinates around 2e7); centring on Turkey keeps everything we care about
// under ~1.5e6, where float32 resolves a few centimetres.

export const R = 6378137;
export const WORLD = 2 * Math.PI * R;
export const HALF = WORLD / 2;

export type Merc = { x: number; y: number };
export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

export function lonLatToMerc(lon: number, lat: number): Merc {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return {
    x: (lon * Math.PI * R) / 180,
    y: R * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)),
  };
}

export function mercToLonLat(x: number, y: number): [number, number] {
  const lon = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lon, lat];
}

export const ORIGIN = lonLatToMerc(35.0, 39.0);

/** Scene X grows east, scene Z grows south (north is -Z), Y is up. */
export function mercToScene(x: number, y: number): { x: number; z: number } {
  return { x: x - ORIGIN.x, z: -(y - ORIGIN.y) };
}

export function sceneToMerc(sx: number, sz: number): Merc {
  return { x: sx + ORIGIN.x, y: -sz + ORIGIN.y };
}

/** Mercator stretches distances by 1/cos(lat); heights must be stretched too. */
export function mercScale(y: number): number {
  return Math.cosh(y / R);
}

export function tileSize(z: number): number {
  return WORLD / (1 << z);
}

export function tileBBox(z: number, x: number, y: number): BBox {
  const s = tileSize(z);
  const minX = -HALF + x * s;
  const maxY = HALF - y * s;
  return { minX, maxX: minX + s, maxY, minY: maxY - s };
}

export function mercToTile(z: number, mx: number, my: number): [number, number] {
  const n = 1 << z;
  const tx = Math.floor(((mx + HALF) / WORLD) * n);
  const ty = Math.floor(((HALF - my) / WORLD) * n);
  return [Math.min(n - 1, Math.max(0, tx)), Math.min(n - 1, Math.max(0, ty))];
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function ringBBox(ring: ArrayLike<number>, into?: BBox): BBox {
  const b = into ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < ring.length; i += 2) {
    const x = ring[i], y = ring[i + 1];
    if (x < b.minX) b.minX = x;
    if (x > b.maxX) b.maxX = x;
    if (y < b.minY) b.minY = y;
    if (y > b.maxY) b.maxY = y;
  }
  return b;
}

/** Signed planar area of a flat [x0,y0,x1,y1,...] ring. */
export function ringArea(ring: ArrayLike<number>): number {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return a / 2;
}

export function pointInRing(px: number, py: number, ring: ArrayLike<number>): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Polygon = outer ring followed by holes, each ring a flat mercator array. */
export type Polygon = Float64Array[];

export function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  if (!pointInRing(px, py, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (pointInRing(px, py, poly[i])) return false;
  return true;
}

/** True ground area in m² (mercator area divided by the local scale squared). */
export function polygonAreaM2(polys: Polygon[]): number {
  let total = 0;
  for (const poly of polys) {
    const b = ringBBox(poly[0]);
    const k = mercScale((b.minY + b.maxY) / 2);
    let a = Math.abs(ringArea(poly[0]));
    for (let i = 1; i < poly.length; i++) a -= Math.abs(ringArea(poly[i]));
    total += a / (k * k);
  }
  return total;
}

export function polygonPerimeterM(polys: Polygon[]): number {
  let total = 0;
  for (const poly of polys) {
    const r = poly[0];
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      const k = mercScale((r[i + 1] + r[j + 1]) / 2);
      total += Math.hypot(r[j] - r[i], r[j + 1] - r[i + 1]) / k;
    }
  }
  return total;
}

export function polygonCentroid(polys: Polygon[]): Merc {
  // Area-weighted centroid of the largest outer ring; good enough for a label anchor.
  let best = polys[0][0];
  let bestA = 0;
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]));
    if (a > bestA) { bestA = a; best = p[0]; }
  }
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < best.length; i += 2) {
    const j = (i + 2) % best.length;
    const f = best[i] * best[j + 1] - best[j] * best[i + 1];
    cx += (best[i] + best[j]) * f;
    cy += (best[i + 1] + best[j + 1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) return { x: best[0], y: best[1] };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'K' : 'G'}`;
}
export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'D' : 'B'}`;
}
