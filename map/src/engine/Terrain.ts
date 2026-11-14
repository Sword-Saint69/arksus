// Quadtree terrain: picks which Web Mercator tiles to draw each frame, binds
// imagery/elevation/label/overlay textures to them, and answers height queries
// from the same elevation data the GPU uses (so picking matches what you see).

import * as THREE from 'three';
import { BASEMAPS, LABELS, TERRAIN, type RasterSource } from '../sources';
import { HALF, WORLD, mercScale, mercToScene, mercToTile, tileBBox, tileSize, sceneToMerc } from '../geo';
import { ELEV_RES, elevationStore, imageryStore, scheduler, type Elevation, type TileStore } from './TileStore';
import { createSharedUniforms, createTileGeometry, createTileMaterial, type SharedUniforms } from './terrainMaterial';
import type { OverlayManager } from './Overlay';

export const MAX_Z = 19;
/** Highest real relief anywhere on the map we draw (Everest), used for culling bounds. */
const MAX_RELIEF_M = 8900;

type TileMesh = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; lastFrame: number };

export type RenderTile = { z: number; x: number; y: number; key: string; dist: number };

export class Terrain {
  readonly group = new THREE.Group();
  readonly shared: SharedUniforms = createSharedUniforms();
  imagery: TileStore<THREE.Texture>;
  readonly labels: TileStore<THREE.Texture>;
  readonly elevation: TileStore<Elevation>;
  overlay: OverlayManager | null = null;
  lodPx = 300;
  /** Tiles drawn last frame, for the overlay and loading UI. */
  rendered: RenderTile[] = [];

  private geometry = createTileGeometry(48);
  private meshes = new Map<string, TileMesh>();
  private pool: TileMesh[] = [];
  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  private box = new THREE.Box3();
  private v = new THREE.Vector3();
  private blankColor: THREE.DataTexture;
  private blankElev: THREE.DataTexture;
  private anisotropy: number;

  constructor(renderer: THREE.WebGLRenderer, basemap: RasterSource = BASEMAPS[0]) {
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const linearFloat = renderer.extensions.has('OES_texture_float_linear');
    this.imagery = imageryStore(basemap, this.anisotropy);
    this.labels = imageryStore(LABELS, this.anisotropy);
    this.elevation = elevationStore(TERRAIN, linearFloat);
    this.blankColor = new THREE.DataTexture(new Uint8Array([14, 22, 32, 255]), 1, 1);
    this.blankColor.needsUpdate = true;
    this.blankElev = new THREE.DataTexture(new Float32Array([0]), 1, 1, THREE.RedFormat, THREE.FloatType);
    this.blankElev.needsUpdate = true;
  }

  setBasemap(source: RasterSource) {
    if (source.id === this.imagery.source.id) return;
    const old = this.imagery;
    this.imagery = imageryStore(source, this.anisotropy);
    // Keep the old textures bound until the new low zooms arrive, then free them.
    setTimeout(() => old.clear(), 4000);
    this.oldImagery = old;
  }
  private oldImagery: TileStore<THREE.Texture> | null = null;

