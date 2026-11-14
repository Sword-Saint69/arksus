// Process simulation: plays one 24-month sequence of the engine's weekly water
// ledger for the three rotations side by side.
//
// Everything that moves is driven by the ledger (ARAYUZLER §8, ledger/{id}.json):
// the water level is aw_mm over the root zone's capacity, rain / evaporation /
// drainage particles scale with p_mm / eta_mm / dp_mm, and crops appear only in
// the weeks the ledger says they are in the field. The plant heights and colours
// are illustrative (the engine models water, not canopy size); the panel says so.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DepthId, LedgerFile, LedgerSeries, ResultsFile, RotationId, SiteIndex } from '../../../web/src/lib/types';
import { t, tx, getLang, type Key } from '../strings';
import { fmtNum } from '../ui/format';

export type SimInput = {
  site: SiteIndex;
  locationName: string;
  results: ResultsFile;      // baseline: soil AWC and the median-year choice
  ledger: LedgerFile;
  depth: DepthId;
  showBaselineNote: boolean;
};

const COLOR: Record<RotationId, string> = {
  fallow_wheat: '#94541f',
  chickpea_wheat: '#b8860b',
  lentil_wheat: '#127fa8',
};
const PLOT_W = 2.2, PLOT_D = 1.7, SOIL_H = 1.25, GAP = 1.5, BLADES = 220;
const SECONDS_PER_WEEK = 0.32;

type Plot = {
  rotationId: RotationId;
  series: LedgerSeries;
  group: THREE.Group;
  water: THREE.Mesh;
  surface: THREE.Mesh;
  blades: THREE.InstancedMesh;
  bladeBase: { x: number; z: number; s: number; tilt: number }[];
  growth: number[];        // 0–1 per week while a crop is in the field, -1 for stubble, 0 otherwise
  label: HTMLElement;
  totals: { p: number[]; et: number[]; dp: number[] };   // cumulative mm per week
};

/** Pick the start year whose fallow → wheat yield is the median one (Chart B's default, PLAN_MVP §6). */
function medianYear(results: ResultsFile, depth: DepthId): number {
  const rows = results.sequences.filter((s) => s.rotation_id === 'fallow_wheat' && s.depth_id === depth)
    .sort((a, b) => a.wheat.yield_ratio - b.wheat.yield_ratio);
  return rows[Math.floor((rows.length - 1) / 2)]?.start_year ?? results.sequences[0].start_year;
}

/** Growth stage per week: ramps up across each contiguous crop run, then stubble after harvest. */
function growthCurve(series: LedgerSeries): number[] {
  const w = series.weeks;
  const out = new Array<number>(w.length).fill(0);
  let i = 0;
  while (i < w.length) {
    const crop = w[i].crop;
    let j = i;
    while (j < w.length && w[j].crop === crop) j++;
    if (crop === 'wheat' || crop === 'chickpea' || crop === 'lentil') {
      // A run that starts at week 0 is the spin-up wheat still standing in July: show it ripe.
      const len = j - i;
      for (let k = i; k < j; k++) out[k] = i === 0 ? 1 : Math.min(1, ((k - i + 1) / len) ** 0.8);
      for (let k = j; k < w.length && w[k].crop === 'bare'; k++) out[k] = -1; // stubble
    }
    i = j;
  }
  return out;
}

export class ProcessSim {
  private root: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private controls: OrbitControls;
  private plots: Plot[] = [];
  private week = 0;
  private playing = true;
  private speed = 1;
  private raf = 0;
  private last = performance.now();
  private rain: THREE.Points;
  private vapor: THREE.Points;
  private drain: THREE.Points;
  private particles = { rain: [] as P[], vapor: [] as P[], drain: [] as P[] };
  private ro: ResizeObserver;
  private taw: number;
  private year: number;
  private ui: { slider: HTMLInputElement; date: HTMLElement; play: HTMLButtonElement; year: HTMLSelectElement };
  private dummy = new THREE.Object3D();
  private colors = { green: new THREE.Color('#5f8f3a'), gold: new THREE.Color('#d6aa3c'), legume: new THREE.Color('#4f8a3c'), stubble: new THREE.Color('#c9b07a') };

