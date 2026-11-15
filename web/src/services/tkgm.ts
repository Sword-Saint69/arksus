// Client for TKGM's Parsel Sorgu service (the API behind parselsorgu.tkgm.gov.tr).
// It is public, keyless and sends Access-Control-Allow-Origin: *, so the browser
// calls it directly. We only ever ask on a user action (a tap or a search), one
// request at a time, and cache what comes back: no bulk crawling. The service has
// a daily query limit; when it is reached the page offers drawing instead.
//
// TKGM states the results are for information only and are not an official
// document; the page repeats that next to every parcel it shows.

import type { Parcel } from '@/domain/field';
import { areaM2, openRing, type LngLat, type Polygon } from '@/domain/geo';

const API = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api';
const TIMEOUT_MS = 15_000;

export type AdminUnit = { id: number; name: string };

type GeoFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null;
  properties: Record<string, string | number | null>;
};

export class TkgmError extends Error {
  /** `notFound`: no parcel there. `limited`: TKGM's daily query limit for this visitor is used up. */
  constructor(message: string, readonly notFound = false, readonly limited = false) { super(message); }
}

// Once TKGM says the daily limit is reached, the field screen puts drawing first for the rest of the
// day (kept in localStorage with the date, so a reload remembers it). Any successful answer clears it.
// We never work around the limit: it only changes which way of picking a field is offered first.
const LIMIT_KEY = 'nobetsu.tkgm-limited';
const today = () => new Date().toISOString().slice(0, 10);
let limitedToday = (() => { try { return localStorage.getItem(LIMIT_KEY) === today(); } catch { return false; } })();
const limitSubs = new Set<() => void>();
function setLimited(v: boolean) {
  if (limitedToday === v) return;
  limitedToday = v;
  try { if (v) localStorage.setItem(LIMIT_KEY, today()); else localStorage.removeItem(LIMIT_KEY); } catch { /* private mode */ }
  limitSubs.forEach((f) => f());
}
/** True after TKGM answered "daily limit reached" today (and has not answered normally since). */
export const tkgmLimited = () => limitedToday;
/** For useSyncExternalStore. */
export function onTkgmLimited(f: () => void): () => void { limitSubs.add(f); return () => { limitSubs.delete(f); }; }

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API}/${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) throw e;
    throw new TkgmError('TKGM unreachable');
  }
  // TKGM answers 403 "Günlük sorgu limitini aştınız" once its daily limit is reached. That limit is
  // theirs to set: we say so and offer drawing the field by hand instead.
  if (res.status === 403 || res.status === 429) { setLimited(true); throw new TkgmError('daily limit', false, true); }
  setLimited(false);                                        // TKGM answered: the limit is over
  if (res.status === 404) throw new TkgmError('not found', true);
  if (!res.ok) throw new TkgmError(`TKGM HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const listCache = new Map<string, Promise<AdminUnit[]>>();

function list(path: string): Promise<AdminUnit[]> {
  let p = listCache.get(path);
  if (!p) {
    p = getJSON<{ features: GeoFeature[] }>(path).then((d) =>
      d.features
        .map((f) => ({ id: Number(f.properties.id), name: String(f.properties.text) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    // A failed list is retried next time, not cached as a rejection.
    p.catch(() => listCache.delete(path));
    listCache.set(path, p);
  }
  return p;
}

export const provinces = () => list('idariYapi/ilListe');
export const districts = (ilId: number) => list(`idariYapi/ilceListe/${ilId}`);
export const neighbourhoods = (ilceId: number) => list(`idariYapi/mahalleListe/${ilceId}`);

/**
 * TKGM returns alan as "86,100.00" or "86.100,00" depending on the record; the
 * separator followed by one or two digits at the end is the decimal one.
 */
export function parseTkgmArea(s: string | number | null | undefined): number | null {
  if (s === undefined || s === null || s === '') return null;
  if (typeof s === 'number') return isFinite(s) ? s : null;
  const m = s.trim().match(/^(.*?)([.,])(\d{1,2})$/);
  const whole = (m ? m[1] : s).replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const n = Number(m ? `${whole}.${m[3]}` : whole);
  return isFinite(n) ? n : null;
}

/** A TKGM parcel feature as a field parcel. Exported for the tests. */
export function toParcel(g: GeoFeature): Parcel {
  if (!g.geometry) throw new TkgmError('no geometry');
  const p = g.properties;
  const raw = (g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates) as number[][][][];
  const polygons: Polygon[] = raw.map((poly) => poly.map((ring) => openRing(ring.map((c) => [c[0], c[1]] as LngLat))));
  const ada = String(p.adaNo ?? ''), parsel = String(p.parselNo ?? '');
  const registered = parseTkgmArea(p.alan);
  return {
    id: `tkgm:${p.mahalleId}:${ada}/${parsel}`,
    source: 'tkgm',
    polygons,
    // The registered area is the legal figure; the geometric one is only a fallback.
    areaM2: registered ?? areaM2(polygons),
    areaBadge: registered !== null ? 'official' : 'model',
    label: `${p.mahalleAd ?? ''} ${ada}/${parsel}`.trim(),
    admin: {
      ilId: Number(p.ilId), ilceId: Number(p.ilceId), mahalleId: Number(p.mahalleId),
      il: String(p.ilAd ?? ''), ilce: String(p.ilceAd ?? ''), mahalle: String(p.mahalleAd ?? ''),
      ada, parsel,
      nitelik: p.nitelik ? String(p.nitelik) : undefined,
      mevkii: p.mevkii ? String(p.mevkii) : undefined,
    },
  };
}

const parcelCache = new Map<string, Parcel>();
const remember = (p: Parcel) => { parcelCache.set(p.id, p); return p; };

export async function parcelByNumber(mahalleId: number, ada: string, parsel: string, signal?: AbortSignal): Promise<Parcel> {
  const hit = parcelCache.get(`tkgm:${mahalleId}:${ada}/${parsel}`);
  if (hit) return hit;
  return remember(toParcel(await getJSON<GeoFeature>(`parsel/${mahalleId}/${encodeURIComponent(ada)}/${encodeURIComponent(parsel)}`, signal)));
}

/** The registered parcel under a point. */
export async function parcelAt(lat: number, lon: number, signal?: AbortSignal): Promise<Parcel> {
  return remember(toParcel(await getJSON<GeoFeature>(`parsel/${lat.toFixed(6)}/${lon.toFixed(6)}/`, signal)));
}
