import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceLine } from 'recharts';
import { range } from '@/lib/economics';
import type { DepthId, ResultsFile, RotationId, SiteIndex } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { t, tx, type Lang } from '@/strings';
import { fmtPctOf100 } from '@/utils/format';
import { ROTATION_COLOR } from '@/utils/series';

type Props = { site: SiteIndex; results: ResultsFile; depthId: DepthId; lang: Lang };

/**
 * Chart A (PLAN_MVP §6, updated 14 Nov: wheat yield ratio instead of money).
 * A strip plot: one dot per start year, spread sideways by a fixed per-year
 * offset (not random, so the picture is the same on every render).
 */
export function ChartA({ site, results, depthId, lang }: Props) {
  const rots = site.rotations;
  const lanes = rots.map((rot, lane) => {
    const rows = results.sequences.filter((s) => s.rotation_id === rot.id && s.depth_id === depthId)
      .sort((a, b) => a.start_year - b.start_year);
    const pts = rows.map((r, i) => ({
      x: lane + ((i * 7) % 24 - 11.5) / 24 * 0.5,
      y: r.wheat.yield_ratio * 100,
      year: r.start_year,
      rot: tx(lang, rot.label),
    }));
    return { rot, lane, pts, r: range(rows.map((x) => x.wheat.yield_ratio * 100)) };
  });

  return (
    <section aria-labelledby="chart-a-title" className="rounded-xl border border-line bg-paper p-5">
      <h2 id="chart-a-title" className="text-lg font-semibold">{t(lang, 'chartATitle')} <Badge type="model" lang={lang} /></h2>
      <p className="mt-1 text-sm text-muted">{t(lang, 'chartASub')}</p>
      <div className="mt-3 h-80 w-full" role="img" aria-label={t(lang, 'chartATitle')}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: -8 }}>
            <CartesianGrid stroke="#e7e2d4" vertical={false} />
            <XAxis type="number" dataKey="x" domain={[-0.5, rots.length - 0.5]} ticks={lanes.map((l) => l.lane)}
              tickFormatter={(v: number) => tx(lang, rots[Math.round(v)]?.label)} tick={{ fontSize: 12, fill: '#1f2a24' }}
              tickLine={false} axisLine={{ stroke: '#d9d4c4' }} interval={0} />
            <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => fmtPctOf100(v, lang)}
              tick={{ fontSize: 11, fill: '#7b867e' }} tickLine={false} axisLine={false} width={44} />
            <ZAxis range={[64, 64]} />
            {lanes.flatMap((l) => [
              <ReferenceLine key={`${l.rot.id}50`} segment={[{ x: l.lane - 0.3, y: l.r.p50 }, { x: l.lane + 0.3, y: l.r.p50 }]}
                stroke="#1f2a24" strokeWidth={2.5} ifOverflow="visible" />,
              <ReferenceLine key={`${l.rot.id}10`} segment={[{ x: l.lane - 0.2, y: l.r.p10 }, { x: l.lane + 0.2, y: l.r.p10 }]}
                stroke="#56645b" strokeDasharray="3 3" />,
              <ReferenceLine key={`${l.rot.id}90`} segment={[{ x: l.lane - 0.2, y: l.r.p90 }, { x: l.lane + 0.2, y: l.r.p90 }]}
                stroke="#56645b" strokeDasharray="3 3" />,
            ])}
            {lanes.map((l) => (
              <Scatter key={l.rot.id} name={tx(lang, l.rot.label)} data={l.pts} fill={ROTATION_COLOR[l.rot.id as RotationId]}
                fillOpacity={0.85} stroke="#fbfaf6" strokeWidth={2} isAnimationActive={false} />
            ))}
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as { year: number; y: number; rot: string } | undefined;
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow">
                    <b>{p.rot}</b>
                    <div>{t(lang, 'startYear')}: {p.year}–{p.year + 2}</div>
                    <div className="font-mono">{fmtPctOf100(p.y, lang)}</div>
                  </div>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-3">
        {lanes.map((l) => (
          <li key={l.rot.id} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: ROTATION_COLOR[l.rot.id as RotationId] }} aria-hidden="true" />
            <span className="text-ink">{tx(lang, l.rot.label)}</span>
            <span className="font-mono">P10 {fmtPctOf100(l.r.p10, lang)} · P50 {fmtPctOf100(l.r.p50, lang)} · P90 {fmtPctOf100(l.r.p90, lang)}</span>
          </li>
        ))}
      </ul>
      <details className="mt-2 text-sm">
        <summary className="min-h-9 cursor-pointer text-primary">{t(lang, 'showTable')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] text-right font-mono text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 text-left font-sans">{t(lang, 'startYear')}</th>
                {lanes.map((l) => <th key={l.rot.id} className="py-1 font-sans">{tx(lang, l.rot.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {lanes[0]?.pts.map((p, i) => (
                <tr key={p.year} className="border-t border-line">
                  <td className="py-1 text-left">{p.year}</td>
                  {lanes.map((l) => <td key={l.rot.id} className="py-1">{l.pts[i] ? fmtPctOf100(l.pts[i].y, lang) : '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
