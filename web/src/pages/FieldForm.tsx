import { useState } from 'react';
import type { SiteData } from '@/data/useSiteData';
import { useAuth } from '@/auth/AuthContext';
import { newFieldId, type Field } from '@/auth/accounts';
import type { DepthId } from '@/lib/types';
import { navigate } from '@/router';
import { t, tx, type Key, type Lang } from '@/strings';
import { PRIORITY_IDS, type PriorityId } from '@/utils/priorities';
import { cn } from '@/utils/cn';

const input = 'h-12 w-full rounded-xl border border-line bg-white px-3 text-base';

/** Add or edit a field: name, district, size, soil depth in plain words, and what matters most. */
export function FieldForm({ data, lang, id }: { data: SiteData; lang: Lang; id?: string }) {
  const { farmer, update } = useAuth();
  const existing = id ? farmer?.fields.find((f) => f.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [locationId, setLocationId] = useState(existing?.locationId ?? farmer?.locationId ?? data.site.locations[0].id);
  const [area, setArea] = useState(existing?.areaDonum?.toString() ?? '');
  const [depthId, setDepthId] = useState<DepthId>(existing?.depthId ?? 'medium');
  const [priority, setPriority] = useState<PriorityId>(existing?.priority ?? 'balanced');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  if (!farmer) return null;
  if (id && !existing) return <main className="mx-auto max-w-xl px-4 py-10 text-muted">{t(lang, 'notFoundField')}</main>;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t(lang, 'err_field_name')); return; }
    const a = area.trim() === '' ? null : Number(area.replace(',', '.'));
    const field: Field = {
      id: existing?.id ?? newFieldId(),
      name: name.trim(), locationId, depthId, priority, note: note.trim(),
      areaDonum: a !== null && isFinite(a) && a > 0 ? a : null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    const fields = existing ? farmer.fields.map((f) => (f.id === field.id ? field : f)) : [...farmer.fields, field];
    update({ ...farmer, fields });
    navigate(`/tarla/${field.id}`);
  };

  const remove = () => {
    if (!existing || !confirm(t(lang, 'confirmDeleteField'))) return;
    update({ ...farmer, fields: farmer.fields.filter((f) => f.id !== existing.id) });
    navigate('/panel');
  };

  return (
    <main className="mx-auto grid max-w-xl gap-5 px-4 py-8">
      <a href={existing ? `#/tarla/${existing.id}` : '#/panel'} className="text-sm text-primary">← {t(lang, 'back')}</a>
      <h1 className="text-2xl font-bold">{t(lang, existing ? 'fieldEditTitle' : 'fieldNewTitle')}</h1>
      <form onSubmit={save} className="grid gap-5 rounded-2xl border border-line bg-paper p-5" noValidate>
        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'fieldName')}
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t(lang, 'fieldNamePh')} required />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'fieldDistrict')}
          <select className={input} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {[...data.site.locations].sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((l) => (
              <option key={l.id} value={l.id}>{l.name} · {l.province}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'fieldArea')}
          <input className={input} value={area} onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" aria-describedby="area-hint" />
          <span id="area-hint" className="text-xs font-normal text-faint">{t(lang, 'fieldAreaHint')}</span>
        </label>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">{t(lang, 'fieldDepth')}</legend>
          {data.site.depth_classes.map((d) => (
            <Choice key={d.id} name="depth" checked={depthId === d.id} onChange={() => setDepthId(d.id)}
              title={tx(lang, d.label)} help={t(lang, `depthHelp_${d.id}` as Key)} />
          ))}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">{t(lang, 'fieldPriority')}</legend>
          {PRIORITY_IDS.map((p) => (
            <Choice key={p} name="priority" checked={priority === p} onChange={() => setPriority(p)}
              title={t(lang, `prio_${p}` as Key)} help={t(lang, `prio_${p}_help` as Key)} />
          ))}
        </fieldset>

        <label className="grid gap-1 text-sm font-semibold">
          {t(lang, 'fieldNote')}
          <textarea className="min-h-20 w-full rounded-xl border border-line bg-white p-3 text-base font-normal" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-[#f7e4df] px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="min-h-12 rounded-xl bg-primary font-semibold text-white">{t(lang, 'save')}</button>
          <a href={existing ? `#/tarla/${existing.id}` : '#/panel'} className="grid min-h-12 place-items-center rounded-xl border border-line font-semibold text-muted">{t(lang, 'cancel')}</a>
        </div>
        {existing && <button type="button" onClick={remove} className="min-h-11 text-sm font-semibold text-bad">{t(lang, 'deleteField')}</button>}
      </form>
    </main>
  );
}

function Choice({ name, checked, onChange, title, help }: { name: string; checked: boolean; onChange: () => void; title: string; help: string }) {
  const id = `${name}-${title}`.replace(/\W+/g, '-');
  return (
    <label className={cn('flex cursor-pointer gap-3 rounded-xl border bg-white p-3', checked ? 'border-2 border-primary' : 'border-line')}>
      <input type="radio" name={name} value={title} checked={checked} onChange={onChange} aria-labelledby={`${id}-t`} aria-describedby={`${id}-h`} className="mt-1 h-5 w-5 accent-[#2f5d46]" />
      <span><span id={`${id}-t`} className="block font-semibold">{title}</span><span id={`${id}-h`} className="block text-sm text-muted">{help}</span></span>
    </label>
  );
}
