import { CloudRain, Droplets, LoaderCircle, TriangleAlert } from 'lucide-react';
import { fmtDay, fmtMonth, useT } from '@/i18n';
import { useStore } from '@/state/store';
import { useAsync } from '@/data/hooks';
import { fieldCentroid } from '@/domain/field';
import { precipGapPct, PRECIP_WARN_PCT } from '@/domain/precip';
import { recentRain } from '@/services/power';
import type { Location, SmapFile } from '@/lib/types';
import { Card, DataBadge, Note, SectionTitle } from '@/ui/kit';

/** What the sky and the soil are doing now: NASA's latest soil wetness for the region and recent rain on the field. */
export function RightNow({ smap, location }: { smap: SmapFile | null; location: Location }) {
  const { t, lang, num, pct } = useT();
  const core = useStore((s) => s.core)!;
  const parcels = useStore((s) => s.parcels);
  const at = fieldCentroid(parcels) ?? [location.lon, location.lat];
  const rain = useAsync(`rain|${at[1].toFixed(2)},${at[0].toFixed(2)}`, () => recentRain(at[1], at[0]));
  const gap = precipGapPct(core.validation, location);

  return (
    <section className="grid gap-3">
      <SectionTitle>{t('nowTitle')}</SectionTitle>

      <Card className="grid gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold"><CloudRain size={22} className="text-water" aria-hidden="true" /> {t('rainTitle')}</h3>
        {rain.status === 'loading' && <p className="flex items-center gap-2 text-muted" role="status"><LoaderCircle size={18} className="animate-spin" /> {t('rainLoading')}</p>}
        {(rain.status === 'error' || (rain.status === 'ready' && !rain.data)) && <p className="text-muted">{t('rainFailed')}</p>}
        {rain.status === 'ready' && rain.data && (() => {
          const r = rain.data;
          const max = Math.max(r.totalMm, r.usualMm ?? 0, 1);
          const peak = Math.max(...r.days.map((d) => d.mm), 1);
          return (
            <>
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums leading-none text-water">{t('rainValue', { mm: num(r.totalMm) })}</span>
                <DataBadge type="model" />
              </p>
              {/* thirty small bars: when it rained, not only how much */}
              <svg viewBox="0 0 300 44" className="h-11 w-full" role="img" aria-label={t('rainTitle')} preserveAspectRatio="none">
                {r.days.map((d, i) => {
                  const h = (d.mm / peak) * 40;
                  return <rect key={d.date} x={i * 10 + 1} y={42 - h} width={8} height={Math.max(h, 0.8)} rx={1.5} fill="#2f7fb0" opacity={d.mm > 0 ? 1 : 0.25}><title>{fmtDay(lang, d.date)}: {num(d.mm, 1)} mm</title></rect>;
                })}
              </svg>
              {r.usualMm !== null && (
                <div className="grid gap-1.5 text-[15px]">
                  <Bar label={`${fmtDay(lang, r.from)} – ${fmtDay(lang, r.to)}`} value={r.totalMm} max={max} color="#2f7fb0" text={`${num(r.totalMm)} mm`} />
                  <Bar label={t('rainNormal', { mm: num(r.usualMm) })} value={r.usualMm} max={max} color="#9aa7a0" text="" />
                </div>
              )}
              <p className="text-sm leading-snug text-muted">{t('rainNote', { a: fmtDay(lang, r.from), b: fmtDay(lang, r.to) })}</p>
            </>
          );
        })()}
        {gap !== null && Math.abs(gap) > PRECIP_WARN_PCT && (
          <Note tone="warn" icon={<TriangleAlert size={20} />}>
            {t('precipWarn', { pct: num(Math.abs(gap)), dir: t(gap > 0 ? 'higher' : 'lower'), tone: t(gap > 0 ? 'optimistic' : 'pessimistic') })}
          </Note>
        )}
      </Card>

      <Card className="grid gap-2">
        <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold"><Droplets size={22} className="text-water" aria-hidden="true" /> {t('moistTitle')}</h3>
        {smap?.available && smap.latest ? (
          <>
            <p className="text-lg leading-snug">
              <b>{t('moistLatest', { date: fmtMonth(lang, smap.latest.date), w: pct(smap.latest.rootzone_wetness) })}</b> <DataBadge type="model" />
            </p>
            <p className="text-[15px] text-muted">
              {t('moistRank', { n: new Set(smap.monthly_series.map((m) => m.month_start.slice(0, 4))).size, pct: num(smap.latest.percentile_for_month) })}
            </p>
            <MoistureChart smap={smap} />
            <p className="text-sm leading-snug text-muted">{t('moistNote')}</p>
          </>
        ) : <p className="text-muted">{t('moistNone')}</p>}
      </Card>
    </section>
  );
}

function Bar({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2"><span>{label}</span><b className="tabular-nums">{text}</b></div>
      <span className="mt-0.5 block h-2.5 overflow-hidden rounded-full bg-raise"><span className="block h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} /></span>
    </div>
  );
}

const W = 340, H = 130, L = 34, R = 6, T = 8, B = 22;
const MONTHS_SHOWN = 24;

/** The last two years of root-zone wetness against what is usual for each calendar month. */
function MoistureChart({ smap }: { smap: SmapFile }) {
  const { t, lang } = useT();
  const rows = smap.monthly_series.slice(-MONTHS_SHOWN);
  if (rows.length < 3) return null;
  const clim = new Map(smap.monthly_climatology.map((c) => [c.month, c]));
  const x = (i: number) => L + (i / (rows.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const band = rows.map((r) => clim.get(Number(r.month_start.slice(5, 7))));
  const hasBand = band.every(Boolean);
  const upper = rows.map((_, i) => `${x(i).toFixed(1)},${y(band[i]?.p90 ?? 0).toFixed(1)}`);
  const lower = rows.map((_, i) => `${x(i).toFixed(1)},${y(band[i]?.p10 ?? 0).toFixed(1)}`).reverse();
  const short = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short', year: '2-digit' });

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('moistTitle')}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#dcd7c6" />
            <text x={L - 5} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4f5e54">{lang === 'tr' ? `%${v * 100}` : `${v * 100}%`}</text>
          </g>
        ))}
        {hasBand && <polygon points={[...upper, ...lower].join(' ')} fill="#c9cfc9" opacity="0.6" />}
        <polyline fill="none" stroke="#2f7fb0" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
          points={rows.map((r, i) => `${x(i).toFixed(1)},${y(r.rootzone_wetness).toFixed(1)}`).join(' ')} />
        <circle cx={x(rows.length - 1)} cy={y(rows[rows.length - 1].rootzone_wetness)} r="4.5" fill="#2f7fb0" stroke="#fff" strokeWidth="2" />
        {[0, Math.floor(rows.length / 2), rows.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#4f5e54">{short.format(new Date(rows[i].month_start))}</text>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-1 w-5 rounded-full bg-water" />{t('thisYear', { n: rows.length })}</span>
        {hasBand && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-5 rounded-sm bg-[#c9cfc9]" />{t('moistBand')}</span>}
      </figcaption>
    </figure>
  );
}
