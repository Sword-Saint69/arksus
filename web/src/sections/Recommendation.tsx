import type { Decision, PriceRobustness } from '@/lib/economics';
import type { SiteIndex } from '@/lib/types';
import { t, tx, type Key, type Lang } from '@/strings';

type Props = { site: SiteIndex; decision: Decision; robustness: PriceRobustness; lang: Lang };

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** Top-of-page card (ISMAIL_BAKMALI §11, §14). No money anywhere: scores, reasons and crop names only. */
export function Recommendation({ site, decision, robustness, lang }: Props) {
  const label = (id: string | null) => tx(lang, site.rotations.find((r) => r.id === id)?.label);
  const top = decision.ranking.find((r) => r.rotation_id === decision.recommended);
  const blocked = decision.ranking.filter((r) => !r.eligible);

  return (
    <section aria-labelledby="rec-title" className="rounded-2xl border-2 border-primary/30 bg-paper p-5 shadow-sm sm:p-6">
      <p id="rec-title" className="text-xs font-semibold uppercase tracking-wider text-primary">{t(lang, 'recTitle')}</p>
      {decision.recommended ? (
        <>
          <p className="mt-1 text-2xl font-bold sm:text-3xl">{label(decision.recommended)}</p>
          {top && <p className="mt-1 text-sm text-muted">{t(lang, 'recDriver', { d: t(lang, `crit_${top.driver}` as Key) })}</p>}
          {decision.close_call && decision.runner_up && (
            <p className="mt-3 rounded-lg bg-[#fbf3e4] px-3 py-2 text-sm text-warn">{t(lang, 'recClose', { r: label(decision.runner_up) })}</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold text-bad">{t(lang, 'recNone')}</p>
      )}

      {blocked.length > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-sm">
          <p className="font-semibold">{t(lang, 'recBlocked')}</p>
          <ul className="mt-1 grid gap-1">
            {blocked.map((b) => (
              <li key={b.rotation_id}>
                <span className="font-medium">{label(b.rotation_id)}</span>
                <span className="text-muted"> · {b.blocked.map((r) => t(lang, `block_${r}` as Key)).join(' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3 text-sm text-muted">
        {robustness.stable ? (
          <p>{t(lang, 'robustStable')}</p>
        ) : (
          <ul className="grid gap-1">
            {robustness.sensitive_to.map((s) => {
              const vars = {
                crop: lang === 'tr' ? cap(t(lang, `crop_${s.crop}` as Key)) : t(lang, `crop_${s.crop}` as Key),
                dir: t(lang, s.change > 0 ? 'up' : 'down'),
                pct: Math.round(Math.abs(s.change) * 100),
                r: label(s.recommended),
              };
              return <li key={`${s.crop}${s.change}`}>{cap(t(lang, s.recommended ? 'robustFlip' : 'robustFlipNone', vars))}</li>;
            })}
          </ul>
        )}
        <p className="mt-1 text-xs text-faint">{t(lang, 'robustNote')}</p>
      </div>
    </section>
  );
}
