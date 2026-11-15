import { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { fmtMonth, useT } from '@/i18n';
import { useStore } from '@/state/store';
import { useDistrict } from '@/data/hooks';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { Button, Note, cn } from '@/ui/kit';

const STEP_MS = 620;

/**
 * The short wait between the questions and the result. Each line names a data
 * source that is really read for this field; the last ones wait for the files.
 */
export function Analyzing() {
  const { t, lang } = useT();
  const core = useStore((s) => s.core)!;
  const locationId = useStore((s) => s.locationId);
  const go = useStore((s) => s.go);
  const district = useDistrict(locationId);
  const [shown, setShown] = useState(1);

  const steps = useMemo(() => {
    const site = core.site;
    const years = site.start_years[1] - site.start_years[0] + 1;
    const smap = district.status === 'ready' ? district.data.smap : null;
    return [
      { text: t('anField'), needsData: false },
      { text: t('anWeather', { a: site.power_range.start.slice(0, 4), b: site.power_range.end.slice(0, 4) }), needsData: false },
      { text: t('anSoil'), needsData: true },
      ...(smap?.available && smap.latest ? [{ text: t('anMoisture', { date: fmtMonth(lang, smap.latest.date) }), needsData: true }] : []),
      { text: t('anCompare', { r: site.rotations.length, y: years, n: site.rotations.length * years }), needsData: true },
      { text: t('anGuard'), needsData: true },
      { text: t('anDone'), needsData: true },
    ];
  }, [core.site, district, lang, t]);

  useEffect(() => {
    withMap((m) => m.fitField(fieldPolygons(useStore.getState().parcels), { orbit: true }));
  }, []);

  useEffect(() => {
    const ready = district.status === 'ready';
    if (shown >= steps.length) {
      const id = window.setTimeout(() => go('result'), 500);
      return () => window.clearTimeout(id);
    }
    // Lines about the files only tick once the files are here.
    if (steps[shown].needsData && !ready) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [shown, steps, district.status, go]);

  return (
    <div className="grid gap-5">
      <h1 className="text-[1.75rem] font-black leading-tight" aria-live="polite">{t('anTitle')}…</h1>
      <ol className="grid gap-2.5">
        {steps.map((s, i) => {
          const done = i < shown, active = i === shown;
          if (!done && !active) return null;
          return (
            <li key={i} className={cn('flex animate-rise items-start gap-3 rounded-2xl px-3.5 py-3 text-lg leading-snug', done ? 'bg-primary-soft text-primary-strong' : 'bg-canvas text-muted')}>
              <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', done ? 'bg-primary text-white' : 'text-primary')}>
                {done ? <Check size={18} strokeWidth={3.2} /> : <LoaderCircle size={22} className="animate-spin" />}
              </span>
              <span className={done ? 'font-semibold' : undefined}>{s.text}</span>
            </li>
          );
        })}
      </ol>
      {district.status === 'error' && (
        <Note tone="bad">
          {t('loadFailed')}
          <Button className="mt-2" onClick={() => location.reload()}>{t('retry')}</Button>
        </Note>
      )}
    </div>
  );
}
