// Plain WGS84 geometry for fields: areas in m², a local metre frame, the cell
// grid and strips the 3D field view is built from. No map library in here, so
// everything is unit-tested in node.

export type LngLat = [number, number];
/** Open ring: the first point is not repeated at the end. */
export type Ring = LngLat[];
/** Outer ring followed by holes. */
export type Polygon = Ring[];

const RAD = Math.PI / 180;
// WGS84 ellipsoid
const A = 6378137;
const E2 = 0.00669437999014;

export function openRing(ring: Ring): Ring {
  const n = ring.length;
  if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) return ring.slice(0, n - 1);
  return ring;
}

export function closedRing(ring: Ring): Ring {
  const r = openRing(ring);
  return r.length ? [...r, r[0]] : r;
}

export interface LocalFrame {
  origin: LngLat;
  /** lon/lat → metres east and north of the origin. */
  fwd(p: LngLat): [number, number];
  inv(x: number, y: number): LngLat;
}

/**
 * Tangent-plane frame around `origin`, using the ellipsoid's two radii of
 * curvature there. Over a field (hundreds of metres) the error is far below
 * the 1 m precision of cadastral coordinates.
 */
export function localFrame(origin: LngLat): LocalFrame {
  const phi = origin[1] * RAD;
  const s2 = Math.sin(phi) ** 2;
  const n = A / Math.sqrt(1 - E2 * s2);                 // prime vertical
  const m = (A * (1 - E2)) / (1 - E2 * s2) ** 1.5;      // meridian
  const kx = n * Math.cos(phi) * RAD;
  const ky = m * RAD;
  return {
    origin,
    fwd: (p) => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    inv: (x, y) => [origin[0] + x / kx, origin[1] + y / ky],
  };
}

export function bboxOf(polys: Polygon[]): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of polys) for (const p of poly[0]) {
    if (p[0] < w) w = p[0];
    if (p[0] > e) e = p[0];
    if (p[1] < s) s = p[1];
    if (p[1] > n) n = p[1];
  }
  return [w, s, e, n];
}

function bboxCentre(polys: Polygon[]): LngLat {
  const [w, s, e, n] = bboxOf(polys);
  return [(w + e) / 2, (s + n) / 2];
}

/** Signed shoelace area of an open ring already in metres. */
function shoelace(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return a / 2;
}

export function polygonAreaM2(poly: Polygon, frame = localFrame(bboxCentre([poly]))): number {
  let a = 0;
  poly.forEach((ring, i) => {
    const r = Math.abs(shoelace(openRing(ring).map(frame.fwd)));
    a += i === 0 ? r : -r;
  });
  return Math.max(0, a);
}

/** Ground area of a field made of one or more polygons, m². */
export function areaM2(polys: Polygon[]): number {
  if (!polys.length) return 0;
  const frame = localFrame(bboxCentre(polys));
  return polys.reduce((sum, p) => sum + polygonAreaM2(p, frame), 0);
}

export function perimeterM(polys: Polygon[]): number {
  if (!polys.length) return 0;
  const frame = localFrame(bboxCentre(polys));
  let total = 0;
  for (const poly of polys) {
    const pts = openRing(poly[0]).map(frame.fwd);
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      total += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    }
  }
  return total;
}

/** Area-weighted centroid of the outer rings (a label and camera anchor). */
export function centroidOf(polys: Polygon[]): LngLat {
  const frame = localFrame(bboxCentre(polys));
  let cx = 0, cy = 0, total = 0;
  for (const poly of polys) {
    const pts = openRing(poly[0]).map(frame.fwd);
    let a = 0, x = 0, y = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const f = pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
      a += f; x += (pts[i][0] + pts[j][0]) * f; y += (pts[i][1] + pts[j][1]) * f;
    }
    if (Math.abs(a) < 1e-9) continue;
    const w = Math.abs(a / 2);
    cx += (x / (3 * a)) * w; cy += (y / (3 * a)) * w; total += w;
  }
  if (!total) return polys[0]?.[0]?.[0] ?? frame.origin;
  return frame.inv(cx / total, cy / total);
}

