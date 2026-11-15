// The map style: satellite imagery with roads, borders and place names from open
// vector tiles on top, on a globe when zoomed out. The 3D terrain is switched on by
// the controller once the view is close enough for it to matter (TERRAIN below).
// Every source below was checked to send Access-Control-Allow-Origin, which
// WebGL needs to use the pixels.

import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

export const SRC = {
  sat: 'sat', s2: 's2', dem: 'dem', omt: 'omt', ndvi: 'ndvi',
} as const;

/** Terrain setting the controller applies when zoomed in. */
export const TERRAIN = { source: SRC.dem, exaggeration: 1.35 } as const;

/** Layers switched as one group by the "place names and roads" toggle. */
export const LABEL_LAYERS: string[] = [];

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const halo = { 'text-color': '#ffffff', 'text-halo-color': 'rgba(8, 20, 14, 0.85)', 'text-halo-width': 1.6, 'text-halo-blur': 0.4 } as const;

function labelLayers(): LayerSpecification[] {
  const road = (id: string, classes: string[], minzoom: number, width: [number, number, number, number], color: string, opacity: number): LayerSpecification => ({
    id, type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom,
    filter: ['all', ['match', ['get', 'class'], classes, true, false], ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-opacity': opacity, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], width[0], width[1], width[2], width[3]] },
  });
  const place = (id: string, classes: string[], minzoom: number, size: [number, number, number, number], bold = false, maxzoom?: number): LayerSpecification => ({
    id, type: 'symbol', source: SRC.omt, 'source-layer': 'place', minzoom, ...(maxzoom ? { maxzoom } : {}),
    filter: ['match', ['get', 'class'], classes, true, false],
    layout: {
      'text-field': ['coalesce', ['get', 'name:tr'], ['get', 'name']],
      'text-font': bold ? FONT_BOLD : FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], size[0], size[1], size[2], size[3]],
      'text-max-width': 8,
      'text-padding': 4,
    },
    paint: halo,
  });
  const layers: LayerSpecification[] = [
    {
      id: 'border-province', type: 'line', source: SRC.omt, 'source-layer': 'boundary', minzoom: 5,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.42, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 1.4], 'line-dasharray': [3, 2] },
    },
    {
      id: 'border-country', type: 'line', source: SRC.omt, 'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#f2c14e', 'line-opacity': 0.9, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 8, 2.4] },
    },
    road('road-minor', ['minor', 'service', 'track'], 13, [13, 0.6, 18, 5], '#ffffff', 0.38),
    road('road-secondary', ['secondary', 'tertiary'], 10, [10, 0.6, 18, 8], '#ffffff', 0.5),
    road('road-major', ['motorway', 'trunk', 'primary'], 7, [7, 0.7, 18, 11], '#ffe7a8', 0.62),
    place('place-other', ['hamlet', 'suburb', 'neighbourhood', 'quarter', 'isolated_dwelling'], 12, [12, 11, 16, 14]),
    place('place-village', ['village'], 10, [10, 11.5, 16, 16]),
    place('place-town', ['town'], 7, [7, 12, 14, 18], true),
    place('place-city', ['city'], 4, [4, 12.5, 12, 22], true),
    place('place-state', ['state'], 5, [5, 11, 7, 14], false, 8),
  ];
  LABEL_LAYERS.splice(0, LABEL_LAYERS.length, ...layers.map((l) => l.id));
  return layers;
}

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#7fb6e6',
      'horizon-color': '#dfeaf2',
      'fog-color': '#e6ece8',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.35,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.85, 9, 0],
    },
    sources: {
      [SRC.sat]: {
        type: 'raster', tileSize: 256,
        // Real imagery ends at z18 in the countryside (z19 returns a placeholder tile), so the
        // source stops there and closer views stretch z18 instead of going blank.
        maxzoom: 18,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Görüntü © Esri, Maxar, Earthstar Geographics',
      },
      [SRC.s2]: {
        type: 'raster', tileSize: 256, maxzoom: 15,
        tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'],
        attribution: 'Sentinel-2 cloudless 2023 © EOX (Copernicus Sentinel)',
      },
      // Mapzen/Tilezen terrain on AWS Open Data (SRTM, GMTED, ETOPO1). Declared as 512 px tiles so
      // each view needs a quarter of the downloads; the mesh does not need more detail than that.
      [SRC.dem]: {
        type: 'raster-dem', encoding: 'terrarium', tileSize: 512, maxzoom: 13,
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Yükselti: Mapzen Terrain Tiles · AWS Open Data',
      },
      [SRC.omt]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
      [SRC.ndvi]: {
        type: 'raster', tileSize: 256, maxzoom: 9,
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png'],
        attribution: 'NDVI: NASA MODIS Terra (GIBS)',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#0d1f17' } },
      { id: 'sat', type: 'raster', source: SRC.sat, paint: { 'raster-fade-duration': 150, 'raster-saturation': 0.08, 'raster-contrast': 0.06 } },
      { id: 's2', type: 'raster', source: SRC.s2, layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 150 } },
      { id: 'ndvi', type: 'raster', source: SRC.ndvi, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.78, 'raster-resampling': 'nearest' } },
      ...labelLayers(),
    ],
  };
}
