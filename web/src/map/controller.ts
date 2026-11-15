// All imperative MapLibre work lives here, behind the MapApi the screens use.

import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource, type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// The library finds its worker next to its own file, which a bundler moves; point at it explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { Location, RotationId } from '@/lib/types';
import type { Parcel } from '@/domain/field';
import {
  areaM2, bboxOf, edgeQuads, gridCells, longAxisAngle, stripIndex, toGeoJSONCoords, type LngLat, type Polygon,
} from '@/domain/geo';
import type { BasemapId, GreenCell, MapApi, OverlayId, SimStrip, SimStripState } from './api';
import { buildStyle, LABEL_LAYERS, TERRAIN } from './style';

setWorkerUrl(workerUrl);

type FC = FeatureCollection;
const fc = (features: Feature[] = []): FC => ({ type: 'FeatureCollection', features });
const polyFeature = (poly: Polygon, properties: GeoJsonProperties = {}): Feature =>
  ({ type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: toGeoJSONCoords(poly) } });
const ringFeature = (ring: LngLat[], properties: GeoJsonProperties = {}): Feature => polyFeature([ring], properties);

const GOLD = '#f2c14e';
const TURKEY: LngLat = [35.2, 39.0];
const REGION: LngLat = [34.3, 38.75];
const TURKEY_BOX: [number, number, number, number] = [25.6, 35.7, 44.9, 42.2];
/** Pilot pins are a country-scale layer: hidden once the view is down among the fields. */
const PIN_MAX_ZOOM = 11.5;
/** Below this the 13 pins sit on top of each other: dots only. */
const PIN_NAME_MIN_ZOOM = 5.3;
/**
 * The 3D terrain is on from here inwards and off again a little further out. From far away
 * it adds nothing but elevation downloads, and the view stays blank until they arrive.
 */
const TERRAIN_ON_ZOOM = 9.5, TERRAIN_OFF_ZOOM = 8.5;
const ORBIT_DEG_PER_S = 3.2;

const isWide = () => innerWidth >= 768;
/** Keep the subject clear of the panel: on a wide screen it sits on the left, on a phone at the bottom. */
const panelPadding = () => (isWide()
  ? { left: 500, right: 70, top: 80, bottom: 70 }
  : { left: 28, right: 28, top: 84, bottom: Math.round(innerHeight * 0.5) });

type Padding = { left: number; right: number; top: number; bottom: number };
const mercY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);

/**
 * Zoom at which a lon/lat box fills the part of the screen the padding leaves free (flat view).
 * Worked out here rather than with map.cameraForBounds, which adds its padding to whatever
 * padding the map already carries from the previous flight.
 */
function zoomForBox([w, s, e, n]: [number, number, number, number], pad: Padding): number {
  const freeW = Math.max(120, innerWidth - pad.left - pad.right), freeH = Math.max(120, innerHeight - pad.top - pad.bottom);
  const dx = Math.max(1e-9, (e - w) / 360), dy = Math.max(1e-9, mercY(s) - mercY(n));
  return Math.log2(Math.min(freeW / dx, freeH / dy) / 512);
}

/** Stable 0–1 noise per cell, so plant heights vary a little but never flicker. */
const jitter = (k: number) => { const s = Math.sin(k * 12.9898) * 43758.5453; return s - Math.floor(s); };

export class MapController implements MapApi {
  readonly map: MlMap;
  private loaded = false;
  private queue: (() => void)[] = [];
  private taps = new Set<(at: LngLat, zoom: number) => void>();
  private zooms = new Set<(zoom: number) => void>();
  private pilotTaps = new Set<(id: string) => void>();
  private pins = new Map<string, { marker: Marker; el: HTMLButtonElement }>();
  private pinsOn = true;
  private here: Marker | null = null;
  private tags: { marker: Marker; el: HTMLElement }[] = [];
  private simHeightM = 8;
  private orbitRaf = 0;
  private orbitWanted = false;
  private spinRaf = 0;
  private fieldColor = GOLD;
  private terrainOn = false;
  private dead = false;
  private wallHidden = false;
  private simOn = false;
  private greenOn = false;

