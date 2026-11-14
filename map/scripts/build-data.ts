// Builds the static vector layers shipped with the app:
//   public/data/provinces.json  81 provinces, geoBoundaries gbOpen TUR ADM1 (OSM-derived, CC BY-SA)
//   public/data/islands.json    every place=island|islet inside Turkey, from Overpass (ODbL)
//
// Islands are prebuilt rather than queried at runtime: the country-wide query
// takes ~30 s on the public Overpass instance, too slow for a first paint.
//
// Inputs (fetched once, gitignored):
//   scripts/adm1-raw.json     https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUR/ADM1/geoBoundaries-TUR-ADM1_simplified.geojson
//   scripts/islands-raw.json  Overpass result of scripts/islands.overpassql

import { readFileSync, writeFileSync } from 'node:fs';
import { elementToArea, simplifyRing, isDegenerate, type OverpassElement } from '../src/vector/osm';
import { lonLatToMerc, mercToLonLat, polygonAreaM2, type Polygon } from '../src/geo';

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function mercRingToLonLat(ring: Float64Array, digits: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    const [lon, lat] = mercToLonLat(ring[i], ring[i + 1]);
    out.push(round(lon, digits), round(lat, digits));
  }
  return out;
}

function simplifyPolys(polys: Polygon[], tolM: number): Polygon[] {
  return polys
    .map((p) => p.map((r) => simplifyRing(r, tolM)).filter((r, i) => i === 0 || !isDegenerate(r)))
    .filter((p) => !isDegenerate(p[0]));
}

// Provinces ----------------------------------------------------------------
type GeoJSONGeom = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
const adm = JSON.parse(readFileSync('scripts/adm1-raw.json', 'utf8')) as {
  features: { properties: { shapeName: string; shapeISO: string }; geometry: GeoJSONGeom }[];
};

const ringFromLonLat = (coords: number[][]) => {
  const n = coords.length - (coords[0][0] === coords.at(-1)![0] && coords[0][1] === coords.at(-1)![1] ? 1 : 0);
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const m = lonLatToMerc(coords[i][0], coords[i][1]);
    out[i * 2] = m.x; out[i * 2 + 1] = m.y;
  }
  return out;
};

const provinces = adm.features.map((f) => {
  const g = f.geometry;
  const raw: Polygon[] = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((p) => p.map(ringFromLonLat));
  // ~60 m in mercator units at Turkey's latitude: invisible at province zoom, 4x smaller file.
  const polys = simplifyPolys(raw, 80);
  return {
    name: f.properties.shapeName,
    iso: f.properties.shapeISO,
    areaKm2: Math.round(polygonAreaM2(raw) / 1e6),
    polys: polys.map((p) => p.map((r) => mercRingToLonLat(r, 5))),
  };
}).sort((a, b) => a.name.localeCompare(b.name, 'tr'));

writeFileSync('public/data/provinces.json', JSON.stringify(provinces));

// Islands ------------------------------------------------------------------
const osm = JSON.parse(readFileSync('scripts/islands-raw.json', 'utf8')) as { elements: OverpassElement[] };
const islands = [];
for (const el of osm.elements) {
  const area = elementToArea(el);
  if (!area) continue;
  const polys = simplifyPolys(area.polys, 2.5);
  if (!polys.length) continue;
  const m2 = polygonAreaM2(area.polys);
  if (m2 < 50) continue;
  islands.push({
    id: area.osmId,
    t: area.osmType === 'way' ? 'w' : 'r',
    name: area.tags['name:tr'] ?? area.tags.name ?? null,
    nameEn: area.tags['name:en'] ?? null,
    kind: area.tags.place,
    areaM2: Math.round(m2),
    polys: polys.map((p) => p.map((r) => mercRingToLonLat(r, 6))),
  });
}
islands.sort((a, b) => b.areaM2 - a.areaM2);
writeFileSync('public/data/islands.json', JSON.stringify(islands));

console.log(`provinces: ${provinces.length}, islands: ${islands.length} (named ${islands.filter((i) => i.name).length})`);
console.log('largest islands:', islands.slice(0, 6).map((i) => `${i.name} ${(i.areaM2 / 1e6).toFixed(1)} km²`).join(', '));
