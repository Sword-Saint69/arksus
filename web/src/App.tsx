import { useEffect, useMemo, useState } from 'react';
import type { DepthId } from '@/lib/types';
import { decide, inputsFromDefaults, priceRobustness, summarize, type Weights } from '@/lib/economics';
import { useLocationData, useSiteData } from '@/data/useSiteData';
import { Header } from '@/sections/Header';
import { Recommendation } from '@/sections/Recommendation';
import { Priorities } from '@/sections/Priorities';
import { RotationCards } from '@/sections/RotationCards';
import { SoilHealth } from '@/sections/SoilHealth';
import { ChartA } from '@/sections/ChartA';
import { MockBanner } from '@/components/MockBanner';
import { initialLang, saveLang, t, tx, type Lang } from '@/strings';
import { PRECIP_WARN_PCT, precipGapPct } from '@/utils/precip';
import { fmtNum } from '@/utils/format';

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [depthId, setDepthId] = useState<DepthId>('medium');
  const [weights, setWeights] = useState<Weights | null>(null);
  const site = useSiteData();
  const loc = useLocationData(locationId);

  useEffect(() => { document.documentElement.lang = lang; saveLang(lang); }, [lang]);
  // First district in site_index is the default; the list itself comes from the data.
  useEffect(() => {
    if (site.status === 'ready' && !locationId) setLocationId(site.data.site.locations[0]?.id ?? null);
  }, [site, locationId]);

  const inputs = useMemo(() => (site.status === 'ready' ? inputsFromDefaults(site.data.defaults) : null), [site]);
  // Sliders start at defaults.decision.weights and stay where the user puts them across districts.
  const w = weights ?? inputs?.weights ?? null;

  const computed = useMemo(() => {
    if (site.status !== 'ready' || loc.status !== 'ready' || !inputs || !w) return null;
    const { results } = loc.data;
    const index = site.data.site;
    return {
      summaries: summarize(results, index, depthId),
      decision: decide(results, index, depthId, inputs, w),
      robustness: priceRobustness(results, index, depthId, inputs, w),
    };
  }, [site, loc, inputs, w, depthId]);

  if (site.status === 'loading') return <p className="p-8 text-muted">{t(lang, 'loading')}</p>;
  if (site.status === 'error') return <p role="alert" className="p-8 text-bad">{t(lang, 'loadFailed')}</p>;

  const { site: index, defaults, validation } = site.data;
  const location = index.locations.find((l) => l.id === locationId) ?? index.locations[0];
  const anyMock = index.mock || defaults.mock || validation.mock || (loc.status === 'ready' && loc.data.results.mock);
  const gap = precipGapPct(validation, location);

  return (
    <div className="min-h-screen">
      <MockBanner show={anyMock} lang={lang} />
      <Header
        site={index}
        lang={lang}
        locationId={location.id}
        depthId={depthId}
        onLocation={setLocationId}
        onDepth={setDepthId}
        onLang={setLang}
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

        {computed && w && inputs && (
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
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-5xl gap-1 px-4 py-5 text-xs text-muted sm:px-6">
          <p>{t(lang, 'sources')}</p>
          <p>{t(lang, 'supports')}</p>
        </div>
      </footer>
    </div>
  );
}
