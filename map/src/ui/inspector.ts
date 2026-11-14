import { formatLat, formatLon, mercToLonLat, polygonCentroid, polygonPerimeterM } from '../geo';
import type { Feature } from '../vector/features';
import { esc, fmtArea, fmtDonum, fmtLen, fmtNum } from './format';
import { t, tx, getLang, type Key } from '../strings';
import type { Badge, DepthId, Location, ResultsFile, SiteIndex, SmapFile, V } from '../../../web/src/lib/types';
import type { RotationSummary } from '../../../web/src/lib/economics';

export type PilotData = {
  site: SiteIndex;
  location: Location;
  results: ResultsFile | null;
  smap: SmapFile | null;
  summaries: RotationSummary[] | null;
  depth: DepthId;
  /** True when cost or Ym is still null: money and kg/da must not be shown. */
  moneyPending: boolean;
};

export type InspectorContext = {
  active: Feature | null;
  selection: Feature[];
  ancestors: (f: Feature) => Feature[];
  elevation: (f: Feature) => { min: number; max: number; mean: number } | null;
  pilot: (f: Feature) => PilotData | null;
  nearestPilot: (f: Feature) => { feature: Feature; km: number } | null;
  pilotList: Feature[];
};

export type InspectorActions = {
  focus: (f: Feature) => void;
  toggle: (f: Feature) => void;
  remove: (f: Feature) => void;
  clear: () => void;
  exportGeoJSON: (list: Feature[]) => void;
  copy: (text: string) => void;
  select: (f: Feature) => void;
  setDepth: (d: DepthId) => void;
};

const icon = (id: string) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
export const badge = (type: Badge, verified = true) =>
  `<span class="bdg bdg-${type}">${t(`badge_${type}` as Key)}</span>${verified ? '' : `<span class="bdg bdg-unverified">${t('unverified')}</span>`}`;
const kindLabel = (k: Feature['kind']) => t(`kind_${k}` as Key);

// OSM-derived props are stored with Turkish keys; translate the keys for EN.
const PROP_EN: Record<string, string> = {
  Kullanım: 'Land use', Ürün: 'Crop', Sulama: 'Irrigation', Tür: 'Type', 'İngilizce ad': 'English name',
  Kaynak: 'Source', Plaka: 'Plate code', İl: 'Province', İlçe: 'District', Mahalle: 'Neighbourhood', Ada: 'Block (ada)',
  Parsel: 'Parcel', Nitelik: 'Land class', Mevkii: 'Locality', Pafta: 'Map sheet', 'Tapu alanı': 'Registered area', Zemin: 'Ground status',
};
const propKey = (k: string) => (getLang() === 'en' ? PROP_EN[k] ?? k : k);

export function renderInspector(root: HTMLElement, ctx: InspectorContext, act: InspectorActions) {
  const f = ctx.active;
  let html = '';
  if (!f) html = emptyState(ctx);
  else if (f.kind === 'pilot') html = pilotPanel(f, ctx);
  else html = featurePanel(f, ctx);
  html += basket(ctx);
  root.innerHTML = html;
  wire(root, ctx, act);
}

function emptyState(ctx: InspectorContext) {
  return `
    <div class="empty-state">
      <h2>${t('emptyTitle')}</h2>
      <p>${t('emptyBody')}</p>
      <div class="empty-pilots" role="list" aria-label="${t('emptyPilots')}">
        ${ctx.pilotList.map((p, i) => `
          <button role="listitem" data-pilot="${i}"><i class="dot dot-pilot"></i><span><b>${esc(p.name)}</b><small>${esc(String(p.props.province))} · ${t('kind_pilot')}</small></span>${icon('i-arrow')}</button>`).join('')}
      </div>
      <h3 class="sec-title">${t('howTo')}</h3>
      <ol>
        <li>${icon('i-cursor')}<span>${t('howClick')}</span></li>
        <li><i class="dot dot-province" style="margin:4px"></i><span>${t('howProvince')}</span></li>
        <li><i class="dot dot-island" style="margin:4px"></i><span>${t('howIsland')}</span></li>
        <li><i class="dot dot-field" style="margin:4px"></i><span>${t('howField')}</span></li>
        <li><i class="dot dot-parcel" style="margin:4px"></i><span>${t('howParcel')}</span></li>
      </ol>
      <div class="kbd-row"><span><kbd>/</kbd> ${t('kbdSearch')}</span><span><kbd>Esc</kbd> ${t('kbdClear')}</span><span><kbd>P</kbd> 2B/3B</span><span>${t('kbdRotate')}</span></div>
      <p class="foot-note">${t('supportNote')}</p>
    </div>`;
}

