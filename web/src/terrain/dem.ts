// Elevation and satellite imagery for one small area, straight from public
// tile servers (the same ones the site's map uses), sampled onto a grid.

export type BBox = { minX: number; minY: number; maxX: number; maxY: number };   // web mercator metres
export type TileSource = { url: (z: number, x: number, y: number) => string; maxZoom: number };

const R = 6378137;
export const WORLD = 2 * Math.PI * R;
const HALF = WORLD / 2;

const PROXY = import.meta.env.VITE_TILE_PROXY === '1';
/** Dev-only: route through a local relay for sandboxed browsers (VITE_TILE_PROXY=1). */
const via = (name: string, url: string) => (PROXY ? url.replace(/^https:\/\/[^/]+/, `/x/${name}`) : url);

/** Mapzen/Tilezen terrain on AWS Open Data (SRTM, GMTED, ETOPO1), terrarium-encoded. */
export const TERRAIN: TileSource = {
  url: (z, x, y) => via('s3', `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`),
  maxZoom: 15,
};
/** Esri World Imagery, the site map's satellite layer. */
export const IMAGERY: TileSource = {
  url: (z, x, y) => via('esri', `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`),
  maxZoom: 18,
};

export function lonLatToMerc(lon: number, lat: number): { x: number; y: number } {
  const c = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return { x: (lon * Math.PI * R) / 180, y: R * Math.log(Math.tan(Math.PI / 4 + (c * Math.PI) / 360)) };
}
/** Mercator stretches lengths by 1/cos(latitude). */
export const mercScale = (y: number) => Math.cosh(y / R);

export function mercToTile(z: number, mx: number, my: number): [number, number] {
  const n = 1 << z;
  const tx = Math.floor(((mx + HALF) / WORLD) * n), ty = Math.floor(((HALF - my) / WORLD) * n);
  return [Math.min(n - 1, Math.max(0, tx)), Math.min(n - 1, Math.max(0, ty))];
}

export function tileBBox(z: number, x: number, y: number): BBox {
  const s = WORLD / (1 << z);
  const minX = -HALF + x * s, maxY = HALF - y * s;
  return { minX, maxX: minX + s, maxY, minY: maxY - s };
}

async function bitmap(url: string, raw = false): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return raw ? createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : createImageBitmap(blob);
}

/** Elevation (m) on an nx × ny grid of cell centres over b, from z15 terrain tiles, bilinear. */
export async function loadDem(b: BBox, nx: number, ny: number): Promise<Float32Array> {
  const z = TERRAIN.maxZoom;
  const [x0, y0] = mercToTile(z, b.minX, b.maxY);
  const [x1, y1] = mercToTile(z, b.maxX, b.minY);
  const tiles = new Map<string, Float32Array>();
  const canvas = new OffscreenCanvas(256, 256);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    jobs.push(bitmap(TERRAIN.url(z, x, y), true).then((bmp) => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const px = ctx.getImageData(0, 0, 256, 256).data;
      const d = new Float32Array(256 * 256);
      for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768;
      tiles.set(`${x}/${y}`, d);
    }));
  }
  await Promise.all(jobs);
  const size = WORLD / (1 << z);
  const at = (mx: number, my: number) => {
    const fx = (mx + WORLD / 2) / size, fy = (WORLD / 2 - my) / size;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    const d = tiles.get(`${tx}/${ty}`);
    if (!d) return 0;
    const u = Math.min(255, Math.max(0, (fx - tx) * 256 - 0.5)), v = Math.min(255, Math.max(0, (fy - ty) * 256 - 0.5));
    const i0 = Math.floor(u), j0 = Math.floor(v), i1 = Math.min(255, i0 + 1), j1 = Math.min(255, j0 + 1);
    const a = u - i0, c = v - j0;
    return (d[j0 * 256 + i0] * (1 - a) + d[j0 * 256 + i1] * a) * (1 - c) + (d[j1 * 256 + i0] * (1 - a) + d[j1 * 256 + i1] * a) * c;
  };
  const out = new Float32Array(nx * ny);
  const dx = (b.maxX - b.minX) / nx, dy = (b.maxY - b.minY) / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    out[j * nx + i] = at(b.minX + (i + 0.5) * dx, b.maxY - (j + 0.5) * dy);
  }
  return out;
}

/** Satellite image of b stitched from tiles, about `px` wide. Row 0 is north. */
export async function loadImagery(b: BBox, src: TileSource = IMAGERY, px = 1024): Promise<HTMLCanvasElement> {
  const w = b.maxX - b.minX, h = b.maxY - b.minY;
  const z = Math.max(8, Math.min(src.maxZoom, Math.floor(Math.log2((WORLD * px) / (256 * w)))));
  const [x0, y0] = mercToTile(z, b.minX, b.maxY);
  const [x1, y1] = mercToTile(z, b.maxX, b.minY);
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round(px * (h / w));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b7d63';
  ctx.fillRect(0, 0, c.width, c.height);
  const s = c.width / w;
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const tb = tileBBox(z, x, y);
    jobs.push(bitmap(src.url(z, x, y)).then((bmp) => {
      ctx.drawImage(bmp, (tb.minX - b.minX) * s, (b.maxY - tb.maxY) * s, (tb.maxX - tb.minX) * s, (tb.maxY - tb.minY) * s);
      bmp.close();
    }).catch(() => { /* a missing tile leaves the earth-tone fill */ }));
  }
  await Promise.all(jobs);
  return c;
}

