// Marcadores do mapa: capitais, cidades, vilas, cercos (com barra de progresso)
// e batalhas (animadas enquanto ocorrem; esmaecidas logo apos o fim).
import type { MapData } from '../../map/MapData';
import type { Simulation } from '../../sim/Simulation';
import type { Camera } from '../Camera';
import { CITY_STYLE, type PixelTextCache } from '../pixelText';
import type { MapSpriteSet, TintCache } from '../sprites/mapSprites';

export interface BattleHit {
  id: number;
  sx: number;
  sy: number;
  r: number;
}

export class MarkerLayer {
  battleHits: BattleHit[] = [];

  constructor(
    private readonly map: MapData,
    private readonly sprites: MapSpriteSet,
    private readonly text: PixelTextCache,
    private readonly tints: TintCache,
  ) {}

  drawCities(ctx: CanvasRenderingContext2D, camera: Camera, sim: Simulation): void {
    const z = camera.zoom;
    if (z < 0.55) return;
    const m = this.map;
    const [mx0, my0] = camera.screenToMap(-40, -40);
    const [mx1, my1] = camera.screenToMap(camera.viewW + 40, camera.viewH + 40);
    const cellSize = 22;
    const occupied = new Set<number>();
    const tryOccupy = (sx: number, sy: number) => {
      const k = Math.floor(sx / cellSize) * 4096 + Math.floor(sy / cellSize);
      if (occupied.has(k)) return false;
      occupied.add(k);
      return true;
    };
    const capSize = z < 1 ? 16 : z < 2.5 ? 24 : z < 6 ? 32 : 40;
    const citySize = z < 5 ? 20 : z < 10 ? 28 : 36;
    // Capitais primeiro (prioridade de ocupacao).
    for (const c of sim.state.countries) {
      if (!c.alive || c.kind !== 'nation' || c.capital < 0) continue;
      const mp = m.provinces[c.capital];
      if (mp.x < mx0 || mp.x > mx1 || mp.y < my0 || mp.y > my1) continue;
      const [sx, sy] = camera.mapToScreen(mp.x, mp.y);
      if (!tryOccupy(sx, sy)) continue;
      const art = this.tints.get('capital', this.sprites.capitalArt, c.color);
      ctx.drawImage(art, Math.round(sx - capSize / 2), Math.round(sy - capSize * 0.8), capSize, capSize);
      if (z >= 2.5) this.drawName(ctx, m.cities[mp.cities[0]].name, sx, sy + capSize * 0.25);
    }
    if (z < 2) return;
    for (const mp of m.provinces) {
      if (mp.x < mx0 || mp.x > mx1 || mp.y < my0 || mp.y > my1) continue;
      const owner = sim.state.countries[sim.state.provinces[mp.id].owner];
      mp.cities.forEach((cid, i) => {
        const city = m.cities[cid];
        if (i === 0 && owner?.capital === mp.id) return;
        const major = i === 0;
        if (!major && z < 8) return;
        if (major && z < 3.5 && city.pop < 400000) return;
        // Marco sem cidade real (estado sem cidades cadastradas): o nome do estado ja aparece no mapa.
        if (city.synthetic) return;
        const [sx, sy] = camera.mapToScreen(city.x, city.y);
        if (!tryOccupy(sx, sy)) return;
        const size = major ? citySize : Math.round(citySize * 0.7);
        ctx.drawImage(major ? this.sprites.city : this.sprites.town, Math.round(sx - size / 2), Math.round(sy - size * 0.8), size, size);
        if ((major && z >= 5) || z >= 12) this.drawName(ctx, city.name, sx, sy + size * 0.25);
      });
    }
  }

  private drawName(ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number): void {
    const canvas = this.text.get(name, CITY_STYLE);
    ctx.drawImage(canvas, Math.round(sx - canvas.width / 2), Math.round(sy));
  }

  drawSieges(ctx: CanvasRenderingContext2D, camera: Camera, sim: Simulation, time: number): void {
    const z = camera.zoom;
    if (z < 1.2) return;
    const frame = Math.floor(time / 300) % 2;
    const size = z < 3 ? 20 : z < 8 ? 28 : 36;
    const provs = sim.state.provinces;
    for (let p = 0; p < provs.length; p++) {
      const siege = provs[p].siege;
      if (!siege) continue;
      const mp = this.map.provinces[p];
      const [sx, sy] = camera.mapToScreen(mp.x, mp.y);
      if (sx < -40 || sy < -40 || sx > camera.viewW + 40 || sy > camera.viewH + 40) continue;
      const ox = Math.round(sx + size * 0.55);
      const oy = Math.round(sy - size);
      ctx.drawImage(this.sprites.siege[frame], ox, oy, size, size);
      const pct = Math.min(1, siege.progress / siege.needed);
      ctx.fillStyle = '#1a120b';
      ctx.fillRect(ox, oy + size, size, 5);
      ctx.fillStyle = '#e7b84a';
      ctx.fillRect(ox + 1, oy + size + 1, Math.round((size - 2) * pct), 3);
    }
  }

  drawBattles(ctx: CanvasRenderingContext2D, camera: Camera, sim: Simulation, time: number): void {
    this.battleHits = [];
    const z = camera.zoom;
    const day = sim.day;
    const frame = Math.floor(time / 220) % 2;
    const size = z < 1 ? 26 : z < 3 ? 34 : z < 8 ? 44 : 56;
    const list = sim.state.battles;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      const ongoing = b.end < 0;
      if (!ongoing && day - b.end > 40) {
        if (day - b.end > 400) break;
        continue;
      }
      const [sx, sy] = camera.mapToScreen(b.x, b.y);
      if (sx < -60 || sy < -60 || sx > camera.viewW + 60 || sy > camera.viewH + 60) continue;
      if (ongoing) {
        const pulse = 0.5 + 0.5 * Math.sin(time / 180);
        ctx.strokeStyle = `rgba(255, 214, 110, ${0.35 + pulse * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy - size * 0.2, size * (0.55 + pulse * 0.15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.drawImage(this.sprites.battle[frame], Math.round(sx - size / 2), Math.round(sy - size * 0.7), size, size);
      } else {
        const s = Math.round(size * 0.6);
        ctx.globalAlpha = 0.6 * (1 - (day - b.end) / 45);
        ctx.drawImage(this.sprites.battle[0], Math.round(sx - s / 2), Math.round(sy - s * 0.7), s, s);
        ctx.globalAlpha = 1;
      }
      this.battleHits.push({ id: b.id, sx, sy: sy - size * 0.2, r: size * 0.5 });
    }
  }

  pickBattle(sx: number, sy: number): number {
    for (const h of this.battleHits) if (Math.hypot(h.sx - sx, h.sy - sy) <= h.r) return h.id;
    return -1;
  }
}
