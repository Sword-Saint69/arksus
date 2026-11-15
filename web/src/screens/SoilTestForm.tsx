import { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import type { SoilKey, SoilTest } from '@/lib/fertilizer';
import { parseNum } from '@/domain/fertilizerView';
import { Button, cn } from '@/ui/kit';

const input = 'h-14 w-full rounded-2xl border-2 border-line bg-white px-3.5 text-lg outline-none focus:border-primary';
const MAIN: SoilKey[] = ['om_pct', 'ph'];
const MORE: SoilKey[] = ['lime_pct', 'ec_ds_m', 'zn_ppm'];
/** Reports give phosphorus and potassium either per dekar or as mg/kg; the engine accepts both. */
const PK = { kg: ['p2o5_kg_per_da', 'k2o_kg_per_da'], ppm: ['olsen_p_ppm', 'k_ppm'] } as const satisfies Record<string, readonly SoilKey[]>;
type Unit = keyof typeof PK;

const show = (v: number | undefined, lang: string) => (v === undefined ? '' : String(v).replace('.', lang === 'tr' ? ',' : '.'));

// The attached report lives in memory for this visit only: it is shown next to
// the boxes so the values can be read off it, and is never uploaded.
let attached: { name: string; url: string; isImage: boolean } | null = null;

/** Values from the farmer's lab report. Everything is optional; what is typed carries the "your value" badge. */
export function SoilTestForm() {
  const { t, lang } = useT();
  const soil = useStore((s) => s.answers.soilTest);
  const answer = useStore((s) => s.answer);
  const [unit, setUnit] = useState<Unit>(soil.olsen_p_ppm !== undefined || soil.k_ppm !== undefined ? 'ppm' : 'kg');
  const [text, setText] = useState<Partial<Record<SoilKey, string>>>(() =>
    Object.fromEntries((Object.keys(soil) as SoilKey[]).map((k) => [k, show(soil[k], lang)])));
  const [report, setReport] = useState(attached);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { attached = report; }, [report]);

  const write = (next: Partial<Record<SoilKey, string>>, u: Unit = unit) => {
    setText(next);
    const out: SoilTest = {};
    const keys: SoilKey[] = [...MAIN, ...PK[u], ...MORE];
    for (const k of keys) { const v = parseNum(next[k] ?? ''); if (v !== undefined) out[k] = v; }
    answer('soilTest', out);
  };
  const set = (k: SoilKey, v: string) => write({ ...text, [k]: v.replace(/[^\d.,]/g, '') });
  const switchUnit = (u: Unit) => { setUnit(u); write(text, u); };

  const attach = (f: File | undefined) => {
    if (!f) return;
    if (report) URL.revokeObjectURL(report.url);
    setReport({ name: f.name, url: URL.createObjectURL(f), isImage: f.type.startsWith('image/') });
  };
  const detach = () => { if (report) URL.revokeObjectURL(report.url); setReport(null); if (file.current) file.current.value = ''; };

  const box = (k: SoilKey) => (
    <label key={k} className="grid gap-1 text-base font-bold">
      {t(`soil_${k}` as Key)}
      <input className={input} inputMode="decimal" value={text[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <div className="grid animate-rise gap-3 rounded-3xl border border-line bg-white p-4">
      <input ref={file} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => attach(e.target.files?.[0])} />
      {report ? (
        <div className="grid gap-2">
          <p className="flex items-center gap-2 text-base font-bold"><FileText size={20} className="shrink-0 text-primary" /> <span className="min-w-0 truncate">{t('soilAttached', { name: report.name })}</span></p>
          {report.isImage
            ? <a href={report.url} target="_blank" rel="noreferrer"><img src={report.url} alt={report.name} className="max-h-64 w-full rounded-2xl border border-line object-contain" /></a>
            : <a href={report.url} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-line px-4 text-base font-bold text-primary"><FileText size={20} /> {t('soilOpenReport')}</a>}
          <button type="button" onClick={detach} className="flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-semibold text-muted"><Trash2 size={16} /> {t('soilRemoveReport')}</button>
        </div>
      ) : (
        <Button onClick={() => file.current?.click()} icon={<Paperclip size={20} />} block>{t('soilAttach')}</Button>
      )}
      <p className="text-sm leading-snug text-muted">{t('soilAttachHint')}</p>

      <p className="text-base font-semibold">{t('soilFormHint')}</p>
      <div className="grid grid-cols-2 gap-3">{MAIN.map(box)}</div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('unitChoice')}>
          <span className="text-sm font-semibold text-muted">{t('unitChoice')}:</span>
          {(['kg', 'ppm'] as Unit[]).map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => switchUnit(u)}
              className={cn('min-h-11 rounded-full border-2 px-3.5 text-sm font-bold', unit === u ? 'border-primary bg-primary text-white' : 'border-line bg-white')}>
              {t(u === 'kg' ? 'unitKgDa' : 'unitPpm')}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">{PK[unit].map(box)}</div>
      </div>

      <details className="group">
        <summary className="flex min-h-11 items-center gap-2 text-base font-bold text-primary">
          <span aria-hidden="true" className="text-xl leading-none transition group-open:rotate-45">+</span> {t('soilMore')}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-3">{MORE.map(box)}</div>
      </details>
    </div>
  );
}
