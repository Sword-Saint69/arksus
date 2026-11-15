import { useState } from 'react';
import { FileText, LogIn, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { useCloud } from '@/state/cloud';
import { hasConsent, LLM_CONSENT_OPEN } from '@/domain/consent';
import { Markdown } from '@/ui/Markdown';
import { Button, Note, cn } from '@/ui/kit';
import { noticeBody, useLegalText } from './ConsentDialog';

/** The account part of the profile panel when Supabase is configured: Google sign-in and the farmer's permissions. */
export function CloudAccount() {
  const { t } = useT();
  const { ready, user, consents, error, signIn, signOut, decide, deleteAccount } = useCloud();
  const locationId = useStore((s) => s.locationId);
  const site = useStore((s) => s.core?.site);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState<'notice' | 'consent' | null>(null);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setFailed(false);
    try { await f(); } catch { setFailed(true); } finally { setBusy(false); }
  };

  if (!ready) return <p role="status" className="text-muted">{t('loading')}</p>;

  if (!user) {
    return (
      <section className="grid gap-3 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
        <Button variant="primary" size="lg" block onClick={() => void signIn()} icon={<LogIn size={22} />}>{t('gSignIn')}</Button>
        <p className="text-sm text-muted">{t('gSignInNote')}</p>
        {error && <Note tone="warn">{t('gError')}</Note>}
        <LegalLinks open={text} setOpen={setText} />
      </section>
    );
  }

  const field = site?.locations.find((l) => l.id === locationId);
  const district = hasConsent(consents, 'district_stats');
  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-white p-4" aria-label={t('accountTitle')}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-2xl font-black uppercase text-white">{(user.name || user.email)[0]}</span>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{user.name || user.email}</p>
          {user.name && <p className="truncate text-sm text-muted">{user.email}</p>}
        </div>
      </div>
      <p className="text-[15px]">{field ? t('profileField', { name: `${field.name}, ${field.province}` }) : t('profileNoField')}</p>

      <fieldset className="grid gap-2 rounded-2xl border border-line p-3">
        <legend className="flex items-center gap-1.5 px-1 text-base font-extrabold"><ShieldCheck size={18} className="text-primary" aria-hidden="true" /> {t('gConsentsTitle')}</legend>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-1 hover:bg-canvas">
          <input type="checkbox" checked={district} disabled={busy} className="mt-0.5 h-5 w-5 accent-[var(--color-primary)]"
            onChange={(e) => void run(() => decide([{ kind: 'district_stats', granted: e.target.checked }]))} />
          <span>
            <span className="block text-[15px] font-bold">{t('gDistrictConsent')}</span>
            <span className="block text-sm text-muted">{t('gDistrictConsentHelp')}</span>
          </span>
        </label>
        {!LLM_CONSENT_OPEN && <p className="px-1 text-sm text-muted">{t('gLlmClosed')}</p>}
      </fieldset>

      <LegalLinks open={text} setOpen={setText} />
      {(failed || error) && <Note tone="warn">{t('gError')}</Note>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void signOut()} icon={<LogOut size={18} />}>{t('gSignOut')}</Button>
        {confirmDelete ? (
          <Button variant="primary" className="bg-bad hover:bg-bad" disabled={busy} onClick={() => void run(deleteAccount)} icon={<Trash2 size={18} />}>{t('gDeleteConfirm')}</Button>
        ) : (
          <Button onClick={() => setConfirmDelete(true)} icon={<Trash2 size={18} />}>{t('gDelete')}</Button>
        )}
      </div>
      {confirmDelete && <p className="text-sm text-muted">{t('gDeleteNote')}</p>}
    </section>
  );
}

function LegalLinks({ open, setOpen }: { open: 'notice' | 'consent' | null; setOpen: (v: 'notice' | 'consent' | null) => void }) {
  const { t } = useT();
  const notice = useLegalText('aydinlatma-metni.md');
  const consent = useLegalText('acik-riza-metni.md');
  const src = open === 'notice' ? (notice && noticeBody(notice)) : open === 'consent' ? consent : null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {(['notice', 'consent'] as const).map((k) => (
          <button key={k} type="button" aria-expanded={open === k} onClick={() => setOpen(open === k ? null : k)}
            className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold underline underline-offset-4', open === k ? 'text-ink' : 'text-primary')}>
            <FileText size={18} aria-hidden="true" /> {t(k === 'notice' ? 'gReadNotice' : 'gReadConsent')}
          </button>
        ))}
      </div>
      {open && (
        <div className="thin-scroll max-h-[50dvh] overflow-y-auto rounded-2xl border border-line bg-paper p-3">
          {src === null ? <p role="status" className="text-muted">{t('loading')}</p> : <Markdown src={src} />}
        </div>
      )}
    </div>
  );
}
