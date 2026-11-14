// Holds every selectable layer, their visibility and the hover/selection
// state, and implements OverlaySource so the terrain can drape them.

import { bboxIntersects, type BBox } from '../geo';
import type { OverlaySource } from '../engine/Overlay';
import { FeatureIndex, type Feature, type FeatureKind } from './features';
import { FieldService, LANDUSE } from './fields';

export type PickMode = 'auto' | FeatureKind;

export const ZOOM = {
  provinceMax: 12,
  islandMin: 5,
  fieldMin: 13,
  parcelMin: 14,
  pilotMin: 7,
};

const AMBER = '242,169,59';

export class VectorScene implements OverlaySource {
  provinces = new FeatureIndex(50000);
  islands = new FeatureIndex(5000);
  pilots = new FeatureIndex(20000);
  fields = new FieldService();
  /** Real cadastral parcels fetched from TKGM on click or search; grows as you use it. */
  parcels = new FeatureIndex(500);
  show = { pilots: true, provinces: true, islands: true, fields: true, parcels: true };
  hovered: Feature | null = null;
  selected = new Map<string, Feature>();
  private turkey: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  setProvinces(list: Feature[]) {
    for (const f of list) {
      this.provinces.add(f);
      this.turkey.minX = Math.min(this.turkey.minX, f.bbox.minX);
      this.turkey.minY = Math.min(this.turkey.minY, f.bbox.minY);
      this.turkey.maxX = Math.max(this.turkey.maxX, f.bbox.maxX);
      this.turkey.maxY = Math.max(this.turkey.maxY, f.bbox.maxY);
    }
  }
  setIslands(list: Feature[]) { for (const f of list) this.islands.add(f); }
  setPilots(list: Feature[]) { for (const f of list) this.pilots.add(f); this.pilotList = list; }
  pilotList: Feature[] = [];
  get turkeyBBox() { return this.turkey; }

  // Picking ------------------------------------------------------------------

  /** Which kinds can be picked at this zoom, smallest first. */
  pickableKinds(z: number): FeatureKind[] {
    const k: FeatureKind[] = [];
    if (this.show.parcels && z >= ZOOM.parcelMin) k.push('parcel');
    if (this.show.fields && z >= ZOOM.fieldMin) k.push('field');
    // Pilot circles sit below fields: inside one, a click on a field picks the
    // field (whose panel links back to the pilot).
    if (this.show.pilots) k.push('pilot');
    if (this.show.islands && z >= ZOOM.islandMin) k.push('island');
    if (this.show.provinces) k.push('province');
    return k;
  }

  pick(x: number, y: number, z: number, mode: PickMode): Feature | null {
    const kinds = mode === 'auto' ? this.pickableKinds(z) : [mode];
    for (const kind of kinds) {
      const f = this.pickKind(kind, x, y);
      if (f) return f;
    }
    return null;
  }

  private pickKind(kind: FeatureKind, x: number, y: number): Feature | null {
    switch (kind) {
      case 'pilot': return this.pilots.at(x, y)[0] ?? null;
      case 'province': return this.provinces.at(x, y)[0] ?? null;
      case 'island': {
        // Islets can sit inside bigger islands' bboxes; prefer the smallest hit.
        const hits = this.islands.at(x, y).sort((a, b) => a.areaM2 - b.areaM2);
        return hits[0] ?? null;
      }
      case 'field': return smallest(this.fields.fieldsAt(x, y));
      case 'parcel': return smallest(this.parcels.at(x, y));
    }
  }

  // Drawing ------------------------------------------------------------------

