import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowLeft, Check, ChevronRight, Hash, Info, LandPlot, LoaderCircle, LocateFixed, MapPin, PencilLine, Plus, Search,
  Trash2, TriangleAlert, Undo2, X,
} from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore, type FindMode } from '@/state/store';
import { mapNow, withMap } from '@/map/api';
import { coverageOf } from '@/domain/pilots';
import { drawnParcel, fieldAreaM2, fieldCentroid, fieldPolygons, pilotParcel, toDonum, type Parcel } from '@/domain/field';
import type { LngLat } from '@/domain/geo';
import { onTkgmLimited, parcelAt, TkgmError, tkgmLimited } from '@/services/tkgm';
import { Button, Card, DataBadge, Note, cn } from '@/ui/kit';
import { SearchPlace } from './find/SearchPlace';
import { ParcelNumber } from './find/ParcelNumber';

/** From this zoom a tap asks the cadastre for the parcel under the finger; below it a tap zooms in. */
const PICK_ZOOM = 14;

type Msg = { tone: 'warn' | 'info'; text: string; offerDraw?: boolean };

export function FindField() {
  const { t, num } = useT();
  const core = useStore((s) => s.core)!;
  const mode = useStore((s) => s.findMode);
  const setMode = useStore((s) => s.setFindMode);
  const parcels = useStore((s) => s.parcels);
  const setField = useStore((s) => s.setField);
  const go = useStore((s) => s.go);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [zoom, setZoom] = useState(() => mapNow()?.zoom() ?? 5);
  const seq = useRef(0);
  // TKGM said "daily limit reached": drawing goes first and the registry options are dimmed, not hidden.
  const limited = useSyncExternalStore(onTkgmLimited, tkgmLimited);
  // After locating or searching, a tap would ask TKGM; while it is limited, go straight to drawing there.
  const pickMode: FindMode = limited ? 'draw' : 'tap';

  const commit = useCallback((next: Parcel[], fly = true) => {
    if (!next.length) {
      setField([], null, null);
    } else if (next[0].source === 'pilot') {
      setField(next, next[0].id.slice('pilot:'.length), 0);
    } else {
      const c = coverageOf(core.site, fieldCentroid(next)!);
      setField(next, c.covered && c.location ? c.location.id : null, c.km);
    }
    withMap((m) => {
      m.setField(next);
      if (next.length && fly) m.fitField(fieldPolygons(next));
    });
  }, [core.site, setField]);

  const pick = useCallback(async (at: LngLat) => {
    const mine = ++seq.current;
    setBusy(t('queryingParcel'));
    setMsg(null);
    try {
      const p = await parcelAt(at[1], at[0]);
      if (mine !== seq.current) return;                         // a newer tap won
      const canAdd = adding && parcels.length > 0 && parcels.every((x) => x.source === 'tkgm');
      commit(canAdd ? (parcels.some((x) => x.id === p.id) ? parcels : [...parcels, p]) : [p]);
      setAdding(false);
    } catch (e) {
      if (mine !== seq.current) return;
      const limited = e instanceof TkgmError && e.limited;
      setMsg({ tone: 'warn', text: e instanceof TkgmError && e.notFound ? t('noParcelHere') : limited ? t('tkgmLimit') : t('tkgmFail'), offerDraw: !(e instanceof TkgmError && e.notFound) });
    } finally {
      if (mine === seq.current) setBusy(null);
    }
  }, [adding, commit, parcels, t]);

  // The map calls the latest handler without re-subscribing on every render.
  const onTap = useRef<(at: LngLat, z: number) => void>(() => {});
  onTap.current = (at, z) => {
    if (mode === 'draw') { setDraft((d) => [...d, at]); return; }
    if (mode !== 'menu' && mode !== 'tap') return;
    if (z < PICK_ZOOM) { withMap((m) => m.flyTo(at, Math.min(z + 2.6, 15.6))); return; }
    void pick(at);
  };
  const onPilot = useRef<(id: string) => void>(() => {});
  onPilot.current = (id) => {
    const loc = core.site.locations.find((l) => l.id === id);
    // A pilot pin is a shortcut to its district only while no field is being picked up close.
    if (loc && (mapNow()?.zoom() ?? 0) < 11) { setMode('menu'); commit([pilotParcel(loc)]); }
  };

  useEffect(() => {
    let offTap = () => {}, offZoom = () => {}, offPilot = () => {};
    withMap((m) => {
      offTap = m.onTap((at, z) => onTap.current(at, z));
      offZoom = m.onZoom(setZoom);
      offPilot = m.onPilot((id) => onPilot.current(id));
      m.setField(useStore.getState().parcels);
      m.setOrbit(false);
    });
    return () => { offTap(); offZoom(); offPilot(); withMap((m) => { m.setPicking(false); m.setDraft([]); }); };
  }, []);

  useEffect(() => { withMap((m) => m.setPicking(mode === 'tap' || mode === 'draw')); }, [mode]);
  useEffect(() => { withMap((m) => m.setDraft(mode === 'draw' ? draft : [])); }, [draft, mode]);

  const open = (m: FindMode) => { setMsg(null); setDraft([]); setMode(m); };

  const locate = () => {
    if (!navigator.geolocation) { setMsg({ tone: 'warn', text: t('locateDenied') }); return; }
    setBusy(t('locating'));
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setBusy(null);
        withMap((m) => { m.setHere(at); m.flyTo(at, 16.2); });
        setDraft([]);
        setMode(pickMode);
      },
      () => { setBusy(null); setMsg({ tone: 'warn', text: t('locateDenied') }); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const finishDraw = () => {
    if (draft.length < 3) { setMsg({ tone: 'warn', text: t('drawNeed') }); return; }
    commit([drawnParcel(draft, Date.now())]);
    setDraft([]);
    setMode('menu');
  };

  const cover = parcels.length && parcels[0].source !== 'pilot' ? coverageOf(core.site, fieldCentroid(parcels)!) : null;
  const isPilot = parcels[0]?.source === 'pilot';
  const ready = parcels.length > 0 && (isPilot || !!cover?.covered);
  const allTkgm = parcels.length > 0 && parcels.every((p) => p.source === 'tkgm');

  return (
    <div className="grid gap-4">
      {parcels.length > 0 && (
        <Card className="animate-rise border-2 border-primary/40 bg-primary-soft/60">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{t('fieldPicked')}</p>
          {isPilot ? (
            <>
              <p className="mt-1 text-2xl font-black leading-tight">{t('fieldSample', { name: parcels[0].label })}</p>
              <p className="mt-1 text-[15px] text-muted">{t('fieldSampleNote')}</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-black leading-tight">
                {num(toDonum(fieldAreaM2(parcels)), 1)} {t('donum')}{' '}
                <DataBadge type={parcels.every((p) => p.areaBadge === 'official') ? 'official' : parcels[0].areaBadge} />
              </p>
              <ul className="mt-2 grid gap-1.5">
                {parcels.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-base">
                    <LandPlot size={20} className="shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="font-bold">{p.source === 'drawn' ? t('fieldDrawn') : p.label}</span>
                      {p.admin && <span className="text-muted"> · {p.admin.ilce}, {p.admin.il}</span>}
                      {p.admin?.nitelik && <span className="block text-sm text-muted">{t('landClass')}: {p.admin.nitelik}</span>}
                    </span>
                    {parcels.length > 1 && (
                      <button type="button" aria-label={t('removeParcel', { name: p.label })} onClick={() => commit(parcels.filter((x) => x.id !== p.id))}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-white hover:text-bad">
                        <X size={20} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {cover && cover.location && (cover.covered ? (
            <p className="mt-3 text-[15px] leading-snug text-muted">
              <b className="text-ink">{t('covered', { name: cover.location.name, km: num(cover.km, cover.km < 10 ? 1 : 0) })}</b> {t('coveredNote')}
            </p>
          ) : (
            <Note tone="warn" icon={<TriangleAlert size={20} />} className="mt-3">
              {t('notCovered', { name: cover.location.name, km: num(cover.km) })}
              <button type="button" onClick={() => open('pilot')} className="mt-1 block min-h-11 font-bold underline underline-offset-4">{t('notCoveredCta')}</button>
            </Note>
          ))}

          <div className="mt-4 grid gap-2">
            <Button variant="primary" size="lg" block disabled={!ready} onClick={() => go('questions')} icon={<Check size={24} strokeWidth={3} />}>
              {t('confirmField')}
            </Button>
            <div className="flex flex-wrap gap-2">
              {allTkgm && (
                <Button className="flex-1" onClick={() => { setAdding(true); open('tap'); }} icon={<Plus size={20} />}>{t('addParcel')}</Button>
              )}
              <Button variant="ghost" onClick={() => { commit([]); setAdding(false); open('menu'); }} icon={<Trash2 size={18} />}>{t('clearField')}</Button>
            </div>
          </div>
          {allTkgm && <p className="mt-3 text-xs leading-snug text-faint">{t('tkgmNote')}</p>}
        </Card>
      )}

      {busy && (
        <p role="status" className="flex items-center gap-2.5 rounded-2xl bg-water-soft px-3.5 py-3 text-base font-semibold text-[#1d4d6b]">
          <LoaderCircle size={22} className="animate-spin" aria-hidden="true" /> {busy}
        </p>
      )}
      {msg && (
        <Note tone={msg.tone} icon={msg.tone === 'warn' ? <TriangleAlert size={20} /> : <Info size={20} />}>
          {msg.text}
          {msg.offerDraw && mode !== 'draw' && <Button className="mt-2" onClick={() => open('draw')} icon={<PencilLine size={20} />}>{t('mDraw')}</Button>}
        </Note>
      )}

      {mode === 'menu' && (
        <div className="grid gap-3">
          <div>
            <h1 className="text-[1.75rem] font-black leading-tight">{t('findTitle')}</h1>
            <p className="mt-1 text-base text-muted">{t('findSub')}</p>
          </div>
          {limited && <Note tone="info" icon={<Info size={20} />}>{t('tkgmBusyNote')}</Note>}
          {limited && <Method icon={<PencilLine size={26} />} k="mDraw" onClick={() => open('draw')} />}
          <Method icon={<LocateFixed size={26} />} k="mLocate" onClick={locate} />
          <Method icon={<MapPin size={26} />} title={t('tapTitle')} dim={limited}
            sub={limited ? t('tkgmBusySub') : zoom < PICK_ZOOM ? t('tapHintFar') : t('tapHintNear')} onClick={() => open('tap')} />
          <Method icon={<Search size={26} />} k="mSearch" onClick={() => open('search')} />
          <Method icon={<Hash size={26} />} k="mNumber" dim={limited} sub={limited ? t('tkgmBusySub') : undefined} onClick={() => open('number')} />
          {!limited && <Method icon={<PencilLine size={26} />} k="mDraw" onClick={() => open('draw')} />}
          <Method icon={<LandPlot size={26} />} k="mPilot" onClick={() => open('pilot')} />
        </div>
      )}

      {mode !== 'menu' && (
        <div className="grid gap-3">
          <button type="button" onClick={() => { setAdding(false); open('menu'); }} className="flex min-h-11 items-center gap-1.5 justify-self-start text-base font-bold text-primary">
            <ArrowLeft size={20} /> {t('otherWay')}
          </button>

          {mode === 'tap' && (
            <div>
              <h1 className="text-2xl font-black leading-tight">{adding ? t('addParcel') : t('tapTitle')}</h1>
              <p className="mt-1.5 text-lg leading-snug text-muted">{adding ? t('addParcelHint') : zoom < PICK_ZOOM ? t('tapHintFar') : t('tapHintNear')}</p>
            </div>
          )}

          {mode === 'search' && (
            <SearchPlace onPick={(hit) => {
              withMap((m) => (hit.bbox ? m.fitBounds(hit.bbox) : m.flyTo([hit.lon, hit.lat], 15)));
              setDraft([]);
              setMode(pickMode);
            }} />
          )}

          {mode === 'number' && <ParcelNumber onFound={(p) => { commit([p]); setMode('menu'); }} onDraw={() => open('draw')} />}

          {mode === 'draw' && (
            <div className="grid gap-3">
              <div>
                <h1 className="text-2xl font-black leading-tight">{t('drawTitle')}</h1>
                <p className="mt-1.5 text-lg text-muted" role="status">{t('drawCount', { n: draft.length })}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} icon={<Undo2 size={20} />}>{t('drawUndo')}</Button>
                <Button variant="primary" onClick={finishDraw} disabled={draft.length < 3} icon={<Check size={20} strokeWidth={3} />}>{t('drawDone')}</Button>
              </div>
            </div>
          )}

          {mode === 'pilot' && (
            <div className="grid gap-3">
              <div>
                <h1 className="text-2xl font-black leading-tight">{t('pilotTitle')}</h1>
                <p className="mt-1 text-base text-muted">{t('pilotSub')}</p>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {[...core.site.locations].sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => { commit([pilotParcel(l)]); setMode('menu'); }}
                      className={cn('flex min-h-14 w-full flex-col justify-center rounded-2xl border-2 bg-white px-3 py-2 text-left hover:border-primary',
                        parcels[0]?.id === `pilot:${l.id}` ? 'border-primary bg-primary-soft' : 'border-line')}>
                      <span className="text-base font-bold leading-tight">{l.name}</span>
                      <span className="text-sm text-muted">{l.province}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Method({ icon, k, title, sub, dim, onClick }: { icon: React.ReactNode; k?: 'mLocate' | 'mSearch' | 'mNumber' | 'mDraw' | 'mPilot'; title?: string; sub?: string; dim?: boolean; onClick: () => void }) {
  const { t } = useT();
  // dim: still usable (the limit may be over), just shown as the less likely way today.
  return (
    <button type="button" onClick={onClick}
      className={cn('flex min-h-[4.5rem] w-full items-center gap-3.5 rounded-2xl border-2 border-line bg-white p-3.5 text-left transition hover:border-primary active:scale-[0.99]', dim && 'opacity-60')}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{title ?? t(k!)}</span>
        <span className="mt-0.5 block text-[15px] leading-snug text-muted">{sub ?? t(`${k!}Sub` as Key)}</span>
      </span>
      <ChevronRight size={22} className="shrink-0 text-faint" aria-hidden="true" />
    </button>
  );
}
