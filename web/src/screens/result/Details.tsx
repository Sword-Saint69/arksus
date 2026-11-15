import { Sparkles } from 'lucide-react';
import { fmtNum, textureName, useT, hasKey, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import type { Verdict } from '@/domain/verdict';
import type { Weights } from '@/lib/economics';
import type { AgentFile, ResultsFile, V } from '@/lib/types';
import { DataBadge, Fold, SectionTitle } from '@/ui/kit';

const CRITERIA: (keyof Weights)[] = ['value', 'yield', 'soil', 'water'];
const GLOSSARY = ['et', 'water_balance', 'available_water', 'field_capacity_vs_saturation', 'soil_moisture_anomaly', 'ph', 'organic_carbon', 'cec',
  'p10_p50_p90', 'fallow_storage_efficiency', 'nitrogen_fixation', 'wind_exposure'] as const;

/** AI commentary of the district. Shown only when the build-time guards passed (every number from the data, honest wording). */
export function AgentCard({ agent }: { agent: AgentFile | null }) {
  const { t, tx } = useT();
  const site = useStore((s) => s.core)!.site;
  if (!agent || !agent.guards.passed || !agent.report) return null;
  const r = agent.report;
  const list = (title: string, items: { en: string; tr: string }[]) => (items.length ? (
    <div>
      <h4 className="font-bold">{title}</h4>
      <ul className="mt-1 grid list-disc gap-1 pl-5">{items.map((x, i) => <li key={i}>{tx(x)}</li>)}</ul>
    </div>
  ) : null);
  return (
    <section className="grid gap-2 rounded-3xl border border-line bg-white p-4">
      <h2 className="flex flex-wrap items-center gap-2 text-xl font-extrabold"><Sparkles size={22} className="text-wheat" aria-hidden="true" /> {t('aiTitle')} <DataBadge type="model" /></h2>
      <p className="text-lg font-semibold leading-snug">{tx(r.headline)}</p>
      <Fold title={t('detailsTitle')}>
        {r.rotations.map((x) => (
          <div key={x.rotation_id} className="grid gap-1.5">
            <h3 className="text-base font-extrabold">{tx(site.rotations.find((q) => q.id === x.rotation_id)?.label)}</h3>
            {list(t('aiStrengths'), x.strengths)}
            {list(t('aiRisks'), x.risks)}
          </div>
        ))}
        {list(t('aiSoil'), r.soil_health)}
        {list(t('aiSat'), r.satellites)}
        {list(t('aiScen'), r.climate_scenarios)}
        {list(t('gaps'), r.uncertainties)}
        {list(t('localReview'), r.ask_local_expert)}
      </Fold>
      <p className="text-sm leading-snug text-muted">{t('aiSub')} {tx(agent.disclaimer)} · {agent.model}</p>
    </section>
  );
}

/** For the curious and for experts: weights, thresholds, sensitivity, soil, checks, sources. */
export function Details({ verdict, results }: { verdict: Verdict; results: ResultsFile }) {
  const { t, tx, num, pct, lang } = useT();
  const core = useStore((s) => s.core)!;
  const { site, defaults, validation } = core;
  const total = CRITERIA.reduce((s, k) => s + verdict.weights[k], 0) || 1;
  const usesTeamWeights = CRITERIA.every((k) => verdict.weights[k] === defaults.decision.weights[k].value);
  const rb = verdict.robustness;
  const step = Math.round(Math.max(...rb.tested_changes.map(Math.abs)) * 100);
  const label = (id: string | null) => tx(site.rotations.find((r) => r.id === id)?.label);
  const g = defaults.decision.guardrails;
  const soil = results.soil;
  const awc = soil.awc_mm_per_m;
  const threshold = (v: V) => (v.value === null ? t('pending') : <><b>{pct(v.value)}</b> <DataBadge type={v.type} verified={v.verified} /></>);

  return (
    <section className="grid gap-2.5">
      <SectionTitle sub={t('detailsSub')}>{t('detailsTitle')}</SectionTitle>

      <Fold title={t('weightsUsed')}>
        <ul className="grid gap-1.5">
          {CRITERIA.map((k) => {
            const d = defaults.decision.weights[k];
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold first-letter:uppercase">{t(`crit_${k}` as Key)}</span>
                <span className="tabular-nums"><b>{pct(verdict.weights[k] / total)}</b> <DataBadge type={usesTeamWeights ? d.type : 'user'} verified={usesTeamWeights ? d.verified : true} /></span>
              </li>
            );
          })}
        </ul>
        <p className="font-semibold">{t('thresholdsUsed')}</p>
        <ul className="grid gap-1.5">
          <li className="flex flex-wrap items-center justify-between gap-2"><span>{t('thr_wheat')}</span><span>{threshold(g.min_wheat_ratio_vs_baseline)}</span></li>
          <li className="flex flex-wrap items-center justify-between gap-2"><span>{t('thr_first')}</span><span>{threshold(g.min_first_crop_ratio)}</span></li>
        </ul>
        <div className="border-t border-line pt-2 text-muted">
          {rb.stable ? <p>{t('robustStable', { p: step })}</p> : (
            <ul className="grid gap-1">
              {rb.sensitive_to.map((s) => (
                <li key={`${s.crop}${s.change}`} className="first-letter:uppercase">
                  {t(s.recommended ? 'robustFlip' : 'robustFlipNone', {
                    crop: t(`crop_${s.crop}` as Key).toLocaleLowerCase(lang), dir: t(s.change > 0 ? 'up' : 'down'),
                    pct: Math.round(Math.abs(s.change) * 100), r: label(s.recommended),
                  })}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-sm">{t('robustNote')} <DataBadge type="assumption" /></p>
        </div>
      </Fold>

      <Fold title={<>{t('soilTitle')} <DataBadge type="model" /></>}>
        <p className="text-muted">{t('soilSub', { d: soil.properties[0]?.depth ?? '0-30 cm' })}</p>
        <table className="w-full border-collapse text-left">
          <tbody>
            {soil.properties.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <th className="py-1.5 pr-2 font-semibold">{tx(p.label)}{p.meaning && <span className="mt-0.5 block text-sm font-normal leading-snug text-muted">{tx(p.meaning)}</span>}</th>
                <td className="py-1.5 text-right tabular-nums"><b>{fmtNum(lang, p.q50, 1)}</b> {p.unit}<span className="block text-sm text-muted">{fmtNum(lang, p.q05, 1)}–{fmtNum(lang, p.q95, 1)}</span></td>
              </tr>
            ))}
            {soil.texture_class && (
              <tr className="border-t border-line"><th className="py-1.5 pr-2 font-semibold">{t('texture')}</th><td className="py-1.5 text-right">{textureName(lang, soil.texture_class)}</td></tr>
            )}
            <tr className="border-t border-line">
              <th className="py-1.5 pr-2 font-semibold">{t('awc')}</th>
              <td className="py-1.5 text-right">{awc.value === null ? t('pending') : <><b>{num(awc.value)}</b> {awc.unit ?? 'mm/m'}</>} <DataBadge type={awc.type} verified={awc.verified} /></td>
            </tr>
            {Object.entries(soil.awc_alternatives ?? {}).map(([id, a]) => (
              <tr key={id} className="border-t border-line align-top">
                <th className="py-1.5 pr-2 font-normal text-muted">{t('awcAlt')}<span className="block text-sm leading-snug">{a.source}</span></th>
                <td className="py-1.5 text-right tabular-nums text-muted"><b>{num(a.value)}</b> {a.unit}{a.range_q05_q95 && <span className="block text-sm">{num(a.range_q05_q95[0])}–{num(a.range_q05_q95[1])}</span>} <DataBadge type={a.type} verified={a.verified} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {soil.awc_alternatives && Object.keys(soil.awc_alternatives).length > 0 && <p className="text-sm text-muted">{t('awcAltNote')}</p>}
        <div>
          <p className="font-bold">{t('notRemote')}</p>
          <p className="text-muted">{t('notRemoteBody')}</p>
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            {soil.not_available_remotely.map((k) => <span key={k} className="rounded-full bg-canvas px-2.5 py-1 text-sm font-semibold">{hasKey(`nr_${k}`) ? t(`nr_${k}` as Key) : k}</span>)}
          </p>
        </div>
      </Fold>

      <Fold title={t('evidenceTitle')}>
        <p className="text-muted">{t('evidenceSub')}</p>
        <ul className="grid gap-3">
          {validation.checks.map((c) => (
            <li key={c.id}>
              <p className="flex flex-wrap items-center gap-2 font-bold">
                <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-extrabold uppercase">{t(`st_${c.status}` as Key)}</span>
                {hasKey(`chk_${c.id}`) ? t(`chk_${c.id}` as Key) : c.id}
              </p>
              <p className="text-muted">{tx(c.note)}</p>
              {c.value && <p className="mt-0.5 break-words text-sm text-faint">{c.value}</p>}
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title={t('glossaryTitle')}>
        <p className="text-muted">{t('glossarySub')}</p>
        <dl className="grid gap-2.5">
          {GLOSSARY.map((g) => (
            <div key={g}>
              <dt className="font-bold">{t(`gl_${g}_t`)}</dt>
              <dd className="m-0 text-muted">{t(`gl_${g}`)}</dd>
            </div>
          ))}
        </dl>
      </Fold>

      <p className="text-sm leading-snug text-muted">{t('sources', { a: site.power_range.start, b: site.power_range.end })}</p>
      <p className="text-sm font-semibold leading-snug text-muted">{t('supports')}</p>
    </section>
  );
}