  update(camera: THREE.PerspectiveCamera, viewportH: number) {
    const frame = scheduler.frame;
    camera.updateMatrixWorld();
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const proj = viewportH / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const cam = camera.position;
    const exag = this.shared.uExaggeration.value;
    const out: RenderTile[] = [];

    const visit = (z: number, x: number, y: number) => {
      const b = tileBBox(z, x, y);
      const k = mercScale(Math.min(Math.abs(b.minY), Math.abs(b.maxY))) * exag;
      const minS = mercToScene(b.minX, b.maxY);
      this.box.min.set(minS.x, 0, minS.z);
      this.box.max.set(minS.x + (b.maxX - b.minX), MAX_RELIEF_M * Math.min(k, 6), minS.z + (b.maxY - b.minY));
      if (z > 1 && !this.frustum.intersectsBox(this.box)) return;
      // Distance for LOD is measured to a flat box at the tile's own ground
      // height. Using the tall culling box here put the camera "inside" every
      // nearby tile and split them all down to z19.
      if (z >= 6) {
        const g = this.heightM((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2) * k;
        this.box.min.y = this.box.max.y = g;
      } else this.box.min.y = this.box.max.y = 0;
      const dist = Math.max(1, this.box.distanceToPoint(cam));
      const screen = (tileSize(z) / dist) * proj;
      if (z < MAX_Z && screen > this.lodPx) {
        const cz = z + 1, cx = x * 2, cy = y * 2;
        visit(cz, cx, cy); visit(cz, cx + 1, cy); visit(cz, cx, cy + 1); visit(cz, cx + 1, cy + 1);
        return;
      }
      out.push({ z, x, y, key: `${z}/${x}/${y}`, dist });
    };
    visit(0, 0, 0);
    this.rendered = out;

    for (const t of out) this.bind(t, frame);

    for (const [key, tm] of this.meshes) {
      if (tm.lastFrame !== frame) {
        tm.mesh.visible = false;
        if (frame - tm.lastFrame > 30) {
          this.meshes.delete(key);
          this.pool.push(tm);
        }
      }
    }
    this.imagery.evict();
    this.labels.evict();
    this.elevation.evict();
    this.oldImagery?.evict();
  }

  private bind(t: RenderTile, frame: number) {
    const { z, x, y } = t;
    // Lower zoom first so the whole view gets coarse coverage before any detail.
    const pri = z * 10 + Math.min(9, t.dist / tileSize(z));
    const iz = Math.min(z, this.imagery.source.maxZoom);
    this.imagery.want(iz, x >> (z - iz), y >> (z - iz), pri);
    const ez = Math.min(z, TERRAIN.maxZoom);
    this.elevation.want(ez, x >> (z - ez), y >> (z - ez), pri + 0.5);
    // Also pull a coarse ancestor: it is what the tile shows while its own data
    // loads, and a jump straight to a deep zoom would otherwise have nothing.
    const ai = Math.max(0, iz - 4), ae = Math.max(0, ez - 4);
    this.imagery.want(ai, x >> (z - ai), y >> (z - ai), ai * 10);
    this.elevation.want(ae, x >> (z - ae), y >> (z - ae), ae * 10 + 0.5);
    const labelsOn = this.shared.uLabelsOn.value > 0.5;
    if (labelsOn) {
      const lz = Math.min(z, LABELS.maxZoom);
      this.labels.want(lz, x >> (z - lz), y >> (z - lz), pri + 1);
    }

    const img = this.imagery.best(z, x, y) ?? this.oldImagery?.best(z, x, y) ?? null;
    if (!img) return;
    const elev = this.elevation.best(z, x, y);

    let tm = this.meshes.get(t.key);
    if (!tm) {
      tm = this.pool.pop() ?? this.createMesh();
      this.meshes.set(t.key, tm);
      const b = tileBBox(z, x, y);
      const s = mercToScene(b.minX, b.maxY);
      tm.mesh.position.set(s.x, 0, s.z);
      const size = tileSize(z);
      tm.mat.uniforms.uSize.value = size;
      tm.mat.uniforms.uMercScale.value = mercScale((b.minY + b.maxY) / 2);
      tm.mat.uniforms.uSkirt.value = Math.max(size * 0.02, 5);
      tm.mesh.renderOrder = z;
    }
    tm.lastFrame = frame;
    tm.mesh.visible = true;
    const u = tm.mat.uniforms;
    u.uImg.value = img.entry.value;
    u.uImgT.value.set(img.ox, img.oy, img.s);
    if (elev) {
      u.uElev.value = elev.entry.value!.tex;
      u.uElevT.value.set(elev.ox, elev.oy, elev.s);
    } else {
      u.uElev.value = this.blankElev;
      u.uElevT.value.set(0, 0, 1);
    }
    const lab = labelsOn ? this.labels.best(z, x, y) : null;
    // Labels drawn from a much coarser ancestor are blurry blobs; skip until close.
    if (lab && lab.s >= 1 / 4) {
      u.uLab.value = lab.entry.value;
      u.uLabT.value.set(lab.ox, lab.oy, lab.s);
      u.uLabOn.value = 1;
    } else u.uLabOn.value = 0;

    const over = this.overlay?.textureFor(z, x, y) ?? null;
    if (over) { u.uOver.value = over; u.uOverOn.value = 1; } else u.uOverOn.value = 0;
  }

  private createMesh(): TileMesh {
    const mat = createTileMaterial(this.shared, this.blankColor);
    mat.uniforms.uElev.value = this.blankElev;
    const mesh = new THREE.Mesh(this.geometry, mat);
    // Positions are tile-local uv, so three's bounding sphere is meaningless;
    // the quadtree already did the culling.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = true;
    this.group.add(mesh);
    return { mesh, mat, lastFrame: -1 };
  }

  // Height queries ---------------------------------------------------------

  /** Ground height in metres at a mercator point, bilinear like the GPU sampler. */
  heightM(mx: number, my: number): number {
    if (Math.abs(mx) > HALF || Math.abs(my) > HALF) return 0;
    for (let z = TERRAIN.maxZoom; z >= 0; z--) {
      const [tx, ty] = mercToTile(z, mx, my);
      const e = this.elevation.get(z, tx, ty);
      if (!e || e.state !== 'ready') continue;
      const s = tileSize(z);
      const u = (mx - (-HALF + tx * s)) / s;
      const v = (HALF - ty * s - my) / s;
      const fx = Math.min(ELEV_RES - 1, Math.max(0, u * ELEV_RES - 0.5));
      const fy = Math.min(ELEV_RES - 1, Math.max(0, v * ELEV_RES - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(ELEV_RES - 1, x0 + 1), y1 = Math.min(ELEV_RES - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      const d = e.value!.data;
      const h0 = d[y0 * ELEV_RES + x0] * (1 - ax) + d[y0 * ELEV_RES + x1] * ax;
      const h1 = d[y1 * ELEV_RES + x0] * (1 - ax) + d[y1 * ELEV_RES + x1] * ax;
      return h0 * (1 - ay) + h1 * ay;
    }
    return 0;
  }

  /** Height in scene units (exaggerated, mercator-stretched) under a scene point. */
  sceneHeight(sx: number, sz: number): number {
    const m = sceneToMerc(sx, sz);
    return this.heightM(m.x, m.y) * mercScale(m.y) * this.shared.uExaggeration.value;
  }

  /** March a ray against the terrain; returns the hit in scene space or null. */
  raycast(ray: THREE.Ray, out = new THREE.Vector3()): THREE.Vector3 | null {
    const o = ray.origin, d = ray.direction;
    if (d.y > -1e-4) return null;
    const exag = this.shared.uExaggeration.value;
    const topY = 9000 * exag * 1.6;
    const t0 = Math.max(0, (o.y - topY) / -d.y);
    const t1 = o.y / -d.y + 1;
    const steps = 160;
    let prevT = t0;
    for (let i = 1; i <= steps; i++) {
      // Quadratic spacing: dense near the camera where precision matters.
      const f = i / steps;
      const t = t0 + (t1 - t0) * f * f;
      this.v.copy(d).multiplyScalar(t).add(o);
      if (this.v.y <= this.sceneHeight(this.v.x, this.v.z)) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 18; k++) {
          const mid = (lo + hi) / 2;
          this.v.copy(d).multiplyScalar(mid).add(o);
          if (this.v.y <= this.sceneHeight(this.v.x, this.v.z)) hi = mid; else lo = mid;
        }
        return out.copy(d).multiplyScalar(hi).add(o);
      }
      prevT = t;
    }
    return null;
  }

  get pending() { return scheduler.pending; }
  get worldSize() { return WORLD; }
}
