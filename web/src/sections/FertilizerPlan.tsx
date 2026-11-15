import { useEffect, useMemo, useState } from 'react';
import type { Field } from '@/auth/accounts';
import { useAuth } from '@/auth/AuthContext';
import { Badge } from '@/components/Badge';
import { getJSON, useLocationData, type SiteData } from '@/data/useSiteData';
import { recommend, soilFromResults, type FertPlan, type SoilKey, type SoilTest } from '@/lib/fertilizer';
import type { FertCropId, FertilizerFile, WaterRegime } from '@/lib/types';
import { hasKey, t, tx, type Key, type Lang } from '@/strings';
import { cn } from '@/utils/cn';
import { fmtNum } from '@/utils/format';
import { cropsForRotation, fieldTotal, groupByTiming, mergeSoil, parseNum } from '@/utils/fertilizerView';

// Fertilizer card for one field (docs/GUBRE.md §5). All numbers come from
// lib/fertilizer.ts; this file only lays them out. kg per dekar, never money.

const WATERS: WaterRegime[] = ['rainfed', 'limited', 'irrigated'];
const OTHER_CROPS: FertCropId[] = ['barley', 'sugar_beet', 'potato', 'onion'];
const FORM_KEYS: SoilKey[] = ['om_pct', 'p2o5_kg_per_da', 'k2o_kg_per_da', 'ph', 'lime_pct', 'ec_ds_m', 'zn_ppm'];
const USED_KEYS: SoilKey[] = [...FORM_KEYS, 'total_n_pct'];
// Shown as its own box next to the plan, so not repeated in the advice list.
const ADVICE_SHOWN_ELSEWHERE = new Set(['soil_test']);

function useFertilizer() {
  const [f, setF] = useState<FertilizerFile | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    getJSON<FertilizerFile>('fertilizer.json').then((x) => alive && setF(x)).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, []);
  return { f, err };
}

type Props = { data: SiteData; lang: Lang; field: Field; rotationId: string | null };

