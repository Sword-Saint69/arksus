import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Sprout } from 'lucide-react';
import { useT, hasKey, type Key } from '@/i18n';
import { QUESTION_IDS, useStore } from '@/state/store';
import { useFertilizer } from '@/data/hooks';
import { fieldAreaM2, hasRealArea, toDonum } from '@/domain/field';
import { cropsForRotation, fieldTotal, groupByTiming, mergeSoil } from '@/domain/fertilizerView';
import { recommend, soilFromResults, type SoilKey } from '@/lib/fertilizer';
import type { FertCropId, ResultsFile, WaterRegime } from '@/lib/types';
import { Button, Card, DataBadge, Fold, Note, SectionTitle, cn } from '@/ui/kit';

const USED_KEYS: SoilKey[] = ['om_pct', 'p2o5_kg_per_da', 'k2o_kg_per_da', 'ph', 'lime_pct', 'ec_ds_m', 'zn_ppm', 'total_n_pct'];
// Said in its own box below the plan, so not repeated in the advice list.
const ADVICE_SHOWN_ELSEWHERE = new Set(['soil_test']);

/**
 * When, which fertilizer, how many kg per dekar. Every number comes from
 * lib/fertilizer.ts (official TAGEM tables first); this card only lays them out.
 */
export function Fertilizer({ results, rotationId }: { results: ResultsFile; rotationId: string | null }) {
  const { t, tx, num } = useT();
  const site = useStore((s) => s.core)!.site;
  const parcels = useStore((s) => s.parcels);
  const answers = useStore((s) => s.answers);
  const go = useStore((s) => s.go);
  const setQuestion = useStore((s) => s.setQuestion);
  const fert = useFertilizer();
  const crops = cropsForRotation(site, rotationId);
  const [crop, setCrop] = useState<FertCropId>(crops[0]);
  useEffect(() => { setCrop(cropsForRotation(site, rotationId)[0]); }, [site, rotationId]);
  const water: WaterRegime = answers.water ?? 'rainfed';
  // Unchecked shows the "inoculate" advice and the TAGEM table N; checked uses the GKGM starter dose.
  const [inoculated, setInoculated] = useState(false);
  const [banding, setBanding] = useState(false);

  const view = useMemo(() => {
    if (fert.status !== 'ready') return null;
    const f = fert.data;
    const merged = mergeSoil(soilFromResults(results, f), answers.hasSoilTest ? answers.soilTest : undefined);
    try {
      const plan = recommend(f, { crop, water, soil: merged.soil, inoculated, banding });
      return { f, merged, plan, groups: groupByTiming(f, plan) };
    } catch { return null; }
  }, [fert, results, answers.hasSoilTest, answers.soilTest, crop, water, inoculated, banding]);

  if (fert.status === 'error') return null;   // the rest of the page works without this card
  if (!view) return <p className="text-muted" role="status">{t('loading')}</p>;
  const { f, merged, plan, groups } = view;
  const area = hasRealArea(parcels) ? toDonum(fieldAreaM2(parcels)) : null;
  const product = (id: string) => tx(f.products[id]?.label) || id;
  const needsTest = plan.nutrients.some((n) => n.nutrient !== 'n' && n.basis === 'needs_soil_test');
  const advice = plan.advice.filter((a) => !ADVICE_SHOWN_ELSEWHERE.has(a.id));
  const isLegume = !!f.crops[crop].fixed_n_kg_per_da;
  // Without a P test the plan has nitrogen only; the guide's doses (wheat: Toros) are shown as the no-test reference.
  const guideFallback = needsTest && plan.guide && plan.target_yield_kg_per_da !== null ? plan.guide : null;
  const splitLabel = (timing: string) => f.crops[crop].n_split[water]?.find((p) => p.timing === timing)?.label;
  const timingName = (timing: string) => {
    const l = timing === 'base' ? null : splitLabel(timing);
    return l ? `${t('fert_t_top')} · ${tx(l)}` : t(`fert_t_${timing}` as Key);
  };
  const toSoilQuestion = () => { setQuestion(QUESTION_IDS.indexOf('soil')); go('questions'); };
  // A product dose is worked out from the nutrient amounts, so it is only as firm as the
  // least firm of them: official when every amount comes from an official table.
  const sourced = plan.nutrients.filter((n) => n.fertilizer_kg_per_da !== null && n.source).map((n) => n.source!);
  const doseBadge = sourced.find((s) => s.type !== 'official') ?? sourced[0] ?? null;
  const doseVerified = sourced.every((s) => s.verified);

  return (
    <section className="grid gap-3" aria-labelledby="fert-title">
      <SectionTitle sub={t('fertIntro')}><span id="fert-title">{t('fertTitle')}</span></SectionTitle>

      {crops.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group">
          {crops.map((c) => (
            <button key={c} type="button" aria-pressed={crop === c} onClick={() => setCrop(c)}
              className={cn('inline-flex min-h-12 items-center gap-1.5 rounded-full border-2 px-4 text-base font-bold', crop === c ? 'border-primary bg-primary text-white' : 'border-line bg-white')}>
              <Sprout size={18} aria-hidden="true" /> {tx(f.crops[c].label)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-base">
        {isLegume && (
          <label className="inline-flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={inoculated} onChange={(e) => setInoculated(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
            {t('fertInoculated')}
          </label>
        )}
        <label className="inline-flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={banding} onChange={(e) => setBanding(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
          {t('fertBanding')}
        </label>
      </div>

      {needsTest && groups.length > 0 && <p className="text-[15px] font-bold text-warn">{t('fertOnlyN')}</p>}
      {groups.length === 0 ? <Note tone="warn">{t('fertNoDoses')}</Note> : (
        <ol className="grid gap-2.5">
          {groups.map((g) => (
            <li key={g.timing} className="rounded-3xl border border-line bg-white p-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-primary">
                {g.label ? `${t('fert_t_top')} · ${tx(g.label)}` : t(`fert_t_${g.timing}` as Key)}
              </p>
              <ul className="mt-2 grid gap-2.5">
                {g.doses.map((d) => {
                  const total = fieldTotal(d.kg_per_da, area);
                  return (
                    <li key={d.product + d.timing} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                      <span className="text-lg font-bold">{product(d.product)}</span>
                      <span className="text-right">
                        <span className="text-2xl font-black tabular-nums">{num(d.kg_per_da, 1)} kg</span>
                        <span className="text-[15px] text-muted"> {t('fertPerDa')}</span>{' '}
                        {doseBadge && <DataBadge type={doseBadge.type} verified={doseVerified} />}
                        {total !== null && (
                          <span className="block text-sm text-muted">{t('fertForField', { a: num(area!, 1) })}: <b className="text-ink">{num(Math.round(total))} kg</b></span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {guideFallback && (
        <Card className="grid gap-2 border-2 border-gold/60">
          <p className="flex flex-wrap items-center gap-2 font-extrabold">
            {t('fertGuideTitle', { y: num(plan.target_yield_kg_per_da!) })}
            {f.crops[crop].guide_table && <DataBadge type={f.crops[crop].guide_table!.type} verified={f.crops[crop].guide_table!.verified} />}
          </p>
          <ul className="grid gap-1.5">
            {guideFallback.doses.map((g, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span><span className="text-sm text-muted">{timingName(g.timing)}:</span> <b>{product(g.product)}</b></span>
                <span className="text-lg font-black tabular-nums">{num(g.min_kg_per_da)}{g.max_kg_per_da !== g.min_kg_per_da ? `–${num(g.max_kg_per_da)}` : ''} kg <span className="text-sm font-normal text-muted">{t('fertPerDa')}</span></span>
              </li>
            ))}
          </ul>
          {guideFallback.note && <p className="text-sm text-muted">{tx(guideFallback.note)}</p>}
          <p className="text-sm text-muted">{t('fertGuideSub')}</p>
        </Card>
      )}

      {needsTest && (
        <Note tone="info" icon={<FlaskConical size={20} />}>
          {t('fertNeedsTest')}
          <Button className="mt-2" onClick={toSoilQuestion}>{t('fertEnter')}</Button>
        </Note>
      )}

      <Fold title={t('fertWhy')}>
        <p className="font-semibold">{t('fertNutrients')}</p>
        <ul className="grid gap-1.5">
          {plan.nutrients.map((n) => (
            <li key={n.nutrient} className="flex flex-wrap items-center gap-x-2">
              <span className="min-w-36 font-semibold">{t(`nutrient_${n.nutrient}` as Key)}</span>
              {n.fertilizer_kg_per_da === null
                ? <span className="italic text-muted">{t(`basis_${n.basis}` as Key)}</span>
                : <><b className="tabular-nums">{num(n.fertilizer_kg_per_da, 1)} kg</b><span className="text-muted">· {t(`basis_${n.basis}` as Key)}</span>{n.source && <DataBadge type={n.source.type} verified={n.source.verified} />}</>}
            </li>
          ))}
        </ul>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
          <span>{t('fertSoilUsed')}:</span>
          {USED_KEYS.filter((k) => plan.soil[k] !== undefined && hasKey(`soil_${k}`)).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">{t(`soil_${k}` as Key)} <b className="text-ink">{num(plan.soil[k]!, 2)}</b>{merged.badges[k] && <DataBadge type={merged.badges[k]!} />}</span>
          ))}
        </p>
        {plan.target_yield_kg_per_da !== null && (
          <p className="text-muted">{t('fertTarget', { v: num(plan.target_yield_kg_per_da) })} {plan.target_badge && <DataBadge type={plan.target_badge} />}</p>
        )}
        {plan.flags.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted">{t('fertFlags')}:</span>
            {plan.flags.map((fl) => <span key={fl} className="rounded-full bg-[#f4e8da] px-2.5 py-0.5 text-sm font-bold text-soil">{t(`flag_${fl}` as Key)}</span>)}
          </p>
        )}
      </Fold>

      {advice.length > 0 && (
        <Fold title={t('fertAdvice')}>
          <ul className="grid gap-2">
            {advice.map((a) => (
              <li key={a.id} className="rounded-xl border-l-4 border-gold bg-canvas px-3 py-2">{tx(a.text)} <DataBadge type={a.type} verified={a.verified} /></li>
            ))}
          </ul>
        </Fold>
      )}
      <Card className="border-0 bg-canvas p-3.5 text-sm leading-snug text-muted">{t('fertFarmer')}</Card>
    </section>
  );
}
