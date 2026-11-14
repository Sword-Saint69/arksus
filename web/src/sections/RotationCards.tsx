import type { Decision, RotationSummary, Weights } from '@/lib/economics';
import type { Rotation, SiteIndex, Text } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { ValueOrPending } from '@/components/Pending';
import { t, tx, type Key, type Lang } from '@/strings';
import { cn } from '@/utils/cn';
import { fmtNum, fmtPct } from '@/utils/format';

type Props = { site: SiteIndex; summaries: RotationSummary[]; decision: Decision; lang: Lang };

/**
 * Three cards in the decision's order (eligible by score, then blocked). The
 * baseline is labelled "current practice"; the others show differences from it
 * with an arrow and a sign, so colour is never the only cue.
 */
export function RotationCards({ site, summaries, decision, lang }: Props) {
  const [y0, y1] = site.start_years;
  return (
    <section aria-labelledby="cards-title">
      <h2 id="cards-title" className="text-lg font-semibold">{t(lang, 'cardsTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t(lang, 'cardsSub', { n: y1 - y0 + 1, a: y0, b: y1 })}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {decision.ranking.map((rank) => {
          const rot = site.rotations.find((r) => r.id === rank.rotation_id)!;
          const sum = summaries.find((s) => s.rotation_id === rank.rotation_id)!;
          return <Card key={rot.id} rot={rot} sum={sum} rank={rank} suggested={decision.recommended === rot.id} lang={lang} />;
        })}
      </div>
    </section>
  );
}

function Delta({ v, unit, goodWhenUp, lang, pct }: { v: number | undefined; unit: string; goodWhenUp: boolean; lang: Lang; pct?: boolean }) {
  if (v === undefined || !isFinite(v)) return null;
  const shown = pct ? Math.round(v * 100) : Math.round(v);
  if (shown === 0) return null;
  const up = v > 0;
  const good = up === goodWhenUp;
  return (
    <span
      title={t(lang, 'vsFallow')}
      className={cn('ml-1 rounded px-1 font-mono text-[11px]', good ? 'bg-[#e3f0e7] text-good' : 'bg-[#f7e4df] text-bad')}
    >
      {up ? '▲ +' : '▼ −'}{fmtNum(Math.abs(shown), lang)}{pct ? (lang === 'tr' ? ' puan' : ' pts') : ` ${unit}`}
    </span>
  );
}

function Row({ label, badge, children, sub }: { label: string; badge?: React.ReactNode; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 border-t border-dashed border-line py-2 first:border-t-0">
      <div className="text-sm">{label} {badge}</div>
      <div className="text-right font-mono text-sm tabular-nums">
        {children}
        {sub && <div className="text-[11px] text-faint">{sub}</div>}
      </div>
    </div>
  );
}

