// Rasterises vector layers into a per-tile canvas that the terrain shader
// blends over the imagery.
//
// Drawing polygons as their own meshes was the alternative; draped meshes
// z-fight with the terrain, cut through hills between vertices and need a
// height lift that changes with zoom. Rasterising into the tile's own uv space
// drapes perfectly at any exaggeration, at the cost of re-rendering a canvas
// when a highlight changes, which the dirty-bbox tracking keeps local.

import * as THREE from 'three';
import { bboxIntersects, tileBBox, type BBox } from '../geo';
import { scheduler } from './TileStore';

export const OVERLAY_RES = 512;

export interface OverlaySource {
  /** Cheap test: could anything be drawn on this tile? */
  covers(b: BBox, z: number): boolean;
  /** Draw into ctx whose transform maps mercator metres to canvas pixels. Returns true if it drew. */
  draw(ctx: CanvasRenderingContext2D, b: BBox, z: number, pxPerM: number): boolean;
}

type Slot = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  empty: boolean;
  dirty: boolean;
  bbox: BBox;
  z: number;
  lastUsed: number;
};

export class OverlayManager {
  private slots = new Map<string, Slot>();
  private free: Slot[] = [];
  /** Per-frame rasterisation budget; the rest stays stale for a frame or two. */
  budget = 10;
  private spent = 0;
  private frame = -1;

  constructor(private readonly source: OverlaySource, private readonly anisotropy: number) {}

  /** Mark tiles overlapping bbox (or all, for null) as needing a redraw. */
  invalidate(b: BBox | null) {
    for (const s of this.slots.values()) if (!b || bboxIntersects(s.bbox, b)) s.dirty = true;
  }

  textureFor(z: number, x: number, y: number): THREE.Texture | null {
    if (this.frame !== scheduler.frame) { this.frame = scheduler.frame; this.spent = 0; this.gc(); }
    const key = `${z}/${x}/${y}`;
    let slot = this.slots.get(key);
    const b = slot?.bbox ?? tileBBox(z, x, y);
    if (!slot) {
      if (!this.source.covers(b, z)) return null;
      if (this.spent >= this.budget) return null;
      slot = this.free.pop() ?? this.createSlot();
      slot.bbox = b; slot.z = z; slot.dirty = true;
      this.slots.set(key, slot);
    }
    slot.lastUsed = scheduler.frame;
    if (slot.dirty && this.spent < this.budget) {
      this.spent++;
      this.render(slot);
    }
    return slot.empty ? null : slot.tex;
  }

  private render(slot: Slot) {
    const { ctx, bbox: b } = slot;
    const s = OVERLAY_RES / (b.maxX - b.minX);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, OVERLAY_RES, OVERLAY_RES);
    ctx.setTransform(s, 0, 0, -s, -b.minX * s, b.maxY * s);
    slot.empty = !this.source.draw(ctx, b, slot.z, s);
    slot.dirty = false;
    if (!slot.empty) slot.tex.needsUpdate = true;
  }

  private createSlot(): Slot {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OVERLAY_RES;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.anisotropy;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return { canvas, ctx, tex, empty: true, dirty: true, bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, z: 0, lastUsed: 0 };
  }

  private gc() {
    for (const [k, s] of this.slots) {
      if (scheduler.frame - s.lastUsed > 120) {
        this.slots.delete(k);
        if (this.free.length < 48) this.free.push(s); else s.tex.dispose();
      }
    }
  }
}
