// Map-style camera: a ground target, a distance, a heading and a pitch.
//
// OrbitControls was the obvious choice, but its pan and zoom-to-cursor work on
// a plane through the target, and on the Konya plateau that plane is a
// kilometre below the ground you are pointing at. Here every drag and zoom is
// anchored to the terrain point under the cursor instead.

import * as THREE from 'three';
import type { Terrain } from './Terrain';
import { WORLD, lonLatToMerc, mercToLonLat, mercToScene, sceneToMerc, type BBox } from '../geo';

const MIN_DIST = 120;
const MAX_DIST = 2.6e7;
const MAX_PITCH = THREE.MathUtils.degToRad(72);

type Fly = {
  from: { x: number; z: number; d: number; h: number; p: number };
  to: { x: number; z: number; d: number; h: number; p: number };
  t: number; dur: number; arc: number;
};

export class MapCamera {
  readonly camera: THREE.PerspectiveCamera;
  target = new THREE.Vector3();
  distance = 2.2e7;
  heading = 0;
  pitch = 0;
  onChange: () => void = () => {};
  /** False while another tool (area drawing) owns the pointer. */
  enabled = true;
  /** Farthest the camera may pull back. */
  maxDistance = MAX_DIST;
  /** Scene-space box the view centre must stay in (the map is limited to one country). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;

  private goalDist = this.distance;
  private zoomAnchor: THREE.Vector3 | null = null;
  private targetY = 0;
  private fly: Fly | null = null;
  private velocity = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { mode: 'pan' | 'rotate'; anchor: THREE.Vector3; lastX: number; lastY: number; lastT: number } | null = null;
  private pinch: { dist: number; angle: number; midY: number } | null = null;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  movedSincePointerDown = 0;

  constructor(private readonly dom: HTMLElement, private readonly terrain: Terrain) {
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 1e9);
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Approximate slippy-map zoom level at the view centre (for LOD-gated layers). */
  get zoom(): number {
    const h = this.dom.clientHeight || 800;
    const mpp = (2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / h;
    return Math.log2(WORLD / (256 * mpp));
  }

  get maxPitch() {
    // From orbit the flat world plane would show its edge; flatten out with altitude.
    const t = THREE.MathUtils.clamp((Math.log10(this.distance) - 5.3) / (6.8 - 5.3), 0, 1);
    return MAX_PITCH * (1 - t);
  }

  setSize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Pointer input ------------------------------------------------------------

  private ndc(x: number, y: number) {
    const r = this.dom.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  /** Terrain point under a client position; falls back to the target's height plane. */
  groundAt(clientX: number, clientY: number, planeY = this.target.y): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hit = this.terrain.raycast(this.raycaster.ray);
    if (hit) return hit;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    return this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }

  private planeAt(clientX: number, clientY: number, y: number) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.fly = null;
    this.zoomAnchor = null;
    this.goalDist = this.distance;
    this.velocity.set(0, 0);
    this.movedSincePointerDown = 0;
    if (this.pointers.size === 2) {
      this.drag = null;
      this.pinch = this.pinchState();
      return;
    }
    const rotate = e.button === 2 || e.button === 1 || e.ctrlKey || e.altKey;
    const anchor = this.groundAt(e.clientX, e.clientY) ?? this.target.clone();
    this.drag = { mode: rotate ? 'rotate' : 'pan', anchor, lastX: e.clientX, lastY: e.clientY, lastT: performance.now() };
  };

