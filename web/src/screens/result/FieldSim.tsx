import { Play } from 'lucide-react';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { medianFullness, ROTATION_COLOR } from '@/domain/sim';
import type { DepthId, ResultsFile, SiteIndex } from '@/lib/types';
import { Button, Card, DataBadge, SectionTitle } from '@/ui/kit';

/** Invitation to watch two years on the field, and the same story as a chart for those who prefer one. */
export function FieldSim({ results, depth }: { results: ResultsFile; depth: DepthId }) {
  const { t } = useT();
  const site = useStore((s) => s.core)!.site;
  const setSim = useStore((s) => s.setSim);
  const sim = useStore((s) => s.sim);
  const nYears = site.start_years[1] - site.start_years[0] + 1;

  return (
    <section className="grid gap-3">
      <Card className="grid gap-3 border-0 bg-gradient-to-br from-primary-strong to-primary text-white">
        <h2 className="text-xl font-extrabold leading-tight">{t('simTitle')}</h2>
        <p className="text-base leading-snug text-white/90">{t('simBody')}</p>
        <Button variant="gold" size="lg" onClick={() => setSim(!sim)} icon={<Play size={22} fill="currentColor" />} className="justify-self-start">
          {sim ? t('simExit') : t('simOpen')}
        </Button>
      </Card>

      <Card className="grid gap-2">
        <SectionTitle sub={t('waterChartSub', { n: nYears })} badge={<DataBadge type="model" />}>{t('waterChartTitle')}</SectionTitle>
        <WaterChart site={site} results={results} depth={depth} />
      </Card>
    </section>
  );
}

const W = 340, H = 190, L = 34, R = 8, T = 10, B = 34;

/** Three lines, one per rotation, over the 24 months of the sequence (July of year 1 → June of year 3). */
function WaterChart({ site, results, depth }: { site: SiteIndex; results: ResultsFile; depth: DepthId }) {
  const { t, tx, lang, num } = useT();
  const series = medianFullness(site, results, depth);
  const x = (m: number) => L + (m / 23) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const month = new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short' });
  const tick = (m: number) => month.format(new Date(2001, (6 + m) % 12, 1));
  const label = (id: string) => tx(site.rotations.find((r) => r.id === id)?.label);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[34rem]" role="img" aria-label={t('waterChartTitle')}>
        {/* second year gets a soft band so the two years read apart */}
        <rect x={x(12)} y={T} width={x(23) - x(12)} height={H - T - B} fill="#f1eee4" />
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#dcd7c6" strokeWidth="1" />
            <text x={L - 5} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#4f5e54">{lang === 'tr' ? `%${v}` : `${v}%`}</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((m) => (
          <text key={m} x={x(m)} y={H - B + 14} textAnchor="middle" fontSize="11" fill="#4f5e54">{tick(m)}</text>
        ))}
        <text x={(x(0) + x(11)) / 2} y={H - 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16241c">{t('year1')}</text>
        <text x={(x(12) + x(23)) / 2} y={H - 4} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#16241c">{t('year2')}</text>
        {series.map((s) => (
          <polyline key={s.rotationId} fill="none" stroke={ROTATION_COLOR[s.rotationId]} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
            points={s.values.map((v, m) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
        ))}
      </svg>
      {/* Legend with a line sample and the word, never colour alone. */}
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        {series.map((s) => (
          <span key={s.rotationId} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-1 w-5 rounded-full" style={{ background: ROTATION_COLOR[s.rotationId] }} />
            {label(s.rotationId)}
          </span>
        ))}
      </figcaption>
      <details className="mt-2 text-sm">
        <summary className="min-h-9 font-semibold text-primary underline underline-offset-4">{t('showTable')}</summary>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full border-collapse text-left tabular-nums">
            <thead><tr><th className="py-1 pr-2">{t('month')}</th>{series.map((s) => <th key={s.rotationId} className="py-1 pr-2">{label(s.rotationId)}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 24 }, (_, m) => (
                <tr key={m} className="border-t border-line">
                  <td className="py-1 pr-2">{tick(m)} · {m < 12 ? t('year1') : t('year2')}</td>
                  {series.map((s) => <td key={s.rotationId} className="py-1 pr-2">{num(s.values[m])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
