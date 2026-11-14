import type { Location } from '@/lib/types';
import type { Lang } from '@/strings';

// The 3D map is its own app (map/). In production it is built into /harita/ of
// this site (npm run build:all). In development it runs as its own dev server
// (cd map && npm run dev → port 5180); VITE_MAP_URL overrides either. The
// default lives here rather than in .env.development because .env.* is ignored.
const BASE = (import.meta.env.VITE_MAP_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:5180/' : `${import.meta.env.BASE_URL}harita/`);

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
