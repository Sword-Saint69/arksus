import type { SiteData } from '@/data/useSiteData';
import { t, type Lang } from '@/strings';
import { mapUrl } from '@/utils/mapUrl';

/** The 3D map inside the site, opened on a district when ?ilce= is given. */
export function MapView({ data, lang, query }: { data: SiteData; lang: Lang; query: URLSearchParams }) {
  const loc = data.site.locations.find((l) => l.id === query.get('ilce'));
  const src = mapUrl(lang, loc, true);
  const full = mapUrl(lang, loc);
  return (
    <main className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2 text-sm sm:px-6">
        <p className="text-muted"><b className="text-ink">{t(lang, 'mapTitle')}</b> · {t(lang, 'mapHint')}</p>
        <a href={full} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 font-semibold text-primary">{t(lang, 'mapOpenFull')} ↗</a>
      </div>
      {/* Keyed by src so switching district reloads the map on it. */}
      <iframe key={src} src={src} title={t(lang, 'mapTitle')} className="w-full flex-1 border-0" allow="fullscreen; clipboard-write" />
    </main>
  );
}
