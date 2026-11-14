// Agricultural land from OpenStreetMap, fetched from Overpass per z13 cell
// (~3.8 km square at Turkey's latitude) as the camera gets close enough.

import { mercToLonLat, mercToTile, tileBBox, type BBox } from '../geo';
import { elementToArea, type OverpassElement } from './osm';
import { FeatureIndex, makeFeature, type Feature } from './features';
import { via } from '../sources';

export const FIELD_CELL_Z = 13;

const ENDPOINTS = [
  via('ovpa', 'https://overpass-api.de/api/interpreter'),
  via('ovpb', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'),
];

// Cells change rarely; keeping responses in Cache Storage means a revisit or a
// reload costs Overpass nothing. Bump the version when the query changes.
const CACHE = 'terrashift-overpass-v1';

export const LANDUSE: Record<string, { label: string; en: string; color: string }> = {
  farmland: { label: 'Tarla', en: 'Farmland', color: '#e3c169' },
  orchard: { label: 'Meyve bahçesi', en: 'Orchard', color: '#8fd16a' },
  vineyard: { label: 'Bağ', en: 'Vineyard', color: '#c58be0' },
  meadow: { label: 'Çayır / mera', en: 'Meadow', color: '#6fd3a8' },
  greenhouse_horticulture: { label: 'Sera', en: 'Greenhouse', color: '#7cc7f2' },
  plant_nursery: { label: 'Fidanlık', en: 'Nursery', color: '#b4e07a' },
  allotments: { label: 'Hobi bahçesi', en: 'Allotments', color: '#f0a58a' },
};

const CROPS: Record<string, string> = {
  wheat: 'Buğday', barley: 'Arpa', maize: 'Mısır', corn: 'Mısır', sunflower: 'Ayçiçeği', cotton: 'Pamuk',
  rice: 'Pirinç', sugar_beet: 'Şeker pancarı', potato: 'Patates', tomato: 'Domates', grape: 'Üzüm',
  olive: 'Zeytin', hazelnut: 'Fındık', tea: 'Çay', tobacco: 'Tütün', vegetables: 'Sebze', cereal: 'Tahıl',
  grass: 'Çim / ot', fodder: 'Yem bitkisi', pistachio: 'Antep fıstığı', apple: 'Elma', citrus: 'Narenciye',
};
const TREES: Record<string, string> = {
  olive_trees: 'Zeytin', apple_trees: 'Elma', orange_trees: 'Portakal', citrus_trees: 'Narenciye',
  hazel_plants: 'Fındık', nut_trees: 'Kabuklu yemiş', almond_trees: 'Badem', pistachio_trees: 'Antep fıstığı',
  cherry_trees: 'Kiraz', apricot_trees: 'Kayısı', tea_plants: 'Çay', fig_trees: 'İncir', peach_trees: 'Şeftali',
};

type CellState = 'loading' | 'ready' | 'error';

export class FieldService {
  readonly index = new FeatureIndex(2000);
  private cells = new Map<string, { state: CellState; retryAt?: number }>();
  private queue: { key: string; x: number; y: number; pri: number }[] = [];
  private inflight = 0;
  private endpoint = 0;
  /** Set after a 429/504: nothing is sent to Overpass before this time. */
  private pausedUntil = 0;
  private backoff = 10000;
  onData: (bbox: BBox) => void = () => {};
  onStatus: () => void = () => {};

  get loadingCount() { return this.inflight + this.queue.length; }
  get lastError() { return this._lastError; }
  private _lastError: string | null = null;

  /** Request every z13 cell overlapping the given mercator bbox, nearest first. */
  want(view: BBox, cx: number, cy: number, maxCells = 6) {
    const [x0, y0] = mercToTile(FIELD_CELL_Z, view.minX, view.maxY);
    const [x1, y1] = mercToTile(FIELD_CELL_Z, view.maxX, view.minY);
    const [ccx, ccy] = mercToTile(FIELD_CELL_Z, cx, cy);
    const wanted: { key: string; x: number; y: number; pri: number }[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const key = `${x}/${y}`;
      const c = this.cells.get(key);
      if (c && (c.state !== 'error' || performance.now() < (c.retryAt ?? 0))) continue;
      wanted.push({ key, x, y, pri: Math.hypot(x - ccx, y - ccy) });
    }
    wanted.sort((a, b) => a.pri - b.pri);
    // Overpass's public instances allow two concurrent slots per client and
    // punish bursts; asking only for the cells nearest the view centre keeps us
    // well inside that while the camera is moving.
    this.queue = wanted.slice(0, maxCells);
    this.pump();
  }

  private pump() {
    if (performance.now() < this.pausedUntil) return;
    // One request at a time: the public instances answer a burst with 429 and
    // then refuse everything for a while, which is worse than going slowly.
    while (this.inflight < 1 && this.queue.length) {
      const job = this.queue.shift()!;
      if (this.cells.has(job.key) && this.cells.get(job.key)!.state !== 'error') continue;
      this.cells.set(job.key, { state: 'loading' });
      this.inflight++;
      this.fetchCell(job.x, job.y)
        .then((bbox) => {
          this.cells.set(job.key, { state: 'ready' });
          this._lastError = null;
          this.backoff = 10000;
          this.onData(bbox);
        })
        .catch((e: Error) => {
          this.cells.set(job.key, { state: 'error', retryAt: performance.now() + this.backoff });
          this._lastError = e.message;
          this.endpoint = (this.endpoint + 1) % ENDPOINTS.length;
          this.pausedUntil = performance.now() + this.backoff;
          setTimeout(() => this.pump(), this.backoff + 50);
          this.backoff = Math.min(120000, this.backoff * 2);
        })
        .finally(() => { this.inflight--; this.onStatus(); this.pump(); });
    }
    this.onStatus();
  }

  private async fetchCell(x: number, y: number): Promise<BBox> {
    const b = tileBBox(FIELD_CELL_Z, x, y);
    const [w, s] = mercToLonLat(b.minX, b.minY);
    const [e, n] = mercToLonLat(b.maxX, b.maxY);
    const bb = `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}`;
    const types = Object.keys(LANDUSE).join('|');
    const q = `[out:json][timeout:25];(way["landuse"~"^(${types})$"](${bb});relation["landuse"~"^(${types})$"](${bb}););out geom;`;
    const json = await this.query(q);
    for (const el of json.elements) {
      const area = elementToArea(el);
      if (!area) continue;
      const t = area.tags;
      const lu = LANDUSE[t.landuse] ?? LANDUSE.farmland;
      const crop = t.crop ? t.crop.split(';').map((c) => CROPS[c.trim()] ?? c.trim()).join(', ') : null;
      const trees = t.trees ? t.trees.split(';').map((c) => TREES[c.trim()] ?? c.trim()).join(', ') : null;
      const f: Feature = makeFeature({
        id: `tarla:${area.osmType[0]}${area.osmId}`,
        kind: 'field',
        name: t.name ?? lu.label,
        polys: area.polys,
        props: {
          Kullanım: lu.label,
          Ürün: crop ?? trees ?? t.produce ?? null,
          Sulama: t.irrigated === 'yes' ? 'Sulu' : t.irrigated === 'no' ? 'Kuru' : null,
          landuse: t.landuse,
          OSM: `${area.osmType}/${area.osmId}`,
        },
      });
      this.index.add(f);
    }
    return b;
  }

  private async query(q: string): Promise<{ elements: OverpassElement[] }> {
    // The cache key is endpoint-independent so a cell fetched from either mirror is reused.
    const key = `https://overpass.cache/${encodeURIComponent(q)}`;
    const cache = 'caches' in self ? await caches.open(CACHE).catch(() => null) : null;
    const hit = await cache?.match(key);
    if (hit) return hit.json();
    // GET rather than POST so the request is a simple CORS request (no preflight).
    const res = await fetch(`${ENDPOINTS[this.endpoint]}?data=${encodeURIComponent(q)}`);
    if (!res.ok) {
      throw new Error(res.status === 429 ? 'Overpass hız sınırına takıldı' : res.status === 504 ? 'Overpass meşgul' : `Overpass HTTP ${res.status}`);
    }
    const text = await res.text();
    // Overpass reports server-side timeouts inside a 200 response.
    if (text.includes('"remark"') && /runtime error|timed out/i.test(text)) throw new Error('Overpass zaman aşımı');
    await cache?.put(key, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
    return JSON.parse(text);
  }

  fieldsIn(b: BBox) { return this.index.query(b); }
  fieldsAt(x: number, y: number) { return this.index.at(x, y); }
}
