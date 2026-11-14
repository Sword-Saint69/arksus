// Fetches, decodes and caches raster tiles for one source.
//
// One shared scheduler caps in-flight requests across all sources; each frame
// the terrain re-requests what it still wants, and anything nobody asked for
// in a while is dropped from the queue or aborted mid-flight. That keeps a fast
// pan from leaving a long tail of tiles for places the camera already left.

import * as THREE from 'three';
import type { RasterSource } from '../sources';

export type TileEntry<T> = {
  key: string;
  z: number; x: number; y: number;
  state: 'queued' | 'loading' | 'ready' | 'error';
  value?: T;
  priority: number;
  lastWanted: number;
  lastUsed: number;
  abort?: AbortController;
  retryAt?: number;
};

type Job = { store: TileStore<unknown>; entry: TileEntry<unknown> };

class Scheduler {
  private queue: Job[] = [];
  private inflight = 0;
  frame = 0;
  onLoad: () => void = () => {};
  constructor(private readonly max = 20) {}

  get pending() { return this.queue.length + this.inflight; }

  enqueue(job: Job) { this.queue.push(job); }

  pump() {
    // Requests not re-asked for in the last couple of frames are stale.
    this.queue = this.queue.filter(({ entry, store }) => {
      if (this.frame - entry.lastWanted > 2) { store.forget(entry.key); return false; }
      return true;
    });
    this.queue.sort((a, b) => a.entry.priority - b.entry.priority);
    while (this.inflight < this.max && this.queue.length) {
      const job = this.queue.shift()!;
      this.inflight++;
      job.store.run(job.entry).finally(() => { this.inflight--; this.onLoad(); });
    }
  }
}

export const scheduler = new Scheduler(24);

export class TileStore<T> {
  private entries = new Map<string, TileEntry<T>>();
  constructor(
    public source: RasterSource,
    private readonly decode: (blob: Blob, entry: TileEntry<T>) => Promise<T>,
    private readonly release: (value: T) => void,
    private readonly limit = 600,
  ) {}

  static key(z: number, x: number, y: number) { return `${z}/${x}/${y}`; }

  get(z: number, x: number, y: number) { return this.entries.get(TileStore.key(z, x, y)); }

  forget(key: string) {
    const e = this.entries.get(key);
    if (e && e.state === 'queued') this.entries.delete(key);
  }

  /** Ask for a tile. Cheap to call every frame; also refreshes its priority. */
  want(z: number, x: number, y: number, priority: number) {
    if (z > this.source.maxZoom) return;
    const key = TileStore.key(z, x, y);
    let e = this.entries.get(key);
    const f = scheduler.frame;
    if (!e) {
      e = { key, z, x, y, state: 'queued', priority, lastWanted: f, lastUsed: f };
      this.entries.set(key, e);
      scheduler.enqueue({ store: this as TileStore<unknown>, entry: e as TileEntry<unknown> });
      return;
    }
    e.lastWanted = f;
    e.priority = priority;
    if (e.state === 'error' && e.retryAt && performance.now() > e.retryAt) {
      e.state = 'queued';
      scheduler.enqueue({ store: this as TileStore<unknown>, entry: e as TileEntry<unknown> });
    }
  }

  async run(entry: TileEntry<T>) {
    entry.state = 'loading';
    entry.abort = new AbortController();
    const { z, x, y } = entry;
    try {
      const res = await fetch(this.source.url(z, x, y), { signal: entry.abort.signal, mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      entry.value = await this.decode(blob, entry);
      entry.state = 'ready';
    } catch (err) {
      entry.state = 'error';
      // Ocean tiles 404 on some servers; ancestors cover them, so back off quietly.
      entry.retryAt = performance.now() + 15000;
      if ((err as Error).name === 'AbortError') this.entries.delete(entry.key);
    } finally {
      entry.abort = undefined;
    }
  }

  /**
   * The deepest ready tile at or above (z,x,y), with the uv transform that maps
   * the requested tile's [0,1]² into it. Lets a tile render with its parent's
   * pixels while its own are still on the way.
   */
  best(z: number, x: number, y: number): { entry: TileEntry<T>; ox: number; oy: number; s: number } | null {
    let dz = 0;
    if (z > this.source.maxZoom) dz = z - this.source.maxZoom;
    for (; dz <= z; dz++) {
      const az = z - dz, ax = x >> dz, ay = y >> dz;
      const e = this.entries.get(TileStore.key(az, ax, ay));
      if (e && e.state === 'ready') {
        e.lastUsed = scheduler.frame;
        const n = 1 << dz;
        return { entry: e, ox: (x - ax * n) / n, oy: (y - ay * n) / n, s: 1 / n };
      }
    }
    return null;
  }

  /** Drop the least recently used ready tiles above the limit. */
  evict() {
    if (this.entries.size <= this.limit) return;
    const f = scheduler.frame;
    const ready = [...this.entries.values()]
      .filter((e) => (e.state === 'ready' || e.state === 'error') && f - e.lastUsed > 3 && e.z > 2)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    let excess = this.entries.size - this.limit;
    for (const e of ready) {
      if (excess-- <= 0) break;
      if (e.value) this.release(e.value);
      this.entries.delete(e.key);
    }
    for (const e of this.entries.values()) {
      if (e.state === 'loading' && f - e.lastWanted > 90) e.abort?.abort();
    }
  }

  clear() {
    for (const e of this.entries.values()) {
      e.abort?.abort();
      if (e.value) this.release(e.value);
    }
    this.entries.clear();
  }
}

// Decoders ----------------------------------------------------------------

export function imageryStore(source: RasterSource, anisotropy: number) {
  return new TileStore<THREE.Texture>(
    source,
    async (blob) => {
      const bmp = await createImageBitmap(blob);
      const tex = new THREE.Texture(bmp);
      tex.flipY = false; // ImageBitmap ignores flipY; row 0 is north, matching tile v=0
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = anisotropy;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.needsUpdate = true;
      return tex;
    },
    (tex) => { tex.dispose(); (tex.image as ImageBitmap | undefined)?.close?.(); },
    700,
  );
}

export type Elevation = { data: Float32Array; tex: THREE.DataTexture };
export const ELEV_RES = 256;

let decodeCanvas: OffscreenCanvas | null = null;

export function elevationStore(source: RasterSource, linear: boolean) {
  return new TileStore<Elevation>(
    source,
    async (blob) => {
      // colorSpaceConversion/premultiply off: the RGB bytes are an encoded number, not a colour.
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      decodeCanvas ??= new OffscreenCanvas(ELEV_RES, ELEV_RES);
      const ctx = decodeCanvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, ELEV_RES, ELEV_RES);
      ctx.drawImage(bmp, 0, 0, ELEV_RES, ELEV_RES);
      bmp.close();
      const px = ctx.getImageData(0, 0, ELEV_RES, ELEV_RES).data;
      const data = new Float32Array(ELEV_RES * ELEV_RES);
      for (let i = 0, j = 0; i < data.length; i++, j += 4) {
        // Sea floor is clamped to sea level: the imagery shows water there and a
        // 4 km deep trench under it would only produce artefacts at the coast.
        data[i] = Math.max(0, px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768);
      }
      const tex = new THREE.DataTexture(data, ELEV_RES, ELEV_RES, THREE.RedFormat, THREE.FloatType);
      tex.minFilter = tex.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return { data, tex };
    },
    (v) => v.tex.dispose(),
    900,
  );
}
