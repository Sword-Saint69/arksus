import { useState } from 'react';
import { CloudRain, CloudSun, Sun } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { useAsync } from '@/data/hooks';
import { loadResults } from '@/data/api';
import { buildVerdict, type Verdict } from '@/domain/verdict';
import type { Tercile } from '@/lib/economics';
import type { SiteIndex } from '@/lib/types';
import { Card, DataBadge, Note, SectionTitle, cn } from '@/ui/kit';
import { RotationDot } from '@/ui/crops';

const YEAR_ICON: Record<Tercile, React.ReactNode> = { dry: <Sun size={28} />, normal: <CloudSun size={28} />, wet: <CloudRain size={28} /> };

function Rot({ site, id }: { site: SiteIndex; id: string | null }) {
  const { tx } = useT();
  const r = site.rotations.find((x) => x.id === id);
  if (!r) return <span>–</span>;
  return <span className="inline-flex items-center gap-1.5 font-extrabold"><RotationDot id={r.id} />{tx(r.label)}</span>;
}

/** "If the year is dry / wet", "if the climate shifts", "if the soil is shallower": the same decision, re-run. */
export function WhatIf({ verdict, locationId }: { verdict: Verdict; locationId: string }) {
  const { t, tx, pct } = useT();
  const core = useStore((s) => s.core)!;
  const depthAnswer = useStore((s) => s.answers.depth);
  const site = core.site;
  const [scenario, setScenario] = useState<string | null>(null);
  const alt = useAsync(scenario ? `${locationId}|${scenario}|${verdict.depthId}` : null, async () =>
    buildVerdict(site, core.defaults, await loadResults(locationId, scenario!), verdict.depthId, verdict.weights));
  const scenarios = site.scenarios.filter((s) => s.id !== 'baseline');

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <SectionTitle sub={t('yearSub', { n: verdict.nYears })} badge={<DataBadge type="model" />}>{t('yearTitle')}</SectionTitle>
        <ul className="grid grid-cols-3 gap-2">
          {verdict.byYearType.map((y) => (
            <li key={y.tercile} className="grid content-start justify-items-center gap-1.5 rounded-2xl border border-line bg-white px-2 py-3 text-center">
              <span className={cn(y.tercile === 'dry' ? 'text-wheat' : y.tercile === 'wet' ? 'text-water' : 'text-muted')} aria-hidden="true">{YEAR_ICON[y.tercile]}</span>
              <span className="text-sm font-bold text-muted">{t(`t_${y.tercile}` as Key)}</span>
              <span className="text-[15px] leading-tight"><Rot site={site} id={y.recommended} /></span>
              {y.closeCall && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">≈ {t('closeMark')}</span>}
            </li>
          ))}
        </ul>
      </div>

      {scenarios.length > 0 && (
        <Card className="grid gap-3">
          <SectionTitle sub={t('climateSub')} badge={<DataBadge type="model" />}>{t('climateTitle')}</SectionTitle>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('climateTitle')}>
            {scenarios.map((s) => (
              <button key={s.id} type="button" aria-pressed={scenario === s.id} onClick={() => setScenario(scenario === s.id ? null : s.id)}
                className={cn('min-h-12 rounded-full border-2 px-3.5 text-[15px] font-bold', scenario === s.id ? 'border-primary bg-primary text-white' : 'border-line bg-white hover:border-primary/60')}>
                {tx(s.label)}
              </button>
            ))}
          </div>
          {scenario && alt.status === 'loading' && <p className="text-muted" role="status">{t('loading')}</p>}
          {scenario && alt.status === 'error' && <Note tone="warn">{t('loadFailed')}</Note>}
          {scenario && alt.status === 'ready' && (() => {
            const a = alt.data;
            const same = a.decision.recommended === verdict.decision.recommended;
            const before = verdict.recommended?.summary.wheat_yield_ratio.p50;
            const after = a.options.find((o) => o.rotation.id === verdict.decision.recommended)?.summary.wheat_yield_ratio.p50;
            return (
              <div className="grid gap-2" aria-live="polite">
                <Note tone={same ? 'good' : 'warn'}>
                  {same ? t('climateSame') : t('climateChanged', { r: tx(a.recommended?.rotation.label) })}
                  {a.closeCall && <span className="block font-semibold">≈ {t('closeMark')}</span>}
                </Note>
                {before !== undefined && after !== undefined && (
                  <p className="text-base">
                    <Rot site={site} id={verdict.decision.recommended} /> · {t('wheatChange', { a: pct(before), b: pct(after) })} <DataBadge type="model" />
                  </p>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      <Card className="grid gap-2.5">
        <SectionTitle badge={<DataBadge type="model" />}>{t('depthTitle')}</SectionTitle>
        <ul className="grid gap-1.5">
          {verdict.byDepth.map((d) => (
            <li key={d.depth.id} className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl px-3 py-2', d.depth.id === verdict.depthId ? 'bg-primary-soft' : 'bg-canvas')}>
              <span className="font-semibold">
                {tx(d.depth.label)}
                {d.depth.id === depthAnswer && <span className="ml-1.5 text-sm font-bold text-primary">· {t('yourDepth')}</span>}
              </span>
              <span className="text-[15px]"><Rot site={site} id={d.recommended} />{d.closeCall && <span className="ml-1 text-warn" title={t('closeMark')}> ≈</span>}</span>
            </li>
          ))}
        </ul>
        <p className="text-[15px] text-muted">{verdict.dependsOnDepth ? t('depthVaries') : t('depthSame')}</p>
        {depthAnswer === 'unknown' || depthAnswer === null ? <Note tone="warn">{t('depthAssumed')}</Note> : null}
      </Card>
    </section>
  );
}
