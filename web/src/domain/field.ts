// The farmer's field: one or more parcels, however they were picked.

import type { Badge } from '@/lib/types';
import { areaM2, centroidOf, squareAround, type LngLat, type Polygon } from './geo';

export interface ParcelAdmin {
  ilId: number; ilceId: number; mahalleId: number;
  il: string; ilce: string; mahalle: string;
  ada: string; parsel: string;
  nitelik?: string;    // land class on the register, e.g. "Tarla"
  mevkii?: string;
}

export interface Parcel {
  id: string;
  /** tkgm: registered parcel · drawn: outlined by the farmer · pilot: stand-in area of a pilot district */
  source: 'tkgm' | 'drawn' | 'pilot';
  polygons: Polygon[];
  areaM2: number;
  /** official = registered area (TKGM) · user = computed from the farmer's outline · assumption = stand-in */
  areaBadge: Badge;
  label: string;
  admin?: ParcelAdmin;
}

export const fieldPolygons = (parcels: Parcel[]): Polygon[] => parcels.flatMap((p) => p.polygons);
export const fieldAreaM2 = (parcels: Parcel[]): number => parcels.reduce((s, p) => s + p.areaM2, 0);
export const fieldCentroid = (parcels: Parcel[]): LngLat | null => (parcels.length ? centroidOf(fieldPolygons(parcels)) : null);
/** 1 dönüm = 1 dekar = 1000 m². */
export const toDonum = (m2: number): number => m2 / 1000;
/** The area is a real figure only for registered or drawn parcels. */
export const hasRealArea = (parcels: Parcel[]): boolean => parcels.length > 0 && parcels.every((p) => p.source !== 'pilot');

export function drawnParcel(ring: LngLat[], n: number): Parcel {
  const polygons: Polygon[] = [[ring]];
  return { id: `drawn:${n}`, source: 'drawn', polygons, areaM2: areaM2(polygons), areaBadge: 'user', label: '' };
}

/** Side of the square drawn at a pilot point so the 3D view has something to stand on. Illustrative only. */
export const PILOT_SAMPLE_SIDE_M = 320;

export function pilotParcel(loc: { id: string; name: string; lat: number; lon: number }): Parcel {
  const polygons = [squareAround([loc.lon, loc.lat], PILOT_SAMPLE_SIDE_M)];
  return { id: `pilot:${loc.id}`, source: 'pilot', polygons, areaM2: areaM2(polygons), areaBadge: 'assumption', label: loc.name };
}