function featurePanel(f: Feature, ctx: InspectorContext) {
  const [lon, lat] = centroidLonLat(f);
  const area = fmtArea(f.areaM2);
  const per = polygonPerimeterM(f.polys);
  const elev = ctx.elevation(f);
  const anc = ctx.ancestors(f);
  const inSel = ctx.selection.some((s) => s.id === f.id);
  const props = Object.entries(f.props).filter(([k, v]) => v !== null && v !== '' && k !== 'landuse' && !k.startsWith('_'));
  const osm = f.props.OSM ? `https://www.openstreetmap.org/${f.props.OSM}` : null;
  // Parcel area is TKGM's registered figure; provinces are official boundaries; the rest is mapped geometry.
  const areaBadge = badge(f.kind === 'parcel' || f.kind === 'province' ? 'official' : 'statistic');
  const near = f.kind === 'field' || f.kind === 'parcel' ? ctx.nearestPilot(f) : null;
  return `
    <div class="kind-chip"><i class="dot dot-${f.kind}"></i>${kindLabel(f.kind)}</div>
    <h2 class="sel-title">${esc(f.name)}</h2>
    ${anc.length ? `<ol class="crumbs" aria-label="${t('location')}">${anc.map((a, i) => `<li><button data-anc="${i}">${esc(a.name)}</button></li>`).join('')}</ol>` : ''}
    <dl class="metrics">
      <div class="metric accent"><dt>${t('area')} ${areaBadge}</dt><dd>${area.value}<small>${area.unit}</small></dd></div>
      <div class="metric"><dt>${t('donum')}</dt><dd>${fmtDonum(f.areaM2)}</dd></div>
      <div class="metric"><dt>${t('perimeter')}</dt><dd>${fmtLen(per)}</dd></div>
      <div class="metric"><dt>${t('elevation')} ${badge('measured')}</dt><dd>${elev ? `${fmtNum(elev.mean)}<small>m</small>` : '–'}</dd></div>
      ${elev && elev.max - elev.min >= 1 ? `<div class="metric wide"><dt>${t('elevRange')} <span class="bdg bdg-unverified">SRTM</span></dt><dd>${fmtNum(elev.min)} – ${fmtNum(elev.max)}<small>m</small></dd></div>` : ''}
      <div class="metric wide"><dt>${t('center')}</dt><dd style="font-size:14px">${formatLat(lat)} · ${formatLon(lon)}</dd></div>
    </dl>
    ${near ? `<div class="pilot-link">${icon('i-drop')}<span>${t('nearPilot', { name: esc(near.feature.name), km: fmtNum(near.km, near.km < 10 ? 1 : 0) })}</span><button class="btn primary" data-goto-pilot="${esc(near.feature.id)}">${t('seePilot', { name: esc(near.feature.name) })}${icon('i-arrow')}</button></div>` : ''}
    ${f.kind === 'parcel' ? `<div class="note">${icon('i-info')}<span>${t('tkgmNote')}</span></div>` : ''}
    ${props.length ? `<table class="props"><tbody>${props.map(([k, v]) => `<tr><th>${esc(propKey(k))}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="actions">
      <button class="btn primary" data-act="toggle">${icon(inSel ? 'i-check' : 'i-plus-sq')}${inSel ? t('inList') : t('addToList')}</button>
      <button class="btn" data-act="focus">${icon('i-target')}${t('focus')}</button>
      <button class="btn" data-act="copy" data-ll="${lat.toFixed(6)}, ${lon.toFixed(6)}">${icon('i-copy')}${t('coords')}</button>
      <button class="btn" data-act="geojson">${icon('i-download')}GeoJSON</button>
      ${osm ? `<a class="btn wide" href="${osm}" target="_blank" rel="noopener">${icon('i-external')}${t('openOsm')}</a>` : ''}
    </div>`;
}

const mm = (v: number) => fmtNum(v, 0);

function delta(v: number, goodWhenUp: boolean, unit: string) {
  if (!isFinite(v) || Math.abs(v) < 0.5) return '';
  const up = v > 0;
  const good = up === goodWhenUp;
  // Arrow plus sign, so the meaning never rests on colour alone.
  return `<span class="delta ${good ? 'up' : 'down'}" title="${t('vsBaseline')}">${up ? '▲ +' : '▼ −'}${fmtNum(Math.abs(v), 0)} ${unit}</span>`;
}

function pilotPanel(f: Feature, ctx: InspectorContext) {
  const d = ctx.pilot(f);
  if (!d) return featurePanel(f, ctx);
  const { site, location: loc, results, summaries } = d;
  const [y0, y1] = site.start_years;
  const rots = site.rotations;
  let rotHtml = '';
  if (summaries) {
    rotHtml = rots.map((rot) => {
      const s = summaries.find((x) => x.rotation_id === rot.id)!;
      const dl = s.delta_vs_baseline;
      const st = rot.strategy;
      const list = (xs: { en: string; tr: string }[]) => xs.length ? `<ul>${xs.map((x) => `<li>${esc(tx(x))}</li>`).join('')}</ul>` : '';
      return `
        <article class="rot ${rot.is_baseline ? 'base' : ''}">
          <div class="rot-head"><h4>${esc(tx(rot.label))}</h4>${rot.is_baseline ? `<span class="tag">${t('currentPractice')}</span>` : ''}</div>
          <div class="rot-row">${icon('i-drop')}<span>${t('waterAtSowing')} ${badge('model')}</span>
            <span class="v">${mm(s.water_at_wheat_sowing_mm.p50)} mm${dl ? delta(dl.water_p50, true, 'mm') : ''}<small>${mm(s.water_at_wheat_sowing_mm.p10)}–${mm(s.water_at_wheat_sowing_mm.p90)} · 1 mm = 1 m³/da</small></span></div>
          <div class="rot-row">${icon('i-sun')}<span>${t('bareDays')} ${badge('model')}</span>
            <span class="v">${mm(s.bare_days_p50)} ${t('days')}${dl ? delta(dl.bare_days_p50, false, t('days')) : ''}<small>${mm(s.wind_exposed_bare_days_p50)} ${t('windExposed')}</small></span></div>
          <div class="rot-row">${icon('i-wind')}<span>${t('wheatStress')} ${badge('model')}</span>
            <span class="v">${mm(s.wheat_stress_days_p50)} ${t('days')}</span></div>
          <div class="rot-row">${icon('i-leaf')}<span>${rot.soil_traits.n_fixing ? t('nFixing') : t('noNFixing')}</span>
            <span class="v">${vValue(rot.soil_traits.tillage_passes)}</span></div>
          <details>
            <summary>${t('why')}</summary>
            <p>${esc(tx(st.why))}</p>
            ${st.evidence.length ? `<h5>${t('evidence')}</h5><ul>${st.evidence.map((e) => `<li>${esc(tx(e.text))} ${e.source_url ? `<a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source)}</a>` : `<small>${esc(e.source)}</small>`}</li>`).join('')}</ul>` : ''}
            ${st.benefits.length ? `<h5>${t('benefits')}</h5>${list(st.benefits)}` : ''}
            ${st.gaps.length ? `<h5>${t('gaps')}</h5>${list(st.gaps)}` : ''}
            ${st.local_review.length ? `<h5>${t('localReview')}</h5>${list(st.local_review)}` : ''}
          </details>
        </article>`;
    }).join('');
  }

  let soilHtml = '';
  if (results) {
    const props = results.soil.properties;
    const depth = props[0]?.depth ?? '0-30 cm';
    const awc = results.soil.awc_mm_per_m;
    soilHtml = `
      <h3 class="sec-title">${t('soilCard')} ${badge('model')}</h3>
      <p class="sec-sub">${t('soilCardSub', { d: esc(depth) })}</p>
      <table class="soil"><tbody>
        ${props.map((p) => `<tr><th>${esc(tx(p.label))}</th><td>${fmtNum(p.q50, 1)} <small>${esc(p.unit)} · ${fmtNum(p.q05, 1)}–${fmtNum(p.q95, 1)}</small></td></tr>`).join('')}
        <tr><th>${t('awc')} ${badge(awc.type, awc.verified)}</th><td>${awc.value === null ? '…' : fmtNum(awc.value, 0)} <small>${esc(awc.unit)}</small></td></tr>
      </tbody></table>
      <h3 class="sec-title">${t('notRemote')}</h3>
      <p class="sec-sub">${t('notRemoteBody')}</p>
      <div class="chips">${results.soil.not_available_remotely.map((k) => `<span>${t((k in { phosphorus: 1, potassium: 1, micronutrients: 1, compaction: 1 } ? k : 'compaction') as Key)}</span>`).join('')}</div>`;
  }

  return `
    <div class="kind-chip"><i class="dot dot-pilot"></i>${t('pilotChip')}</div>
    <h2 class="sel-title">${esc(loc.name)}</h2>
    <ol class="crumbs"><li>${esc(loc.province)}</li><li>${esc(loc.district)}</li></ol>
    <p class="pilot-note">${esc(tx(loc.note))}</p>
    <dl class="metrics">
      <div class="metric"><dt>${t('elevation')} ${badge('model')}</dt><dd>${fmtNum(loc.elevation_m)}<small>m</small></dd></div>
      <div class="metric"><dt>${t('center')}</dt><dd style="font-size:13px">${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}</dd></div>
    </dl>
    <h3 class="sec-title">${t('rotations')}</h3>
    <p class="sec-sub">${t('rotationsSub', { a: y0, b: y1 })}</p>
    <div class="seg" role="group" aria-label="${t('depth')}">
      ${site.depth_classes.map((c) => `<button data-depth="${c.id}" aria-pressed="${c.id === d.depth}">${esc(tx(c.label))}</button>`).join('')}
    </div>
    ${d.moneyPending ? `<div class="note warn">${icon('i-info')}<span>${t('moneyPending')}</span></div>` : ''}
    ${rotHtml || `<p class="sec-sub">…</p>`}
    ${soilHtml}
    <h3 class="sec-title">${t('smap')}</h3>
    <p class="sec-sub">${d.smap && d.smap.available ? 'SMAP' : t('smapComing')}</p>
    <div class="actions" style="margin-top:14px">
      <button class="btn" data-act="focus">${icon('i-target')}${t('focus')}</button>
      <button class="btn" data-act="copy" data-ll="${loc.lat}, ${loc.lon}">${icon('i-copy')}${t('coords')}</button>
    </div>
    <p class="foot-note">${t('weatherSource', { a: site.power_range.start, b: site.power_range.end })}<br>${t('supportNote')}</p>`;
}

