// Rotulos do mapa: nomes das nacoes proporcionais ao territorio (maior bloco contiguo),
// mares/oceanos e grandes acidentes geograficos.
import type { MapData } from '../../map/MapData';
import type { Simulation } from '../../sim/Simulation';
import type { Camera } from '../Camera';
import { FEATURE_STYLE, LABEL_STYLE, SEA_STYLE, STATE_STYLE, type PixelTextCache } from '../pixelText';

interface CountryLabel {
  country: number;
  text: string;
  x: number;
  y: number;
  size: number;
}

export class LabelLayer {
  private labels: CountryLabel[] = [];
  private version = -1;
  private lastCompute = -1e9;
  private formal = false;

  constructor(private readonly map: MapData, private readonly text: PixelTextCache) {}

  invalidate(): void {
    this.version = -1;
  }

  update(sim: Simulation, now: number, formal: boolean): void {
    const v = sim.index.ownershipVersion;
    const stale = v !== this.version || formal !== this.formal;
    if (!stale && now - this.lastCompute < 4000) return;
    if (stale && now - this.lastCompute < 350) return;
    this.version = v;
    this.formal = formal;
    this.lastCompute = now;
    this.compute(sim, formal);
  }

  private compute(sim: Simulation, formal: boolean): void {
    const m = this.map;
    const provs = sim.state.provinces;
    const out: CountryLabel[] = [];
    for (const c of sim.state.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      const owned = sim.index.ownedBy[c.id];
      if (!owned?.length) continue;
      const seen = new Set<number>();
      let best: number[] = [];
      let bestCells = 0;
      for (const start of owned) {
        if (seen.has(start)) continue;
        const comp: number[] = [];
        let cells = 0;
        const stack = [start];
        seen.add(start);
        while (stack.length) {
          const p = stack.pop() as number;
          comp.push(p);
          cells += m.provinces[p].cells;
          for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
            if (m.edgeSea[e]) continue;
            const q = m.edgeTo[e];
            if (!seen.has(q) && provs[q].owner === c.id) {
              seen.add(q);
              stack.push(q);
            }
          }
        }
        if (cells > bestCells) {
          bestCells = cells;
          best = comp;
        }
      }
      let sx = 0;
      let sy = 0;
      let x0 = Infinity;
      let x1 = -Infinity;
      for (const p of best) {
        const mp = m.provinces[p];
        sx += mp.lx * mp.cells;
        sy += mp.ly * mp.cells;
        x0 = Math.min(x0, mp.bbox[0]);
        x1 = Math.max(x1, mp.bbox[2]);
      }
      let cx = sx / bestCells;
      let cy = sy / bestCells;
      const at = m.provinceAt(cx, cy);
      if (at < 0 || provs[at].owner !== c.id) {
        let bd = Infinity;
        for (const p of best) {
          const mp = m.provinces[p];
          const d = (mp.lx - cx) ** 2 + (mp.ly - cy) ** 2 - mp.cells * 0.5;
          if (d < bd) {
            bd = d;
            cx = mp.lx;
            cy = mp.ly;
          }
        }
      }
      const name = formal && bestCells >= 900 ? sim.countries.formalName(c.id) : c.name;
      let size = Math.max(2.2, Math.min(42, Math.sqrt(bestCells) * 0.22));
      const width = Math.max(4, (x1 - x0) * 0.95);
      const textW = size * 0.6 * name.length;
      if (textW > width) size = Math.max(1.2, width / (0.6 * name.length));
      out.push({ country: c.id, text: name, x: cx, y: cy, size });
    }
    // Maiores primeiro: em caso de sobreposicao, o rotulo da nacao maior tem prioridade.
    out.sort((a, b) => b.size - a.size);
    this.labels = out;
  }

  private placed: number[] = [];

  draw(ctx: CanvasRenderingContext2D, camera: Camera, selected: number): void {
    const z = camera.zoom;
    const placed = this.placed;
    placed.length = 0;
    const sel = this.labels.find((l) => l.country === selected);
    if (sel) this.drawLabel(ctx, camera, sel, z, true);
    for (const l of this.labels) {
      if (l !== sel) this.drawLabel(ctx, camera, l, z, false);
    }
    ctx.globalAlpha = 1;
  }

  private drawLabel(ctx: CanvasRenderingContext2D, camera: Camera, l: CountryLabel, z: number, selected: boolean): void {
    const raw = l.size * z;
    if (raw < 9) return;
    const px = Math.min(raw, 60);
    const [sx, sy] = camera.mapToScreen(l.x, l.y);
    if (sx < -400 || sy < -100 || sx > camera.viewW + 400 || sy > camera.viewH + 100) return;
    const canvas = this.text.get(l.text, LABEL_STYLE);
    const k = px / LABEL_STYLE.size;
    const scale = k >= 1 ? Math.round(k) : k;
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    const x = Math.round(sx - w / 2);
    const y = Math.round(sy - h / 2);
    // Retangulo util do texto (o canvas tem margem para o contorno).
    const pad = 4 * scale;
    const x0 = x + pad;
    const y0 = y + pad;
    const x1 = x + w - pad;
    const y1 = y + h - pad;
    const placed = this.placed;
    if (!selected) {
      for (let i = 0; i < placed.length; i += 4) {
        if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) return;
      }
    }
    placed.push(x0, y0, x1, y1);
    ctx.globalAlpha = selected ? 1 : raw > 120 ? 0.45 : raw > 60 ? 0.7 : 0.9;
    ctx.drawImage(canvas, x, y, w, h);
  }

  // Nomes dos estados (com zoom): apenas onde cabem dentro do proprio estado e sem cobrir
  // os nomes das nacoes ja desenhados (afterCountries reaproveita as areas ocupadas).
  drawStates(ctx: CanvasRenderingContext2D, camera: Camera, afterCountries: boolean): void {
    const z = camera.zoom;
    if (z < 1.5) return;
    const placed = this.placed;
    if (!afterCountries) placed.length = 0;
    const [mx0, my0] = camera.screenToMap(-120, -40);
    const [mx1, my1] = camera.screenToMap(camera.viewW + 120, camera.viewH + 40);
    const m = this.map;
    ctx.globalAlpha = 0.8;
    for (const mp of m.provinces) {
      if (mp.lx < mx0 || mp.lx > mx1 || mp.ly < my0 || mp.ly > my1) continue;
      if ((mp.bbox[3] - mp.bbox[1] + 1) * z < 20) continue;
      // Nacao de um so estado: o nome da nacao ja identifica; com zoom alto a cidade homonima ja tem rotulo.
      if (m.nations[mp.nation]?.provinces.length === 1) continue;
      if (z >= 5 && m.cities[mp.cities[0]]?.name === mp.name) continue;
      const canvas = this.text.get(mp.name.toUpperCase(), STATE_STYLE);
      if (canvas.width > (mp.bbox[2] - mp.bbox[0] + 1) * z * 0.85) continue;
      const [sx, sy] = camera.mapToScreen(mp.lx, mp.ly);
      const x = Math.round(sx - canvas.width / 2);
      const y = Math.round(sy - canvas.height / 2);
      const x0 = x + 2;
      const y0 = y + 3;
      const x1 = x + canvas.width - 2;
      const y1 = y + canvas.height - 3;
      let blocked = false;
      for (let i = 0; i < placed.length; i += 4) {
        if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      placed.push(x0, y0, x1, y1);
      ctx.drawImage(canvas, x, y);
    }
    ctx.globalAlpha = 1;
  }

  drawGeo(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const z = camera.zoom;
    const m = this.map;
    for (const s of m.seas) {
      const size = s.size ?? 0;
      const min = size > 60000 ? 0 : size > 8000 ? 1.2 : 3;
      if (z < min) continue;
      const [sx, sy] = camera.mapToScreen(s.x, s.y);
      if (sx < -200 || sy < -50 || sx > camera.viewW + 200 || sy > camera.viewH + 50) continue;
      const canvas = this.text.get(s.name, SEA_STYLE);
      const scale = size > 60000 && z >= 2 ? 2 : 1;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(canvas, Math.round(sx - (canvas.width * scale) / 2), Math.round(sy - (canvas.height * scale) / 2), canvas.width * scale, canvas.height * scale);
    }
    for (const f of m.features) {
      const min = f.rank <= 1 ? 1.5 : f.rank <= 2 ? 3 : 5;
      if (z < min || f.type === 'plain' || f.type === 'basin') continue;
      const [sx, sy] = camera.mapToScreen(f.x, f.y);
      if (sx < -200 || sy < -50 || sx > camera.viewW + 200 || sy > camera.viewH + 50) continue;
      const canvas = this.text.get(f.name, FEATURE_STYLE);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(canvas, Math.round(sx - canvas.width / 2), Math.round(sy - canvas.height / 2));
    }
    ctx.globalAlpha = 1;
  }
}
