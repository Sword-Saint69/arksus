import type { SiteData } from '@/data/useSiteData';
import { useFieldVerdict } from '@/data/useFieldVerdict';
import { useAuth } from '@/auth/AuthContext';
import type { Field } from '@/auth/accounts';
import { t, tx, type Key, type Lang } from '@/strings';
import { fmtNum } from '@/utils/format';
import { ROTATION_COLOR } from '@/utils/series';
import type { RotationId } from '@/lib/types';

/** The farmer's home after signing in: their fields, each with its plain-language result. */
export function Panel({ data, lang }: { data: SiteData; lang: Lang }) {
  const { farmer } = useAuth();
  if (!farmer) return null;
  const area = farmer.fields.reduce((s, f) => s + (f.areaDonum ?? 0), 0);
  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(lang, 'hello', { name: farmer.name.split(' ')[0] })}</h1>
          <p className="text-muted">{t(lang, 'panelSub')}</p>
          {farmer.fields.length > 0 && (
            <p className="mt-1 text-sm text-faint">{t(lang, 'totalArea', { n: farmer.fields.length, a: fmtNum(area, lang) })}</p>
          )}
        </div>
        <a href="#/tarla/yeni" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white">+ {t(lang, 'addField')}</a>
      </div>
      {farmer.fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper p-8 text-center">
          <p className="text-muted">{t(lang, 'noFields')}</p>
          <a href="#/tarla/yeni" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white">+ {t(lang, 'addField')}</a>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {farmer.fields.map((f) => <FieldCard key={f.id} field={f} data={data} lang={lang} />)}
        </ul>
      )}
    </main>
  );
}

function FieldCard({ field, data, lang }: { field: Field; data: SiteData; lang: Lang }) {
  const { verdict, status } = useFieldVerdict(data, field);
  const loc = data.site.locations.find((l) => l.id === field.locationId);
  const depth = data.site.depth_classes.find((d) => d.id === field.depthId);
  const rot = data.site.rotations.find((r) => r.id === verdict?.decision.recommended);
  return (
    <li>
      <a href={`#/tarla/${field.id}`} className="block h-full rounded-2xl border border-line bg-paper p-5 hover:border-primary">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{field.name}</h2>
          {field.areaDonum !== null && <span className="font-mono text-sm text-muted">{fmtNum(field.areaDonum, lang)} {t(lang, 'donumUnit')}</span>}
        </div>
        <p className="text-sm text-muted">{loc?.name} · {loc?.province} · {tx(lang, depth?.label)} · {t(lang, `prio_${field.priority}` as Key)}</p>
        <div className="mt-4 rounded-xl bg-white p-4" style={{ borderLeft: `5px solid ${rot ? ROTATION_COLOR[rot.id as RotationId] : '#d9d4c4'}` }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t(lang, 'mostSuitable')}</p>
          {status === 'loading' && <p className="text-sm text-muted">{t(lang, 'loading')}</p>}
          {verdict && (rot
            ? <p className="text-xl font-bold">{tx(lang, rot.label)}</p>
            : <p className="text-sm font-semibold text-bad">{t(lang, 'recNone')}</p>)}
        </div>
        <p className="mt-3 flex items-center justify-between text-xs text-faint">
          <span>{t(lang, 'districtResult')}</span>
          <span className="font-semibold text-primary">{t(lang, 'details')} →</span>
        </p>
      </a>
    </li>
  );
}