  constructor(container: HTMLElement) {
    this.map = new MlMap({
      container,
      style: buildStyle(),
      center: TURKEY,
      zoom: isWide() ? 4.3 : 3.5,
      pitch: 0,
      maxPitch: 78,
      minZoom: 2.5,
      maxZoom: 19.5,
      attributionControl: { compact: true },
      // Rotating with two fingers is easy to trigger by accident on a phone; the tilt button covers it.
      dragRotate: true,
      canvasContextAttributes: { antialias: true },
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.on('load', () => {
      this.addLayers();
      this.loaded = true;
      this.syncTerrain();
      this.queue.splice(0).forEach((fn) => fn());
    });
    this.map.on('click', (e) => { for (const cb of this.taps) cb([e.lngLat.lng, e.lngLat.lat], this.map.getZoom()); });
    const zoomed = () => { const z = this.map.getZoom(); this.syncPins(z); for (const cb of this.zooms) cb(z); };
    this.map.on('zoomend', zoomed);
    this.map.on('zoom', () => this.syncTerrain());
    this.map.on('moveend', () => { if (this.orbitWanted && !this.orbitRaf) this.runOrbit(); });
    // Any touch of the map hands the camera back to the farmer.
    for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) {
      this.map.getCanvas().addEventListener(ev, () => { this.orbitWanted = false; this.stopLoops(); }, { passive: true });
    }
    // A missing tile is not worth a console error for every square of sea.
    this.map.on('error', (e) => { if (import.meta.env.DEV) console.debug('map', e.error?.message ?? e); });
  }

  /** Run now if the style is ready, later if not, never once the map is gone. */
  private run(fn: () => void) { if (this.dead) return; if (this.loaded) fn(); else this.queue.push(fn); }

  private syncTerrain() {
    if (!this.loaded) return;
    const z = this.map.getZoom();
    const want = this.terrainOn ? z >= TERRAIN_OFF_ZOOM : z >= TERRAIN_ON_ZOOM;
    if (want === this.terrainOn) return;
    this.terrainOn = want;
    this.map.setTerrain(want ? TERRAIN : null);
  }
  private src(id: string) { return this.map.getSource<GeoJSONSource>(id); }

  private addLayers() {
    const m = this.map;
    for (const id of ['field', 'fence', 'draft', 'draft-pts', 'green', 'cells']) m.addSource(id, { type: 'geojson', data: fc() });
    // Flat layers go under the place names; the extruded ones stand on top of everything.
    const under = LABEL_LAYERS[0];
    m.addLayer({ id: 'field-fill', type: 'fill', source: 'field', paint: { 'fill-color': GOLD, 'fill-opacity': 0.26 } }, under);
    m.addLayer({ id: 'field-glow', type: 'line', source: 'field', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-blur': 6, 'line-opacity': 0.55 } }, under);
    m.addLayer({ id: 'field-line', type: 'line', source: 'field', layout: { 'line-join': 'round' }, paint: { 'line-color': GOLD, 'line-width': 3.2 } }, under);
    m.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', paint: { 'fill-color': GOLD, 'fill-opacity': 0.25 } }, under);
    m.addLayer({ id: 'draft-line', type: 'line', source: 'draft', paint: { 'line-color': GOLD, 'line-width': 3, 'line-dasharray': [1.5, 1] } }, under);
    m.addLayer({ id: 'draft-pts', type: 'circle', source: 'draft-pts', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': GOLD, 'circle-stroke-width': 3.5 } });
    m.addLayer({
      id: 'green', type: 'fill-extrusion', source: 'green',
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'ndvi'], 0.08, '#a9825a', 0.2, '#d8c97a', 0.35, '#b7d36a', 0.55, '#5fae4a', 0.8, '#17692b'],
        'fill-extrusion-height': ['*', ['max', 0, ['get', 'ndvi']], ['get', 'h']],
        'fill-extrusion-opacity': 0.95,
      },
    });
    m.addLayer({ id: 'cells', type: 'fill-extrusion', source: 'cells', paint: { 'fill-extrusion-color': '#86644a', 'fill-extrusion-height': 0, 'fill-extrusion-opacity': 1 } });
    m.addLayer({ id: 'fence', type: 'fill-extrusion', source: 'fence', paint: { 'fill-extrusion-color': GOLD, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.8 } });
  }

  // --- camera -------------------------------------------------------------------------------

  private stopLoops() {
    cancelAnimationFrame(this.orbitRaf); this.orbitRaf = 0;
    cancelAnimationFrame(this.spinRaf); this.spinRaf = 0;
  }

  home() {
    this.orbitWanted = false;
    this.stopLoops();
    // Frame the whole country, clear of the words: they sit on the left of a wide screen and at the bottom of a phone.
    const padding = isWide()
      ? { left: Math.round(innerWidth * 0.46), right: 30, top: 80, bottom: 60 }
      : { left: 16, right: 16, top: 76, bottom: Math.round(innerHeight * 0.56) };
    this.map.flyTo({ center: TURKEY, zoom: Math.min(zoomForBox(TURKEY_BOX, padding), 5.4), pitch: 0, bearing: 0, padding, duration: 1800, essential: true });
    // A slow drift keeps the opening view alive without making anyone seasick.
    let last = performance.now(), t = 0;
    const spin = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!this.map.isMoving() || t > 0) { t += dt; this.map.jumpTo({ bearing: Math.sin(t * 0.09) * 7 }); }
      this.spinRaf = requestAnimationFrame(spin);
    };
    this.map.once('moveend', () => { if (!this.orbitWanted && !this.spinRaf && this.map.getZoom() < 6) this.spinRaf = requestAnimationFrame(spin); });
  }

