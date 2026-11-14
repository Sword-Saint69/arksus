import type { DepthId, Location } from '@/lib/types';
import type { Lang } from '@/strings';

// The 3D map is its own app (map/). In production it is built into /harita/ of
// this site (npm run build:all). In development it runs as its own dev server
// (cd map && npm run dev → port 5180); VITE_MAP_URL overrides either. The
// default lives here rather than in .env.development because .env.* is ignored.
const BASE = (import.meta.env.VITE_MAP_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:5180/' : `${import.meta.env.BASE_URL}harita/`);

type Opts = {
  embed?: boolean;      // inside this site's iframe: the map hides its own brand
  sim?: boolean;        // open the 3D process simulation right away
  depth?: DepthId;
  back?: string;        // opened on its own: where "Back to the site" goes
};

/** Map URL in the map's deep-link format, optionally on a district with its pilot circle selected. */
export function mapUrl(lang: Lang, loc?: Location, o: Opts = {}): string {
  const q = new URLSearchParams({ lang });
  if (o.embed) q.set('embed', '1');
  if (loc) {
    q.set('v', `${loc.lat},${loc.lon},45000,0,50`);
    q.set('s', `pilot:${loc.id}`);
  }
  if (o.depth) q.set('d', o.depth);
  if (o.sim && loc) q.set('sim', '1');
  if (o.back) q.set('back', o.back);
  return `${BASE}#${q.toString()}`;
}

/** Site route that opens the map on a district and starts the 3D process. */
export const simRoute = (locationId: string, depth: DepthId) => `#/harita?ilce=${locationId}&derinlik=${depth}&sim=1`;
