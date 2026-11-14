import { useState } from 'react';
import type { SiteData } from '@/data/useSiteData';
import { useAuth } from '@/auth/AuthContext';
import { AuthError } from '@/auth/accounts';
import { navigate } from '@/router';
import { t, type Key, type Lang } from '@/strings';
import { Logo } from '@/components/AppShell';

const input = 'h-12 w-full rounded-xl border border-line bg-white px-3 text-base';

export function Login({ data, lang, mode }: { data: SiteData; lang: Lang; mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [district, setDistrict] = useState(data.site.locations[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isReg = mode === 'register';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isReg) await register({ name, phone, pin, locationId: district });
      else await login(phone, pin);
      navigate('/panel');
    } catch (err) {
      setError(err instanceof AuthError ? t(lang, `err_${err.code}` as Key) : t(lang, 'err_storage'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid max-w-md gap-5 px-4 py-10">
      <div className="flex items-center gap-3">
        <Logo className="h-11 w-11" />
        <h1 className="text-2xl font-bold">{t(lang, isReg ? 'registerTitle' : 'loginTitle')}</h1>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-line bg-paper p-5" noValidate>
        {isReg && (
          <label className="grid gap-1 text-sm font-semibold">
            {t(lang, 'fullName')}
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'phone')}
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="05__ ___ __ __" aria-describedby="phone-hint" required />
          <span id="phone-hint" className="text-xs font-normal text-faint">{t(lang, 'phoneHint')}</span>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'pin')}
          <input className={`${input} font-mono tracking-[0.4em]`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" type="password" autoComplete={isReg ? 'new-password' : 'current-password'} aria-describedby="pin-hint" required />
          <span id="pin-hint" className="text-xs font-normal text-faint">{t(lang, 'pinHint')}</span>
        </label>
        {isReg && (
          <label className="grid gap-1 text-sm font-semibold">
            {t(lang, 'yourDistrict')}
            <select className={input} value={district} onChange={(e) => setDistrict(e.target.value)}>
              {[...data.site.locations].sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((l) => (
                <option key={l.id} value={l.id}>{l.name} · {l.province}</option>
              ))}
            </select>
          </label>
        )}
        {error && <p role="alert" className="rounded-lg bg-[#f7e4df] px-3 py-2 text-sm text-bad">{error}</p>}
        <button disabled={busy} className="min-h-12 rounded-xl bg-primary text-base font-semibold text-white disabled:opacity-60">
          {busy ? t(lang, 'working') : t(lang, isReg ? 'submitRegister' : 'submitLogin')}
        </button>
        <a href={isReg ? '#/giris' : '#/kayit'} className="text-center text-sm text-primary underline underline-offset-4">
          {t(lang, isReg ? 'toLogin' : 'toRegister')}
        </a>
      </form>
      <p className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">{t(lang, 'deviceNote')}</p>
    </main>
  );
}
