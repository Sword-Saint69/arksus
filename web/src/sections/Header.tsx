import type { DepthId, SiteIndex } from '@/lib/types';
import { t, tx, type Lang } from '@/strings';
import { cn } from '@/utils/cn';

type Props = {
  site: SiteIndex;
  lang: Lang;
  locationId: string;
  depthId: DepthId;
  onLocation: (id: string) => void;
  onDepth: (id: DepthId) => void;
  onLang: (lang: Lang) => void;
};

export function Header({ site, lang, locationId, depthId, onLocation, onDepth, onLang }: Props) {
  // Grouped by province from site_index, never a hard-coded list (ISMAIL_BAKMALI §10).
  const byProvince = new Map<string, SiteIndex['locations']>();
  for (const l of site.locations) byProvince.set(l.province, [...(byProvince.get(l.province) ?? []), l]);
  const provinces = [...byProvince.keys()].sort((a, b) => a.localeCompare(b, 'tr'));

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 32 32" className="h-10 w-10 shrink-0" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#2f5d46" />
              <path d="M5 22c4-1 7-6 11-6s7 5 11 6" fill="none" stroke="#f3c45c" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M16 6c3 4 4 6 4 8a4 4 0 01-8 0c0-2 1-4 4-8z" fill="#cfe8f5" />
            </svg>
            <div>
              <p className="text-sm font-bold tracking-wide text-primary">{t(lang, 'appName')}</p>
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">{t(lang, 'question')}</h1>
            </div>
          </div>
          <div role="group" aria-label={t(lang, 'language')} className="flex shrink-0 rounded-lg border border-line bg-canvas p-0.5">
            {(['en', 'tr'] as const).map((l) => (
              <button
                key={l}
                aria-pressed={lang === l}
                onClick={() => onLang(l)}
                className={cn('h-9 min-w-10 rounded-md px-2 font-mono text-xs font-semibold uppercase text-muted', lang === l && 'bg-paper text-ink shadow-sm')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted">{t(lang, 'tagline')}</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-semibold text-muted">
            {t(lang, 'district')}
            <select
              value={locationId}
              onChange={(e) => onLocation(e.target.value)}
              className="h-11 rounded-lg border border-line bg-white px-3 text-base font-normal text-ink"
            >
              {provinces.map((p) => (
                <optgroup key={p} label={p}>
                  {byProvince.get(p)!.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.province}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="grid gap-1 text-xs font-semibold text-muted">
            <span id="depth-label">{t(lang, 'depth')}</span>
            <div role="radiogroup" aria-labelledby="depth-label" className="flex rounded-lg border border-line bg-canvas p-0.5">
              {site.depth_classes.map((d) => (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={depthId === d.id}
                  onClick={() => onDepth(d.id)}
                  className={cn('h-10 flex-1 rounded-md px-3 text-sm font-medium text-muted whitespace-nowrap', depthId === d.id && 'bg-paper text-ink shadow-sm')}
                >
                  {tx(lang, d.label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
