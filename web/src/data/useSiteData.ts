import { useEffect, useState } from 'react';
import type { DefaultsFile, ResultsFile, SiteIndex, SmapFile, ValidationFile } from '@/lib/types';

// Loading order follows ISMAIL_BAKMALI §3 and §10: site_index, defaults and
// validation once; results and smap when a district is picked. The ~2 MB
// ledger is loaded lazily by Chart B itself, never here.

const base = `${import.meta.env.BASE_URL}data`;
const cache = new Map<string, Promise<unknown>>();

export function getJSON<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`${base}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    // A failed request is retried next time rather than cached as a rejection.
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export type SiteData = { site: SiteIndex; defaults: DefaultsFile; validation: ValidationFile };
type Async<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T };

export function useSiteData(): Async<SiteData> {
  const [state, setState] = useState<Async<SiteData>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    Promise.all([
      getJSON<SiteIndex>('site_index.json'),
      getJSON<DefaultsFile>('defaults.json'),
      getJSON<ValidationFile>('validation.json'),
    ])
      .then(([site, defaults, validation]) => alive && setState({ status: 'ready', data: { site, defaults, validation } }))
      .catch((e: Error) => alive && setState({ status: 'error', error: e.message }));
    return () => { alive = false; };
  }, []);
  return state;
}

export type LocationData = { results: ResultsFile; smap: SmapFile | null };

/** Results for a district and scenario. Non-baseline scenarios live in results/{id}__{scenario}.json. */
export function useLocationData(locationId: string | null, scenarioId = 'baseline'): Async<LocationData> {
  const [state, setState] = useState<Async<LocationData>>({ status: 'loading' });
  useEffect(() => {
    if (!locationId) return;
    let alive = true;
    setState({ status: 'loading' });
    const file = scenarioId === 'baseline' ? `results/${locationId}.json` : `results/${locationId}__${scenarioId}.json`;
    Promise.all([
      getJSON<ResultsFile>(file),
      // smap/{id}.json always exists per contract, but a missing panel must not break the page.
      getJSON<SmapFile>(`smap/${locationId}.json`).catch(() => null),
    ])
      .then(([results, smap]) => alive && setState({ status: 'ready', data: { results, smap } }))
      .catch((e: Error) => alive && setState({ status: 'error', error: e.message }));
    return () => { alive = false; };
  }, [locationId, scenarioId]);
  return state;
}
