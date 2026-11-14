import type { SiteData } from '@/data/useSiteData';
import { useAuth } from '@/auth/AuthContext';
import { t, tx, type Key, type Lang } from '@/strings';
import { ROTATION_COLOR } from '@/utils/series';
import type { RotationId } from '@/lib/types';

/** Landing page: what NöbetSu answers, in a farmer's words, and how to start. */
export function Home({ data, lang }: { data: SiteData; lang: Lang }) {
  const { farmer } = useAuth();
  const districts = [...data.site.locations].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return (
    <main>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t(lang, 'heroKicker')}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{t(lang, 'heroTitle')}</h1>
            <p className="mt-4 text-base text-muted sm:text-lg">{t(lang, 'heroBody')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {farmer ? (
                <a href="#/panel" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-base font-semibold text-white">{t(lang, 'navPanel')} →</a>
              ) : (
                <>
                  <a href="#/kayit" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-base font-semibold text-white">{t(lang, 'heroStart')}</a>
                  <a href="#/analiz" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-white px-5 text-base font-semibold text-primary">{t(lang, 'heroTry')}</a>
                  <a href="#/harita" className="inline-flex min-h-12 items-center rounded-xl border border-line bg-white px-5 text-base font-semibold text-primary">{t(lang, 'navMap')} →</a>
                </>
              )}
            </div>
            {!farmer && <a href="#/giris" className="mt-3 inline-block text-sm text-primary underline underline-offset-4">{t(lang, 'heroHave')}</a>}
          </div>
          <FieldIllustration />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6" aria-labelledby="steps">
        <h2 id="steps" className="text-xl font-semibold">{t(lang, 'stepsTitle')}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {(['1', '2', '3'] as const).map((n) => (
            <li key={n} className="rounded-xl border border-line bg-paper p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-bold text-white" aria-hidden="true">{n}</span>
              <h3 className="mt-3 font-semibold">{t(lang, `step${n}T` as Key)}</h3>
              <p className="mt-1 text-sm text-muted">{t(lang, `step${n}B` as Key)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-paper" aria-labelledby="options">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h2 id="options" className="text-xl font-semibold">{t(lang, 'optionsTitle')}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {data.site.rotations.map((r) => (
              <article key={r.id} className="rounded-xl border border-line bg-white p-5" style={{ borderTop: `5px solid ${ROTATION_COLOR[r.id as RotationId]}` }}>
                <h3 className="text-lg font-semibold">{tx(lang, r.label)}</h3>
                {r.is_baseline && <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t(lang, 'currentPractice')}</p>}
                <p className="mt-2 text-sm text-muted">{t(lang, `opt_${r.id}` as Key)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-2" aria-labelledby="trust">
        <div>
          <h2 id="trust" className="text-xl font-semibold">{t(lang, 'trustTitle')}</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {(['trust1', 'trust2', 'trust3'] as const).map((k) => (
              <li key={k} className="flex gap-2"><span aria-hidden="true" className="text-primary">✓</span>{t(lang, k)}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-[#ecd6ae] bg-[#fbf3e4] px-3 py-2 text-sm text-warn">{t(lang, 'honest')}</p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">{t(lang, 'step1T')}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {districts.map((l) => (
              <li key={l.id}>
                <a href={`#/analiz?ilce=${l.id}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-paper px-3 text-sm hover:border-primary">
                  {l.name} <span className="ml-1 text-xs text-faint">{l.province}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

/** A simple drawn field: soil, stored water, wheat. Decorative. */
function FieldIllustration() {
  return (
    <svg viewBox="0 0 320 220" className="w-full max-w-md justify-self-center" aria-hidden="true">
      <rect x="0" y="0" width="320" height="220" rx="16" fill="#e7eef1" />
      <circle cx="262" cy="46" r="22" fill="#f3c45c" />
      <path d="M0 120 Q80 96 160 112 T320 104 V220 H0Z" fill="#c9b07a" />
      <path d="M0 140 Q90 124 170 136 T320 130 V220 H0Z" fill="#8a5a2b" />
      <path d="M0 176 Q90 166 170 172 T320 168 V220 H0Z" fill="#3d7ea6" opacity=".55" />
      {Array.from({ length: 22 }, (_, i) => {
        const x = 14 + i * 14, h = 26 + ((i * 7) % 5) * 4;
        return <g key={i}><path d={`M${x} 124 q2 -${h / 2} 0 -${h}`} stroke="#6f8f3a" strokeWidth="2.4" fill="none" /><ellipse cx={x} cy={124 - h} rx="2.6" ry="6" fill="#d6aa3c" /></g>;
      })}
    </svg>
  );
}
