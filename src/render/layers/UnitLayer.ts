// Exercitos no mapa: sprites em pixel art tingidos com a cor do pais, posicao interpolada
// durante a marcha (inclusive por rotas maritimas), contagem de soldados, setas de ofensiva
// e rotas maritimas tracejadas.
import type { MapData } from '../../map/MapData';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import type { Simulation } from '../../sim/Simulation';
import type { Army } from '../../state/types';
import type { Camera } from '../Camera';
import { rgb, scale, type RGB } from '../colors';
import { PLATE_STYLE, type PixelTextCache } from '../pixelText';
import type { MapSpriteSet, TintCache } from '../sprites/mapSprites';

export type ArmyVisibility = 'all' | 'war' | 'none';

interface ArmyHit {
  id: number;
  sx: number;
  sy: number;
  r: number;
}

function shortCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.', ',')}k`;
  return String(Math.round(n));
}

function chaikin(pts: [number, number][], iterations = 2): [number, number][] {
  let out = pts;
  for (let it = 0; it < iterations; it++) {
    if (out.length < 3) return out;
    const next: [number, number][] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i];
      const [bx, by] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

export class UnitLayer {
  private readonly routes: [number, number][][];
  private hits: ArmyHit[] = [];

  constructor(
    private readonly map: MapData,
    private readonly sprites: MapSpriteSet,
    private readonly text: PixelTextCache,
    private readonly tints: TintCache,
  ) {
    this.routes = map.seaRoutes
      .filter((r) => r.d >= 4)
      .map((r) => {
        const pts: [number, number][] = [];
        for (let i = 0; i + 1 < r.pts.length; i += 2) pts.push([r.pts[i], r.pts[i + 1]]);
        return chaikin(pts);
      });
  }

  private routePoint(a: number, b: number, t: number): [number, number] | null {
    const m = this.map;
    const e = m.edgeBetween(a, b);
    if (e < 0 || !m.edgeSea[e]) return null;
    const r = m.seaRoutes[m.edgeRoute[e]];
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < r.pts.length; i += 2) pts.push([r.pts[i], r.pts[i + 1]]);
    if (r.a !== a) pts.reverse();
    const full: [number, number][] = [[m.provinces[a].x, m.provinces[a].y], ...pts, [m.provinces[b].x, m.provinces[b].y]];
    let total = 0;
    const seg: number[] = [];
    for (let i = 0; i < full.length - 1; i++) {
      const d = Math.hypot(full[i + 1][0] - full[i][0], full[i + 1][1] - full[i][1]);
      seg.push(d);
      total += d;
    }
    let target = total * t;
    for (let i = 0; i < seg.length; i++) {
      if (target <= seg[i] || i === seg.length - 1) {
        const k = seg[i] > 0 ? Math.min(1, target / seg[i]) : 0;
        return [full[i][0] + (full[i + 1][0] - full[i][0]) * k, full[i][1] + (full[i + 1][1] - full[i][1]) * k];
      }
      target -= seg[i];
    }
    return null;
  }

  position(a: Army, frac: number): [number, number] {
    const m = this.map;
    const from = m.provinces[a.location];
    if (!a.path.length || a.edgeDays <= 0 || a.battle >= 0) return [from.x, from.y];
    const t = Math.max(0, Math.min(1, (a.progress + frac) / a.edgeDays));
    if (a.naval) {
      const p = this.routePoint(a.location, a.path[0], t);
      if (p) return p;
    }
    const to = m.provinces[a.path[0]];
    return [from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t];
  }

  visible(sim: Simulation, a: Army, mode: ArmyVisibility, selectedCountry: number, zoom: number): boolean {
    if (mode === 'none') return a.owner === selectedCountry;
    if (mode === 'all') return true;
    return sim.index.isAtWar(a.owner) || a.owner === selectedCountry || zoom >= 6;
  }

  drawRoutes(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const z = camera.zoom;
    if (z < 0.6) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 226, 190, 0.5)';
    ctx.lineWidth = Math.max(1, Math.min(3, z * 0.4));
    ctx.setLineDash([Math.max(4, z * 2), Math.max(4, z * 2)]);
    ctx.beginPath();
    for (const pts of this.routes) {
      pts.forEach(([x, y], i) => {
        const [sx, sy] = camera.mapToScreen(x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
    }
    ctx.stroke();
    ctx.restore();
  }

  drawArrows(ctx: CanvasRenderingContext2D, camera: Camera, sim: Simulation, frac: number, mode: ArmyVisibility, selectedCountry: number): void {
    const z = camera.zoom;
    const width = Math.max(3, Math.min(10, z * 1.1));
    for (const a of sim.state.armies) {
      if (!a.path.length || (a.mission !== 'attack' && a.mission !== 'siege')) continue;
      if (!sim.index.isAtWar(a.owner) || !this.visible(sim, a, mode, selectedCountry, z)) continue;
      const pts: [number, number][] = [camera.mapToScreen(...this.position(a, frac))];
      for (const p of a.path.slice(0, 5)) {
        const mp = this.map.provinces[p];
        pts.push(camera.mapToScreen(mp.x, mp.y));
      }
      if (pts.length < 2) continue;
      const color = sim.country(a.owner).color as RGB;
      this.arrow(ctx, pts, width, color);
    }
  }

  private arrow(ctx: CanvasRenderingContext2D, pts: [number, number][], width: number, color: RGB): void {
    const [ex, ey] = pts[pts.length - 1];
    const [px, py] = pts[pts.length - 2];
    const ang = Math.atan2(ey - py, ex - px);
    const head = width * 2.6;
    const bx = ex - Math.cos(ang) * head;
    const by = ey - Math.sin(ang) * head;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(bx, by);
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(20,14,8,0.85)';
    ctx.lineWidth = width + 3;
    trace();
    ctx.stroke();
    ctx.strokeStyle = rgb(color, 0.95);
    ctx.lineWidth = width;
    trace();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(bx + Math.cos(ang + Math.PI / 2) * head * 0.7, by + Math.sin(ang + Math.PI / 2) * head * 0.7);
    ctx.lineTo(bx + Math.cos(ang - Math.PI / 2) * head * 0.7, by + Math.sin(ang - Math.PI / 2) * head * 0.7);
    ctx.closePath();
    ctx.fillStyle = rgb(scale(color, 1.05));
    ctx.strokeStyle = 'rgba(20,14,8,0.9)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }

  drawArmies(ctx: CanvasRenderingContext2D, camera: Camera, sim: Simulation, frac: number, mode: ArmyVisibility, selectedCountry: number, selectedArmy: number, time: number): void {
    this.hits = [];
    const z = camera.zoom;
    const size = z < 1.5 ? 24 : z < 4 ? 32 : z < 8 ? 48 : 64;
    const stack = new Map<number, number>();
    for (const a of sim.state.armies) {
      if (!this.visible(sim, a, mode, selectedCountry, z)) continue;
      const [mx, my] = this.position(a, frac);
      let [sx, sy] = camera.mapToScreen(mx, my);
      if (sx < -size || sy < -size || sx > camera.viewW + size || sy > camera.viewH + size) continue;
      if (!a.path.length) {
        const n = stack.get(a.location) ?? 0;
        stack.set(a.location, n + 1);
        sx += n * size * 0.55;
      }
      const c = sim.country(a.owner);
      let sprite: HTMLCanvasElement;
      if (a.naval) sprite = this.tints.get('ship', this.sprites.shipArt, c.color);
      else if (c.kind === 'rebel') sprite = this.tints.get('rebel', this.sprites.rebelArt, c.color);
      else {
        const era = c.tech < 9 ? 0 : c.tech < 18 ? 1 : 2;
        sprite = this.tints.get(`army${era}`, this.sprites.armyArt[era], c.color);
      }
      const dx = Math.round(sx - size / 2);
      const dy = Math.round(sy - size * 0.85);
      if (a.id === selectedArmy) {
        const pulse = 0.5 + 0.5 * Math.sin(time / 200);
        ctx.strokeStyle = `rgba(255, 240, 160, ${0.5 + pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 2, dy - 2, size + 4, size + 4);
        this.drawPath(ctx, camera, a, frac);
      }
      ctx.drawImage(sprite, dx, dy, size, size);
      if (a.morale < 0.3) {
        ctx.fillStyle = '#e04a32';
        ctx.fillRect(dx + size - 6, dy + 2, 4, 4);
      }
      this.plates.push({ owner: a.owner, soldiers: soldiersOf(a), selected: a.id === selectedArmy, sx, sy, size });
      this.hits.push({ id: a.id, sx, sy: sy - size * 0.35, r: size * 0.45 });
    }
    this.drawPlates(ctx, sim);
  }

  // Placas com o efetivo: a selecionada e as maiores primeiro; placas que se sobrepoem sao omitidas
  // para que exercitos aglomerados continuem legiveis.
  private readonly plates: { owner: number; soldiers: number; selected: boolean; sx: number; sy: number; size: number }[] = [];
  private readonly placed: number[] = [];

  private drawPlates(ctx: CanvasRenderingContext2D, sim: Simulation): void {
    const plates = this.plates;
    const placed = this.placed;
    placed.length = 0;
    plates.sort((p, q) => Number(q.selected) - Number(p.selected) || q.soldiers - p.soldiers);
    for (const p of plates) {
      const label = this.text.get(shortCount(p.soldiers), PLATE_STYLE);
      const lx = Math.round(p.sx - label.width / 2);
      const ly = Math.round(p.sy + p.size * 0.12);
      const x0 = lx - 1;
      const y0 = ly + 2;
      const x1 = lx + label.width + 1;
      const y1 = ly + label.height - 1;
      let blocked = false;
      if (!p.selected) {
        for (let i = 0; i < placed.length; i += 4) {
          if (x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1]) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) continue;
      placed.push(x0, y0, x1, y1);
      const color = sim.country(p.owner).color as RGB;
      ctx.fillStyle = rgb(scale(color, 0.45), 0.92);
      ctx.fillRect(lx - 1, ly + 2, label.width + 2, label.height - 4);
      ctx.fillStyle = rgb(color);
      ctx.fillRect(lx - 1, ly + label.height - 3, label.width + 2, 2);
      ctx.drawImage(label, lx, ly);
    }
    plates.length = 0;
  }

  private drawPath(ctx: CanvasRenderingContext2D, camera: Camera, a: Army, frac: number): void {
    if (!a.path.length) return;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(255, 244, 200, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const [sx, sy] = camera.mapToScreen(...this.position(a, frac));
    ctx.moveTo(sx, sy);
    for (const p of a.path) {
      const mp = this.map.provinces[p];
      const [x, y] = camera.mapToScreen(mp.x, mp.y);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    const last = this.map.provinces[a.path[a.path.length - 1]];
    const [tx, ty] = camera.mapToScreen(last.x, last.y);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 90, 60, 0.95)';
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.moveTo(tx - 11, ty);
    ctx.lineTo(tx + 11, ty);
    ctx.moveTo(tx, ty - 11);
    ctx.lineTo(tx, ty + 11);
    ctx.stroke();
    ctx.restore();
  }

  pickArmy(sx: number, sy: number): number {
    let best = -1;
    let bd = Infinity;
    for (const h of this.hits) {
      const d = Math.hypot(h.sx - sx, h.sy - sy);
      if (d <= h.r && d < bd) {
        bd = d;
        best = h.id;
      }
    }
    return best;
  }
}