  region() {
    this.orbitWanted = false;
    this.stopLoops();
    this.map.flyTo({ center: REGION, zoom: isWide() ? 6.5 : 5.6, pitch: 46, bearing: -6, padding: panelPadding(), duration: 2600, essential: true });
  }

  flyTo(center: LngLat, zoom: number) {
    this.orbitWanted = false;
    this.stopLoops();
    this.map.flyTo({ center, zoom, pitch: zoom >= 13 ? 40 : this.map.getPitch(), padding: panelPadding(), duration: 1500, essential: true });
  }

  fitBounds([w, s, e, n]: [number, number, number, number]) {
    this.orbitWanted = false;
    this.stopLoops();
    const padding = panelPadding();
    this.map.flyTo({ center: [(w + e) / 2, (s + n) / 2], zoom: Math.min(zoomForBox([w, s, e, n], padding), 15.5), padding, duration: 1700, essential: true });
  }

  fitField(polys: Polygon[], opts: { orbit?: boolean; tight?: boolean } = {}) {
    if (!polys.length) return;
    this.stopLoops();
    const [w, s, e, n] = bboxOf(polys);
    const padding = panelPadding();
    // Look across the field's long side, so strips laid along it read left to right.
    let bearing = -(longAxisAngle(polys) * 180) / Math.PI;
    while (bearing > 90) bearing -= 180;
    while (bearing < -90) bearing += 180;
    this.orbitWanted = !!opts.orbit;
    // Extruded shapes sit at the height the terrain has when they are built; until the
    // elevation tiles of the new place arrive they would hang in the air.
    this.run(() => {
      if (this.wallHidden) return;
      this.wallHidden = true;
      this.map.setLayoutProperty('fence', 'visibility', 'none');
      this.map.once('idle', () => { this.wallHidden = false; if (!this.simOn && !this.greenOn) this.map.setLayoutProperty('fence', 'visibility', 'visible'); });
    });
    this.map.flyTo({
      center: [(w + e) / 2, (s + n) / 2],
      // The tilted view shows more ground ahead, and a little air around the field reads better.
      zoom: Math.min(zoomForBox([w, s, e, n], padding), 17.8) - (opts.tight ? 0.35 : 0.7),
      pitch: 58, bearing, padding, duration: 2400, essential: true,
    });
  }

