// Loads the NöbetSu data files (web/public/data, served under /data/nobetsu) and
// turns them into what the pilot-district panel shows. All money and range
// maths goes through the project's own economics.ts, never re-implemented here.

import type { DefaultsFile, DepthId, LocationId, ResultsFile, SiteIndex, SmapFile } from '../../web/src/lib/types';
import { inputsFromDefaults, summarize } from '../../web/src/lib/economics';
import { pilotFeature, type Feature } from './vector/features';
import type { PilotData } from './ui/inspector';

const base = `${import.meta.env.BASE_URL}data/nobetsu`;
const getJSON = <T>(path: string) => fetch(`${base}/${path}`).then((r) => {
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
});

export class Pilots {
  site: SiteIndex | null = null;
  defaults: DefaultsFile | null = null;
  features: Feature[] = [];
  depth: DepthId = 'medium';
  private results = new Map<string, ResultsFile>();
  private smap = new Map<string, SmapFile>();
  private loading = new Map<string, Promise<void>>();
  onLoaded: () => void = () => {};

  async init() {
    [this.site, this.defaults] = await Promise.all([getJSON<SiteIndex>('site_index.json'), getJSON<DefaultsFile>('defaults.json')]);
    this.features = this.site.locations.map(pilotFeature);
    return this.features;
  }

  get anyMock() {
    return !!(this.site?.mock || this.defaults?.mock || [...this.results.values()].some((r) => r.mock));
  }

  /** Fetch a district's results and SMAP file once; the panel re-renders when they land. */
  ensure(id: string) {
    if (this.results.has(id) || this.loading.has(id)) return;
    const p = Promise.all([getJSON<ResultsFile>(`results/${id}.json`), getJSON<SmapFile>(`smap/${id}.json`).catch(() => null)])
      .then(([r, s]) => { this.results.set(id, r); if (s) this.smap.set(id, s); this.onLoaded(); })
      .finally(() => this.loading.delete(id));
    this.loading.set(id, p);
  }

  data(f: Feature): PilotData | null {
    if (!this.site || !this.defaults) return null;
    const id = String(f.props.location_id) as LocationId;
    const location = this.site.locations.find((l) => l.id === id);
    if (!location) return null;
    this.ensure(id);
    const results = this.results.get(id) ?? null;
    const inp = inputsFromDefaults(this.defaults, id);
    const summaries = results ? summarize(results, this.site, this.depth, inp) : null;
    const vals = this.defaults.values[id];
    // economics.ts reads null as 0, so a missing cost or Ym would silently show
    // a wrong margin; the panel hides money and kg/da while any is missing.
    const moneyPending = !vals || [vals.wheat, vals.chickpea, vals.lentil].some((c) => c.cost_tl_per_da.value === null || c.ym_kg_per_da.value === null)
      || vals.fallow.cost_tl_per_da.value === null;
    return { site: this.site, location, results, smap: this.smap.get(id) ?? null, summaries, depth: this.depth, moneyPending };
  }

  /** Nearest pilot point and its ground distance, if within reach of the district. */
  nearest(lon: number, lat: number, maxKm = 80): { feature: Feature; km: number } | null {
    if (!this.site) return null;
    let best: { feature: Feature; km: number } | null = null;
    for (const loc of this.site.locations) {
      const km = haversineKm(lat, lon, loc.lat, loc.lon);
      if (km <= maxKm && (!best || km < best.km)) best = { feature: this.features.find((f) => f.props.location_id === loc.id)!, km };
    }
    return best;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
