import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Satellite, X } from 'lucide-react';
import { fmtDay, useT } from '@/i18n';
import { useStore } from '@/state/store';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import type { Greenness as Green, GreenWhen } from '@/services/sentinel';
import { Button, Card, DataBadge, Note, SectionTitle } from '@/ui/kit';

type State = { status: 'idle' } | { status: 'loading'; when: GreenWhen } | { status: 'failed' } | { status: 'ready'; when: GreenWhen; data: Green };

/**
 * The field in 10-metre squares coloured by how green it is, on the farmer's
 * request. The image reader is only downloaded when a button is pressed.
 */
export function Greenness() {
  const { t, lang, num } = useT();
  const parcels = useStore((s) => s.parcels);
  const [state, setState] = useState<State>({ status: 'idle' });
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => { ctrl.current?.abort(); withMap((m) => m.setGreen(null)); }, []);

  const load = async (when: GreenWhen) => {
    ctrl.current?.abort();
    const mine = (ctrl.current = new AbortController());
    setState({ status: 'loading', when });
    try {
      const { fieldGreenness } = await import('@/services/sentinel');
      const signal = AbortSignal.any([mine.signal, AbortSignal.timeout(90_000)]);
      const data = await fieldGreenness(fieldPolygons(parcels), when, new Date(), signal);
      if (mine.signal.aborted) return;
      if (!data) { setState({ status: 'failed' }); withMap((m) => m.setGreen(null)); return; }
      setState({ status: 'ready', when, data });
      withMap((m) => { m.stopSim(); m.setGreen(data.cells); m.fitField(fieldPolygons(parcels), { tight: true }); });
      useStore.getState().setSim(false);
    } catch {
      if (!mine.signal.aborted) setState({ status: 'failed' });
    }
  };
  const clear = () => { ctrl.current?.abort(); setState({ status: 'idle' }); withMap((m) => m.setGreen(null)); };
  const busy = state.status === 'loading';

  return (
    <Card className="grid gap-3">
      <SectionTitle sub={t('greenBody')}><Satellite size={22} className="text-primary" aria-hidden="true" /> {t('greenTitle')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(['latest', 'spring'] as GreenWhen[]).map((w) => (
          <Button key={w} onClick={() => load(w)} disabled={busy}
            variant={state.status === 'ready' && state.when === w ? 'primary' : 'secondary'}
            icon={busy && state.when === w ? <LoaderCircle size={20} className="animate-spin" /> : undefined}>
            {t(w === 'latest' ? 'greenNow' : 'greenSpring')}
          </Button>
        ))}
      </div>
      {busy && <p className="text-muted" role="status">{t('greenLoading')}</p>}
      {state.status === 'failed' && <Note tone="warn">{t('greenFailed')}</Note>}
      {state.status === 'ready' && (
        <div className="grid gap-2" aria-live="polite">
          <p className="text-base">
            <b>{t('greenInfo', { date: fmtDay(lang, state.data.date), v: num(state.data.median, 2) })}</b> <DataBadge type="measured" />
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{t('greenLow')}</span>
            <span aria-hidden="true" className="h-3 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg, #a9825a, #d8c97a, #b7d36a, #5fae4a, #17692b)' }} />
            <span>{t('greenHigh')}</span>
          </div>
          <button type="button" onClick={clear} className="flex min-h-11 items-center gap-1.5 justify-self-start text-base font-bold text-primary"><X size={18} /> {t('greenHide')}</button>
        </div>
      )}
      <p className="text-sm leading-snug text-muted">{t('greenNote')}</p>
    </Card>
  );
}