function vValue(v: V) {
  // value: null means the number is not sourced yet: say so, never show 0.
  if (v.value === null) return `<small>${t('pending')}</small>`;
  return `${fmtNum(v.value)} <small>${esc(v.unit)}</small> ${badge(v.type, v.verified)}`;
}

function basket(ctx: InspectorContext) {
  const sel = ctx.selection.filter((s) => s.kind !== 'pilot');
  if (!sel.length) return '';
  const total = sel.reduce((s, x) => s + x.areaM2, 0);
  const ta = fmtArea(total);
  return `
    <section class="basket" aria-label="${t('list')}">
      <div class="basket-head"><h3>${t('list')}</h3><span>${t('items', { n: sel.length })}</span></div>
      <ul>${sel.map((s) => `
        <li><i class="dot dot-${s.kind}"></i><button class="name" data-sel="${esc(s.id)}" title="${esc(s.name)}">${esc(s.name)}</button><span>${fmtArea(s.areaM2).value} ${fmtArea(s.areaM2).unit}</span><button class="rm" data-rm="${esc(s.id)}" aria-label="${esc(t('remove', { name: s.name }))}">${icon('i-x')}</button></li>`).join('')}
      </ul>
      <div class="basket-total"><span>${t('total')}</span><b>${ta.value} ${ta.unit} · ${fmtDonum(total)} ${t('donum').toLowerCase()}</b></div>
      <div class="actions">
        <button class="btn" data-act="export-all">${icon('i-download')}${t('downloadAll')}</button>
        <button class="btn" data-act="clear">${icon('i-x')}${t('clear')}</button>
      </div>
    </section>`;
}

