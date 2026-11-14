// Client for TKGM's Parsel Sorgu service (the API behind parselsorgu.tkgm.gov.tr).
// It is public, keyless and sends Access-Control-Allow-Origin: *, so the browser
// calls it directly. We only ever ask on a user action (a click or a search),
// one request at a time, and cache what comes back: no bulk crawling.
//
// TKGM states the results are for information only and are not an official
// document; the UI repeats that next to every parcel it shows.

import { lonLatToMerc, type Polygon } from './geo';
import { makeFeature, type Feature } from './vector/features';
import { via } from './sources';

const API = via('tkgm', 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api');

export type AdminUnit = { id: number; name: string };

type GeoFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null;
  properties: Record<string, string | number>;
};

export class TkgmError extends Error {
  constructor(message: string, readonly notFound = false) { super(message); }
}

const listCache = new Map<string, Promise<AdminUnit[]>>();

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`);
  if (res.status === 404) {
    const body = await res.json().catch(() => null) as { Message?: string } | null;
    throw new TkgmError(body?.Message ?? 'Bulunamadı', true);
  }
  if (!res.ok) throw new TkgmError(`TKGM HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function list(path: string): Promise<AdminUnit[]> {
  let p = listCache.get(path);
  if (!p) {
    p = getJSON<{ features: GeoFeature[] }>(path).then((d) =>
      d.features
        .map((f) => ({ id: Number(f.properties.id), name: String(f.properties.text) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')));
    // A failed list should be retried next time, not cached as a rejection.
    p.catch(() => listCache.delete(path));
    listCache.set(path, p);
  }
  return p;
}

export const provinces = () => list('idariYapi/ilListe');
export const districts = (ilId: number) => list(`idariYapi/ilceListe/${ilId}`);
export const neighbourhoods = (ilceId: number) => list(`idariYapi/mahalleListe/${ilceId}`);

export type ParcelInfo = {
  ilId: number; ilceId: number; mahalleId: number;
  il: string; ilce: string; mahalle: string;
  ada: string; parsel: string;
};

/** TKGM returns alan as "86,100.00" or "86.100,00" depending on the record; the
 *  separator followed by exactly two digits at the end is the decimal one. */
export function parseTkgmArea(s: string | number | undefined): number | null {
  if (s === undefined || s === null || s === '') return null;
  if (typeof s === 'number') return s;
  const m = s.trim().match(/^(.*?)([.,])(\d{1,2})$/);
  const whole = (m ? m[1] : s).replace(/[.,\s]/g, '');
  const n = Number(m ? `${whole}.${m[3]}` : whole);
  return isFinite(n) ? n : null;
}

function toFeature(g: GeoFeature): Feature {
  if (!g.geometry) throw new TkgmError('Parselin geometrisi yok');
  const p = g.properties;
  const raw = (g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates) as number[][][][];
  const polys: Polygon[] = raw.map((poly) => poly.map((ring) => {
    const n = ring.length - (ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? 1 : 0);
    const out = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const m = lonLatToMerc(ring[i][0], ring[i][1]);
      out[i * 2] = m.x; out[i * 2 + 1] = m.y;
    }
    return out;
  }));
  const ada = String(p.adaNo ?? ''), parsel = String(p.parselNo ?? '');
  const officialArea = parseTkgmArea(p.alan as string);
  return makeFeature({
    id: `tkgm:${p.mahalleId}:${ada}/${parsel}`,
    kind: 'parcel',
    name: `${p.mahalleAd} ${ada}/${parsel}`,
    polys,
    // Prefer TKGM's registered area over our geometric one: it is the legal figure.
    areaM2: officialArea ?? undefined,
    props: {
      İl: String(p.ilAd ?? ''),
      İlçe: String(p.ilceAd ?? ''),
      Mahalle: String(p.mahalleAd ?? ''),
      Ada: ada,
      Parsel: parsel,
      Nitelik: (p.nitelik as string) || null,
      Mevkii: (p.mevkii as string) || null,
      Pafta: (p.pafta as string) || null,
      'Tapu alanı': p.alan ? `${p.alan} m²` : null,
      Zemin: (p.zeminKmdurum as string) || null,
      Kaynak: 'TKGM Parsel Sorgu',
      _ilId: Number(p.ilId), _ilceId: Number(p.ilceId), _mahalleId: Number(p.mahalleId),
    },
  });
}

export async function parcelByNumber(mahalleId: number, ada: string, parsel: string): Promise<Feature> {
  const g = await getJSON<GeoFeature>(`parsel/${mahalleId}/${encodeURIComponent(ada)}/${encodeURIComponent(parsel)}`);
  return toFeature(g);
}

export async function parcelAt(lat: number, lon: number): Promise<Feature> {
  const g = await getJSON<GeoFeature>(`parsel/${lat.toFixed(6)}/${lon.toFixed(6)}/`);
  return toFeature(g);
}

export function infoOf(f: Feature): ParcelInfo | null {
  const p = f.props;
  if (!String(f.id).startsWith('tkgm:')) return null;
  return {
    ilId: Number(p._ilId), ilceId: Number(p._ilceId), mahalleId: Number(p._mahalleId),
    il: String(p['İl']), ilce: String(p['İlçe']), mahalle: String(p.Mahalle),
    ada: String(p.Ada), parsel: String(p.Parsel),
  };
}
