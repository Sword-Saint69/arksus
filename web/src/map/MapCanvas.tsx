import { useEffect, useRef, useState } from 'react';
import { translate } from '@/i18n';
import { useStore } from '@/state/store';
import { loadResults } from '@/data/api';
import { buildVerdict } from '@/domain/verdict';
import type { RotationId } from '@/lib/types';
import { provideMap, withdrawMap, withMap } from './api';
import { MapController } from './controller';

/** The one map of the page. It is created once and driven through MapApi from then on. */
export function MapCanvas() {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const core = useStore((s) => s.core);
  const lang = useStore((s) => s.lang);

  useEffect(() => {
    let ctrl: MapController | null = null;
    try {
      ctrl = new MapController(box.current!);
      provideMap(ctrl);
      if (import.meta.env.DEV) Object.assign(window, { nobetsuMap: ctrl, nobetsuStore: useStore });
    } catch (e) {
      console.warn('map', e);
      setFailed(true);
    }
    return () => { if (ctrl) { withdrawMap(ctrl); ctrl.destroy(); } };
  }, []);

  // Pilot pins, then (when the browser is idle) what the model says in each of them
  // on medium soil with the team's priorities: the colours of the pins.
  useEffect(() => {
    if (!core) return;
    withMap((m) => m.setPilots(core.site.locations, (l) => translate(lang, 'pilotPin', { name: l.name })));
    let alive = true;
    const id = window.setTimeout(async () => {
      const out: Record<string, RotationId | null> = {};
      await Promise.all(core.site.locations.map(async (l) => {
        try {
          out[l.id] = (buildVerdict(core.site, core.defaults, await loadResults(l.id), 'medium').decision.recommended as RotationId | null);
        } catch { out[l.id] = null; }
      }));
      if (alive) withMap((m) => m.setPilotVerdicts(out));
    }, 2500);
    return () => { alive = false; window.clearTimeout(id); };
  }, [core, lang]);

  return (
    <>
      {/* MapLibre's stylesheet makes its container position: relative, so the full-screen box is a wrapper. */}
      <div className="absolute inset-0">
        <div ref={box} className="h-full w-full" role="application" aria-label={translate(lang, 'mapAria')} />
      </div>
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-primary-strong p-8 text-center text-lg text-white">
          {translate(lang, 'mapFailed')}
        </div>
      )}
    </>
  );
}
