import type { Location } from '@/lib/types';
import type { Lang } from '@/strings';

// The 3D map is its own app (map/). In production it is built into /harita/ of
// this site; in development VITE_MAP_URL points at its dev server.
const BASE = (import.meta.env.VITE_MAP_URL as string | undefined) ?? `${import.meta.env.BASE_URL}harita/`;

/** Map URL, optionally opened on a district with its pilot circle selected (map deep-link format). */
export function mapUrl(lang: Lang, loc?: Location, embed = false): string {
  const q = new URLSearchParams({ lang });
  if (embed) q.set('embed', '1');
  if (loc) {
    q.set('v', `${loc.lat},${loc.lon},45000,0,50`);
    q.set('s', `pilot:${loc.id}`);
  }
  return `${BASE}#${q.toString()}`;
}