  private pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 };
  }

  private onMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId)!;
    this.movedSincePointerDown += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pinch && this.pointers.size === 2) {
      const now = this.pinchState();
      const [a, b] = [...this.pointers.values()];
      const mid = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2);
      this.zoomBy(this.pinch.dist / Math.max(1, now.dist), mid, true);
      this.heading -= now.angle - this.pinch.angle;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (now.midY - this.pinch.midY) * 0.004, 0, this.maxPitch);
      this.pinch = now;
      this.apply();
      return;
    }
    const d = this.drag;
    if (!d) return;
    if (d.mode === 'pan') {
      // Keep the grabbed ground point under the cursor.
      const p = this.planeAt(e.clientX, e.clientY, d.anchor.y);
      if (p) {
        const dx = d.anchor.x - p.x, dz = d.anchor.z - p.z;
        this.target.x += dx;
        this.target.z += dz;
        const now = performance.now();
        const dt = Math.max(1, now - d.lastT);
        this.velocity.set(dx / dt, dz / dt);
        d.lastT = now;
      }
    } else {
      this.heading += (e.clientX - d.lastX) * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - d.lastY) * 0.005, 0, this.maxPitch);
    }
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    this.apply();
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.drag?.mode === 'pan' && performance.now() - this.drag.lastT > 60) this.velocity.set(0, 0);
    if (this.pointers.size === 0) this.drag = null;
    else if (this.pointers.size === 1) {
      const [p] = [...this.pointers.values()];
      const anchor = this.groundAt(p.x, p.y) ?? this.target.clone();
      this.drag = { mode: 'pan', anchor, lastX: p.x, lastY: p.y, lastT: performance.now() };
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.fly = null;
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    const f = Math.exp(THREE.MathUtils.clamp(delta, -300, 300) * 0.0022);
    this.zoomBy(f, this.groundAt(e.clientX, e.clientY), false);
  };

  /** Zoom by factor f toward a ground anchor; smooth unless immediate. */
  zoomBy(f: number, anchor: THREE.Vector3 | null, immediate: boolean) {
    this.goalDist = THREE.MathUtils.clamp(this.goalDist * f, MIN_DIST, this.maxDistance);
    this.zoomAnchor = anchor;
    if (immediate) this.stepZoom(1);
  }

  private stepZoom(k: number) {
    const nd = this.distance + (this.goalDist - this.distance) * k;
    if (Math.abs(nd - this.distance) < 0.01) return false;
    const f = nd / this.distance;
    if (this.zoomAnchor) {
      this.target.x = this.zoomAnchor.x + (this.target.x - this.zoomAnchor.x) * f;
      this.target.z = this.zoomAnchor.z + (this.target.z - this.zoomAnchor.z) * f;
    }
    this.distance = nd;
    return true;
  }

  // Programmatic moves --------------------------------------------------------

  flyTo(lon: number, lat: number, opts: { distance?: number; heading?: number; pitch?: number; duration?: number } = {}) {
    const m = lonLatToMerc(lon, lat);
    const s = mercToScene(m.x, m.y);
    const to = {
      x: s.x, z: s.z,
      d: THREE.MathUtils.clamp(opts.distance ?? this.distance, MIN_DIST, this.maxDistance),
      h: opts.heading ?? this.heading,
      p: opts.pitch ?? this.pitch,
    };
    const from = { x: this.target.x, z: this.target.z, d: this.distance, h: this.heading, p: this.pitch };
    // Unwrap heading so we turn the short way round.
    while (to.h - from.h > Math.PI) to.h -= Math.PI * 2;
    while (to.h - from.h < -Math.PI) to.h += Math.PI * 2;
    const travel = Math.hypot(to.x - from.x, to.z - from.z);
    // Rise to see both ends when the hop is long relative to the current view.
    const arc = Math.max(0, Math.log2(travel / Math.max(from.d, to.d) + 1) - 0.4);
    const dur = this.reduceMotion ? 0 : opts.duration ?? THREE.MathUtils.clamp(900 + arc * 450, 900, 3200);
    this.goalDist = to.d;
    this.zoomAnchor = null;
    this.velocity.set(0, 0);
    this.fly = { from, to, t: 0, dur, arc };
    if (dur === 0) this.finishFly();
  }

  fitBBox(b: BBox, opts: { pitch?: number; heading?: number; padding?: number } = {}) {
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const w = (b.maxX - b.minX) * (opts.padding ?? 1.35), h = (b.maxY - b.minY) * (opts.padding ?? 1.35);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const d = Math.max(h / (2 * Math.tan(vFov / 2)), w / (2 * Math.tan(hFov / 2)));
    const [lon, lat] = mercToLonLat(cx, cy);
    this.flyTo(lon, lat, { distance: Math.max(d, 350), pitch: opts.pitch, heading: opts.heading });
  }

  private finishFly() {
    const f = this.fly!;
    this.target.x = f.to.x; this.target.z = f.to.z;
    this.distance = this.goalDist = f.to.d;
    this.heading = f.to.h; this.pitch = f.to.p;
    this.fly = null;
  }

  // Per-frame ------------------------------------------------------------------

  /** Advance animation; returns true if anything moved. */
  update(dt: number): boolean {
    let moved = false;
    if (this.fly) {
      const f = this.fly;
      f.t += dt * 1000;
      const u = Math.min(1, f.t / f.dur);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.target.x = f.from.x + (f.to.x - f.from.x) * e;
      this.target.z = f.from.z + (f.to.z - f.from.z) * e;
      const ld = Math.log(f.from.d) + (Math.log(f.to.d) - Math.log(f.from.d)) * e + f.arc * Math.sin(Math.PI * u) * 0.9;
      this.distance = Math.exp(ld);
      this.heading = f.from.h + (f.to.h - f.from.h) * e;
      this.pitch = f.from.p + (f.to.p - f.from.p) * e;
      if (u >= 1) this.finishFly();
      moved = true;
    } else {
      if (this.stepZoom(1 - Math.exp(-dt * 14))) moved = true;
      if (!this.drag && this.velocity.lengthSq() > 1e-8) {
        // Pan inertia, scaled so a flick travels about the same screen distance at any zoom.
        this.target.x += this.velocity.x * dt * 1000;
        this.target.z += this.velocity.y * dt * 1000;
        this.velocity.multiplyScalar(Math.exp(-dt * 5));
        if (this.velocity.length() * 1000 < this.distance * 0.002) this.velocity.set(0, 0);
        moved = true;
      }
    }
    this.pitch = Math.min(this.pitch, this.maxPitch);
    this.apply();
    if (moved) this.onChange();
    return moved;
  }

  apply() {
    if (this.bounds) {
      this.target.x = THREE.MathUtils.clamp(this.target.x, this.bounds.minX, this.bounds.maxX);
      this.target.z = THREE.MathUtils.clamp(this.target.z, this.bounds.minZ, this.bounds.maxZ);
    }
    // Follow the ground smoothly so the view does not jump as better elevation loads.
    const ground = this.terrain.sceneHeight(this.target.x, this.target.z);
    this.targetY += (ground - this.targetY) * 0.2;
    this.target.y = this.targetY;
    const f = new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading));
    const c = this.camera;
    c.position.copy(this.target)
      .addScaledVector(f, -this.distance * Math.sin(this.pitch))
      .add(new THREE.Vector3(0, this.distance * Math.cos(this.pitch), 0));
    // Never sink into a ridge behind the target.
    const under = this.terrain.sceneHeight(c.position.x, c.position.z) + 40;
    if (c.position.y < under) c.position.y = under;
    c.up.copy(f);
    c.lookAt(this.target);
    // A near plane proportional to altitude keeps log-depth precision where it is needed.
    const alt = Math.max(10, c.position.y - this.terrain.sceneHeight(c.position.x, c.position.z));
    c.near = Math.max(0.5, alt * 0.05);
    c.far = Math.max(1e6, this.distance * 60);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  /** Lon/lat at the view centre. */
  get center(): [number, number] {
    const m = sceneToMerc(this.target.x, this.target.z);
    return mercToLonLat(m.x, m.y);
  }

  resetNorth() {
    const [lon, lat] = this.center;
    this.flyTo(lon, lat, { heading: 0, duration: 600 });
  }

  togglePitch() {
    const [lon, lat] = this.center;
    this.flyTo(lon, lat, { pitch: this.pitch > 0.1 ? 0 : Math.min(THREE.MathUtils.degToRad(58), this.maxPitch), duration: 700 });
  }

  /** Keyboard nudges: pan by a fraction of the view, zoom by a factor. */
  nudge(dx: number, dz: number) {
    const f = new THREE.Vector3(Math.sin(this.heading), 0, -Math.cos(this.heading));
    const r = new THREE.Vector3(Math.cos(this.heading), 0, Math.sin(this.heading));
    const step = this.distance * 0.25;
    this.target.addScaledVector(r, dx * step).addScaledVector(f, dz * step);
    this.apply();
    this.onChange();
  }
}

