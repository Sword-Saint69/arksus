import type { SiteData } from '@/data/useSiteData';
import { useFieldVerdict } from '@/data/useFieldVerdict';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/Badge';
import type { RotationId } from '@/lib/types';
import { t, tx, type Key, type Lang } from '@/strings';
import { fmtNum, fmtPct } from '@/utils/format';
import { ROTATION_COLOR } from '@/utils/series';
import { simRoute } from '@/utils/mapUrl';
import { FertilizerPlan } from '@/sections/FertilizerPlan';

/**
 * One field in plain words: the most suitable crop order, why, and three facts
 * compared with fallow. Numbers are medians over 24 start years; the dry/wet
 * line uses P10/P90 without naming them.
 */
export function FieldDetail({ data, lang, id }: { data: SiteData; lang: Lang; id: string }) {
  const { farmer } = useAuth();
  const field = farmer?.fields.find((f) => f.id === id) ?? null;
  const { verdict, status } = useFieldVerdict(data, field);
  if (!farmer) return null;
  if (!field) return <main className="mx-auto max-w-xl px-4 py-10 text-muted">{t(lang, 'notFoundField')}</main>;

  const loc = data.site.locations.find((l) => l.id === field.locationId);
  const depth = data.site.depth_classes.find((d) => d.id === field.depthId);
  const label = (rid: string | null) => tx(lang, data.site.rotations.find((r) => r.id === rid)?.label);
  const d = verdict?.decision;
  const top = d?.ranking.find((r) => r.rotation_id === d.recommended);
  const blocked = d?.ranking.filter((r) => !r.eligible) ?? [];
  const c = verdict?.chosen, f = verdict?.fallow;
  const q = new URLSearchParams({ ilce: field.locationId, derinlik: field.depthId, oncelik: field.priority });

  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 py-8 sm:px-6">
      <a href="#/panel" className="text-sm text-primary">← {t(lang, 'navPanel')}</a>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{field.name}</h1>
          <p className="text-sm text-muted">
            {loc?.name} · {loc?.province} · {tx(lang, depth?.label)}
            {field.areaDonum !== null && ` · ${fmtNum(field.areaDonum, lang)} ${t(lang, 'donumUnit')}`}
          </p>
        </div>
        <a href={`#/tarla/${field.id}/duzenle`} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm font-semibold text-primary">{t(lang, 'editField')}</a>
      </div>

      {status === 'loading' && <p className="text-muted">{t(lang, 'loading')}</p>}
      {d && (
        <section className="rounded-2xl border-2 border-primary/30 bg-paper p-5 sm:p-6" aria-labelledby="verdict">
          <p id="verdict" className="text-xs font-semibold uppercase tracking-wider text-primary">{t(lang, 'forThisField')} · {t(lang, 'mostSuitable')}</p>
          {d.recommended ? (
            <>
              <p className="mt-1 text-3xl font-bold" style={{ color: ROTATION_COLOR[d.recommended as RotationId] }}>{label(d.recommended)}</p>
              {top && <p className="mt-1 text-muted">{t(lang, 'recDriver', { d: t(lang, `crit_${top.driver}` as Key) })} · <Badge type={field.priority === 'balanced' ? 'assumption' : 'user'} lang={lang} /></p>}
              {d.close_call && d.runner_up && <p className="mt-3 rounded-lg bg-[#fbf3e4] px-3 py-2 text-sm text-warn">{t(lang, 'recClose', { r: label(d.runner_up) })}</p>}
            </>
          ) : <p className="mt-2 text-lg font-semibold text-bad">{t(lang, 'recNone')}</p>}
          {blocked.length > 0 && (
            <ul className="mt-3 grid gap-1 border-t border-line pt-3 text-sm">
              {blocked.map((b) => (
                <li key={b.rotation_id}><b>{label(b.rotation_id)}</b> <span className="text-muted">· {b.blocked.map((r) => t(lang, `block_${r}` as Key)).join(' ')}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {c && f && !c.is_baseline && (
        <section className="rounded-2xl border border-line bg-paper p-5" aria-labelledby="facts">
          <h2 id="facts" className="font-semibold">{t(lang, 'vsFallowTitle')} <Badge type="model" lang={lang} /></h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Fact label={t(lang, 'factWater')} value={`${fmtNum(c.water_at_wheat_sowing_mm.p50, lang)} mm`}
              sub={t(lang, 'fallowRef', { v: `${fmtNum(f.water_at_wheat_sowing_mm.p50, lang)} mm` })} />
            <Fact label={t(lang, 'factWheat')}
              value={t(lang, 'factWheatVal', { pct: fmtPct(f.wheat_yield_ratio.p50 > 0 ? c.wheat_yield_ratio.p50 / f.wheat_yield_ratio.p50 : 0, lang) })}
              sub={t(lang, 'badGoodYears', { lo: fmtPct(c.wheat_yield_ratio.p10, lang), hi: fmtPct(c.wheat_yield_ratio.p90, lang) })} />
            <Fact label={t(lang, 'factBare')} value={`${fmtNum(c.bare_days_p50, lang)} ${t(lang, 'days')}`}
              sub={t(lang, 'fallowRef', { v: `${fmtNum(f.bare_days_p50, lang)} ${t(lang, 'days')}` })} />
            <Fact label={t(lang, 'factHarvests')} value={String(c.harvests_in_two_years)} sub={t(lang, 'fallowRef', { v: String(f.harvests_in_two_years) })} />
          </dl>
        </section>
      )}

      {status !== 'loading' && <FertilizerPlan data={data} lang={lang} field={field} rotationId={d?.recommended ?? null} />}

      <a href={simRoute(field.locationId, field.depthId)} className="group flex items-center gap-4 rounded-2xl border border-line bg-[#eef4f7] p-5 hover:border-[#3d7ea6]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#3d7ea6] text-xl text-white" aria-hidden="true">▶</span>
        <span>
          <span className="block font-semibold">{t(lang, 'simForField')}</span>
          <span className="block text-sm text-muted">{t(lang, 'simWatch')} · {t(lang, 'simWatchSub')}</span>
        </span>
      </a>
      <p className="rounded-lg border border-line bg-paper px-3 py-2 text-xs text-muted">{t(lang, 'honest')}</p>
      {field.note && <p className="text-sm text-muted">“{field.note}”</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={`#/harita?ilce=${field.locationId}`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-white">{t(lang, 'seeOnMap')} →</a>
        <a href={`#/analiz?${q}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-primary px-5 font-semibold text-primary">{t(lang, 'openAnalysis')} →</a>
      </div>
    </main>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
      <dd className="text-xs text-faint">{sub}</dd>
    </div>
  );
}