  private runOrbit() {
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.map.jumpTo({ bearing: this.map.getBearing() + dt * ORBIT_DEG_PER_S });
      this.orbitRaf = requestAnimationFrame(step);
    };
    this.orbitRaf = requestAnimationFrame(step);
  }

  setOrbit(on: boolean) {
    this.orbitWanted = on;
    if (!on) { cancelAnimationFrame(this.orbitRaf); this.orbitRaf = 0; } else if (!this.map.isMoving() && !this.orbitRaf) this.runOrbit();
  }

  zoom() { return this.map.getZoom(); }
  zoomBy(delta: number) { this.orbitWanted = false; this.stopLoops(); this.map.easeTo({ zoom: this.map.getZoom() + delta, duration: 350 }); }
  toggleTilt() { this.orbitWanted = false; this.stopLoops(); this.map.easeTo({ pitch: this.map.getPitch() > 20 ? 0 : 58, duration: 600 }); }
  north() { this.orbitWanted = false; this.stopLoops(); this.map.easeTo({ bearing: 0, duration: 500 }); }
  setPicking(on: boolean) { this.map.getCanvas().style.cursor = on ? 'crosshair' : ''; }

  // --- the field ----------------------------------------------------------------------------

  setField(parcels: Parcel[], color = GOLD) {
    this.fieldColor = color;
    this.run(() => {
      const polys = parcels.flatMap((p) => p.polygons);
      this.src('field')?.setData(fc(polys.map((p) => polyFeature(p))));
      // A low wall around the field, taller on bigger fields so it reads from the same distance.
      const h = Math.min(7, Math.max(1.4, Math.sqrt(areaM2(polys)) / 55));
      this.src('fence')?.setData(fc(edgeQuads(polys, Math.max(0.8, h * 0.45)).map((r) => ringFeature(r, { h }))));
      this.map.setPaintProperty('field-fill', 'fill-color', color);
      this.map.setPaintProperty('field-line', 'line-color', color);
      this.map.setPaintProperty('fence', 'fill-extrusion-color', color);
    });
  }

  setDraft(ring: LngLat[]) {
    this.run(() => {
      this.src('draft-pts')?.setData(fc(ring.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))));
      const shape: Feature[] = ring.length >= 3 ? [ringFeature(ring)]
        : ring.length === 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } }] : [];
      this.src('draft')?.setData(fc(shape));
    });
  }

  setHere(at: LngLat | null) {
    this.here?.remove();
    this.here = null;
    if (!at) return;
    const el = document.createElement('div');
    el.className = 'here-pin';
    this.here = new Marker({ element: el }).setLngLat(at).addTo(this.map);
  }

  // --- pilot districts ----------------------------------------------------------------------

  /** Pins for the districts the engine has results for. Called once the site index is loaded. */
  setPilots(locations: Location[], label: (l: Location) => string) {
    for (const { marker } of this.pins.values()) marker.remove();
    this.pins.clear();
    for (const loc of locations) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'pilot-pin';
      el.setAttribute('aria-label', label(loc));
      const name = document.createElement('span'); name.className = 'name'; name.textContent = loc.name;
      const dot = document.createElement('span'); dot.className = 'dot';
      el.append(name, dot);
      el.addEventListener('click', (e) => { e.stopPropagation(); for (const cb of this.pilotTaps) cb(loc.id); });
      this.pins.set(loc.id, { el, marker: new Marker({ element: el, anchor: 'bottom' }).setLngLat([loc.lon, loc.lat]).addTo(this.map) });
    }
    this.syncPins(this.map.getZoom());
  }

  private syncPins(zoom: number) {
    const show = this.pinsOn && zoom < PIN_MAX_ZOOM;
    for (const { el } of this.pins.values()) {
      el.style.display = show ? '' : 'none';
      el.classList.toggle('far', zoom < PIN_NAME_MIN_ZOOM);
    }
  }

  setPilotVerdicts(byLocation: Record<string, RotationId | null>) {
    for (const [id, { el }] of this.pins) {
      const rot = byLocation[id];
      if (rot) el.dataset.rot = rot; else delete el.dataset.rot;
    }
  }

  // --- layers -------------------------------------------------------------------------------

  setBasemap(id: BasemapId) {
    this.run(() => {
      this.map.setLayoutProperty('sat', 'visibility', id === 'satellite' ? 'visible' : 'none');
      this.map.setLayoutProperty('s2', 'visibility', id === 's2' ? 'visible' : 'none');
    });
  }

  setOverlay(id: OverlayId, on: boolean) {
    this.run(() => {
      const vis = on ? 'visible' : 'none';
      if (id === 'labels') for (const l of LABEL_LAYERS) this.map.setLayoutProperty(l, 'visibility', vis);
      else if (id === 'pilots') { this.pinsOn = on; this.syncPins(this.map.getZoom()); }
      else if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', vis);
    });
  }

  // --- two-year view ------------------------------------------------------------------------

  startSim(polys: Polygon[], strips: SimStrip[]) {
    this.run(() => {
      this.clearTags();
      this.simOn = true;
      this.greenOn = false;
      this.src('green')?.setData(fc());
      const grid = gridCells(polys, { maxCells: 1500 });
      const strip = stripIndex(grid.cells, strips.length);
      this.simHeightM = Math.min(18, Math.max(3, 0.036 * Math.sqrt(areaM2(polys))));
      this.src('cells')?.setData(fc(grid.cells.map((c, i) => ringFeature(c.ring, { s: strip[i], j: 0.78 + 0.44 * jitter(c.k) }))));
      // The field's own fill would tint the strips; keep only its outline while they play.
      this.map.setPaintProperty('field-fill', 'fill-opacity', 0);
      this.map.setLayoutProperty('fence', 'visibility', 'none');
      strips.forEach((s, i) => {
        const mine = grid.cells.filter((_, k) => strip[k] === i);
        if (!mine.length) return;
        const at: LngLat = [
          mine.reduce((a, c) => a + (c.ring[0][0] + c.ring[2][0]) / 2, 0) / mine.length,
          mine.reduce((a, c) => a + (c.ring[0][1] + c.ring[2][1]) / 2, 0) / mine.length,
        ];
        const el = document.createElement('div');
        el.className = 'strip-tag';
        el.style.setProperty('--c', s.color);
        el.innerHTML = '<b></b><span></span><div class="gauge"><i></i></div><small></small>';
        el.querySelector('b')!.textContent = s.label;
        this.tags.push({ el, marker: new Marker({ element: el, anchor: 'bottom', offset: [0, -14] }).setLngLat(at).addTo(this.map) });
      });
    });
  }

  setSimWeek(states: SimStripState[]) {
    this.run(() => {
      if (!states.length || !this.map.getLayer('cells')) return;
      const pick = (f: (s: SimStripState) => number | string): ExpressionSpecification => {
        const e: unknown[] = ['match', ['get', 's']];
        states.slice(0, -1).forEach((s, i) => e.push(i, f(s)));
        e.push(f(states[states.length - 1]));
        return e as ExpressionSpecification;
      };
      this.map.setPaintProperty('cells', 'fill-extrusion-height', ['*', ['get', 'j'], pick((s) => s.height * this.simHeightM)] as ExpressionSpecification);
      this.map.setPaintProperty('cells', 'fill-extrusion-color', pick((s) => s.color));
      states.forEach((s, i) => {
        const tag = this.tags[i];
        if (!tag) return;
        tag.el.querySelector('span')!.textContent = s.line1;
        tag.el.querySelector('small')!.textContent = s.line2;
        (tag.el.querySelector('.gauge i') as HTMLElement).style.width = `${Math.round(s.fullness * 100)}%`;
      });
    });
  }

  private clearTags() {
    for (const t of this.tags) t.marker.remove();
    this.tags = [];
  }

  stopSim() {
    this.run(() => {
      if (!this.simOn) return;
      this.simOn = false;
      this.clearTags();
      this.src('cells')?.setData(fc());
      this.map.setPaintProperty('field-fill', 'fill-opacity', 0.26);
      if (!this.wallHidden) this.map.setLayoutProperty('fence', 'visibility', 'visible');
      this.map.setPaintProperty('field-fill', 'fill-color', this.fieldColor);
    });
  }

  setGreen(cells: GreenCell[] | null) {
    this.run(() => {
      const h = 14;
      this.greenOn = !!cells?.length;
      this.src('green')?.setData(fc((cells ?? []).map((c) => ringFeature(c.ring, { ndvi: c.ndvi, h }))));
      if (this.simOn) return;
      this.map.setPaintProperty('field-fill', 'fill-opacity', this.greenOn ? 0 : 0.26);
      this.map.setLayoutProperty('fence', 'visibility', this.greenOn || this.wallHidden ? 'none' : 'visible');
    });
  }

  // --- events -------------------------------------------------------------------------------

  onTap(cb: (at: LngLat, zoom: number) => void) { this.taps.add(cb); return () => { this.taps.delete(cb); }; }
  onZoom(cb: (zoom: number) => void) { this.zooms.add(cb); cb(this.map.getZoom()); return () => { this.zooms.delete(cb); }; }
  onPilot(cb: (id: string) => void) { this.pilotTaps.add(cb); return () => { this.pilotTaps.delete(cb); }; }

  destroy() {
    this.dead = true;
    this.stopLoops();
    this.clearTags();
    this.map.remove();
  }
}
