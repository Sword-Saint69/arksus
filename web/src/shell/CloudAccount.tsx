import { useState } from 'react';
import { FileText, LogOut, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { useCloud } from '@/state/cloud';
import { hasConsent, LLM_CONSENT_OPEN } from '@/domain/consent';
import { Markdown } from '@/ui/Markdown';
import { Button, Note, cn } from '@/ui/kit';
import { noticeBody, useLegalText } from './ConsentDialog';

/** The account part of the profile panel when Supabase is configured: email + password, and the farmer's permissions. */
export function CloudAccount() {
  const { t } = useT();
  const { ready, user, consents, error, signOut, decide, deleteAccount } = useCloud();
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
        <div className="flex items-center gap-2 text-lg font-extrabold"><UserRound size={22} className="text-primary" aria-hidden="true" /> {t('accountTitle')}</div>
        <EmailForm />
        <p className="text-sm text-muted">{t('gSignInNote')}</p>
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

const MIN_PASSWORD = 8;

function EmailForm() {
  const { t } = useT();
  const signIn = useCloud((s) => s.signIn);
  const signUp = useCloud((s) => s.signUp);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'warn' | 'info'; key: Key } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'register' && pass.length < MIN_PASSWORD) { setMsg({ tone: 'warn', key: 'eErr_weak_password' }); return; }
    setBusy(true); setMsg(null);
    const r = tab === 'login' ? await signIn(email, pass) : await signUp(email, pass);
    setBusy(false);
    if (r === null) { setPass(''); return; }                       // signed in: the panel switches to the account
    setMsg(r === 'check_mail' ? { tone: 'info', key: 'eCheckMail' } : { tone: 'warn', key: `eErr_${r}` as Key });
  };

  const input = 'min-h-12 rounded-2xl border-2 border-line bg-white px-3 text-base font-normal focus:border-primary focus:outline-none';
  return (
    <>
      <div role="tablist" className="flex rounded-2xl bg-canvas p-1">
        {(['login', 'register'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setMsg(null); }}
            className={cn('min-h-10 flex-1 rounded-xl text-[15px] font-extrabold', tab === k ? 'bg-white text-primary shadow-sm' : 'text-muted')}>
            {t(k === 'login' ? 'signIn' : 'signUp')}
          </button>
        ))}
      </div>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('eEmail')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required className={input} />
        </label>
        <label className="grid gap-1 text-[15px] font-semibold">
          {t('password')}
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={tab === 'login' ? 'current-password' : 'new-password'} required className={input} />
          {tab === 'register' && <span className="text-sm font-normal text-muted">{t('passwordHelp', { n: MIN_PASSWORD })}</span>}
        </label>
        {msg && <Note tone={msg.tone}>{t(msg.key)}</Note>}
        <Button type="submit" variant="primary" size="lg" disabled={busy || !email.includes('@') || !pass}>{t(tab === 'login' ? 'signIn' : 'signUp')}</Button>
      </form>
    </>
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
