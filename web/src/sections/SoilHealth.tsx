import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { range } from '@/lib/economics';
import type { DepthId, ResultsFile, RotationId, SiteIndex, SmapFile } from '@/lib/types';
import { Badge } from '@/components/Badge';
import { hasKey, t, textureName, tx, type Lang } from '@/strings';
import { fmtNum, fmtPctOf100 } from '@/utils/format';
import { ROTATION_COLOR, sequenceMonths } from '@/utils/series';

type Props = { site: SiteIndex; results: ResultsFile; smap: SmapFile | null; depthId: DepthId; lang: Lang };

export function SoilHealth({ site, results, smap, depthId, lang }: Props) {
  return (
    <section aria-labelledby="soil-title" className="grid gap-4">
      <h2 id="soil-title" className="text-lg font-semibold">{t(lang, 'soilTitle')}</h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SoilCard results={results} lang={lang} />
        <div className="grid content-start gap-4">
          <NotRemote items={results.soil.not_available_remotely} lang={lang} />
          <Smap smap={smap} lang={lang} />
        </div>
      </div>
      <Fullness site={site} results={results} depthId={depthId} lang={lang} />
    </section>
  );
}

function SoilCard({ results, lang }: { results: ResultsFile; lang: Lang }) {
  const { soil } = results;
  const depth = soil.properties[0]?.depth ?? '0-30 cm';
  const alts = Object.entries(soil.awc_alternatives ?? {});
  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <h3 className="font-semibold">{t(lang, 'soilCard')} <Badge type="model" lang={lang} /></h3>
      <p className="mt-1 text-xs text-faint">{t(lang, 'soilCardSub', { d: depth })}</p>
      {soil.texture_class && (
        <p className="mt-3 text-sm"><span className="text-muted">{t(lang, 'texture')}:</span> <b>{textureName(lang, soil.texture_class)}</b></p>
      )}
      <dl className="mt-3 divide-y divide-line">
        {soil.properties.map((p) => (
          <div key={p.id} className="grid gap-0.5 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm font-medium">{tx(lang, p.label)}</dt>
              <dd className="text-right font-mono text-sm tabular-nums">
                {fmtNum(p.q50, lang, 1)} <span className="text-xs text-muted">{p.unit}</span>
                <span className="ml-2 text-[11px] text-faint">{fmtNum(p.q05, lang, 1)}–{fmtNum(p.q95, lang, 1)}</span>
              </dd>
            </div>
            {tx(lang, p.meaning) && <dd className="text-xs text-muted">{tx(lang, p.meaning)}</dd>}
          </div>
        ))}
        <div className="grid gap-0.5 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium">{t(lang, 'awc')} <Badge type={soil.awc_mm_per_m.type} verified={soil.awc_mm_per_m.verified} lang={lang} /></dt>
            <dd className="font-mono text-sm">
              {soil.awc_mm_per_m.value === null ? <i className="text-faint">{t(lang, 'pending')}</i> : fmtNum(soil.awc_mm_per_m.value, lang)}{' '}
              <span className="text-xs text-muted">mm/m</span>
            </dd>
          </div>
          {alts.length > 0 && (
            <dd className="text-xs text-muted">
              {t(lang, 'awcAlt', {
                list: alts.map(([k, v]) => `${S_AWC(k, lang)} ${fmtNum(v.value, lang, 1)} ${v.unit}`).join(' · '),
              })}
            </dd>
          )}
        </div>
      </dl>
    </div>
  );
}

const S_AWC = (k: string, lang: Lang) => { const key = `awc_${k}`; return hasKey(key) ? t(lang, key) : k; };

function NotRemote({ items, lang }: { items: string[]; lang: Lang }) {
  return (
    <div className="rounded-xl border border-[#cfe0e8] bg-[#eef4f7] p-5 text-[#24495c]">
      <h3 className="font-semibold">{t(lang, 'notRemote')}</h3>
      <p className="mt-1 text-sm">{t(lang, 'notRemoteBody')}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((k) => {
          const key = `nr_${k}`;
          return <li key={k} className="rounded-full border border-[#cfe0e8] bg-white px-3 py-1 text-sm">{hasKey(key) ? t(lang, key) : k}</li>;
        })}
      </ul>
    </div>
  );
}

