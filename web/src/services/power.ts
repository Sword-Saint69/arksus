// Recent rain at the field's own coordinates, straight from NASA POWER (public,
// keyless, CORS-enabled). This is context for the farmer, not an input of the
// decision: the engine's results are precomputed from 24 years of the same source.
//
// PRECTOTCORR is a satellite-and-model estimate (badge: model), not a rain gauge.
// The "usual" figure is POWER's own monthly climatology for the same days, so the
// two numbers share the same biases and can be compared with each other.

const API = 'https://power.larc.nasa.gov/api/temporal';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const DAYS = 30;

export interface RecentRain {
  from: string;            // ISO date of the first day counted
  to: string;              // ISO date of the last day with data
  days: { date: string; mm: number }[];
  totalMm: number;
  /** Long-term mean for the same calendar days (POWER climatology), or null when unavailable. */
  usualMm: number | null;
  usualRange: string | null;   // e.g. "January 2001 - December 2025"
}

const ymd = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const iso = (k: string) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`;

/** Pure part, exported for the tests: pick the last `DAYS` days that have data and sum them. */
export function summarise(daily: Record<string, number>, climatology: Record<string, number> | null, usualRange: string | null = null): RecentRain | null {
  const valid = Object.entries(daily).filter(([, v]) => typeof v === 'number' && v >= 0).sort(([a], [b]) => a.localeCompare(b));
  if (valid.length < DAYS) return null;
  const last = valid.slice(-DAYS);
  const days = last.map(([k, v]) => ({ date: iso(k), mm: v }));
  const totalMm = days.reduce((s, d) => s + d.mm, 0);
  let usualMm: number | null = null;
  if (climatology) {
    let sum = 0, ok = true;
    for (const d of days) {
      const perDay = climatology[MONTHS[Number(d.date.slice(5, 7)) - 1]];
      if (typeof perDay !== 'number' || perDay < 0) { ok = false; break; }
      sum += perDay;
    }
    usualMm = ok ? sum : null;
  }
  return { from: days[0].date, to: days[days.length - 1].date, days, totalMm, usualMm, usualRange };
}

type PowerJSON = { properties: { parameter: { PRECTOTCORR: Record<string, number> } }; header?: { range?: string } };

const cache = new Map<string, Promise<RecentRain | null>>();

export function recentRain(lat: number, lon: number, today = new Date(), signal?: AbortSignal): Promise<RecentRain | null> {
  // POWER's grid is about half a degree: nearby fields share one request.
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${ymd(today)}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const end = new Date(today);
      const start = new Date(today.getTime() - 50 * 86400_000);   // near-real-time data lags a few days
      const q = `parameters=PRECTOTCORR&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
      const opt = () => ({ signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000) });
      const [dailyRes, climRes] = await Promise.all([
        fetch(`${API}/daily/point?${q}&start=${ymd(start)}&end=${ymd(end)}`, opt()),
        fetch(`${API}/climatology/point?${q}`, opt()).catch(() => null),
      ]);
      if (!dailyRes.ok) throw new Error(`POWER HTTP ${dailyRes.status}`);
      const daily = (await dailyRes.json()) as PowerJSON;
      const clim = climRes && climRes.ok ? ((await climRes.json()) as PowerJSON) : null;
      return summarise(daily.properties.parameter.PRECTOTCORR, clim?.properties.parameter.PRECTOTCORR ?? null, clim?.header?.range ?? null);
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
