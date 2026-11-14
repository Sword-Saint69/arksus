import { useEffect, useRef, useState } from 'react';
import type { SiteData } from '@/data/useSiteData';
import type { DepthId } from '@/lib/types';
import { t, type Lang } from '@/strings';
import { mapUrl } from '@/utils/mapUrl';

/**
 * The 3D map inside the site. "Full screen" first makes the map cover the whole
 * page (works in every browser, keeps the visitor on the site), then also asks
 * for the browser's own full screen where that is allowed. A new tab was the
 * first approach and left people stranded; the Fullscreen API alone does
 * nothing on iPhone Safari and in some embedded browsers.
 */
export function MapView({ data, lang, query }: { data: SiteData; lang: Lang; query: URLSearchParams }) {
  const loc = data.site.locations.find((l) => l.id === query.get('ilce'));
  const depth = (['shallow', 'medium', 'deep'] as const).find((d) => d === query.get('derinlik')) as DepthId | undefined;
  const sim = query.get('sim') === '1';
  const src = mapUrl(lang, loc, { embed: true, depth, sim });
  const box = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Leaving the browser's full screen (Esc, swipe) also leaves the expanded view.
  useEffect(() => {
    const on = () => { if (!document.fullscreenElement) setExpanded(false); };
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  // Esc while the page (not the map frame) has focus.
  useEffect(() => {
    if (!expanded) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [expanded]);

  const enter = () => {
    setExpanded(true);
    box.current?.requestFullscreen?.().catch(() => { /* not allowed here: the expanded view is enough */ });
  };
  const exit = () => {
    setExpanded(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  return (
    <main className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-4 py-2 text-sm sm:px-6">
        <p className="text-muted"><b className="text-ink">{t(lang, 'mapTitle')}</b> · {t(lang, 'mapHint')}</p>
        <button onClick={enter} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 font-semibold text-primary">
          {t(lang, 'mapOpenFull')} ⤢
        </button>
      </div>
      <div ref={box} className={expanded ? 'fixed inset-0 z-50 bg-canvas' : 'relative flex-1 bg-canvas'}>
        {/* Keyed by src so switching district reloads the map on it. */}
        <iframe key={src} src={src} title={t(lang, 'mapTitle')} className="absolute inset-0 h-full w-full border-0" allow="fullscreen; clipboard-write" />
        {expanded && (
          <button onClick={exit} className="absolute bottom-14 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full bg-ink/85 px-5 text-sm font-semibold text-white shadow-lg">
            ✕ {t(lang, 'exitFull')}
          </button>
        )}
      </div>
    </main>
  );
}
