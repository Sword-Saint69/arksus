import { useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { useT } from '@/i18n';
import { searchPlaces, type PlaceHit } from '@/services/geocode';
import { Button, Note } from '@/ui/kit';

/** Village or district search. One request per press of the button (Nominatim's rule). */
export function SearchPlace({ onPick }: { onPick: (hit: PlaceHit) => void }) {
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'empty' | 'down'>('idle');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setState('busy');
    try {
      const found = await searchPlaces(q, lang, ctrl.current.signal);
      setHits(found);
      setState(found.length ? 'idle' : 'empty');
      if (found.length === 1) onPick(found[0]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setHits([]);
      setState('down');
    }
  };

  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-black leading-tight">{t('mSearch')}</h1>
      <form onSubmit={run} className="flex gap-2" role="search">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} aria-label={t('mSearch')}
          enterKeyHint="search" autoComplete="off" autoFocus
          className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 text-lg outline-none focus:border-primary"
        />
        <Button type="submit" variant="primary" size="lg" disabled={state === 'busy' || q.trim().length < 3}
          icon={state === 'busy' ? <LoaderCircle size={22} className="animate-spin" /> : <Search size={22} />}>
          {t('searchGo')}
        </Button>
      </form>
      {state === 'empty' && <Note tone="warn">{t('noResults')}</Note>}
      {state === 'down' && <Note tone="warn">{t('searchDown')}</Note>}
      {hits.length > 1 && (
        <ul className="grid gap-2">
          {hits.map((h, i) => (
            <li key={i}>
              <button type="button" onClick={() => onPick(h)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-line bg-white px-3.5 py-2 text-left hover:border-primary">
                <MapPin size={22} className="shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-bold leading-tight">{h.label}</span>
                  <span className="block truncate text-sm text-muted">{h.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
