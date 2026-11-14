import { useState } from 'react';
import type { SiteData } from '@/data/useSiteData';
import { useAuth } from '@/auth/AuthContext';
import { navigate } from '@/router';
import { t, type Lang } from '@/strings';
import { fmtNum } from '@/utils/format';

const input = 'h-12 w-full rounded-xl border border-line bg-white px-3 text-base';

export function Profile({ data, lang }: { data: SiteData; lang: Lang }) {
  const { farmer, update, logout, remove } = useAuth();
  const [name, setName] = useState(farmer?.name ?? '');
  const [district, setDistrict] = useState(farmer?.locationId ?? data.site.locations[0].id);
  const [saved, setSaved] = useState(false);
  if (!farmer) return null;
  const since = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'long' }).format(new Date(farmer.createdAt));
  const phone = `0${farmer.phone.slice(0, 3)} ${farmer.phone.slice(3, 6)} ${farmer.phone.slice(6, 8)} ${farmer.phone.slice(8)}`;
  const area = farmer.fields.reduce((s, f) => s + (f.areaDonum ?? 0), 0);

  return (
    <main className="mx-auto grid max-w-xl gap-5 px-4 py-8">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-bold text-white" aria-hidden="true">
          {farmer.name.trim().charAt(0).toLocaleUpperCase('tr')}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{farmer.name}</h1>
          <p className="text-sm text-muted">{t(lang, 'memberSince', { date: since })}</p>
          <p className="text-sm text-muted">{t(lang, 'totalArea', { n: farmer.fields.length, a: fmtNum(area, lang) })}</p>
        </div>
      </div>
      <form className="grid gap-4 rounded-2xl border border-line bg-paper p-5"
        onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; update({ ...farmer, name: name.trim(), locationId: district }); setSaved(true); }}>
        <label className="grid gap-1 text-sm font-semibold">{t(lang, 'fullName')}
          <input className={input} value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">{t(lang, 'phone')}
          <input className={`${input} bg-raise`} value={phone} readOnly />
        </label>
        <label className="grid gap-1 text-sm font-semibold">{t(lang, 'yourDistrict')}
          <select className={input} value={district} onChange={(e) => { setDistrict(e.target.value); setSaved(false); }}>
            {[...data.site.locations].sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((l) => (
              <option key={l.id} value={l.id}>{l.name} · {l.province}</option>
            ))}
          </select>
        </label>
        <button className="min-h-12 rounded-xl bg-primary font-semibold text-white">{t(lang, 'save')}</button>
        {saved && <p role="status" className="text-center text-sm text-good">✓ {t(lang, 'saved')}</p>}
      </form>
      <p className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">{t(lang, 'deviceNote')}</p>
      <div className="grid gap-2">
        <button onClick={() => { navigate('/'); logout(); }} className="min-h-12 rounded-xl border border-line font-semibold">{t(lang, 'logout')}</button>
        <button onClick={() => { if (confirm(t(lang, 'confirmDeleteAccount'))) { navigate('/'); remove(); } }} className="min-h-11 text-sm font-semibold text-bad">
          {t(lang, 'deleteAccount')}
        </button>
      </div>
    </main>
  );
}
