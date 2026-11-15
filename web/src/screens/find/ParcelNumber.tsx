import { useEffect, useState } from 'react';
import { LoaderCircle, PencilLine, Search } from 'lucide-react';
import { useT } from '@/i18n';
import type { Parcel } from '@/domain/field';
import { districts, neighbourhoods, parcelByNumber, provinces, TkgmError, type AdminUnit } from '@/services/tkgm';
import { Button, Note } from '@/ui/kit';

const field = 'h-14 w-full rounded-2xl border-2 border-line bg-white px-3.5 text-lg outline-none focus:border-primary disabled:bg-canvas disabled:text-faint';

/** Province → district → neighbourhood from TKGM's own lists (their ids are what the query needs), then the two numbers on the deed. */
export function ParcelNumber({ onFound, onDraw }: { onFound: (p: Parcel) => void; onDraw?: () => void }) {
  const { t } = useT();
  const [ils, setIls] = useState<AdminUnit[] | null>(null);
  const [ilces, setIlces] = useState<AdminUnit[] | null>(null);
  const [mahs, setMahs] = useState<AdminUnit[] | null>(null);
  const [il, setIl] = useState('');
  const [ilce, setIlce] = useState('');
  const [mah, setMah] = useState('');
  const [ada, setAda] = useState('');
  const [parsel, setParsel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failText = (err: unknown) => (err instanceof TkgmError && err.limited ? t('tkgmLimit') : t('tkgmFail'));
  useEffect(() => {
    let alive = true;
    provinces().then((x) => alive && setIls(x), (err) => alive && setError(failText(err)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickIl = (v: string) => {
    setIl(v); setIlce(''); setMah(''); setIlces(null); setMahs(null); setError(null);
    if (v) districts(+v).then(setIlces, (err) => setError(failText(err)));
  };
  const pickIlce = (v: string) => {
    setIlce(v); setMah(''); setMahs(null); setError(null);
    if (v) neighbourhoods(+v).then(setMahs, (err) => setError(failText(err)));
  };
  // Title deeds sometimes print the numbers with spaces or leading zeros: keep the digits.
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 7);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mah || ada === '' || parsel === '') return;
    setBusy(true);
    setError(null);
    try {
      onFound(await parcelByNumber(+mah, String(+ada), String(+parsel)));
    } catch (err) {
      setError(err instanceof TkgmError && err.notFound ? t('psNotFound') : err instanceof TkgmError && err.limited ? t('tkgmLimit') : t('tkgmFail'));
    } finally {
      setBusy(false);
    }
  };

  const select = (label: string, value: string, onChange: (v: string) => void, list: AdminUnit[] | null, enabled: boolean) => (
    <label className="grid gap-1 text-base font-bold">
      {label}
      <select className={field} value={value} onChange={(e) => onChange(e.target.value)} disabled={!enabled || !list}>
        <option value="">{enabled && !list && !error ? t('loading') : t('psChoose')}</option>
        {list?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </label>
  );

  return (
    <form onSubmit={submit} className="grid gap-3">
      <h1 className="text-2xl font-black leading-tight">{t('mNumber')}</h1>
      {select(t('psIl'), il, pickIl, ils, true)}
      {select(t('psIlce'), ilce, pickIlce, ilces, !!il)}
      {select(t('psMahalle'), mah, setMah, mahs, !!ilce)}
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-base font-bold">
          {t('psAda')}
          <input className={field} inputMode="numeric" value={ada} onChange={(e) => setAda(digits(e.target.value))} />
        </label>
        <label className="grid gap-1 text-base font-bold">
          {t('psParsel')}
          <input className={field} inputMode="numeric" value={parsel} onChange={(e) => setParsel(digits(e.target.value))} />
        </label>
      </div>
      <p className="text-sm text-muted">{t('psAdaHint')}</p>
      {error && (
        <Note tone="warn">
          {error}
          {onDraw && <Button className="mt-2" onClick={onDraw} icon={<PencilLine size={20} />}>{t('mDraw')}</Button>}
        </Note>
      )}
      <Button type="submit" variant="primary" size="lg" block disabled={busy || !mah || ada === '' || parsel === ''}
        icon={busy ? <LoaderCircle size={22} className="animate-spin" /> : <Search size={22} />}>
        {t('psFind')}
      </Button>
      <p className="text-xs leading-snug text-faint">{t('tkgmNote')}</p>
    </form>
  );
}
