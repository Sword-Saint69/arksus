import { useMemo, useState } from 'react';
import type { DepthId } from '@/lib/types';
import { decide, inputsFromDefaults, priceRobustness, summarize, type Weights } from '@/lib/economics';
import { useLocationData, type SiteData } from '@/data/useSiteData';
import { Header } from '@/sections/Header';
import { Recommendation } from '@/sections/Recommendation';
import { Priorities } from '@/sections/Priorities';
import { RotationCards } from '@/sections/RotationCards';
import { SoilHealth } from '@/sections/SoilHealth';
import { ChartA } from '@/sections/ChartA';
import { t, tx, type Lang } from '@/strings';
import { PRIORITY_IDS, weightsFor, type PriorityId } from '@/utils/priorities';
import { PRECIP_WARN_PCT, precipGapPct } from '@/utils/precip';
import { fmtNum } from '@/utils/format';

type Props = { data: SiteData; lang: Lang; query: URLSearchParams };

/** The full analysis (PLAN_MVP §6 sections). A field page can open it pre-set with ?ilce=&derinlik=&oncelik=. */
export function Analysis({ data, lang, query }: Props) {
  const { site: index, defaults, validation } = data;
  const qLoc = query.get('ilce');
  const qDepth = query.get('derinlik') as DepthId | null;
  const qPrio = query.get('oncelik') as PriorityId | null;
  const [locationId, setLocationId] = useState<string>(
    index.locations.some((l) => l.id === qLoc) ? qLoc! : index.locations[0].id,
  );
  const [depthId, setDepthId] = useState<DepthId>(qDepth && ['shallow', 'medium', 'deep'].includes(qDepth) ? qDepth : 'medium');
  const inputs = useMemo(() => inputsFromDefaults(defaults), [defaults]);
  const [weights, setWeights] = useState<Weights | null>(() =>
    qPrio && PRIORITY_IDS.includes(qPrio) ? weightsFor(qPrio, inputs.weights) : null);
  const loc = useLocationData(locationId);
  // Sliders start at defaults.decision.weights and stay where the user puts them across districts.
  const w = weights ?? inputs.weights;

  const computed = useMemo(() => {
    if (loc.status !== 'ready') return null;
    const { results } = loc.data;
    return {
      summaries: summarize(results, index, depthId),
      decision: decide(results, index, depthId, inputs, w),
      robustness: priceRobustness(results, index, depthId, inputs, w),
    };
  }, [index, loc, inputs, w, depthId]);

  const location = index.locations.find((l) => l.id === locationId) ?? index.locations[0];
  const gap = precipGapPct(validation, location);

  return (
    <div>
      <Header
        site={index}
        lang={lang}
        locationId={location.id}
        depthId={depthId}
        onLocation={setLocationId}
        onDepth={setDepthId}
      />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <section aria-labelledby="loc-title" className="rounded-xl border border-line bg-paper p-5">
          <h2 id="loc-title" className="text-lg font-semibold">{location.name} · {location.province}</h2>
          <p className="mt-1 text-sm text-muted">{tx(lang, location.note)}</p>
          {gap !== null && Math.abs(gap) > PRECIP_WARN_PCT && (
            <p role="note" className="mt-3 rounded-lg border border-[#ecd6ae] bg-[#fbf3e4] px-3 py-2 text-sm text-warn">
              {t(lang, 'precipWarn', {
                pct: fmtNum(Math.abs(gap), lang),
                dir: t(lang, gap > 0 ? 'higher' : 'lower'),
                tone: t(lang, gap > 0 ? 'optimistic' : 'pessimistic'),
              })}
            </p>
          )}
          <p className="mt-3 text-xs text-faint">{t(lang, 'regionalNote')}</p>
        </section>

        {loc.status === 'loading' && <p className="text-sm text-muted">{t(lang, 'loading')}</p>}
        {loc.status === 'error' && <p role="alert" className="text-sm text-bad">{t(lang, 'loadFailed')}</p>}

        {computed && (
          <>
            <Recommendation site={index} decision={computed.decision} robustness={computed.robustness} lang={lang} />
            <Priorities weights={w} defaults={inputs.weights} lang={lang} onChange={setWeights} />
            <RotationCards site={index} summaries={computed.summaries} decision={computed.decision} lang={lang} />
          </>
        )}
        {loc.status === 'ready' && (
          <>
            <SoilHealth site={index} results={loc.data.results} smap={loc.data.smap} depthId={depthId} lang={lang} />
            <ChartA site={index} results={loc.data.results} depthId={depthId} lang={lang} />
          </>
        )}
        <p className="text-sm text-faint">{t(lang, 'comingNext')}</p>
      </main>
    </div>
  );
}
