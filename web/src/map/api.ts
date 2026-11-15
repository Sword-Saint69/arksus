// What the screens may ask of the map. The screens never touch MapLibre; they
// call this small surface, and MapController (controller.ts) implements it.

import type { Parcel } from '@/domain/field';
import type { Cell, LngLat, Polygon } from '@/domain/geo';
import type { Location, RotationId } from '@/lib/types';

export type BasemapId = 'satellite' | 's2';
export type OverlayId = 'labels' | 'pilots' | 'ndvi';

/** One strip of the field in the two-year view. */
export interface SimStrip { rotationId: RotationId; label: string; color: string }
export interface SimStripState {
  /** 0–1 plant height (share of the tallest crop), 0 for bare soil. */
  height: number;
  /** Fill colour of the strip's cells for this week. */
  color: string;
  /** 0–1 soil water store. */
  fullness: number;
  /** Two short lines for the tag above the strip. */
  line1: string;
  line2: string;
}

export interface GreenCell { ring: LngLat[]; ndvi: number }

export interface MapApi {
  /** Whole country from far away (the opening view). */
  home(): void;
  /** Central Anatolia, tilted: where the pilot districts are. */
  region(): void;
  flyTo(center: LngLat, zoom: number): void;
  fitBounds(bbox: [number, number, number, number]): void;
  /** Fly to the field and look at it at an angle. */
  fitField(polys: Polygon[], opts?: { orbit?: boolean; tight?: boolean }): void;
  zoom(): number;
  zoomBy(delta: number): void;
  toggleTilt(): void;
  north(): void;
  setOrbit(on: boolean): void;
  /** Cross-hair cursor while a tap picks a parcel or adds a corner. */
  setPicking(on: boolean): void;
  setField(parcels: Parcel[], color?: string): void;
  setDraft(ring: LngLat[]): void;
  setHere(at: LngLat | null): void;
  /** Pins for the districts the engine has results for. */
  setPilots(locations: Location[], label: (l: Location) => string): void;
  setPilotVerdicts(byLocation: Record<string, RotationId | null>): void;
  setBasemap(id: BasemapId): void;
  setOverlay(id: OverlayId, on: boolean): void;
  /** Start the two-year view: the field's cells split into one strip per rotation. */
  startSim(polys: Polygon[], strips: SimStrip[]): void;
  setSimWeek(states: SimStripState[]): void;
  stopSim(): void;
  setGreen(cells: GreenCell[] | null): void;
  onTap(cb: (at: LngLat, zoom: number) => void): () => void;
  onZoom(cb: (zoom: number) => void): () => void;
  onPilot(cb: (locationId: string) => void): () => void;
}

/** Cells of the field grid, shared by the two-year view and the greenness map. */
export type { Cell };

let impl: MapApi | null = null;
const waiting: ((api: MapApi) => void)[] = [];

export function provideMap(api: MapApi) {
  impl = api;
  waiting.splice(0).forEach((cb) => cb(api));
}

/** The map is gone (page teardown): later calls wait for a new one instead of reaching a dead one. */
export function withdrawMap(api: MapApi) {
  if (impl === api) impl = null;
}

/** Run when the map exists; right away if it already does. Returns nothing: map calls are fire-and-forget. */
export function withMap(cb: (api: MapApi) => void) {
  if (impl) cb(impl); else waiting.push(cb);
}

/** The map if it is ready (for reads such as the current zoom). */
export const mapNow = (): MapApi | null => impl;
