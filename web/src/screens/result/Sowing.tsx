import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Ruler, Sprout, Wheat } from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { useStore } from '@/state/store';
import { useSowing } from '@/data/hooks';
import { fieldAreaM2, hasRealArea, toDonum } from '@/domain/field';
import { cropsForRotation } from '@/domain/fertilizerView';
import { sowingPlan, windowStatus, type Drill, type Seedbed, type SoilMoisture } from '@/lib/sowing';
import type { SowCropId, SowingFile } from '@/lib/types';
import { Card, DataBadge, Fold, Note, SectionTitle, cn } from '@/ui/kit';

// "Nasıl ekilir" card (docs/GUBRE.md §9). Every number comes from lib/sowing.ts and sowing.json;
// this file only lays them out. Seeds and kg per dekar, never money.

const SOW_CROPS: SowCropId[] = ['wheat', 'barley', 'lentil', 'chickpea'];
const SEEDBEDS: Seedbed[] = ['good', 'normal', 'poor'];
const SOILS: SoilMoisture[] = ['moist', 'dry'];
const DRILLS: Drill[] = ['separate_band', 'same_band', 'broadcast'];
const CALC_KEYS = ['tkw_g', 'purity_pct', 'germination_pct'] as const;

const parseNum = (raw: string): number | undefined => {
  const n = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && isFinite(n) && n > 0 ? n : undefined;
};

export function Sowing({ rotationId }: { rotationId: string | null }) {
  const sow = useSowing();
  if (sow.status === 'error') return null;   // the rest of the page works without this card
  if (sow.status === 'loading') return null;
  return <SowingCard f={sow.data} rotationId={rotationId} />;
}

