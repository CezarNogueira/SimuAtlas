// Camada politica/tematica composta sobre o terreno (1 texel = 1 celula), com atualizacao
// incremental por provincia: cores de pais, fronteiras escuras, anel interno saturado,
// fronteiras de provincia pontilhadas e hachuras de ocupacao.
import { CELL_FOREIGN, FLAG_RIVER, type MapData } from '../../map/MapData';
import type { Simulation } from '../../sim/Simulation';
import { buildFill, type LegendItem, type MapModeId } from '../mapModes';
import type { TerrainTexture } from './TerrainLayer';

export interface PoliticalOptions {
  mode: MapModeId;
  provinceBorders: boolean;
  selected: number;
}

export class PoliticalLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly fill: Uint8Array;
  private readonly ownerFill: Uint8Array;
  private readonly ctrl: Int32Array;
  private readonly group: Int32Array;
  private readonly own: Int32Array;
  private dirty = new Set<number>();
  private full = true;
  private lastKey = '';
  legend: LegendItem[] = [];

  constructor(private readonly map: MapData, private readonly tex: TerrainTexture) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = map.width;
    this.canvas.height = map.height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.image = ctx.createImageData(map.width, map.height);
    const P = map.provinceCount;
    this.fill = new Uint8Array(P * 3);
    this.ownerFill = new Uint8Array(P * 3);
    this.ctrl = new Int32Array(P);
    this.group = new Int32Array(P);
    this.own = new Int32Array(P);
  }

  invalidateProvince(p: number): void {
    const m = this.map;
    this.dirty.add(p);
    for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) if (!m.edgeSea[e]) this.dirty.add(m.edgeTo[e]);
  }

  invalidateAll(): void {
    this.full = true;
  }

  update(sim: Simulation, opts: PoliticalOptions): void {
    const key = `${opts.mode}|${opts.provinceBorders}|${opts.mode === 'diplomatic' ? opts.selected : -1}`;
    const modeChanged = key !== this.lastKey;
    const themed = opts.mode !== 'political' && opts.mode !== 'terrain';
    if (modeChanged) {
      this.lastKey = key;
      this.full = true;
    }
    if (!this.full && !this.dirty.size && !themed) return;
    const P = this.map.provinceCount;
    const ctx = buildFill(opts.mode, sim, opts.selected);
    this.legend = ctx.legend;
    const provs = sim.state.provinces;
    for (let p = 0; p < P; p++) {
      const ps = provs[p];
      this.ctrl[p] = ps.controller;
      this.own[p] = ps.owner;
      this.group[p] = ctx.bordersByOwner ? ps.owner : ps.controller;
    }
    if (this.full || themed) {
      for (let p = 0; p < P; p++) this.computeFill(p, ctx.fill, sim);
      this.drawAll(opts);
      this.full = false;
      this.dirty.clear();
      return;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (const p of this.dirty) {
      this.computeFill(p, ctx.fill, sim);
      const bb = this.map.provinces[p].bbox;
      x0 = Math.min(x0, bb[0] - 2);
      y0 = Math.min(y0, bb[1] - 2);
      x1 = Math.max(x1, bb[2] + 2);
      y1 = Math.max(y1, bb[3] + 2);
    }
    for (const p of this.dirty) this.drawProvince(p, opts);
    this.dirty.clear();
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.map.width - 1, x1);
    y1 = Math.min(this.map.height - 1, y1);
    this.ctx.putImageData(this.image, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  private computeFill(p: number, fill: (p: number) => [number, number, number], sim: Simulation): void {
    const c = fill(p);
    this.fill[p * 3] = c[0];
    this.fill[p * 3 + 1] = c[1];
    this.fill[p * 3 + 2] = c[2];
    const owner = sim.state.countries[sim.state.provinces[p].owner];
    const oc = owner?.color ?? c;
    this.ownerFill[p * 3] = oc[0];
    this.ownerFill[p * 3 + 1] = oc[1];
    this.ownerFill[p * 3 + 2] = oc[2];
  }

  private drawAll(opts: PoliticalOptions): void {
    const d = this.image.data;
    d.set(this.tex.base);
    const P = this.map.provinceCount;
    for (let p = 0; p < P; p++) this.drawProvince(p, opts);
    this.ctx.putImageData(this.image, 0, 0);
  }

  private drawProvince(p: number, opts: PoliticalOptions): void {
    const m = this.map;
    const W = m.width;
    const H = m.height;
    const P = m.provinceCount;
    const cells = m.cells;
    const flags = m.flags;
    const base = this.tex.base;
    const tone = this.tex.tone;
    const d = this.image.data;
    const group = this.group;
    const g = group[p];
    const terrainMode = opts.mode === 'terrain';
    const hatch = !terrainMode && opts.mode === 'political' && this.ctrl[p] !== this.own[p] && this.own[p] >= 0;
    const fr = this.fill[p * 3];
    const fg = this.fill[p * 3 + 1];
    const fb = this.fill[p * 3 + 2];
    const hr = this.ownerFill[p * 3];
    const hg = this.ownerFill[p * 3 + 1];
    const hb = this.ownerFill[p * 3 + 2];
    for (let k = m.cellStart[p]; k < m.cellStart[p + 1]; k++) {
      const i = m.cellList[k];
      const x = i % W;
      const y = (i / W) | 0;
      let border = false;
      let provEdge = false;
      const check = (j: number) => {
        const c = cells[j];
        if (c < P) {
          if (group[c] !== g) border = true;
          else if (c !== p) provEdge = true;
        } else if (c === CELL_FOREIGN) border = true;
      };
      if (x > 0) check(i - 1);
      if (x < W - 1) check(i + 1);
      if (y > 0) check(i - W);
      if (y < H - 1) check(i + W);
      let inner = false;
      if (!border) {
        const far = (j: number) => {
          const c = cells[j];
          if ((c < P && group[c] !== g) || c === CELL_FOREIGN) inner = true;
        };
        if (x > 1) far(i - 2);
        if (x < W - 2) far(i + 2);
        if (y > 1) far(i - 2 * W);
        if (y < H - 2) far(i + 2 * W);
        if (x > 0 && y > 0) far(i - W - 1);
        if (x < W - 1 && y > 0) far(i - W + 1);
        if (x > 0 && y < H - 1) far(i + W - 1);
        if (x < W - 1 && y < H - 1) far(i + W + 1);
      }
      const o = i * 4;
      let r: number;
      let gg: number;
      let b: number;
      if (terrainMode) {
        r = base[o];
        gg = base[o + 1];
        b = base[o + 2];
        if (border) {
          r *= 0.62;
          gg *= 0.62;
          b *= 0.62;
        }
      } else {
        let cr = fr;
        let cg = fg;
        let cb = fb;
        if (hatch && (x + y) % 6 < 2) {
          cr = hr;
          cg = hg;
          cb = hb;
        }
        const t = 1 + (tone[i] / 128 - 1) * 0.55;
        r = cr * t * 0.86 + base[o] * 0.14;
        gg = cg * t * 0.86 + base[o + 1] * 0.14;
        b = cb * t * 0.86 + base[o + 2] * 0.14;
        if (flags[i] & FLAG_RIVER) {
          r = r * 0.42 + 64 * 0.58;
          gg = gg * 0.42 + 112 * 0.58;
          b = b * 0.42 + 166 * 0.58;
        }
        if (border) {
          r *= 0.45;
          gg *= 0.45;
          b *= 0.45;
        } else if (inner) {
          const avg = (r + gg + b) / 3;
          r = (r + (r - avg) * 0.35) * 0.92;
          gg = (gg + (gg - avg) * 0.35) * 0.92;
          b = (b + (b - avg) * 0.35) * 0.92;
        } else if (provEdge && opts.provinceBorders && ((x + y) & 1) === 0) {
          r *= 0.82;
          gg *= 0.82;
          b *= 0.82;
        }
      }
      d[o] = r;
      d[o + 1] = gg;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
}