function inRing(x: number, y: number, ring: ArrayLike<[number, number] | LngLat>): boolean {
  let inside = false;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(p: LngLat, poly: Polygon): boolean {
  if (!inRing(p[0], p[1], poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (inRing(p[0], p[1], poly[i])) return false;
  return true;
}

export const pointInAny = (p: LngLat, polys: Polygon[]): boolean => polys.some((poly) => pointInPolygon(p, poly));

export function haversineKm(a: LngLat, b: LngLat): number {
  const h = Math.sin(((b[1] - a[1]) * RAD) / 2) ** 2
    + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(((b[0] - a[0]) * RAD) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(h));
}

/** A north-aligned square of `sideM` metres centred on a point (the stand-in field of a pilot district). */
export function squareAround(center: LngLat, sideM: number): Polygon {
  const f = localFrame(center);
  const h = sideM / 2;
  return [[f.inv(-h, -h), f.inv(h, -h), f.inv(h, h), f.inv(-h, h)]];
}

/** Direction (radians from east) of the longest boundary edge: crop rows usually run along it. */
export function longAxisAngle(polys: Polygon[], frame = localFrame(bboxCentre(polys))): number {
  let best = 0, angle = 0;
  for (const poly of polys) {
    const pts = openRing(poly[0]).map(frame.fwd);
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
      const len = Math.hypot(dx, dy);
      if (len > best) { best = len; angle = Math.atan2(dy, dx); }
    }
  }
  return angle;
}

export interface Cell {
  /** Four corners, lon/lat. */
  ring: Ring;
  /** Centre in the field's own frame (metres): u along the long axis, v across it. */
  u: number;
  v: number;
  /** Stable id (grid position), so colours and heights do not flicker between rebuilds. */
  k: number;
}

export interface Grid { cells: Cell[]; sizeM: number; angle: number }

/**
 * Square cells laid along the field's long axis, kept when their centre is inside the field.
 * `maxCells` caps the count (larger fields get larger cells); `fillU`/`fillV` shrink each cell
 * inside its slot so rows read as rows.
 */
export function gridCells(
  polys: Polygon[],
  opts: { maxCells?: number; minSizeM?: number; fillU?: number; fillV?: number } = {},
): Grid {
  const { maxCells = 900, minSizeM = 3, fillU = 0.92, fillV = 0.62 } = opts;
  if (!polys.length) return { cells: [], sizeM: minSizeM, angle: 0 };
  const frame = localFrame(bboxCentre(polys));
  const angle = longAxisAngle(polys, frame);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const toUV = (p: LngLat): [number, number] => {
    const [x, y] = frame.fwd(p);
    return [x * cos + y * sin, -x * sin + y * cos];
  };
  const fromUV = (u: number, v: number): LngLat => frame.inv(u * cos - v * sin, u * sin + v * cos);

  const uv = polys.map((poly) => poly.map((ring) => openRing(ring).map(toUV)));
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, area = 0;
  for (const poly of uv) {
    for (const [u, v] of poly[0]) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    poly.forEach((ring, i) => { area += (i === 0 ? 1 : -1) * Math.abs(shoelace(ring)); });
  }
  const sizeM = Math.max(minSizeM, Math.sqrt(Math.max(area, 1) / maxCells));
  const cols = Math.max(1, Math.ceil((u1 - u0) / sizeM));
  const rows = Math.max(1, Math.ceil((v1 - v0) / sizeM));
  // Centre the grid on the bounding box so a symmetric field gets a symmetric grid.
  const offU = u0 - (cols * sizeM - (u1 - u0)) / 2;
  const offV = v0 - (rows * sizeM - (v1 - v0)) / 2;
  const hu = (sizeM * fillU) / 2, hv = (sizeM * fillV) / 2;

  const cells: Cell[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = offU + (i + 0.5) * sizeM, v = offV + (j + 0.5) * sizeM;
      const inside = uv.some((poly) => inRing(u, v, poly[0]) && !poly.slice(1).some((hole) => inRing(u, v, hole)));
      if (!inside) continue;
      cells.push({
        ring: [fromUV(u - hu, v - hv), fromUV(u + hu, v - hv), fromUV(u + hu, v + hv), fromUV(u - hu, v + hv)],
        u, v, k: j * cols + i,
      });
    }
  }
  return { cells, sizeM, angle };
}

/** Strip id (0…n−1) per cell: equal cell counts along the long axis, so the strips have equal areas. */
export function stripIndex(cells: Cell[], n: number): number[] {
  const order = cells.map((c, i) => ({ i, u: c.u, v: c.v })).sort((a, b) => a.u - b.u || a.v - b.v);
  const out = new Array<number>(cells.length).fill(0);
  order.forEach((o, rank) => { out[o.i] = Math.min(n - 1, Math.floor((rank * n) / cells.length)); });
  return out;
}

/** A thin quad along every outer edge: extruded, they make a low wall around the field. */
export function edgeQuads(polys: Polygon[], widthM: number): Ring[] {
  if (!polys.length) return [];
  const frame = localFrame(bboxCentre(polys));
  const h = widthM / 2;
  const out: Ring[] = [];
  for (const poly of polys) {
    const pts = openRing(poly[0]).map(frame.fwd);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 0.05) continue;
      const nx = (-dy / len) * h, ny = (dx / len) * h;
      out.push([frame.inv(a[0] + nx, a[1] + ny), frame.inv(b[0] + nx, b[1] + ny), frame.inv(b[0] - nx, b[1] - ny), frame.inv(a[0] - nx, a[1] - ny)]);
    }
  }
  return out;
}

/** GeoJSON coordinates for a polygon (rings closed, as the spec asks). */
export const toGeoJSONCoords = (poly: Polygon): number[][][] => poly.map((ring) => closedRing(ring));
