import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudRain, LoaderCircle, Pause, Play, X } from 'lucide-react';
import { fmtMonth, hasKey, useT, type Key } from '@/i18n';
import { depthFor, useStore } from '@/state/store';
import { useAsync, useLedger } from '@/data/hooks';
import { loadResults } from '@/data/api';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { medianYear, rootZoneCapacityMm, ROTATION_COLOR_ON_MAP, simSeries, weekView, WEEKS } from '@/domain/sim';
import { DataBadge } from '@/ui/kit';

const SECONDS_PER_WEEK = 0.3;

/**
 * Plays the engine's weekly ledger on the farmer's own field: three strips, one
 * per rotation, in the district's median year. Sits over the map while it runs.
 */
export function SimHud() {
  const { t, tx, lang, num, pct } = useT();
  const core = useStore((s) => s.core)!;
  const locationId = useStore((s) => s.locationId);
  const parcels = useStore((s) => s.parcels);
  const depth = useStore((s) => depthFor(s.answers));
  const setSim = useStore((s) => s.setSim);
  const ledger = useLedger(locationId, true);
  const results = useAsync(locationId ? `sim-results|${locationId}` : null, () => loadResults(locationId!));
  const [week, setWeek] = useState(0);
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const weekRef = useRef(0);

  const setup = useMemo(() => {
    if (ledger.status !== 'ready' || results.status !== 'ready') return null;
    const year = medianYear(results.data, depth);
    const series = simSeries(core.site, ledger.data, depth, year);
    if (!series.length) return null;
    return { year, series, capacity: rootZoneCapacityMm(core.site, results.data, depth) };
  }, [ledger, results, depth, core.site]);

  // Build the strips once the ledger is here; take them away when the view closes.
  useEffect(() => {
    if (!setup) return;
    // The first-year crop names the strip: all three end in wheat, so that is the part that differs.
    const strips = setup.series.map((s) => {
      const rot = core.site.rotations.find((r) => r.id === s.rotationId);
      return {
        rotationId: s.rotationId,
        label: rot && hasKey(`crop_${rot.crops[0]}`) ? t(`crop_${rot.crops[0]}` as Key) : tx(rot?.label),
        color: ROTATION_COLOR_ON_MAP[s.rotationId],
      };
    });
    withMap((m) => { m.startSim(fieldPolygons(parcels), strips); m.fitField(fieldPolygons(parcels), { tight: true }); });
    return () => withMap((m) => m.stopSim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, lang]);

  // Push the current week to the map.
  useEffect(() => {
    if (!setup) return;
    const states = setup.series.map((s) => {
      const v = weekView(s.series, s.growth, setup.capacity, week);
      return {
        height: v.height, color: v.color, fullness: v.fullness ?? 0,
        line1: t(`stage_${v.crop}` as Key),
        line2: v.fullness === null ? `${num(v.awMm)} mm` : `${t('simStore')}: ${pct(v.fullness)}`,
      };
    });
    withMap((m) => m.setSimWeek(states));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, week, lang]);

  // The clock.
  useEffect(() => {
    if (!setup || !playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = weekRef.current + dt / SECONDS_PER_WEEK;
      if (next >= WEEKS - 1) { weekRef.current = WEEKS - 1; setWeek(WEEKS - 1); setPlaying(false); return; }
      if (Math.floor(next) !== Math.floor(weekRef.current)) setWeek(Math.floor(next));
      weekRef.current = next;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [setup, playing]);

  const seek = (w: number) => { weekRef.current = w; setWeek(w); };
  const toggle = () => { if (!playing && week >= WEEKS - 1) seek(0); setPlaying(!playing); };
  const failed = ledger.status === 'error' || results.status === 'error';
  const now = setup?.series[0].series.weeks[week];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.25rem] z-20 flex justify-center px-3 md:bottom-6 md:left-[29.5rem]">
      <div className="pointer-events-auto w-full max-w-xl animate-rise rounded-3xl bg-[#0f1e16]/92 p-3.5 text-white shadow-panel backdrop-blur" role="region" aria-label={t('simTitle')}>
        {!setup ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-base font-semibold" role="status">
              {failed ? t('simFailed') : <><LoaderCircle size={20} className="animate-spin" /> {t('simLoading')}</>}
            </p>
            <button type="button" onClick={() => setSim(false)} aria-label={t('simExit')} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/15"><X size={22} /></button>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="flex items-center gap-3">
              <button type="button" onClick={toggle} aria-label={playing ? t('simPause') : t('simPlay')}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold text-primary-strong active:scale-95">
                {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold leading-tight" aria-live="off">
                  {now ? fmtMonth(lang, now.week_start) : ''} · {t('simYear', { n: week < 52 ? 1 : 2 })}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-white/85">
                  <span className="inline-flex items-center gap-1"><CloudRain size={16} aria-hidden="true" /> {t('simRain')}: <b className="tabular-nums">{num(now?.p_mm ?? 0)} mm</b></span>
                  <DataBadge type="model" />
                </p>
              </div>
              <button type="button" onClick={() => setSim(false)} aria-label={t('simExit')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-white/15"><X size={22} /></button>
            </div>
            <input type="range" min={0} max={WEEKS - 1} step={1} value={week} onChange={(e) => { setPlaying(false); seek(+e.target.value); }}
              aria-label={t('simWeekLabel')} className="h-8 w-full accent-[var(--color-gold)]" />
            <p className="text-xs leading-snug text-white/70">{t('simStartYear', { y: setup.year })} · {t('simNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
