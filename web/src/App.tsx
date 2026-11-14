import { useEffect, useState } from 'react';
import type { DepthId } from '@/lib/types';
import { useLocationData, useSiteData } from '@/data/useSiteData';
import { Header } from '@/sections/Header';
import { MockBanner } from '@/components/MockBanner';
import { initialLang, saveLang, t, tx, type Lang } from '@/strings';

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [depthId, setDepthId] = useState<DepthId>('medium');
  const site = useSiteData();
  const loc = useLocationData(locationId);

  useEffect(() => { document.documentElement.lang = lang; saveLang(lang); }, [lang]);
  // First district in site_index is the default; the list itself comes from the data.
  useEffect(() => {
    if (site.status === 'ready' && !locationId) setLocationId(site.data.site.locations[0]?.id ?? null);
  }, [site, locationId]);

  if (site.status === 'loading') return <p className="p-8 text-muted">{t(lang, 'loading')}</p>;
  if (site.status === 'error') return <p role="alert" className="p-8 text-bad">{t(lang, 'loadFailed')}</p>;

  const { site: index, defaults, validation } = site.data;
  const location = index.locations.find((l) => l.id === locationId) ?? index.locations[0];
  const anyMock = index.mock || defaults.mock || validation.mock || (loc.status === 'ready' && loc.data.results.mock);

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
          <p className="mt-3 text-xs text-faint">{t(lang, 'regionalNote')}</p>
          {loc.status === 'loading' && <p className="mt-3 text-sm text-muted">{t(lang, 'loading')}</p>}
          {loc.status === 'error' && <p role="alert" className="mt-3 text-sm text-bad">{t(lang, 'loadFailed')}</p>}
        </section>
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