  constructor(host: HTMLElement, private readonly input: SimInput, private readonly onClose: () => void) {
    const depthM = input.site.depth_classes.find((d) => d.id === input.depth)?.depth_m ?? 0.9;
    // Root-zone capacity the engine works with: AWC (mm/m) × depth class (m).
    this.taw = (input.results.soil.awc_mm_per_m.value ?? 150) * depthM;
    this.year = medianYear(input.results, input.depth);

    this.root = document.createElement('section');
    this.root.className = 'sim';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'sim-title');
    this.root.innerHTML = this.chrome();
    host.append(this.root);

    const canvas = this.root.querySelector<HTMLCanvasElement>('canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color('#efece3');
    this.scene.fog = new THREE.Fog('#efece3', 14, 30);

    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#8a7a62', 1.6));
    const sun = new THREE.DirectionalLight('#fff3d6', 2.2);
    sun.position.set(-4, 7, 5);
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshLambertMaterial({ color: '#d9d1bd' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -SOIL_H - 0.002;
    this.scene.add(ground);

    this.camera.position.set(0.5, 2.6, 7.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, -0.35, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.48;

    this.rain = this.makePoints('#3d7ea6', 0.06, 0.95);
    this.vapor = this.makePoints('#ffffff', 0.09, 0.55);
    this.drain = this.makePoints('#2c6a90', 0.05, 0.9);

    this.ui = {
      slider: this.root.querySelector<HTMLInputElement>('.sim-week')!,
      date: this.root.querySelector<HTMLElement>('.sim-date')!,
      play: this.root.querySelector<HTMLButtonElement>('.sim-play')!,
      year: this.root.querySelector<HTMLSelectElement>('.sim-year')!,
    };
    this.wire();
    this.build();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.setPlaying(false);
    this.raf = requestAnimationFrame(this.loop);
    this.root.querySelector<HTMLButtonElement>('.sim-close')!.focus();
  }

  private chrome() {
    const years = [...new Set(this.input.ledger.series.map((s) => s.start_year))].sort((a, b) => a - b);
    const depthLabel = tx(this.input.site.depth_classes.find((d) => d.id === this.input.depth)?.label);
    return `
      <div class="sim-panel">
        <header class="sim-head">
          <div>
            <h2 id="sim-title">${t('simTitle', { name: this.input.locationName })}</h2>
            <p>${t('simSub', { depth: depthLabel })}${this.input.showBaselineNote ? ` ${t('simBaselineOnly')}` : ''}</p>
          </div>
          <button class="sim-close" aria-label="${t('simClose')}"><svg class="icon"><use href="#i-x"/></svg></button>
        </header>
        <div class="sim-stage">
          <canvas aria-label="${t('simTitle', { name: this.input.locationName })}"></canvas>
          <div class="sim-labels"></div>
          <ul class="sim-legend" aria-hidden="true">
            <li><i style="background:#3d7ea6"></i>${t('simLegendRain')}</li>
            <li><i style="background:#ffffff;border:1px solid #bbb"></i>${t('simLegendEt')}</li>
            <li><i style="background:#2c6a90"></i>${t('simLegendDeep')}</li>
          </ul>
        </div>
        <footer class="sim-bar">
          <button class="btn primary sim-play"></button>
          <label class="sim-yr">${t('simStartYear')}
            <select class="sim-year">${years.map((y) => `<option value="${y}" ${y === this.year ? 'selected' : ''}>${y}–${y + 2}${y === this.year ? ` · ${t('simMedianYear')}` : ''}</option>`).join('')}</select>
          </label>
          <label class="sim-range"><span class="sim-date"></span>
            <input class="sim-week" type="range" min="0" max="103" step="1" value="0" aria-label="${t('simWeek')}" />
          </label>
          <label class="sim-spd">${t('simSpeed')}
            <select class="sim-speed"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select>
          </label>
        </footer>
      </div>`;
  }

  private wire() {
    this.root.querySelector('.sim-close')!.addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
      if (e.key === ' ' && !(e.target as HTMLElement).matches('select, input, button')) { e.preventDefault(); this.setPlaying(!this.playing); }
    });
    this.ui.play.addEventListener('click', () => this.setPlaying(!this.playing));
    this.ui.slider.addEventListener('input', () => { this.week = +this.ui.slider.value; this.clearParticles(); this.apply(); });
    this.ui.year.addEventListener('change', () => { this.year = +this.ui.year.value; this.week = 0; this.build(); });
    this.root.querySelector<HTMLSelectElement>('.sim-speed')!.addEventListener('change', (e) => { this.speed = +(e.target as HTMLSelectElement).value; });
    this.setPlaying(this.playing);
  }

  private setPlaying(on: boolean) {
    this.playing = on;
    this.ui.play.innerHTML = on ? `❚❚ ${t('simPause')}` : `▶ ${t('simPlay')}`;
    if (on && this.week >= 103) this.week = 0;
  }

  private makePoints(color: string, size: number, opacity: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 1500), 3));
    geo.setDrawRange(0, 0);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }

  /** (Re)build the three plots for the current start year. */
  private build() {
    for (const p of this.plots) { this.scene.remove(p.group); p.label.remove(); disposeGroup(p.group); }
    this.plots = [];
    this.clearParticles();
    const labels = this.root.querySelector('.sim-labels')!;
    const rots = this.input.site.rotations;
    const span = rots.length * PLOT_W + (rots.length - 1) * GAP;
    rots.forEach((rot, i) => {
      const series = this.input.ledger.series.find((s) => s.rotation_id === rot.id && s.depth_id === this.input.depth && s.start_year === this.year);
      if (!series) return;
      const group = new THREE.Group();
      group.position.x = -span / 2 + PLOT_W / 2 + i * (PLOT_W + GAP);
      this.scene.add(group);

      // Soil block: see-through, so the water store inside reads at a glance.
      const soil = new THREE.Mesh(
        new THREE.BoxGeometry(PLOT_W, SOIL_H, PLOT_D),
        new THREE.MeshStandardMaterial({ color: '#8b6a48', transparent: true, opacity: 0.38, roughness: 1, depthWrite: false }),
      );
      soil.position.y = -SOIL_H / 2;
      group.add(soil);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(soil.geometry), new THREE.LineBasicMaterial({ color: '#5b4330' }));
      edges.position.copy(soil.position);
      group.add(edges);
      // Water store: its height is aw_mm over the root zone's capacity (top of the block = 100 %).
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(PLOT_W * 0.94, 1, PLOT_D * 0.92),
        new THREE.MeshStandardMaterial({ color: '#3d7ea6', transparent: true, opacity: 0.78, roughness: 0.3 }),
      );
      group.add(water);
      const surface = new THREE.Mesh(new THREE.BoxGeometry(PLOT_W, 0.06, PLOT_D), new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 1 }));
      surface.position.y = 0.03;
      group.add(surface);
      const tag = new THREE.Mesh(new THREE.BoxGeometry(PLOT_W, 0.04, 0.06), new THREE.MeshBasicMaterial({ color: COLOR[rot.id as RotationId] }));
      tag.position.set(0, 0.04, PLOT_D / 2 + 0.03);
      group.add(tag);

      // Plants: thin cones, one instanced mesh per plot.
      const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.025, 1, 5).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), BLADES);
      blades.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BLADES * 3), 3);
      const bladeBase = Array.from({ length: BLADES }, (_, k) => {
        // Deterministic jittered grid (no Math.random), so a replay looks the same.
        const gx = k % 20, gz = Math.floor(k / 20);
        const jx = Math.sin(k * 12.9898) * 0.5, jz = Math.sin(k * 78.233) * 0.5;
        return {
          x: (-PLOT_W / 2 + 0.08) + (gx + 0.5 + jx * 0.6) * ((PLOT_W - 0.16) / 20),
          z: (-PLOT_D / 2 + 0.08) + (gz + 0.5 + jz * 0.6) * ((PLOT_D - 0.16) / 11),
          s: 0.8 + ((k * 37) % 10) / 25,
          tilt: Math.sin(k * 3.7) * 0.18,
        };
      });
      group.add(blades);

      const label = document.createElement('div');
      label.className = 'sim-label';
      label.style.setProperty('--c', COLOR[rot.id as RotationId]);
      labels.append(label);

      const cum = (key: 'p_mm' | 'eta_mm' | 'dp_mm') => {
        let acc = 0;
        return series.weeks.map((w) => (acc += w[key]));
      };
      this.plots.push({
        rotationId: rot.id as RotationId, series, group, water, surface, blades, bladeBase,
        growth: growthCurve(series), label,
        totals: { p: cum('p_mm'), et: cum('eta_mm'), dp: cum('dp_mm') },
      });
      label.dataset.name = tx(rot.label);
    });
    this.apply();
  }

  /** Put every plot in the state of the current week. */
  private apply() {
    const wk = Math.min(103, Math.max(0, Math.floor(this.week)));
    this.ui.slider.value = String(wk);
    const first = this.plots[0]?.series.weeks[wk];
    if (first) {
      const d = new Date(first.week_start);
      const month = new Intl.DateTimeFormat(getLang() === 'tr' ? 'tr-TR' : 'en-GB', { month: 'long', year: 'numeric' }).format(d);
      this.ui.date.textContent = `${month} · ${t('simYear', { n: wk < 52 ? 1 : 2 })}`;
    }
    for (const p of this.plots) {
      const w = p.series.weeks[wk];
      const fill = Math.min(1, Math.max(0, w.aw_mm / this.taw));
      const h = Math.max(0.004, fill * (SOIL_H - 0.04));
      p.water.scale.y = h;
      p.water.position.y = -SOIL_H + 0.02 + h / 2;

      const g = p.growth[wk];
      const crop = w.crop;
      const surfMat = p.surface.material as THREE.MeshStandardMaterial;
      // Tilled fallow is darker and rougher-looking than stubble or a cropped field.
      surfMat.color.set(crop === 'fallow' ? '#5e4430' : g === -1 ? '#a88b5c' : '#7a5a3c');

      const maxH = crop === 'wheat' ? 0.95 : crop === 'chickpea' ? 0.5 : crop === 'lentil' ? 0.38 : 0.12;
      const color = new THREE.Color();
      for (let k = 0; k < BLADES; k++) {
        const b = p.bladeBase[k];
        let height = 0, width = 1;
        if (g > 0) {
          height = maxH * g * b.s;
          width = crop === 'wheat' ? 1 : 2.4;
          if (crop === 'wheat') color.copy(this.colors.green).lerp(this.colors.gold, Math.max(0, (g - 0.65) / 0.35));
          else color.copy(this.colors.legume);
        } else if (g === -1) {
          height = 0.08 * b.s;
          color.copy(this.colors.stubble);
        }
        this.dummy.position.set(b.x, 0.06, b.z);
        this.dummy.rotation.set(b.tilt, 0, b.tilt * 0.6);
        this.dummy.scale.set(width, Math.max(0.0001, height), width);
        this.dummy.updateMatrix();
        p.blades.setMatrixAt(k, this.dummy.matrix);
        p.blades.setColorAt(k, color);
      }
      p.blades.instanceMatrix.needsUpdate = true;
      if (p.blades.instanceColor) p.blades.instanceColor.needsUpdate = true;

      const stage = t(`stage_${crop}` as Key);
      p.label.innerHTML = `
        <b>${p.label.dataset.name}</b>
        <span class="sim-stage-name">${stage}</span>
        <span>${t('simStore')}: <em>${fmtNum(w.aw_mm, 0)} / ${fmtNum(this.taw, 0)} mm</em></span>
        <small>${t('simTotals')}: ${t('simRain')} ${fmtNum(p.totals.p[wk], 0)} · ${t('simEt')} ${fmtNum(p.totals.et[wk], 0)} · ${t('simDeep')} ${fmtNum(p.totals.dp[wk], 0)} mm</small>`;
    }
  }

  private clearParticles() {
    this.particles = { rain: [], vapor: [], drain: [] };
  }

  /** Spawn and move particles; their rate is the week's mm, so a dry month stays still. */
  private stepParticles(dt: number) {
    const wk = Math.min(103, Math.floor(this.week));
    for (const p of this.plots) {
      const w = p.series.weeks[wk];
      const x0 = p.group.position.x;
      const spawn = (list: P[], rate: number, make: () => P) => {
        let n = rate * dt * (this.playing ? this.speed : 0);
        while (n > 0) { if (n >= 1 || Math.random() < n) list.push(make()); n -= 1; }
      };
      const rx = () => x0 + (Math.random() - 0.5) * PLOT_W * 0.95;
      const rz = () => (Math.random() - 0.5) * PLOT_D * 0.9;
      spawn(this.particles.rain, w.p_mm * 9, () => ({ x: rx(), y: 3.2 + Math.random(), z: rz(), vy: -4.2, floor: 0.08 }));
      spawn(this.particles.vapor, w.eta_mm * 7, () => ({ x: rx(), y: 0.1, z: rz(), vy: 0.7 + Math.random() * 0.4, floor: 2.6 }));
      spawn(this.particles.drain, w.dp_mm * 12, () => ({ x: rx(), y: -SOIL_H, z: rz(), vy: -0.8, floor: -SOIL_H - 1.1 }));
    }
    const move = (list: P[], down: boolean) => list.filter((q) => {
      q.y += q.vy * dt;
      return down ? q.y > q.floor : q.y < q.floor;
    });
    this.particles.rain = move(this.particles.rain, true).slice(-1500);
    this.particles.vapor = move(this.particles.vapor, false).slice(-1500);
    this.particles.drain = move(this.particles.drain, true).slice(-1500);
    write(this.rain, this.particles.rain);
    write(this.vapor, this.particles.vapor);
    write(this.drain, this.particles.drain);
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.playing) {
      const prev = Math.floor(this.week);
      this.week += (dt * this.speed) / SECONDS_PER_WEEK;
      if (this.week >= 103.99) { this.week = 103; this.setPlaying(false); }
      if (Math.floor(this.week) !== prev) this.apply();
    }
    this.stepParticles(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  private placeLabels() {
    const c = this.renderer.domElement;
    const v = new THREE.Vector3();
    for (const p of this.plots) {
      v.set(p.group.position.x, 1.05, -PLOT_D / 2).project(this.camera);
      p.label.style.transform = `translate(${((v.x + 1) / 2) * c.clientWidth}px, ${((1 - v.y) / 2) * c.clientHeight}px) translate(-50%, -100%)`;
    }
  }

  private resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = 36;
    this.camera.updateProjectionMatrix();
    // Fit all three plots (and their labels) to whatever shape the panel has:
    // keep the viewing direction, move along it until the row fits both ways.
    const n = this.input.site.rotations.length;
    const span = n * PLOT_W + (n - 1) * GAP + 0.8;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const dist = Math.max((span / 2) / Math.tan(hHalf), (SOIL_H + 2.2) / 2 / Math.tan(vHalf)) * 1.08;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, dist);
    this.controls.maxDistance = Math.max(16, dist * 1.6);
  }

  close() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    for (const p of this.plots) disposeGroup(p.group);
    for (const pts of [this.rain, this.vapor, this.drain]) { pts.geometry.dispose(); (pts.material as THREE.Material).dispose(); }
    this.renderer.dispose();
    this.root.remove();
    this.onClose();
  }
}

type P = { x: number; y: number; z: number; vy: number; floor: number };

function write(points: THREE.Points, list: P[]) {
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const a = attr.array as Float32Array;
  for (let i = 0; i < list.length; i++) { a[i * 3] = list[i].x; a[i * 3 + 1] = list[i].y; a[i * 3 + 2] = list[i].z; }
  attr.needsUpdate = true;
  points.geometry.setDrawRange(0, list.length);
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}
