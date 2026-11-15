import { useMemo } from 'react';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { ROTATION_COLOR } from '@/domain/sim';
import { fieldCalendar, wheatByYear } from '@/domain/charts';
import type { DepthId, ResultsFile } from '@/lib/types';
import { Card, DataBadge, SectionTitle } from '@/ui/kit';

// One hue per job: brown for bare soil, red for a crop short of water. Each
// is a single-hue ramp from the card's paper colour, so more = darker.
const BARE = '#94541f';
const STRESS = '#b42318';
const PAPER = '#f4efe3';

const W = 340, PAD = 6, CELL = (W - 2 * PAD) / 24, STRIP = 14;

const useMonthTick = () => {
  const { lang } = useT();
  const f = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short' });
  return (m: number) => f.format(new Date(2001, (6 + m) % 12, 1));
};

/** Chart C: for each sequence, 24 months of bare soil and of crop water shortage, median across the years. */
export function FieldCalendar({ results, depth }: { results: ResultsFile; depth: DepthId }) {
  const { t, tx, pct } = useT();
  const site = useStore((s) => s.core)!.site;
  const rows = useMemo(() => fieldCalendar(site, results, depth), [site, results, depth]);
  const tick = useMonthTick();
  const nYears = site.start_years[1] - site.start_years[0] + 1;
  const label = (id: string) => tx(site.rotations.find((r) => r.id === id)?.label);
  const x = (m: number) => PAD + m * CELL;
  const block = 18 + 2 * STRIP + 3 + 10; // rotation name, two strips, gap
  const top = 30;
  const H = top + rows.length * block;

  return (
    <Card className="grid gap-2">
      <SectionTitle sub={t('calSub', { n: nYears })} badge={<DataBadge type="model" />}>{t('calTitle')}</SectionTitle>
      <figure className="m-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[34rem]" role="img" aria-label={t('calTitle')}>
          <text x={(x(0) + x(12)) / 2} y={11} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16241c">{t('year1')}</text>
          <text x={(x(12) + x(24)) / 2} y={11} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16241c">{t('year2')}</text>
          <line x1={x(12) - 0.5} x2={x(12) - 0.5} y1={2} y2={H} stroke="#16241c" strokeOpacity="0.25" strokeDasharray="2 3" />
          {[0, 3, 6, 9, 12, 15, 18, 21].map((m) => (
            <text key={m} x={x(m) + CELL / 2} y={25} textAnchor="middle" fontSize="10" fill="#4f5e54">{tick(m)}</text>
          ))}
          {rows.map((r, i) => {
            const y0 = top + i * block;
            const strip = (vals: number[], color: string, y: number, what: string) => vals.map((v, m) => (
              <rect key={m} x={x(m) + 0.75} y={y} width={CELL - 1.5} height={STRIP} rx="2" fill={v > 0.02 ? color : PAPER} fillOpacity={v > 0.02 ? 0.15 + 0.85 * v : 1}>
                <title>{`${label(r.rotationId)} · ${tick(m)} ${m < 12 ? t('year1') : t('year2')} · ${what}: ${pct(v)}`}</title>
              </rect>
            ));
            return (
              <g key={r.rotationId}>
                <rect x={PAD} y={y0 + 4} width="10" height="4" rx="2" fill={ROTATION_COLOR[r.rotationId]} />
                <text x={PAD + 15} y={y0 + 10} fontSize="11.5" fontWeight="700" fill="#16241c">{label(r.rotationId)}</text>
                {strip(r.bare, BARE, y0 + 15, t('calBare'))}
                {strip(r.stress, STRESS, y0 + 15 + STRIP + 3, t('calStress'))}
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
          {([[BARE, 'calBare'], [STRESS, 'calStress']] as const).map(([c, k]) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-flex overflow-hidden rounded">
                {[0.15, 0.5, 1].map((o) => <span key={o} className="inline-block h-3 w-4" style={{ background: c, opacity: o }} />)}
              </span>
              {t(k)}
            </span>
          ))}
          <span className="basis-full font-normal text-muted">{t('calScale')}</span>
        </figcaption>
        <p className="mt-1.5 text-sm leading-snug text-muted">{t('calRead')}</p>
        <details className="mt-1 text-sm">
          <summary className="min-h-9 font-semibold text-primary underline underline-offset-4">{t('showTable')}</summary>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full border-collapse text-left tabular-nums">
              <thead>
                <tr><th className="py-1 pr-2">{t('month')}</th>{rows.map((r) => <th key={r.rotationId} className="py-1 pr-2">{label(r.rotationId)}<span className="block font-normal text-muted">{t('calBare')} / {t('calStress')}</span></th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: 24 }, (_, m) => (
                  <tr key={m} className="border-t border-line">
                    <td className="py-1 pr-2">{tick(m)} · {m < 12 ? t('year1') : t('year2')}</td>
                    {rows.map((r) => <td key={r.rotationId} className="py-1 pr-2">{pct(r.bare[m])} / {pct(r.stress[m])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figure>
    </Card>
  );
}

/** Chart A: the wheat yield of each of the past climates, one dot per year, per sequence. */
export function YearStrip({ results, depth }: { results: ResultsFile; depth: DepthId }) {
  const { t, tx, pct, lang } = useT();
  const site = useStore((s) => s.core)!.site;
  const rows = useMemo(() => wheatByYear(site, results, depth), [site, results, depth]);
  const nYears = site.start_years[1] - site.start_years[0] + 1;
  const label = (id: string) => tx(site.rotations.find((r) => r.id === id)?.label);
  const max = Math.max(1, ...rows.flatMap((r) => r.years.map((y) => y.ratio)));
  const L = 8, R = 12, rowH = 46, top = 6;
  const x = (v: number) => L + (v / max) * (W - L - R);
  const H = top + rows.length * rowH + 22;
  const ticks = [0, 0.25, 0.5, 0.75, 1].filter((v) => v <= max);
  const season = (y: number) => `${y}–${String((y + 2) % 100).padStart(2, '0')}`;

  return (
    <Card className="grid gap-2">
      <SectionTitle sub={t('yrSub', { n: nYears })} badge={<DataBadge type="model" />}>{t('yrTitle')}</SectionTitle>
      <figure className="m-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[34rem]" role="img" aria-label={t('yrTitle')}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={x(v)} x2={x(v)} y1={top} y2={H - 20} stroke="#dcd7c6" strokeWidth="1" />
              <text x={x(v)} y={H - 6} textAnchor={v === 0 ? 'start' : v === max ? 'end' : 'middle'} fontSize="11" fill="#4f5e54">{pct(v)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y0 = top + i * rowH;
            const cy = y0 + 30;
            const color = ROTATION_COLOR[r.rotationId];
            return (
              <g key={r.rotationId}>
                <text x={L} y={y0 + 11} fontSize="11.5" fontWeight="700" fill="#16241c">{label(r.rotationId)}</text>
                {/* P10–P90 range as a thin bar, the middle year as a tall tick */}
                <line x1={x(r.p10)} x2={x(r.p90)} y1={cy} y2={cy} stroke={color} strokeOpacity="0.35" strokeWidth="8" strokeLinecap="round" />
                {r.years.map((y, k) => (
                  <circle key={y.year} cx={x(y.ratio)} cy={cy + ((k % 3) - 1) * 4} r="4" fill={color} fillOpacity="0.85" stroke="#fff" strokeWidth="1.5">
                    <title>{`${label(r.rotationId)} · ${season(y.year)}: ${pct(y.ratio)}`}</title>
                  </circle>
                ))}
                <line x1={x(r.p50)} x2={x(r.p50)} y1={cy - 11} y2={cy + 11} stroke="#16241c" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-ink/60" /> {t('yrDot')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3.5 w-0.5 rounded bg-ink" /> {t('yrMid')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2 w-5 rounded-full bg-ink/25" /> {t('yrRange')}</span>
        </figcaption>
        <ul className="mt-1.5 grid gap-0.5 text-sm leading-snug">
          {rows.map((r) => (
            <li key={r.rotationId}><b>{label(r.rotationId)}</b>: {t('dryWet', { lo: pct(r.p10), hi: pct(r.p90) })}, {t('yrMidShort', { m: pct(r.p50) })} <span className="text-muted">{t('rowWheatHint')}</span></li>
          ))}
        </ul>
        <details className="mt-1 text-sm">
          <summary className="min-h-9 font-semibold text-primary underline underline-offset-4">{t('showTable')}</summary>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full border-collapse text-left tabular-nums">
              <thead><tr><th className="py-1 pr-2">{t('yrSeason')}</th>{rows.map((r) => <th key={r.rotationId} className="py-1 pr-2">{label(r.rotationId)}</th>)}</tr></thead>
              <tbody>
                {rows[0]?.years.map((y, k) => (
                  <tr key={y.year} className="border-t border-line">
                    <td className="py-1 pr-2">{season(y.year)}</td>
                    {rows.map((r) => <td key={r.rotationId} className="py-1 pr-2">{pct(r.years[k]?.ratio ?? NaN)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="mt-1 text-xs text-faint" lang={lang}>{t('yrNote')}</p>
      </figure>
    </Card>
  );
}
