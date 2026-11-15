import { useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Bean, CloudRain, Droplets, FlaskConical, HelpCircle, Scale, Shield, ShowerHead, Sprout,
  Tractor, TrendingUp, Wheat, X,
} from 'lucide-react';
import { useT, type Key } from '@/i18n';
import { QUESTION_IDS, useStore, type QuestionId } from '@/state/store';
import { withMap } from '@/map/api';
import { fieldPolygons } from '@/domain/field';
import { harvestYears, PAST_CROPS, type PastCrop } from '@/domain/history';
import { PRIORITY_IDS, type PriorityId } from '@/domain/priorities';
import type { DepthId, WaterRegime } from '@/lib/types';
import { Button, Choice, cn } from '@/ui/kit';
import { SoilTestForm } from './SoilTestForm';

const WATER: { id: WaterRegime; icon: React.ReactNode }[] = [
  { id: 'rainfed', icon: <CloudRain size={26} /> },
  { id: 'limited', icon: <Droplets size={26} /> },
  { id: 'irrigated', icon: <ShowerHead size={26} /> },
];
const DEPTHS: (DepthId | 'unknown')[] = ['shallow', 'medium', 'deep', 'unknown'];
const PRIORITY_ICON: Record<PriorityId, React.ReactNode> = {
  balanced: <Scale size={26} />, value: <TrendingUp size={26} />, yield: <Wheat size={26} />, soil: <Shield size={26} />, water: <Droplets size={26} />,
};
const PAST_ICON: Record<PastCrop, React.ReactNode> = {
  wheat: <Wheat size={20} />, barley: <Wheat size={20} />, chickpea: <Bean size={20} />, lentil: <Sprout size={20} />, fallow: <Tractor size={20} />, other: <HelpCircle size={20} />,
};

