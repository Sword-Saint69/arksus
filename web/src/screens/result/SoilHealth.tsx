import { useMemo } from 'react';
import { Leaf, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useT } from '@/i18n';
import { depthFor, useStore } from '@/state/store';
import { useFertilizer, useSoilHealth } from '@/data/hooks';
import { practiceOf } from '@/domain/history';
import type { Verdict } from '@/domain/verdict';
import { soilFromResults } from '@/lib/fertilizer';
import { soilHealthPlan } from '@/lib/soilhealth';
import type { Badge, ResultsFile } from '@/lib/types';
import { Card, DataBadge, Fold, SectionTitle, cn } from '@/ui/kit';

// Soil-health card (docs/GUBRE.md §10). Rules and evidence come from soil_health.json through
// lib/soilhealth.ts; the field's own numbers come from the engine (verdict summaries). No money.

export function SoilHealth({ results, verdict }: { results: ResultsFile; verdict: Verdict }) {
  const { t, tx, num, pct } = useT();
  const core = useStore((s) => s.core)!;
  const locationId = useStore((s) => s.locationId);
  const answers = useStore((s) => s.answers);
  const sh = useSoilHealth();
  const fert = useFertilizer();

  const view = useMemo(() => {
    if (sh.status !== 'ready') return null;
    // Organic matter: the farmer's lab value wins; otherwise the SoilGrids estimate (same as the fertilizer card).
    const own = answers.hasSoilTest ? answers.soilTest.om_pct : undefined;
    const est = fert.status === 'ready' ? soilFromResults(results, fert.data).soil.om_pct : undefined;
    const om = own ?? est;
    const omBadge: Badge = own !== undefined ? 'user' : 'model';
    const minRatio = core.defaults.decision.guardrails.min_wheat_ratio_vs_baseline.value ?? 0.85;
    const plan = soilHealthPlan(sh.data, {
      location_id: locationId ?? undefined,
      depth: depthFor(answers),
      depth_known: !!answers.depth && answers.depth !== 'unknown',
      water: answers.water ?? undefined,
      om_pct: om,
      ec_ds_m: answers.hasSoilTest ? answers.soilTest.ec_ds_m : undefined,
      practice: practiceOf(answers.history),
    }, verdict.options.map((o) => o.summary), minRatio);
    return { plan, omBadge };
  }, [sh, fert, results, answers, locationId, core, verdict]);

  if (sh.status === 'error' || !view) return null;   // the rest of the page works without this card
  const { plan, omBadge } = view;
  const depthClass = core.site.depth_classes.find((d) => d.id === depthFor(answers));
  const depthKnown = !!answers.depth && answers.depth !== 'unknown';
  const label = (id: string) => tx(core.site.rotations.find((r) => r.id === id)?.label);

  return (
    <section className="grid gap-3" aria-labelledby="sh-title">
      <SectionTitle sub={t('shIntro')}><span id="sh-title" className="inline-flex items-center gap-2"><Leaf size={22} className="text-primary" aria-hidden="true" /> {t('shTitle')}</span></SectionTitle>

      {/* the soil in two facts */}
      <div className="flex flex-wrap gap-2">
        {plan.om && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl bg-white px-3 py-2 text-[15px]">
            {t('shOm')}: <b>{pct(plan.om.value / 100, 1)}</b> · {tx(plan.om.label)} <DataBadge type={omBadge} />
          </span>
        )}
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl bg-white px-3 py-2 text-[15px]">
          {t('shDepth')}: <b>{tx(depthClass?.label)}</b>
          {depthKnown ? <DataBadge type="user" /> : <span className="text-muted">({t('shDepthUnknown')})</span>}
        </span>
      </div>

      {/* the engine's own numbers for this field */}
      {plan.model.length > 0 && (
        <Card className="grid gap-2">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold">{t('shModelTitle')} <DataBadge type="model" /></h3>
          <p className="text-sm text-muted">{t('shModelSub')}</p>
          <ul className="grid gap-2">
            {plan.model.map((m) => (
              <li key={m.rotation_id} className={cn('grid gap-1 rounded-2xl p-3', m.is_baseline ? 'bg-canvas' : 'bg-primary-soft/60')}>
                <span className="font-bold">{label(m.rotation_id)}{m.is_baseline && <span className="font-normal text-muted"> · {t('shBaselineRow')}</span>}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
                  <span>{t('shColBare')}: <b className="tabular-nums">{num(m.bare_days)}</b></span>
                  <span>{t('shColWind')}: <b className="tabular-nums">{num(m.wind_days)}</b></span>
                  {!m.is_baseline && m.wheat_vs_fallow !== null && (
                    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                      {t('shColWheat')}: <b>{t('shWheatPct', { p: pct(m.wheat_vs_fallow) })}</b>
                      {m.passes_guardrail
                        ? <span className="inline-flex items-center gap-1 text-good"><ShieldCheck size={16} aria-hidden="true" />{t('shPasses')}</span>
                        : <span className="inline-flex items-center gap-1 text-bad"><TriangleAlert size={16} aria-hidden="true" />{t('shFails')}</span>}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* practices, strongest evidence first */}
      <ol className="grid gap-2.5">
        {plan.practices.map((p) => (
          <li key={p.id}>
            <Card className="grid gap-2">
              <h3 className="text-lg font-extrabold leading-snug">{tx(p.title)}</h3>
              <p className="text-[15px] leading-snug">{tx(p.body)}</p>
              {p.show_model && <p className="text-sm font-semibold text-primary">{t('shSeeModel')}</p>}
              <Fold title={t('shEvidence')}>
                <ul className="grid gap-2">
                  {p.evidence.map((e, i) => (
                    <li key={i} className="leading-snug">
                      {tx(e.text)} <DataBadge type={e.type} verified={e.verified} />
                      <span className="block text-xs text-muted">{e.source_url ? <a href={e.source_url} target="_blank" rel="noreferrer" className="underline">{e.source}</a> : e.source}</span>
                    </li>
                  ))}
                </ul>
              </Fold>
            </Card>
          </li>
        ))}
      </ol>
      <Card className="border-0 bg-canvas p-3.5 text-sm leading-snug text-muted">{t('shFarmer')}</Card>
    </section>
  );
}
