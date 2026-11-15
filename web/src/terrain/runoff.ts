// ---------------------------------------------------------------------------
// Runoff: cell-to-cell routing at Manning velocity on the DEM grid.
//
// A frictionless "virtual pipes" scheme was tried first: on a 5 % slope it moved
// water ~40 m/s and piled 30 cm into single cells within a minute. Here each
// wet cell sends water only to lower neighbours, at the sheet-flow speed
// Manning's equation gives for its depth and steepest slope (n = 0.05, a
// typical value for cultivated soil; an assumption), never more than would
// level the two heads. That keeps flows at realistic cm/s–m/s speeds and stays
// stable with steps of several seconds.

export const MANNING_N = 0.05;

export class Runoff {
  W: Float32Array;                 // water depth, m
  private dW: Float32Array;
  private Hout: Float32Array;      // ground level just outside each edge cell (extrapolated)
  rained = 0; infiltrated = 0; outflow = 0; // m³
  time = 0;                        // s

  constructor(readonly H: Float32Array, readonly nx: number, readonly ny: number, readonly l: number) {
    const n = nx * ny;
    this.W = new Float32Array(n);
    this.dW = new Float32Array(n);
    // Outside the box the slope continues as it was at the edge: water leaves
    // where the land falls away and is held where it rises.
    this.Hout = new Float32Array(n).fill(Infinity);
    const set = (c: number, inner: number) => { this.Hout[c] = Math.min(this.Hout[c], 2 * H[c] - H[inner]); };
    for (let i = 0; i < nx; i++) { set(i, i + nx); set((ny - 1) * nx + i, (ny - 2) * nx + i); }
    for (let j = 0; j < ny; j++) { set(j * nx, j * nx + 1); set(j * nx + nx - 1, j * nx + nx - 2); }
  }

  reset() {
    this.W.fill(0);
    this.rained = this.infiltrated = this.outflow = this.time = 0;
  }

  get stored() { let s = 0; for (const w of this.W) s += w; return s * this.l * this.l; }

  /** Advance dt seconds with a rain rate and an infiltration capacity, both in m/s. */
  step(dt: number, rain: number, infil: number) {
    const { H, W, dW, nx, ny, l, Hout } = this;
    const A = l * l;
    const n = nx * ny;
    // Rain in, infiltration out.
    for (let c = 0; c < n; c++) {
      const w = W[c] + rain * dt;
      const soak = Math.min(w, infil * dt);
      this.infiltrated += soak * A;
      W[c] = w - soak;
    }
    this.rained += rain * dt * n * A;
    dW.fill(0);
    let out = 0;
    const nb = [0, 0, 0, 0], drop = [0, 0, 0, 0];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const w = W[c];
      if (w < 1e-5) continue;
      const h = H[c] + w;
      nb[0] = i > 0 ? c - 1 : -1; nb[1] = i < nx - 1 ? c + 1 : -1;
      nb[2] = j > 0 ? c - nx : -1; nb[3] = j < ny - 1 ? c + nx : -1;
      let total = 0, steepest = 0;
      for (let k = 0; k < 4; k++) {
        const hn = nb[k] >= 0 ? H[nb[k]] + W[nb[k]] : Hout[c];
        const d = h - hn;
        drop[k] = d > 0 ? d : 0;
        total += drop[k];
        if (drop[k] > steepest) steepest = drop[k];
      }
      if (total <= 0) continue;
      // Manning sheet-flow velocity, then the share of the cell's water that
      // crosses a cell width this step (capped so the scheme stays stable).
      const v = (Math.pow(w, 2 / 3) * Math.sqrt(steepest / l)) / MANNING_N;
      const frac = Math.min(0.5, (v * dt) / l);
      // Never move more than would bring this cell level with its lowest neighbour.
      const move = Math.min(w * frac, steepest / 2);
      dW[c] -= move;
      for (let k = 0; k < 4; k++) {
        if (!drop[k]) continue;
        const part = (move * drop[k]) / total;
        if (nb[k] >= 0) dW[nb[k]] += part; else out += part * A;
      }
    }
    for (let c = 0; c < n; c++) W[c] = Math.max(0, W[c] + dW[c]);
    this.outflow += out;
    this.time += dt;
  }
}