function Card({ rot, sum, rank, suggested, lang }: {
  rot: Rotation; sum: RotationSummary; rank: Decision['ranking'][number]; suggested: boolean; lang: Lang;
}) {
  const d = sum.delta_vs_baseline;
  const r = (x: { p10: number; p50: number; p90: number }, f: (n: number) => string) => `${f(x.p10)}–${f(x.p90)}`;
  const mm = (n: number) => fmtNum(n, lang);
  const pc = (n: number) => fmtPct(n, lang);
  const model = <Badge type="model" lang={lang} />;
  const traits = rot.soil_traits;

  return (
    <article
      aria-label={tx(lang, rot.label)}
      className={cn(
        'flex flex-col rounded-xl border bg-paper p-4',
        suggested ? 'border-2 border-primary' : 'border-line',
        !rank.eligible && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{tx(lang, rot.label)}</h3>
        <div className="flex gap-1">
          {rot.is_baseline && <Tag>{t(lang, 'currentPractice')}</Tag>}
          {suggested && <Tag className="border-primary bg-primary text-white">{t(lang, 'suggested')}</Tag>}
          {!rank.eligible && <Tag className="border-dashed text-bad">{t(lang, 'blockedTag')}</Tag>}
        </div>
      </div>
      {!rank.eligible && (
        <p className="mt-2 rounded-lg bg-[#f7e4df] px-3 py-2 text-xs text-bad">
          {rank.blocked.map((b) => t(lang, `block_${b}` as Key)).join(' ')}
        </p>
      )}

      <div className="mt-3">
        <Row label={t(lang, 'rowWater')} badge={model} sub={`${r(sum.water_at_wheat_sowing_mm, mm)} · ${t(lang, 'rowWaterUnit')}`}>
          {mm(sum.water_at_wheat_sowing_mm.p50)} mm
          <Delta v={d?.water_p50} unit="mm" goodWhenUp lang={lang} />
        </Row>
        <Row label={t(lang, 'rowWheat')} badge={model} sub={`${r(sum.wheat_yield_ratio, pc)} · ${t(lang, 'rowWheatHint')}`}>
          {pc(sum.wheat_yield_ratio.p50)}
          <Delta v={d?.wheat_yield_ratio_p50} unit="" pct goodWhenUp lang={lang} />
        </Row>
        {sum.first_crop_yield_ratio && (
          <Row label={t(lang, 'rowFirst')} badge={model} sub={r(sum.first_crop_yield_ratio, pc)}>
            {pc(sum.first_crop_yield_ratio.p50)}
          </Row>
        )}
        <Row label={t(lang, 'rowHarvests')}>{sum.harvests_in_two_years}</Row>
        <Row label={t(lang, 'rowBare')} badge={model} sub={t(lang, 'rowWind', { n: mm(sum.wind_exposed_bare_days_p50) })}>
          {mm(sum.bare_days_p50)} {t(lang, 'days')}
          <Delta v={d?.bare_days_p50} unit={t(lang, 'days')} goodWhenUp={false} lang={lang} />
        </Row>
        <Row label={t(lang, 'rowStress')} badge={model}>{mm(sum.wheat_stress_days_p50)} {t(lang, 'days')}</Row>
        <Row label={traits.n_fixing ? t(lang, 'rowN') : t(lang, 'rowNoN')}>{traits.n_fixing ? '✓' : '–'}</Row>
        <Row label={t(lang, 'rowTillage')} badge={<Badge type={traits.tillage_passes.type} verified={traits.tillage_passes.verified} lang={lang} />}>
          <ValueOrPending value={traits.tillage_passes.value} lang={lang}>{(v) => `${mm(v)}${t(lang, 'perYear')}`}</ValueOrPending>
        </Row>
      </div>

      <Score parts={rank.parts} lang={lang} />
      <Why rot={rot} lang={lang} />
    </article>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[11px] text-muted', className)}>{children}</span>;
}

function Score({ parts, lang }: { parts: Weights; lang: Lang }) {
  const keys: (keyof Weights)[] = ['value', 'yield', 'soil', 'water'];
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-semibold text-muted" title={t(lang, 'scoreHint')}>{t(lang, 'scoreTitle')}</p>
      <dl className="mt-2 grid gap-1.5">
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-xs">
            <dt className="text-muted first-letter:uppercase">{t(lang, `crit_${k}` as Key)}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-raise" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(parts[k] * 100)}%` }} />
            </dd>
            <dd className="text-right font-mono">{Math.round(parts[k] * 100)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Why({ rot, lang }: { rot: Rotation; lang: Lang }) {
  const s = rot.strategy;
  const list = (title: string, xs: Text[]) => xs.length > 0 && (
    <>
      <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-4">{xs.map((x, i) => <li key={i}>{tx(lang, x)}</li>)}</ul>
    </>
  );
  return (
    <details className="group mt-3 border-t border-line pt-2 text-sm">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 font-semibold text-primary [&::-webkit-details-marker]:hidden">
        {t(lang, 'why')}
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
      </summary>
      <p className="mt-1">{tx(lang, s.why)}</p>
      {s.evidence.length > 0 && (
        <>
          <h4 className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(lang, 'evidence')}</h4>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {s.evidence.map((e, i) => (
              <li key={i}>
                {tx(lang, e.text)}{' '}
                {e.source_url
                  ? <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{e.source}</a>
                  : <span className="text-faint">{e.source}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {list(t(lang, 'benefits'), s.benefits)}
      {list(t(lang, 'gaps'), s.gaps)}
      {list(t(lang, 'localReview'), s.local_review)}
    </details>
  );
}