export function FertilizerPlan({ data, lang, field, rotationId }: Props) {
  const { f, err } = useFertilizer();
  const loc = useLocationData(field.locationId);
  const rotationCrops = cropsForRotation(data.site, rotationId);
  const [crop, setCrop] = useState<FertCropId>(rotationCrops[0]);
  const [water, setWater] = useState<WaterRegime>(field.water ?? 'rainfed');
  const [inoculated, setInoculated] = useState(false);   // unchecked shows the 'inoculate' advice
  const [banding, setBanding] = useState(false);
  // A new recommendation (other priority, depth) resets the crop to its first year.
  useEffect(() => { setCrop(cropsForRotation(data.site, rotationId)[0]); }, [data.site, rotationId]);

  const prefill = useMemo(
    () => (f && loc.status === 'ready' ? soilFromResults(loc.data.results, f) : null),
    [f, loc],
  );
  const merged = useMemo(() => (prefill ? mergeSoil(prefill, field.soilTest) : null), [prefill, field.soilTest]);
  const plan = useMemo<FertPlan | null>(
    () => (f && merged ? recommend(f, { crop, water, soil: merged.soil, inoculated, banding }) : null),
    [f, merged, crop, water, inoculated, banding],
  );

  if (err) return null;   // the rest of the field page keeps working without this card
  if (!f || !plan || !merged || !prefill) return <p className="text-muted">{t(lang, 'loading')}</p>;

  const isLegume = !!f.crops[crop].fixed_n_kg_per_da;
  const groups = groupByTiming(f, plan);
  const area = field.areaDonum;
  const product = (id: string) => tx(lang, f.products[id]?.label) || id;
  const cropName = (id: FertCropId) => tx(lang, f.crops[id].label);
  const timingName = (g: ReturnType<typeof groupByTiming>[number]) =>
    g.label ? `${t(lang, 'fert_t_top')} · ${tx(lang, g.label)}` : t(lang, `fert_t_${g.timing}` as Key);
  const pOrKUnknown = plan.nutrients.some((n) => n.nutrient !== 'n' && n.basis === 'needs_soil_test');
  const advice = plan.advice.filter((a) => !ADVICE_SHOWN_ELSEWHERE.has(a.id));

  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:p-6" aria-labelledby="fert-title">
      <div>
        <h2 id="fert-title" className="text-lg font-semibold">{t(lang, 'fertTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t(lang, 'fertIntro')}</p>
      </div>

      {/* choices */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t(lang, 'fertCrop')}>
          {rotationCrops.map((c) => (
            <Chip key={c} active={crop === c} onClick={() => setCrop(c)}>{cropName(c)}</Chip>
          ))}
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted">
            {t(lang, 'fertOtherCrop')}
            <select value={OTHER_CROPS.includes(crop) ? crop : ''} onChange={(e) => e.target.value && setCrop(e.target.value as FertCropId)}
              className="h-10 rounded-lg border border-line bg-white px-2 text-sm text-ink">
              <option value="">—</option>
              {OTHER_CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t(lang, 'fertWater')}>
          <span className="text-sm text-muted">{t(lang, 'fertWater')}:</span>
          {WATERS.map((w) => <Chip key={w} active={water === w} onClick={() => setWater(w)}>{t(lang, `water_${w}` as Key)}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {isLegume && <Check checked={inoculated} onChange={setInoculated}>{t(lang, 'fertInoculated')}</Check>}
          <Check checked={banding} onChange={setBanding}>{t(lang, 'fertBanding')}</Check>
        </div>
      </div>

      {/* the plan: when / what / how much */}
      {groups.length === 0 ? (
        <p className="rounded-lg bg-[#fbf3e4] px-3 py-2 text-sm text-warn">{t(lang, 'fertNoDoses')}</p>
      ) : (
        <ol className="grid gap-3">
          {groups.map((g) => (
            <li key={g.timing} className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{timingName(g)}</p>
              <ul className="mt-2 grid gap-2">
                {g.doses.map((d) => {
                  const total = fieldTotal(d.kg_per_da, area);
                  return (
                    <li key={d.product + d.timing} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-semibold">{product(d.product)}</span>
                      <span className="text-right">
                        <span className="text-xl font-bold">{fmtNum(d.kg_per_da, lang, 1)} kg</span>
                        <span className="text-sm text-muted"> {t(lang, 'fertPerDa')}</span>
                        {total !== null && (
                          <span className="block text-xs text-faint">
                            {t(lang, 'fertForField', { a: fmtNum(area!, lang, 1) })}: {fmtNum(Math.round(total), lang)} kg
                          </span>
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
      {pOrKUnknown && <p className="rounded-lg bg-[#eef4f7] px-3 py-2 text-sm">{t(lang, 'fertNeedsTest')}</p>}

      {/* why */}
      <details className="rounded-xl border border-line bg-white p-4" open>
        <summary className="cursor-pointer font-semibold">{t(lang, 'fertWhy')}</summary>
        <p className="mt-2 text-sm text-muted">{t(lang, 'fertNutrients')}</p>
        <ul className="mt-1 grid gap-1 text-sm">
          {plan.nutrients.map((n) => (
            <li key={n.nutrient} className="flex flex-wrap items-center gap-x-2">
              <span className="min-w-36">{t(lang, `nutrient_${n.nutrient}` as Key)}</span>
              <b>{n.fertilizer_kg_per_da === null ? <span className="font-normal italic text-faint">{t(lang, `basis_${n.basis}` as Key)}</span>
                : `${fmtNum(n.fertilizer_kg_per_da, lang, 1)} kg`}</b>
              {n.fertilizer_kg_per_da !== null && <span className="text-muted">· {t(lang, `basis_${n.basis}` as Key)}</span>}
              {n.source && n.fertilizer_kg_per_da !== null && <Badge type={n.source.type} verified={n.source.verified} lang={lang} />}
            </li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{t(lang, 'fertSoilUsed')}:</span>
          {USED_KEYS.filter((k) => plan.soil[k] !== undefined).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              {t(lang, `soil_${k}` as Key)} {fmtNum(plan.soil[k]!, lang, 2)}
              {merged.badges[k] && <Badge type={merged.badges[k]!} lang={lang} />}
            </span>
          ))}
        </p>
        {plan.target_yield_kg_per_da !== null && (
          <p className="mt-2 text-xs text-faint">
            {t(lang, 'fertTarget', { v: fmtNum(plan.target_yield_kg_per_da, lang) })} {plan.target_badge && <Badge type={plan.target_badge} lang={lang} />}
          </p>
        )}
        {plan.flags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted">{t(lang, 'fertFlags')}:</span>
            {plan.flags.map((fl) => <span key={fl} className="rounded-full bg-[#f4e9dc] px-2 py-0.5 text-xs font-semibold text-soil">{t(lang, `flag_${fl}` as Key)}</span>)}
          </div>
        )}
        {plan.better_for_salinity.length > 0 && (
          <p className="mt-2 text-sm text-warn">{t(lang, 'fertSalinity', { c: plan.better_for_salinity.map(cropName).join(', ') })}</p>
        )}
        {plan.guide && plan.target_yield_kg_per_da !== null && (
          <p className="mt-2 text-sm text-muted">
            {t(lang, 'fertGuide', { y: fmtNum(plan.target_yield_kg_per_da, lang) })}{' '}
            {plan.guide.doses.map((g) => `${product(g.product)} ${fmtNum(g.min_kg_per_da, lang)}${g.max_kg_per_da !== g.min_kg_per_da ? `–${fmtNum(g.max_kg_per_da, lang)}` : ''} kg`).join(' + ')}
            {plan.guide.note && ` (${tx(lang, plan.guide.note)})`}{' '}
            {f.crops[crop].guide_table && <Badge type={f.crops[crop].guide_table!.type} verified={f.crops[crop].guide_table!.verified} lang={lang} />}
          </p>
        )}
      </details>

      {/* advice */}
      {advice.length > 0 && (
        <div>
          <h3 className="font-semibold">{t(lang, 'fertAdvice')}</h3>
          <ul className="mt-2 grid gap-2 text-sm">
            {advice.map((a) => (
              <li key={a.id} className="rounded-lg border-l-4 border-[#e3c58d] bg-white px-3 py-2">
                {tx(lang, a.text)} <Badge type={a.type} verified={a.verified} lang={lang} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <SoilTestForm field={field} lang={lang} prefill={prefill.soil} badges={merged.badges} missing={plan.missing} />
      <p className="text-xs text-muted">{t(lang, 'fertFarmer')}</p>
    </section>
  );
}

function SoilTestForm({ field, lang, prefill, badges, missing }: {
  field: Field; lang: Lang; prefill: SoilTest; badges: Partial<Record<SoilKey, string>>; missing: SoilKey[];
}) {
  const { farmer, update } = useAuth();
  const initial = () => Object.fromEntries(FORM_KEYS.map((k) => [k, field.soilTest?.[k]?.toString().replace('.', lang === 'tr' ? ',' : '.') ?? ''])) as Record<SoilKey, string>;
  const [vals, setVals] = useState<Record<SoilKey, string>>(initial);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(missing.some((k) => k === 'p2o5_kg_per_da' || k === 'k2o_kg_per_da'));
  useEffect(() => { setVals(initial()); /* field switched */ }, [field.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const store = (soilTest: SoilTest | undefined) => {
    if (!farmer) return;
    update({ ...farmer, fields: farmer.fields.map((x) => (x.id === field.id ? { ...x, soilTest } : x)) });
    setSaved(true);
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const st: SoilTest = {};
    for (const k of FORM_KEYS) { const v = parseNum(vals[k]); if (v !== undefined) st[k] = v; }
    store(Object.keys(st).length ? st : undefined);
  };
  const clear = () => { setVals(Object.fromEntries(FORM_KEYS.map((k) => [k, ''])) as Record<SoilKey, string>); store(undefined); };
  const missingNames = missing.filter((k) => hasKey(`soil_${k}`)).map((k) => t(lang, `soil_${k}` as Key));

  return (
    <details className="rounded-xl border border-line bg-white p-4" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer font-semibold">{t(lang, 'fertSoilTitle')}</summary>
      <p className="mt-1 text-sm text-muted">{t(lang, 'fertSoilHint')}</p>
      {missingNames.length > 0 && <p className="mt-1 text-xs text-warn">{t(lang, 'fertMissing', { list: missingNames.join(', ') })}</p>}
      <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-2">
        {FORM_KEYS.map((k) => {
          const est = prefill[k];
          return (
            <label key={k} className="grid gap-1 text-sm">
              <span className="flex items-center gap-1.5">
                {t(lang, `soil_${k}` as Key)}
                {badges[k] === 'user' && <Badge type="user" lang={lang} />}
              </span>
              <input inputMode="decimal" value={vals[k]} onChange={(e) => { setVals({ ...vals, [k]: e.target.value }); setSaved(false); }}
                placeholder={est !== undefined ? t(lang, 'fertSoilFrom', { v: fmtNum(est, lang, 2) }) : ''}
                className="h-11 rounded-lg border border-line bg-white px-3 text-base" />
            </label>
          );
        })}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-white">{t(lang, 'fertSave')}</button>
          <button type="button" onClick={clear} className="min-h-11 rounded-xl border border-line px-4 text-sm">{t(lang, 'fertClear')}</button>
          {saved && <span className="text-sm text-good" role="status">{t(lang, 'fertSaved')}</span>}
        </div>
      </form>
    </details>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('min-h-10 rounded-full border px-4 text-sm font-semibold', active ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink')}>
      {children}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
      {children}
    </label>
  );
}