function Smap({ smap, lang }: { smap: SmapFile | null; lang: Lang }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <h3 className="font-semibold">{t(lang, 'smapTitle')}</h3>
      {smap?.available && smap.latest ? (
        <p className="mt-1 text-sm">
          {t(lang, 'smapLatest', {
            date: smap.latest.date,
            w: fmtNum(smap.latest.rootzone_wetness * 100, lang),
            pct: fmtNum(smap.latest.percentile_for_month, lang),
          })} <Badge type="model" lang={lang} />
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">{t(lang, 'smapComing')}</p>
      )}
      <p className="mt-1 text-xs text-faint">{t(lang, 'smapNote')}</p>
    </div>
  );
}

function Fullness({ site, results, depthId, lang }: { site: SiteIndex; results: ResultsFile; depthId: DepthId; lang: Lang }) {
  const months = sequenceMonths(lang);
  const rots = site.rotations;
  const series = rots.map((rot) => {
    const rows = results.sequences.filter((s) => s.rotation_id === rot.id && s.depth_id === depthId);
    return { rot, byMonth: months.map((_, i) => range(rows.map((r) => r.fullness_by_month[i]))), n: rows.length };
  });
  const data = months.map((m, i) => {
    const row: Record<string, number | string | [number, number]> = { i, month: m };
    for (const s of series) {
      const r = s.byMonth[i];
      row[`${s.rot.id}_p50`] = r.p50;
      row[`${s.rot.id}_band`] = [r.p10, r.p90];
    }
    return row;
  });
  const label = (id: string) => tx(lang, rots.find((r) => r.id === id)?.label);

  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <h3 className="font-semibold">{t(lang, 'fullTitle')} <Badge type="model" lang={lang} /></h3>
      <p className="mt-1 text-xs text-faint">{t(lang, 'fullSub', { n: series[0]?.n ?? 0 })}</p>
      <div className="mt-3 h-72 w-full" role="img" aria-label={t(lang, 'fullTitle')}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#e7e2d4" vertical={false} />
            <XAxis dataKey="i" type="number" domain={[0, 23]} ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
              tickFormatter={(i: number) => months[i]} tick={{ fontSize: 11, fill: '#7b867e' }} tickLine={false} axisLine={{ stroke: '#d9d4c4' }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => fmtPctOf100(v, lang)} tick={{ fontSize: 11, fill: '#7b867e' }} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine y={100} stroke="#56645b" strokeDasharray="4 3" label={{ value: t(lang, 'fieldCapacity'), position: 'insideTopRight', fontSize: 11, fill: '#56645b' }} />
            <ReferenceLine x={12} stroke="#d9d4c4" label={{ value: t(lang, 'year2'), position: 'insideTopLeft', fontSize: 11, fill: '#7b867e' }} />
            {series.map((s) => (
              <Area key={`${s.rot.id}b`} dataKey={`${s.rot.id}_band`} stroke="none" fill={ROTATION_COLOR[s.rot.id as RotationId]} fillOpacity={0.09}
                isAnimationActive={false} legendType="none" activeDot={false} />
            ))}
            {series.map((s) => (
              <Line key={s.rot.id} dataKey={`${s.rot.id}_p50`} name={label(s.rot.id)} stroke={ROTATION_COLOR[s.rot.id as RotationId]} strokeWidth={2}
                dot={false} isAnimationActive={false} />
            ))}
            <Tooltip
              formatter={(v: number | [number, number], name: string) => (Array.isArray(v) ? [null, null] : [fmtPctOf100(v, lang), name])}
              labelFormatter={(i: number) => `${months[i]} · ${t(lang, i < 12 ? 'year1' : 'year2')}`}
              contentStyle={{ borderRadius: 8, borderColor: '#d9d4c4', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-9 cursor-pointer text-primary">{t(lang, 'showTable')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-right font-mono text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 text-left font-sans">{t(lang, 'month')}</th>
                {series.map((s) => <th key={s.rot.id} className="py-1 font-sans">{label(s.rot.id)} ({t(lang, 'median')})</th>)}
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1 text-left font-sans">{m} · {t(lang, i < 12 ? 'year1' : 'year2')}</td>
                  {series.map((s) => <td key={s.rot.id} className="py-1">{fmtPctOf100(s.byMonth[i].p50, lang)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