function SowingCard({ f, rotationId }: { f: SowingFile; rotationId: string | null }) {
  const { t, tx, num, lang } = useT();
  const site = useStore((s) => s.core)!.site;
  const locationId = useStore((s) => s.locationId);
  const parcels = useStore((s) => s.parcels);
  const water = useStore((s) => s.answers.water) ?? 'rainfed';

  const rotCrops = cropsForRotation(site, rotationId).filter((c): c is SowCropId => (SOW_CROPS as string[]).includes(c));
  const crops: SowCropId[] = rotCrops.length ? rotCrops : ['wheat'];
  const [crop, setCrop] = useState<SowCropId>(crops[0]);
  useEffect(() => { setCrop(crops[0]); }, [rotationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [typeId, setTypeId] = useState<string>(f.crops[crops[0]].types[0].id);
  useEffect(() => { setTypeId(f.crops[crop].types[0].id); }, [crop, f]);

  const type = f.crops[crop].types.find((x) => x.id === typeId) ?? f.crops[crop].types[0];
  const w = type.window?.[water];
  const status = w ? windowStatus(w.from, w.to, new Date()) : null;
  const [late, setLate] = useState(false);
  const [seedbed, setSeedbed] = useState<Seedbed>('normal');
  const [soil, setSoil] = useState<SoilMoisture>('moist');
  const [drill, setDrill] = useState<Drill>('same_band');
  const [vals, setVals] = useState<Record<(typeof CALC_KEYS)[number], string>>({ tkw_g: '', purity_pct: '', germination_pct: '' });

  const plan = useMemo(() => sowingPlan(f, {
    crop, typeId: type.id, water, locationId: locationId ?? undefined, late, seedbed, soil, drill,
    tkw_g: parseNum(vals.tkw_g), purity_pct: parseNum(vals.purity_pct), germination_pct: parseNum(vals.germination_pct),
  }), [f, crop, type.id, water, locationId, late, seedbed, soil, drill, vals]);

  const day = (md: string) => new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long' })
    .format(new Date(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3, 5))));
  const area = hasRealArea(parcels) ? toDonum(fieldAreaM2(parcels)) : null;
  const range = (a: number, b: number, d = 0) => (a === b ? num(a, d) : `${num(a, d)}–${num(b, d)}`);

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-3" aria-labelledby="sow-title">
      <SectionTitle sub={t('sowIntro')}><span id="sow-title">{t('sowTitle')}</span></SectionTitle>

      {/* crop and type */}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('sowTitle')}>
        {[...crops, ...SOW_CROPS.filter((c) => !crops.includes(c))].map((c) => (
          <button key={c} type="button" aria-pressed={crop === c} onClick={() => setCrop(c)}
            className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-base font-bold',
              crop === c ? 'border-primary bg-primary text-white' : crops.includes(c) ? 'border-line bg-white' : 'border-dashed border-line bg-white text-muted')}>
            <Sprout size={17} aria-hidden="true" /> {tx(f.crops[c].label)}
          </button>
        ))}
      </div>
      {f.crops[crop].types.length > 1 && (
        <label className="grid min-w-0 gap-1 text-[15px] font-semibold">
          {t('sowType')}
          <select value={type.id} onChange={(e) => setTypeId(e.target.value)} className="min-h-12 w-full min-w-0 truncate rounded-2xl border-2 border-line bg-white px-3 text-base">
            {f.crops[crop].types.map((x) => <option key={x.id} value={x.id}>{tx(x.label)}</option>)}
          </select>
        </label>
      )}

      {/* conditions */}
      <Fold title={t('sowConditions')} defaultOpen>
        <Seg label={t('sowSeedbed')} value={seedbed} options={SEEDBEDS} onChange={setSeedbed} name={(v) => t(`seedbed_${v}` as Key)} />
        <Seg label={t('sowSoil')} value={soil} options={SOILS} onChange={setSoil} name={(v) => t(`soil_${v}` as Key)} />
        <Seg label={t('sowDrill')} value={drill} options={DRILLS} onChange={setDrill} name={(v) => t(`drill_${v}` as Key)} />
        <label className="inline-flex min-h-11 items-center gap-2 text-base">
          <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />
          {t('sowLate')}
        </label>
      </Fold>

      {/* when */}
      <Card className="grid gap-2">
        <h3 className="flex items-center gap-2 text-lg font-extrabold"><CalendarRange size={20} className="text-primary" aria-hidden="true" /> {t('sowWhen')}</h3>
        {plan.window ? (
          <p className="flex flex-wrap items-center gap-2 text-xl font-black">
            {t('sowWindow', { a: day(plan.window.from), b: day(plan.window.to) })}
            <DataBadge type={plan.window.source.type} verified={plan.window.source.verified} />
            {status && <span className={cn('rounded-full px-2.5 py-0.5 text-sm font-bold', status === 'open' ? 'bg-primary-soft text-primary' : 'bg-canvas text-muted')}>{t(`sowStatus_${status}` as Key)}</span>}
          </p>
        ) : plan.window_text && <p className="text-lg font-bold">{tx(plan.window_text)}</p>}
        {plan.window_notes.map((n) => (
          <p key={n.id} className="text-[15px] leading-snug text-muted">{tx(n.text)} <DataBadge type={n.type} verified={n.verified} /></p>
        ))}
      </Card>

      {/* seed */}
      <Card className="grid gap-2">
        <h3 className="flex items-center gap-2 text-lg font-extrabold"><Wheat size={20} className="text-wheat" aria-hidden="true" /> {t('sowSeed')}</h3>
        {plan.seeds && (
          <>
            <p className="flex flex-wrap items-center gap-2 text-base">{t('sowSeedsM2', { a: num(plan.seeds.range.min), b: num(plan.seeds.range.max) })} <DataBadge type={plan.seeds.range.type} verified={plan.seeds.range.verified} /></p>
            <p className="text-lg font-bold">{t('sowChosen', { v: num(plan.seeds.chosen) })} <span className="text-[15px] font-normal text-muted">· {t(`sowRule_${plan.seeds.rule}` as Key)}</span></p>
          </>
        )}
        {plan.plants && <p className="flex flex-wrap items-center gap-2 text-base">{t('sowPlantsM2', { a: num(plan.plants.min) })} <DataBadge type={plan.plants.type} verified={plan.plants.verified} /></p>}
        {plan.guide && (
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-muted">{t('sowGuide')}:</span>
            <span className="text-2xl font-black tabular-nums">{range(plan.guide.min, plan.guide.max)} kg</span>
            <span className="text-[15px] text-muted">{t('fertPerDa')}</span>
            <DataBadge type={plan.guide.range.type} verified={plan.guide.range.verified} />
            {plan.guide.extras.length > 0 && (
              <span className="basis-full text-sm text-muted">
                {range(plan.guide.range.min, plan.guide.range.max)} kg {plan.guide.extras.map((e) => t('sowExtra', { a: range(e.min, e.max), r: tx(e.label) })).join(' ')}
              </span>
            )}
            {area !== null && <span className="basis-full text-sm text-muted">{t('fertForField', { a: num(area, 1) })}: <b className="text-ink">{range(Math.round(plan.guide.min * area), Math.round(plan.guide.max * area))} kg</b></span>}
          </p>
        )}
        <Fold title={t('sowCalcTitle')}>
          <p className="text-muted">{t('sowCalcHint')}</p>
          <div className="grid gap-2">
            {CALC_KEYS.map((k) => (
              <label key={k} className="grid gap-1 text-sm font-semibold">
                {t(`sow_${k}` as Key)}
                <input inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                  className="h-12 rounded-2xl border-2 border-line bg-white px-3 text-base font-normal" />
              </label>
            ))}
          </div>
          {plan.calc ? (
            <p className="flex flex-wrap items-center gap-2 text-xl font-black">
              {t('sowCalcResult', { v: num(plan.calc.kg_per_da, 1) })} <DataBadge type="user" />
              {area !== null && <span className="basis-full text-sm font-normal text-muted">{t('fertForField', { a: num(area, 1) })}: <b className="text-ink">{num(Math.round(plan.calc.kg_per_da * area))} kg</b></span>}
            </p>
          ) : plan.calc_missing.length > 0 && Object.values(vals).some((v) => v.trim() !== '') && (
            <p className="text-sm text-warn">{t('sowCalcMissing', { list: plan.calc_missing.map((k) => t(`sow_${k}` as Key)).join(', ') })}</p>
          )}
          <p className="text-xs text-muted">{f.seed_formula.source} <DataBadge type={f.seed_formula.type} verified={f.seed_formula.verified} /></p>
        </Fold>
      </Card>

      {/* depth and rows */}
      <Card className="grid gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold"><Ruler size={20} className="text-soil" aria-hidden="true" /> {t('sowDepth')}</h3>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black">{range(plan.depth.min, plan.depth.max)} cm <DataBadge type={plan.depth.type} verified={plan.depth.verified} /></p>
        </div>
        <div>
          <h3 className="text-lg font-extrabold">{t('sowRows')}</h3>
          <ul className="mt-1 grid gap-1">
            {plan.rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <b className="text-xl tabular-nums">{range(r.min, r.max)} cm</b>
                <span className="text-sm text-muted">{tx(r.label)}</span>
                <DataBadge type={r.type} verified={r.verified} />
              </li>
            ))}
          </ul>
          {plan.annual_precip && typeof plan.annual_precip.value === 'number' && crop === 'lentil' && (
            <p className="mt-1 text-xs text-muted">{t('sowPrecip', { v: num(plan.annual_precip.value) })} <DataBadge type={plan.annual_precip.type} verified={plan.annual_precip.verified} /></p>
          )}
        </div>
      </Card>

      {plan.advice.length > 0 && (
        <Fold title={t('sowAdvice')} defaultOpen>
          <ul className="grid gap-2">
            {plan.advice.map((a) => (
              <li key={a.id} className="rounded-xl border-l-4 border-gold bg-canvas px-3 py-2">{tx(a.text)} <DataBadge type={a.type} verified={a.verified} /></li>
            ))}
          </ul>
        </Fold>
      )}
      {crop === 'chickpea' || crop === 'lentil'
        ? <Note tone="info">{t('sowFarmer')}</Note>
        : <Card className="border-0 bg-canvas p-3.5 text-sm leading-snug text-muted">{t('sowFarmer')}</Card>}
    </section>
  );
}

function Seg<V extends string>({ label, value, options, onChange, name }: {
  label: string; value: V; options: V[]; onChange: (v: V) => void; name: (v: V) => string;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-bold text-muted">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={cn('min-h-11 rounded-2xl border-2 px-3.5 text-[15px] font-bold', value === o ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-white')}>
            {name(o)}
          </button>
        ))}
      </div>
    </div>
  );
}
