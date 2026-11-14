import type { Weights } from '@/lib/economics';
import { t, type Key, type Lang } from '@/strings';

type Props = { weights: Weights; defaults: Weights; lang: Lang; onChange: (w: Weights) => void };

const KEYS: (keyof Weights)[] = ['value', 'yield', 'soil', 'water'];

/** Four sliders (ISMAIL_BAKMALI §11). decide() normalises, so each shows its share of the total. */
export function Priorities({ weights, defaults, lang, onChange }: Props) {
  const total = KEYS.reduce((s, k) => s + weights[k], 0) || 1;
  const isDefault = KEYS.every((k) => Math.abs(weights[k] - defaults[k]) < 1e-9);
  const pct = (v: number) => Math.round(v * 100);

  return (
    <section aria-labelledby="prio-title" className="rounded-xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="prio-title" className="text-lg font-semibold">{t(lang, 'prioTitle')}</h2>
        <button
          onClick={() => onChange(defaults)}
          disabled={isDefault}
          className="min-h-9 rounded-lg border border-line px-3 text-sm text-primary disabled:cursor-default disabled:opacity-40"
        >
          {t(lang, 'prioReset')}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{t(lang, 'prioSub')}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {KEYS.map((k) => (
          <label key={k} className="grid gap-1">
            <span className="flex items-baseline justify-between text-sm">
              <span className="font-medium first-letter:uppercase">{t(lang, `crit_${k}` as Key)}</span>
              <span className="font-mono text-xs text-muted">{t(lang, 'prioShare', { pct: pct(weights[k] / total) })}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pct(weights[k])}
              onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) / 100 })}
              className="h-8 w-full accent-[#2f5d46]"
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-faint">
        {t(lang, 'prioDefaultNote', { w: KEYS.map((k) => `${t(lang, `crit_${k}` as Key)} ${pct(defaults[k])}`).join(' · ') })}
      </p>
    </section>
  );
}
