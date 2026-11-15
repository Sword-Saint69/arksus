import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, Info, MapPin, Pencil, Share2, Square, Volume2 } from 'lucide-react';
import { translate, useT, type Key } from '@/i18n';
import { depthFor, useStore } from '@/state/store';
import { useDistrict } from '@/data/hooks';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { harvestYears, practiceOf, stageOf, twoYearPlan } from '@/domain/history';
import { weightsFor } from '@/domain/priorities';
import { ROTATION_COLOR_ON_MAP } from '@/domain/sim';
import { buildVerdict, type Verdict } from '@/domain/verdict';
import { inputsFromDefaults } from '@/lib/economics';
import type { CropId, RotationId } from '@/lib/types';
import { Button, Card, DataBadge, Note, cn } from '@/ui/kit';
import { CropIcon, RotationName } from '@/ui/crops';
import { Options } from './result/Options';
import { WhatIf } from './result/WhatIf';
import { FieldSim } from './result/FieldSim';
import { RightNow } from './result/RightNow';
import { Fertilizer } from './result/Fertilizer';
import { Sowing } from './result/Sowing';
import { AgentCard, Details } from './result/Details';
import { Greenness } from './result/Greenness';

/** The answer, simplest first: what suits this land, why, what to do next. Everything else is below it. */
export function Result() {
  const { t, tx, num } = useT();
  const core = useStore((s) => s.core)!;
  const parcels = useStore((s) => s.parcels);
  const locationId = useStore((s) => s.locationId);
  const distanceKm = useStore((s) => s.distanceKm);
  const answers = useStore((s) => s.answers);
  const go = useStore((s) => s.go);
  const reset = useStore((s) => s.reset);
  const setQuestion = useStore((s) => s.setQuestion);
  const district = useDistrict(locationId);
  const [asRainfed, setAsRainfed] = useState(false);
  const depth = depthFor(answers);
  const location = core.site.locations.find((l) => l.id === locationId);

  const verdict = useMemo(() => {
    if (district.status !== 'ready') return null;
    const weights = weightsFor(answers.priority ?? 'balanced', inputsFromDefaults(core.defaults).weights);
    return buildVerdict(core.site, core.defaults, district.data.results, depth, weights);
  }, [district, answers.priority, core, depth]);

  const irrigated = answers.water === 'irrigated' && !asRainfed;
  const recId = irrigated ? null : (verdict?.decision.recommended as RotationId | null | undefined) ?? null;

  // The field on the map takes the colour of the suggested rotation.
  useEffect(() => {
    withMap((m) => {
      m.setField(parcels, recId ? ROTATION_COLOR_ON_MAP[recId] : undefined);
      m.fitField(fieldPolygons(parcels), { orbit: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recId]);

  if (!location) return <Note tone="warn">{t('loadFailed')}</Note>;
  if (district.status === 'loading') return <p className="py-8 text-center text-lg text-muted" role="status">{t('loading')}</p>;
  if (district.status === 'error' || !verdict) return <Note tone="bad">{t('loadFailed')}<Button className="mt-2" onClick={() => window.location.reload()}>{t('retry')}</Button></Note>;

  const { results, smap, agent } = district.data;
  const depthLabel = tx(core.site.depth_classes.find((d) => d.id === depth)?.label);
  const isPilot = parcels[0]?.source === 'pilot';

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <p className="flex flex-wrap items-center gap-1.5 text-base font-bold text-muted">
          <MapPin size={18} aria-hidden="true" /> {t('resFor', { name: `${location.name}, ${location.province}`, depth: depthLabel })}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" onClick={() => { setQuestion(0); go('questions'); }} className="flex min-h-11 items-center gap-1.5 text-base font-bold text-primary"><Pencil size={17} /> {t('editAnswers')}</button>
          <button type="button" onClick={() => { reset(); go('find'); }} className="flex min-h-11 items-center gap-1.5 text-base font-bold text-primary"><MapPin size={17} /> {t('newField')}</button>
        </div>
      </header>

      {irrigated ? (
        <Card className="grid gap-3 border-2 border-water/40 bg-water-soft">
          <h1 className="text-2xl font-black leading-tight">{t('irrTitle')}</h1>
          <p className="text-lg leading-snug">{t('irrBody')}</p>
          <Button onClick={() => setAsRainfed(true)}>{t('irrSeeAnyway')}</Button>
        </Card>
      ) : (
        <>
          {answers.water === 'irrigated' && <Note tone="warn" icon={<Info size={20} />}>{t('irrShown')}</Note>}
          {answers.water === 'limited' && <Note tone="info" icon={<Info size={20} />}>{t('qWaterSub')}</Note>}
          <Hero verdict={verdict} />
          <NextStep verdict={verdict} />
          <Blocked verdict={verdict} />
          <Note tone="info" icon={<Info size={20} />}>
            {!isPilot && distanceKm !== null && <b>{t('covered', { name: location.name, km: num(distanceKm, distanceKm < 10 ? 1 : 0) })} </b>}
            {t('coveredNote')}
          </Note>
          <Options verdict={verdict} />
          <FieldSim results={results} depth={depth} />
          <WhatIf verdict={verdict} locationId={location.id} />
        </>
      )}

      <RightNow smap={smap} location={location} />
      {irrigated && <Note tone="info">{t('fertIrrigatedNote')}</Note>}
      <Fertilizer results={results} rotationId={recId} />
      <Sowing rotationId={recId} />
      {!isPilot && <Greenness />}
      <AgentCard agent={agent} />
      <Details verdict={verdict} results={results} />
    </div>
  );
}

function closeText(v: Verdict, t: ReturnType<typeof useT>['t'], tx: ReturnType<typeof useT>['tx']): string {
  if (v.closeCall && v.runnerUp) return t('recClose', { r: tx(v.runnerUp.rotation.label) });
  return v.runnerUp ? t('recNotClose') : t('recOnly');
}

function Hero({ verdict }: { verdict: Verdict }) {
  const { t, tx, lang } = useT();
  const priority = useStore((s) => s.answers.priority);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const rec = verdict.recommended;
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  if (!rec) return <Note tone="bad" icon={<Ban size={20} />}>{t('recNone')}</Note>;
  const why = t(`why_${rec.ranked.driver}` as Key);
  const close = closeText(verdict, t, tx);
  const blocked = verdict.blocked.map((b) => `${tx(b.rotation.label)}: ${b.ranked.blocked.map((r) => t(`block_${r}` as Key)).join(' ')}`);
  const summary = [
    `${t('recTitle')}: ${tx(rec.rotation.label).replace('→', lang === 'tr' ? 'sonra' : 'then')}.`,
    why, close,
    blocked.length ? `${t('recBlocked')}: ${blocked.join(' ')}` : t('noBlocked'),
    translate(lang, 'supports'),
  ].join(' ');

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(summary);
    u.lang = lang === 'tr' ? 'tr-TR' : 'en-GB';
    u.rate = 0.92;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  const share = async () => {
    const text = `NöbetSu · ${summary.replace(lang === 'tr' ? ' sonra ' : ' then ', ' → ')}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    } catch { /* the farmer closed the share sheet */ }
  };

  return (
    <section aria-labelledby="rec-title" className="animate-rise rounded-[1.75rem] bg-gradient-to-br from-primary-strong to-primary p-5 text-white shadow-sm">
      <p id="rec-title" className="text-sm font-extrabold uppercase tracking-[0.08em] text-gold">{t('recTitle')}</p>
      <p className="mt-2.5 text-[2rem] font-black leading-[1.1]"><RotationName rotation={rec.rotation} size="lg" onDark /></p>
      <p className="mt-3 text-xl font-semibold leading-snug">{why}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-white/85">
        {t('recDriver', { d: t(`crit_${rec.ranked.driver}` as Key) })} <DataBadge type="model" />
        <span aria-hidden="true">·</span>
        {priority && priority !== 'balanced'
          ? <>{t('yourPriority', { p: t(`prio_${priority}` as Key) })} <DataBadge type="user" /></>
          : <>{t('teamPriority')} <DataBadge type="assumption" /></>}
      </p>
      <p className={cn('mt-3 rounded-2xl px-3.5 py-2.5 text-base font-semibold leading-snug', verdict.closeCall ? 'bg-gold text-primary-strong' : 'bg-white/14')}>{close}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {'speechSynthesis' in window && (
          <button type="button" onClick={speak} aria-pressed={speaking} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-primary-strong active:scale-[0.98]">
            {speaking ? <Square size={18} fill="currentColor" /> : <Volume2 size={20} />} {speaking ? t('stopListen') : t('listen')}
          </button>
        )}
        <button type="button" onClick={share} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/16 px-4 text-base font-bold active:scale-[0.98]">
          <Share2 size={19} /> {t('share')}
        </button>
        {copied && <span role="status" className="self-center text-sm">{t('shared')}</span>}
      </div>
    </section>
  );
}

const cropNote = (c: CropId): Key => (c === 'fallow' ? 'cropNote_fallow' : c === 'wheat' ? 'cropNote_wheat' : 'cropNote_legume');

/** What the suggestion means for the seasons ahead, starting from what the farmer said was last on the field. */
function NextStep({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  const history = useStore((s) => s.answers.history);
  const rec = verdict.recommended;
  if (!rec) return null;
  const stage = stageOf(history);
  const practice = practiceOf(history);
  const plan = twoYearPlan(stage, rec.rotation.crops, harvestYears(new Date())[2]);
  return (
    <Card className="grid gap-3">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><CalendarDays size={22} className="text-primary" aria-hidden="true" /> {t('nextTitle')}</h2>
      <p className="text-lg leading-snug">{t(`stage_${stage}` as Key, { first: t(`crop_${rec.rotation.crops[0]}` as Key) })}</p>
      <ol className="grid grid-cols-2 gap-2.5">
        {plan.map((y, i) => (
          <li key={y.harvestYear} className={cn('grid gap-1 rounded-2xl p-3', i === 0 ? 'bg-primary-soft' : 'bg-canvas')}>
            <span className="text-sm font-bold text-muted">{t('seasonOf', { y: y.harvestYear })}</span>
            <span className="flex items-center gap-2 text-xl font-black"><CropIcon crop={y.crop} size={26} /> {t(`crop_${y.crop}` as Key)}</span>
            <span className="text-sm leading-snug text-muted">{t(cropNote(y.crop))}</span>
          </li>
        ))}
      </ol>
      {practice !== 'unknown' && <p className="text-[15px] leading-snug text-muted">{t(`practice_${practice}` as Key)}</p>}
    </Card>
  );
}

/** Options the guardrails took out are always named, with the reason. */
function Blocked({ verdict }: { verdict: Verdict }) {
  const { t, tx } = useT();
  if (!verdict.blocked.length) return <Note tone="good">{t('noBlocked')}</Note>;
  return (
    <Card className="grid gap-2 border-bad/30 bg-bad-soft/50">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-bad"><Ban size={20} aria-hidden="true" /> {t('recBlocked')}</h2>
      <ul className="grid gap-2">
        {verdict.blocked.map((b) => (
          <li key={b.rotation.id} className="text-base leading-snug">
            <b>{tx(b.rotation.label)}</b>
            {b.ranked.blocked.map((r) => <span key={r} className="block text-[15px] text-ink/80">{t(`block_${r}` as Key)} <DataBadge type="model" /></span>)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
