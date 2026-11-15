import { Ban, Droplets, Leaf, Sun, Wheat, Wind } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import type { OptionView, Verdict } from '@/domain/verdict';
import { wheatVsBaseline } from '@/domain/verdict';
import { ROTATION_COLOR } from '@/domain/sim';
import type { Weights } from '@/lib/economics';
import type { V } from '@/lib/types';
import { DataBadge, Fold, Meter, Note, SectionTitle, cn } from '@/ui/kit';
import { CropIcon } from '@/ui/crops';

const CRITERIA: (keyof Weights)[] = ['value', 'yield', 'soil', 'water'];

/** The three sequences side by side: three numbers each at a glance, the rest one tap away. */
export function Options({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  return (
    <section className="grid gap-3" aria-labelledby="options-title">
      <SectionTitle sub={t('optionsSub', { n: verdict.nYears })} badge={<DataBadge type="model" />}><span id="options-title">{t('optionsTitle')}</span></SectionTitle>
      {verdict.options.map((o) => <OptionCard key={o.rotation.id} option={o} verdict={verdict} />)}
    </section>
  );
}

function OptionCard({ option: o, verdict }: { option: OptionView; verdict: Verdict }) {
  const { t, tx, num, pct } = useT();
  const s = o.summary;
  const d = s.delta_vs_baseline;
  const vs = wheatVsBaseline(o, verdict.baseline);
  const color = ROTATION_COLOR[o.rotation.id];
  const first = o.rotation.crops[0];
  const st = o.rotation.strategy;
  const delta = (v: number, unit: string, goodWhenUp: boolean) => {
    if (!isFinite(v) || Math.abs(v) < 0.5) return null;
    const up = v > 0;
    // Arrow and sign, so the meaning never rests on colour alone.
    return (
      <span className={cn('whitespace-nowrap font-bold', up === goodWhenUp ? 'text-good' : 'text-bad')}>
        {up ? '▲ +' : '▼ −'}{num(Math.abs(v))} {unit} <span className="font-normal text-muted">{t('vsFallow')}</span>
      </span>
    );
  };

  return (
    <article className={cn('overflow-hidden rounded-3xl border-2 bg-white', o.status === 'recommended' ? 'border-primary shadow-sm' : 'border-line')}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3.5" style={{ borderTop: `7px solid ${color}` }}>
        <h3 className="flex items-center gap-2 text-xl font-black leading-tight">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}><CropIcon crop={first} size={22} /></span>
          {t(`if_${o.rotation.id}` as Key)}
        </h3>
        <span className={cn('rounded-full px-2.5 py-1 text-sm font-extrabold',
          o.status === 'recommended' ? 'bg-primary text-white' : o.status === 'blocked' ? 'bg-bad-soft text-bad' : 'bg-raise text-ink')}>
          {o.status === 'recommended' ? `✓ ${t('tagBest')}` : o.status === 'blocked' ? t('tagBlocked') : t('tagRank', { n: o.rank! })}
        </span>
      </header>
      <p className="px-4 text-sm text-muted">{tx(o.rotation.label)}{o.rotation.is_baseline && ` · ${t('current')}`}</p>

      {o.status === 'blocked' && (
        <Note tone="bad" icon={<Ban size={20} />} className="mx-4 mt-2.5">
          {o.ranked.blocked.map((b) => <p key={b}>{t(`block_${b}` as Key)}</p>)}
        </Note>
      )}

      {/* The three numbers a farmer asks about first: the wheat, the water, the bare soil. */}
      <dl className="grid grid-cols-3 gap-2 px-4 py-3">
        <Stat icon={<Wheat size={20} />} label={t('rowWheat')} value={pct(s.wheat_yield_ratio.p50)} />
        <Stat icon={<Droplets size={20} />} label={t('crit_water')} value={`${num(s.water_at_wheat_sowing_mm.p50)} mm`} />
        <Stat icon={<Wind size={20} />} label={t('statBare')} value={`${num(s.bare_days_p50)} ${t('days')}`} />
      </dl>

      <div className="grid gap-2 px-4 pb-4">
        <Fold title={t('moreNumbers')}>
          <Line icon={<Wheat size={20} />} label={t('rowWheat')} value={pct(s.wheat_yield_ratio.p50)}>
            {t('rowWheatHint')}
            {!o.rotation.is_baseline && vs !== null && <b className="block text-ink">{t('rowWheatVs', { pct: pct(vs) })}</b>}
            <span className="block">{t('dryWet', { lo: pct(s.wheat_yield_ratio.p10), hi: pct(s.wheat_yield_ratio.p90) })}</span>
          </Line>
          <Line icon={<Droplets size={20} />} label={t('rowWater')} value={`${num(s.water_at_wheat_sowing_mm.p50)} mm`}>
            {d && <span className="block">{delta(d.water_p50, 'mm', true)}</span>}
            {t('dryWet', { lo: `${num(s.water_at_wheat_sowing_mm.p10)} mm`, hi: `${num(s.water_at_wheat_sowing_mm.p90)} mm` })} · {t('rowWaterUnit')}
          </Line>
          <Line icon={<Wind size={20} />} label={t('rowBare')} value={`${num(s.bare_days_p50)} ${t('days')}`}>
            {d && <span className="block">{delta(d.bare_days_p50, t('days'), false)}</span>}
            {t('rowWind', { n: num(s.wind_exposed_bare_days_p50) })}
          </Line>
          <Line icon={<Sun size={20} />} label={t('rowHarvests')} value={String(s.harvests_in_two_years)}>
            {s.first_crop_yield_ratio && first !== 'fallow' && first !== 'wheat' && (
              <>{t('rowFirst', { crop: t(`crop_${first}` as Key) })}: <b className="text-ink">{pct(s.first_crop_yield_ratio.p50)}</b> {t('rowWheatHint')}</>
            )}
          </Line>
          <p className="flex items-center gap-2.5 font-semibold"><Leaf size={20} className="text-primary" aria-hidden="true" />{o.rotation.soil_traits.n_fixing ? t('rowN') : t('rowNoN')}</p>
          <Tillage v={o.rotation.soil_traits.tillage_passes} />
          <div className="grid gap-1.5 border-t border-line pt-2.5">
            <p className="font-bold">{t('scoreTitle')}: {num(o.ranked.score, 2)} <DataBadge type="model" /></p>
            <p className="text-sm text-muted">{t('scoreHint')}</p>
            {CRITERIA.map((k) => (
              <div key={k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
                <span className="font-semibold first-letter:uppercase">{t(`crit_${k}` as Key)}</span>
                <Meter value={o.ranked.parts[k]} color={color} label={t(`crit_${k}` as Key)} />
                <span className="text-right tabular-nums">{num(o.ranked.parts[k], 2)}</span>
              </div>
            ))}
          </div>
        </Fold>
        <Fold title={t('whyStrategy')}>
          <p>{tx(st.why)}</p>
          <List title={t('benefits')} items={st.benefits.map(tx)} />
          <List title={t('gaps')} items={st.gaps.map(tx)} />
          <List title={t('localReview')} items={st.local_review.map(tx)} />
          {st.evidence.length > 0 && (
            <div>
              <h4 className="font-bold">{t('evidence')}</h4>
              <ul className="mt-1 grid list-disc gap-1 pl-5">
                {st.evidence.map((e, i) => (
                  <li key={i}>{tx(e.text)}{' '}
                    {e.source_url ? <a className="text-primary underline" href={e.source_url} target="_blank" rel="noreferrer">{e.source}</a> : <span className="text-muted">({e.source})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Fold>
      </div>
    </article>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid content-start justify-items-center gap-0.5 rounded-2xl bg-canvas px-1.5 py-2.5 text-center">
      <span className="text-primary" aria-hidden="true">{icon}</span>
      <dd className="text-xl font-black tabular-nums leading-tight">{value}</dd>
      <dt className="text-[13px] font-semibold leading-tight text-muted first-letter:uppercase">{label}</dt>
    </div>
  );
}

function Line({ icon, label, value, children }: { icon: React.ReactNode; label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2.5 border-b border-line pb-2.5">
      <span className="mt-0.5 text-primary" aria-hidden="true">{icon}</span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xl font-black tabular-nums leading-tight">{value} <DataBadge type="model" /></p>
        {children && <div className="mt-0.5 text-sm leading-snug text-muted">{children}</div>}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="font-bold">{title}</h4>
      <ul className="mt-1 grid list-disc gap-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/** Tillage passes come with their own source and badge; a missing value is said, never shown as 0. */
function Tillage({ v }: { v: V }) {
  const { t, num } = useT();
  return (
    <p className="text-muted">
      {t('rowTillage')}:{' '}
      {v.value === null ? t('pending') : <><b className="text-ink">{num(v.value)}{t('perYear')}</b> <DataBadge type={v.type} verified={v.verified} /></>}
    </p>
  );
}