/** A few questions, one at a time, each answered with one tap. */
export function Questions() {
  const { t } = useT();
  const i = useStore((s) => s.question);
  const setQuestion = useStore((s) => s.setQuestion);
  const answers = useStore((s) => s.answers);
  const answer = useStore((s) => s.answer);
  const setHistory = useStore((s) => s.setHistory);
  const go = useStore((s) => s.go);
  const id: QuestionId = QUESTION_IDS[Math.min(i, QUESTION_IDS.length - 1)];
  const last = i >= QUESTION_IDS.length - 1;

  useEffect(() => {
    // While the farmer answers, the camera circles the field slowly.
    withMap((m) => { m.fitField(fieldPolygons(useStore.getState().parcels), { orbit: true }); });
    return () => withMap((m) => m.setOrbit(false));
  }, []);

  const next = () => (last ? go('analyzing') : setQuestion(i + 1));
  const back = () => (i === 0 ? go('find') : setQuestion(i - 1));
  /** Single-answer questions move on by themselves, after a beat so the tick is seen. */
  const choose = (apply: () => void) => { apply(); window.setTimeout(() => (last ? undefined : setQuestion(i + 1)), 260); };

  const years = harvestYears(new Date());
  const answered: Record<QuestionId, boolean> = {
    water: answers.water !== null,
    history: answers.history.some((c) => c !== null),
    depth: answers.depth !== null,
    priority: answers.priority !== null,
    soil: answers.hasSoilTest !== null,
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={back} className="flex min-h-11 items-center gap-1.5 text-base font-bold text-primary">
          <ArrowLeft size={20} /> {t('back')}
        </button>
        <p className="text-sm font-bold text-muted" aria-live="polite">{t('qOf', { i: i + 1, n: QUESTION_IDS.length })}</p>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {QUESTION_IDS.map((q, k) => <span key={q} className={cn('h-2 flex-1 rounded-full', k < i ? 'bg-primary' : k === i ? 'bg-gold' : 'bg-raise')} />)}
      </div>

      <div key={id} className="grid animate-rise gap-3">
        {id === 'water' && (
          <>
            <Head title={t('qWater')} sub={t('qWaterSub')} />
            <div role="radiogroup" aria-label={t('qWater')} className="grid gap-2.5">
              {WATER.map((w) => (
                <Choice key={w.id} selected={answers.water === w.id} onSelect={() => choose(() => answer('water', w.id))}
                  icon={w.icon} title={t(`water_${w.id}` as Key)} help={t(`water_${w.id}_help` as Key)} />
              ))}
            </div>
          </>
        )}

        {id === 'history' && (
          <>
            <Head title={t('qHistory')} sub={t('qHistorySub')} />
            {/* Latest harvest first: it is the one people remember, and the one that sets the next step. */}
            {[2, 1, 0].map((k) => (
              <fieldset key={k} className="rounded-2xl border border-line bg-white p-3">
                <legend className="px-1 text-base font-extrabold">{t('harvestOf', { y: years[k] })}</legend>
                <div className="flex flex-wrap gap-2">
                  {PAST_CROPS.map((c) => {
                    const on = answers.history[k] === c;
                    return (
                      <button key={c} type="button" aria-pressed={on} onClick={() => setHistory(k as 0 | 1 | 2, on ? null : c)}
                        className={cn('inline-flex min-h-12 items-center gap-1.5 rounded-full border-2 px-3.5 text-base font-bold transition',
                          on ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:border-primary/60')}>
                        {PAST_ICON[c]} {t(`past_${c}` as Key)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </>
        )}

        {id === 'depth' && (
          <>
            <Head title={t('qDepth')} sub={t('qDepthSub')} />
            <div role="radiogroup" aria-label={t('qDepth')} className="grid gap-2.5">
              {DEPTHS.map((d) => (
                <Choice key={d} selected={answers.depth === d} onSelect={() => choose(() => answer('depth', d))}
                  icon={d === 'unknown' ? <HelpCircle size={26} /> : <DepthIcon level={d} />}
                  title={t(`depth_${d}` as Key)} help={t(`depthHelp_${d}` as Key)} />
              ))}
            </div>
          </>
        )}

        {id === 'priority' && (
          <>
            <Head title={t('qPriority')} sub={t('qPrioritySub')} />
            <div role="radiogroup" aria-label={t('qPriority')} className="grid gap-2.5">
              {PRIORITY_IDS.map((p) => (
                <Choice key={p} selected={answers.priority === p} onSelect={() => choose(() => answer('priority', p))}
                  icon={PRIORITY_ICON[p]} title={t(`prio_${p}` as Key)} help={t(`prio_${p}_help` as Key)} />
              ))}
            </div>
          </>
        )}

        {id === 'soil' && (
          <>
            <Head title={t('qSoil')} sub={t('qSoilSub')} />
            <div role="radiogroup" aria-label={t('qSoil')} className="grid gap-2.5">
              <Choice selected={answers.hasSoilTest === true} onSelect={() => answer('hasSoilTest', true)}
                icon={<FlaskConical size={26} />} title={t('soilYes')} help={t('soilYesHelp')} />
              <Choice selected={answers.hasSoilTest === false} onSelect={() => answer('hasSoilTest', false)}
                icon={<X size={26} />} title={t('soilNo')} help={t('soilNoHelp')} />
            </div>
            {answers.hasSoilTest && <SoilTestForm />}
          </>
        )}
      </div>

      <div className="sticky bottom-0 -mx-4 grid gap-1 border-t border-line bg-paper px-4 pb-1 pt-3">
        <Button variant="primary" size="lg" block onClick={next} disabled={!answered[id] && id !== 'history'}>
          {last ? t('seeResult') : t('next')} <ArrowRight size={22} strokeWidth={2.6} />
        </Button>
        {!answered[id] && id !== 'soil' && (
          <button type="button" onClick={next} className="min-h-11 text-base font-semibold text-muted underline underline-offset-4">{t('skip')}</button>
        )}
      </div>
    </div>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="text-[1.7rem] font-black leading-tight">{title}</h1>
      <p className="mt-1.5 text-base leading-snug text-muted">{sub}</p>
    </div>
  );
}

/** Soil column with the stone line higher or lower: the depth classes at a glance. */
function DepthIcon({ level }: { level: DepthId }) {
  const soil = level === 'shallow' ? 9 : level === 'medium' ? 15 : 21;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="4" y="3" width="20" height="22" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="4" y="3" width="20" height={soil} rx="3" fill="currentColor" />
      {soil < 20 && (
        <g fill="currentColor" opacity="0.55">
          <circle cx="9" cy={soil + 4.5} r="1.8" /><circle cx="15" cy={soil + 5.5} r="2.1" /><circle cx="20.5" cy={soil + 4} r="1.5" />
        </g>
      )}
    </svg>
  );
}
