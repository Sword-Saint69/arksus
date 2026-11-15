// How green the farmer's own field is, from Sentinel-2 (Copernicus, 10 m pixels):
// the scene list comes from the public Earth Search STAC catalogue and the pixels
// are read straight from the cloud-optimised GeoTIFFs on AWS Open Data with HTTP
// range requests. No key, no server. A measurement (badge: measured), shown as
// context only: NDVI is not an input of the decision.

import { fromUrl } from 'geotiff';
import { bboxOf, centroidOf, pointInAny, type LngLat, type Polygon } from '@/domain/geo';
import type { GreenCell } from '@/map/api';
import { fromUtm, toUtm } from './utm';

const STAC = 'https://earth-search.aws.element84.com/v1/search';
const MAX_SIDE_PX = 320;              // fields up to ~3 km across
const MIN_CLEAR_SHARE = 0.8;
/** Scene classification values that are neither cloud, shadow, snow nor missing: vegetation, bare soil, water, unclassified. */
const CLEAR = new Set([4, 5, 6, 7]);

export interface Greenness { date: string; sceneId: string; cells: GreenCell[]; median: number }
export type GreenWhen = 'latest' | 'spring';

/** (nir − red) / (nir + red) on surface reflectance; null where the pixel has no valid light. */
export function ndvi(red: number, nir: number): number | null {
  if (!(red >= 0) || !(nir >= 0) || red + nir <= 0) return null;
  return (nir - red) / (nir + red);
}

/** 15 April – 10 June of the latest spring that has ended: when rainfed cereals in Central Anatolia are greenest. */
export function springWindow(today: Date): [string, string] {
  const y = today.getMonth() > 5 || (today.getMonth() === 5 && today.getDate() > 10) ? today.getFullYear() : today.getFullYear() - 1;
  return [`${y}-04-15`, `${y}-06-10`];
}

interface Band { href: string; 'proj:transform'?: number[]; 'raster:bands'?: { scale?: number; offset?: number }[] }
interface Item {
  id: string;
  properties: { datetime: string; 'proj:epsg'?: number; 'proj:code'?: string; 'earthsearch:boa_offset_applied'?: boolean };
  assets: { red: Band; nir: Band; scl: Band };
}

async function search(at: LngLat, when: GreenWhen, today: Date, signal?: AbortSignal): Promise<Item[]> {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const [from, to] = when === 'spring' ? springWindow(today) : [iso(new Date(today.getTime() - 80 * 86400_000)), iso(today)];
  const res = await fetch(STAC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      intersects: { type: 'Point', coordinates: at },
      datetime: `${from}T00:00:00Z/${to}T23:59:59Z`,
      query: { 'eo:cloud_cover': { lt: 30 } },
      // Latest first for "now"; for spring the clearest scenes first.
      sortby: [when === 'spring' ? { field: 'properties.eo:cloud_cover', direction: 'asc' } : { field: 'properties.datetime', direction: 'desc' }],
      limit: 6,
    }),
  });
  if (!res.ok) throw new Error(`STAC HTTP ${res.status}`);
  return ((await res.json()) as { features: Item[] }).features;
}

function zoneOfItem(item: Item): number | null {
  const epsg = item.properties['proj:epsg'] ?? Number(item.properties['proj:code']?.split(':')[1]);
  return epsg && epsg > 32600 && epsg <= 32660 ? epsg - 32600 : null;
}

/** Pixel window of a band that covers a UTM box, from the band's own geotransform. */
function windowOf(band: Band, box: [number, number, number, number]) {
  const tr = band['proj:transform'];
  if (!tr) return null;
  const [res, , x0, , negRes, y0] = tr;
  const px = Math.abs(negRes);
  const c0 = Math.floor((box[0] - x0) / res), c1 = Math.ceil((box[2] - x0) / res);
  const r0 = Math.floor((y0 - box[3]) / px), r1 = Math.ceil((y0 - box[1]) / px);
  return { c0, r0, c1, r1, res, x0, y0, px };
}

async function read(band: Band, w: { c0: number; r0: number; c1: number; r1: number }, signal?: AbortSignal): Promise<ArrayLike<number>> {
  const tiff = await fromUrl(band.href, {}, signal);
  const image = await tiff.getImage();
  const r = await image.readRasters({ window: [w.c0, w.r0, w.c1, w.r1], signal });
  return (Array.isArray(r) ? r[0] : r) as unknown as ArrayLike<number>;
}

export async function fieldGreenness(polys: Polygon[], when: GreenWhen, today = new Date(), signal?: AbortSignal): Promise<Greenness | null> {
  const [w, s, e, n] = bboxOf(polys);
  const items = await search(centroidOf(polys), when, today, signal);

  for (const item of items) {
    const zone = zoneOfItem(item);
    if (!zone) continue;
    const corners = [toUtm(w, s, zone), toUtm(e, s, zone), toUtm(e, n, zone), toUtm(w, n, zone)];
    const box: [number, number, number, number] = [
      Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1])),
      Math.max(...corners.map((c) => c[0])), Math.max(...corners.map((c) => c[1])),
    ];
    const win = windowOf(item.assets.red, box), sclWin = windowOf(item.assets.scl, box);
    if (!win || !sclWin || win.c0 < 0 || win.r0 < 0) continue;          // field off this tile's edge: try the next scene
    if (win.c1 - win.c0 > MAX_SIDE_PX || win.r1 - win.r0 > MAX_SIDE_PX) return null;

    // Clouds first: the 20 m classification is a small read, and saves the two larger ones.
    const scl = await read(item.assets.scl, sclWin, signal);
    let clear = 0;
    for (let i = 0; i < scl.length; i++) if (CLEAR.has(scl[i])) clear++;
    if (!scl.length || clear / scl.length < MIN_CLEAR_SHARE) continue;

    const [red, nir] = await Promise.all([read(item.assets.red, win, signal), read(item.assets.nir, win, signal)]);
    // Digital number → reflectance. Earth Search marks scenes whose processing offset is
    // already taken out of the pixels; for those only the scale applies.
    const applied = item.properties['earthsearch:boa_offset_applied'] === true;
    const meta = item.assets.red['raster:bands']?.[0];
    const scale = meta?.scale ?? 0.0001;
    const offset = applied ? 0 : meta?.offset ?? 0;
    const cols = win.c1 - win.c0;
    const cells: GreenCell[] = [];
    const values: number[] = [];
    for (let i = 0; i < red.length; i++) {
      if (red[i] === 0 || nir[i] === 0) continue;                         // no data
      const v = ndvi(red[i] * scale + offset, nir[i] * scale + offset);
      if (v === null) continue;
      const col = win.c0 + (i % cols), row = win.r0 + Math.floor(i / cols);
      const x = win.x0 + col * win.res, y = win.y0 - row * win.px;
      if (!pointInAny(fromUtm(x + win.res / 2, y - win.px / 2, zone), polys)) continue;
      cells.push({
        ndvi: Math.round(v * 1000) / 1000,
        ring: [fromUtm(x, y - win.px, zone), fromUtm(x + win.res, y - win.px, zone), fromUtm(x + win.res, y, zone), fromUtm(x, y, zone)],
      });
      values.push(v);
    }
    if (cells.length < 4) continue;
    values.sort((a, b) => a - b);
    return { date: item.properties.datetime.slice(0, 10), sceneId: item.id, cells, median: values[Math.floor(values.length / 2)] };
  }
  return null;
}
