// Place search: Nominatim (the OpenStreetMap geocoder), Turkey only, plus plain
// "lat, lon" input. Nominatim's policy is at most one request per second and no
// search-as-you-type, so a query is sent only when the farmer presses Search.

import type { Lang } from '@/state/store';

export interface PlaceHit { label: string; detail: string; lat: number; lon: number; bbox?: [number, number, number, number] }

/** "37.87, 34.68" or "37,87 34,68" → a point; anything else → null. */
export function parseCoords(q: string): { lat: number; lon: number } | null {
  const m = q.match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/)
    ?? q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')), lon = parseFloat(m[2].replace(',', '.'));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

let lastSent = 0;

export async function searchPlaces(query: string, lang: Lang, signal?: AbortSignal): Promise<PlaceHit[]> {
  const q = query.trim();
  const c = parseCoords(q);
  if (c) return [{ label: `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`, detail: '', lat: c.lat, lon: c.lon }];
  if (q.length < 3) return [];
  const wait = Math.max(0, 1100 - (Date.now() - lastSent));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastSent = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=tr&limit=6&accept-language=${lang}&q=${encodeURIComponent(q)}`;
  const timeout = AbortSignal.timeout(12_000);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string; boundingbox?: string[] }[];
  return rows.map((r) => {
    const parts = r.display_name.split(', ');
    const b = r.boundingbox?.map(Number);
    return {
      label: r.name || parts[0],
      detail: parts.slice(1, 4).join(', '),
      lat: +r.lat, lon: +r.lon,
      // Nominatim: [south, north, west, east] → [west, south, east, north]
      bbox: b && b.length === 4 && b.every(isFinite) ? [b[2], b[0], b[3], b[1]] : undefined,
    };
  });
}
