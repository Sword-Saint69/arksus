// Raster tile sources. Every one of these was checked to send
// Access-Control-Allow-Origin, which WebGL needs to upload the pixels.

export type RasterSource = {
  id: string;
  label: string;
  note: string;
  noteEn?: string;
  url: (z: number, x: number, y: number) => string;
  maxZoom: number;
  attribution: string;
  /** True for open-licensed data; the UI marks the rest so the choice is informed. */
  open: boolean;
};

const sub = (x: number, y: number, list: string) => list[(x + y) % list.length];

const PROXY = import.meta.env.VITE_TILE_PROXY === '1';
/** Route through the dev server's /x/<name> relay when VITE_TILE_PROXY=1 (see vite.config.ts). */
export function via(name: string, url: string): string {
  return PROXY ? url.replace(/^https:\/\/[^/]+/, `/x/${name}`) : url;
}

export const BASEMAPS: RasterSource[] = [
  {
    id: 's2',
    label: 'Sentinel-2',
    note: 'Açık veri · 10 m',
    noteEn: 'Open data · 10 m',
    url: (z, x, y) => via('eox', `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/${z}/${y}/${x}.jpg`),
    // Sentinel-2 is 10 m/px; z15 is ~3.7 m/px at Turkey's latitude, more is just upscaling.
    maxZoom: 15,
    attribution: 'Sentinel-2 cloudless 2023 © EOX IT Services (Copernicus Sentinel verisi)',
    open: true,
  },
  {
    id: 'esri',
    label: 'Uydu HD',
    note: 'Yüksek çözünürlük · ~0,5 m',
    noteEn: 'High resolution · ~0.5 m',
    url: (z, x, y) => via('esri', `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`),
    maxZoom: 18,
    attribution: 'Görüntü © Esri, Maxar, Earthstar Geographics',
    open: false,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    note: 'Açık veri · ODbL',
    noteEn: 'Open data · ODbL',
    url: (z, x, y) => via('osm', `https://tile.openstreetmap.org/${z}/${x}/${y}.png`),
    maxZoom: 19,
    attribution: '© OpenStreetMap katkıcıları',
    open: true,
  },
  {
    id: 'topo',
    label: 'Topo',
    note: 'Açık veri · eş yükselti',
    noteEn: 'Open data · contours',
    url: (z, x, y) => via('topo', `https://${sub(x, y, 'abc')}.tile.opentopomap.org/${z}/${x}/${y}.png`),
    maxZoom: 17,
    attribution: '© OpenStreetMap katkıcıları, SRTM · OpenTopoMap (CC BY-SA)',
    open: true,
  },
];

export const LABELS: RasterSource = {
  id: 'labels',
  label: 'Etiketler',
  note: '',
  // CARTO's label-only tiles were the first choice (OSM-based) but now return an
  // "API KEY REQUIRED" watermark at every zoom; Esri's reference layer is keyless.
  url: (z, x, y) => via('esri', `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`),
  maxZoom: 18,
  attribution: 'Yer adları © Esri',
  open: false,
};

// Mapzen/Tilezen terrain on AWS Open Data: SRTM, GMTED, ETOPO1 merged and encoded
// as RGB (height = R*256 + G + B/256 - 32768). Public domain inputs, no key.
export const TERRAIN: RasterSource = {
  id: 'terrain',
  label: 'Yükselti',
  note: '',
  url: (z, x, y) => via('s3', `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`),
  maxZoom: 15,
  attribution: 'Yükselti: Mapzen Terrain Tiles (SRTM, GMTED, ETOPO1) · AWS Open Data',
  open: true,
};