  covers(b: BBox, z: number): boolean {
    if (this.hovered && bboxIntersects(this.hovered.bbox, b)) return true;
    for (const f of this.selected.values()) if (bboxIntersects(f.bbox, b)) return true;
    if (this.show.provinces && z <= ZOOM.provinceMax && bboxIntersects(this.turkey, b)) return true;
    if (this.show.islands && z >= ZOOM.islandMin && this.islands.query(b).length) return true;
    if (this.show.pilots && z >= ZOOM.pilotMin && this.pilots.query(b).length) return true;
    if (this.show.fields && z >= ZOOM.fieldMin && this.fields.fieldsIn(b).length) return true;
    if (this.show.parcels && z >= ZOOM.fieldMin && this.parcels.query(b).length) return true;
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, b: BBox, z: number, s: number): boolean {
    let drew = false;
    const px = (n: number) => n / s;
    const minSize = px(1.5);
    const visible = (f: Feature) => f.bbox.maxX - f.bbox.minX > minSize || f.bbox.maxY - f.bbox.minY > minSize;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (this.show.provinces && z <= ZOOM.provinceMax && bboxIntersects(this.turkey, b)) {
      const list = this.provinces.query(b);
      if (list.length) {
        const p = new Path2D();
        for (const f of list) addPath(p, f);
        ctx.strokeStyle = z <= 6 ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = px(z <= 6 ? 1 : 1.6);
        ctx.stroke(p);
        drew = true;
      }
    }

    if (this.show.islands && z >= ZOOM.islandMin) {
      const list = this.islands.query(b).filter(visible);
      if (list.length) {
        const p = new Path2D();
        for (const f of list) addPath(p, f);
        ctx.fillStyle = 'rgba(90,209,230,0.10)';
        ctx.fill(p, 'evenodd');
        ctx.strokeStyle = 'rgba(120,224,240,0.9)';
        ctx.lineWidth = px(z < 9 ? 1 : 1.5);
        ctx.stroke(p);
        drew = true;
      }
    }

    if (this.show.fields && z >= ZOOM.fieldMin) {
      const list = this.fields.fieldsIn(b).filter(visible);
      const byUse = new Map<string, Path2D>();
      for (const f of list) {
        const use = String(f.props.landuse ?? 'farmland');
        let p = byUse.get(use);
        if (!p) byUse.set(use, (p = new Path2D()));
        addPath(p, f);
      }
      for (const [use, p] of byUse) {
        const c = hexToRgb((LANDUSE[use] ?? LANDUSE.farmland).color);
        ctx.fillStyle = `rgba(${c},0.16)`;
        ctx.fill(p, 'evenodd');
        ctx.strokeStyle = `rgba(${c},0.9)`;
        ctx.lineWidth = px(z >= 16 ? 2 : 1.4);
        ctx.stroke(p);
        drew = true;
      }
    }

    if (this.show.parcels && z >= ZOOM.fieldMin) {
      const list = this.parcels.query(b).filter(visible);
      if (list.length) {
        const p = new Path2D();
        for (const f of list) addPath(p, f);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fill(p, 'evenodd');
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = px(1.6);
        ctx.stroke(p);
        drew = true;
      }
    }

    if (this.show.pilots && z >= ZOOM.pilotMin) {
      const list = this.pilots.query(b);
      if (list.length) {
        const p = new Path2D();
        for (const f of list) addPath(p, f);
        ctx.fillStyle = 'rgba(196,87,47,0.07)';
        ctx.fill(p);
        ctx.setLineDash([px(8), px(5)]);
        ctx.strokeStyle = 'rgba(196,87,47,0.95)';
        ctx.lineWidth = px(2.2);
        ctx.stroke(p);
        ctx.setLineDash([]);
        drew = true;
      }
    }

    // Selection and hover always draw, whatever the layer toggles and zoom say,
    // so a selected parcel stays visible when you zoom out to compare it.
    for (const f of this.selected.values()) {
      if (!bboxIntersects(f.bbox, b)) continue;
      const p = new Path2D();
      addPath(p, f);
      const big = f.kind === 'province' && z > ZOOM.provinceMax;
      // A pilot circle is a reading aid around a point; keep the imagery under it visible.
      const a = big ? 0.06 : f.kind === 'parcel' ? 0.42 : f.kind === 'pilot' ? 0.08 : 0.26;
      ctx.fillStyle = `rgba(${AMBER},${a})`;
      ctx.fill(p, 'evenodd');
      ctx.strokeStyle = `rgba(${AMBER},1)`;
      ctx.lineWidth = px(2.6);
      ctx.stroke(p);
      drew = true;
    }
    const h = this.hovered;
    if (h && !this.selected.has(h.id) && bboxIntersects(h.bbox, b)) {
      const p = new Path2D();
      addPath(p, h);
      ctx.fillStyle = h.kind === 'province' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.24)';
      ctx.fill(p, 'evenodd');
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = px(2);
      ctx.stroke(p);
      drew = true;
    }
    return drew;
  }
}

function addPath(p: Path2D, f: Feature) {
  for (const poly of f.polys) for (const r of poly) {
    p.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
  }
}

function smallest(list: Feature[]): Feature | null {
  let best: Feature | null = null;
  for (const f of list) if (!best || f.areaM2 < best.areaM2) best = f;
  return best;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