function centroidLonLat(f: Feature): [number, number] {
  const c = polygonCentroid(f.polys);
  return mercToLonLat(c.x, c.y);
}

function wire(root: HTMLElement, ctx: InspectorContext, act: InspectorActions) {
  const f = ctx.active;
  const byId = (id: string) => ctx.selection.find((s) => s.id === id);
  root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => {
    switch (b.dataset.act) {
      case 'toggle': act.toggle(f!); break;
      case 'focus': act.focus(f!); break;
      case 'copy': act.copy(b.dataset.ll!); break;
      case 'geojson': act.exportGeoJSON([f!]); break;
      case 'export-all': act.exportGeoJSON(ctx.selection.filter((s) => s.kind !== 'pilot')); break;
      case 'clear': act.clear(); break;
    }
  }));
  if (f) {
    const anc = ctx.ancestors(f);
    root.querySelectorAll<HTMLButtonElement>('[data-anc]').forEach((b) => b.addEventListener('click', () => act.select(anc[+b.dataset.anc!])));
  }
  root.querySelectorAll<HTMLButtonElement>('[data-sel]').forEach((b) => b.addEventListener('click', () => {
    const s = byId(b.dataset.sel!);
    if (s) { act.select(s); act.focus(s); }
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach((b) => b.addEventListener('click', () => { const s = byId(b.dataset.rm!); if (s) act.remove(s); }));
  root.querySelectorAll<HTMLButtonElement>('[data-depth]').forEach((b) => b.addEventListener('click', () => act.setDepth(b.dataset.depth as DepthId)));
  root.querySelectorAll<HTMLButtonElement>('[data-pilot]').forEach((b) => b.addEventListener('click', () => {
    const p = ctx.pilotList[+b.dataset.pilot!];
    act.select(p); act.focus(p);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-goto-pilot]').forEach((b) => b.addEventListener('click', () => {
    const p = ctx.pilotList.find((x) => x.id === b.dataset.gotoPilot);
    if (p) { act.select(p); act.focus(p); }
  }));
}
