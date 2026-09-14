// MAP RENDERING: compoe todas as camadas do mapa em um unico canvas (terreno/politico,
// destaque de selecao, rotas, rotulos, cidades, cercos, batalhas, setas e exercitos).
import type { MapData } from '../map/MapData';
import type { GridTransform, ProjectionDef } from '../map/projection';
import type { Simulation } from '../sim/Simulation';
import { Camera } from './Camera';
import { LabelLayer } from './layers/LabelLayer';
import { MarkerLayer } from './layers/MarkerLayer';
import { PoliticalLayer } from './layers/PoliticalLayer';
import { buildTerrainTexture, type TerrainTexture } from './layers/TerrainLayer';
import { UnitLayer, type ArmyVisibility } from './layers/UnitLayer';
import type { LegendItem, MapModeId } from './mapModes';
import { PixelTextCache } from './pixelText';
import { buildMapSprites, TintCache, type MapSpriteSet } from './sprites/mapSprites';

export interface RenderSettings {
  mapMode: MapModeId;
  provinceBorders: boolean;
  showCities: boolean;
  showLabels: boolean;
  formalNames: boolean;
  showArmies: ArmyVisibility;
  showSeaRoutes: boolean;
  showArrows: boolean;
  showBattles: boolean;
  showGeoLabels: boolean;
  showStateLabels: boolean;
}

export const DEFAULT_RENDER: RenderSettings = {
  mapMode: 'political',
  provinceBorders: true,
  showCities: true,
  showLabels: true,
  showStateLabels: true,
  formalNames: true,
  showArmies: 'war',
  showSeaRoutes: true,
  showArrows: true,
  showBattles: true,
  showGeoLabels: true,
};

export interface PickResult {
  province: number;
  army: number;
  battle: number;
}

export class MapRenderer {
  readonly camera: Camera;
  readonly terrain: TerrainTexture;
  readonly political: PoliticalLayer;
  readonly labels: LabelLayer;
  readonly markers: MarkerLayer;
  readonly units: UnitLayer;
  readonly text = new PixelTextCache();
  readonly tints = new TintCache();
  readonly sprites: MapSpriteSet;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly selection: HTMLCanvasElement;
  private readonly selectionCtx: CanvasRenderingContext2D;
  private selectionKey = '';
  private hoverCanvas: HTMLCanvasElement | null = null;
  private hoverKey = -2;
  private hoverOrigin: [number, number] = [0, 0];
  private dpr = 1;
  selectedCountry = -1;
  selectedProvince = -1;
  selectedArmy = -1;
  hoverProvince = -1;
  settings: RenderSettings = { ...DEFAULT_RENDER };
  private unsubscribe: (() => void)[] = [];

  constructor(readonly canvas: HTMLCanvasElement, readonly map: MapData, private sim: Simulation, projection?: ProjectionDef, transform?: GridTransform) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.ctx = ctx;
    this.camera = new Camera(map.width, map.height);
    this.terrain = buildTerrainTexture(map, projection, transform);
    this.political = new PoliticalLayer(map, this.terrain);
    this.sprites = buildMapSprites();
    this.labels = new LabelLayer(map, this.text);
    this.markers = new MarkerLayer(map, this.sprites, this.text, this.tints);
    this.units = new UnitLayer(map, this.sprites, this.text, this.tints);
    this.selection = document.createElement('canvas');
    this.selection.width = map.width;
    this.selection.height = map.height;
    const sctx = this.selection.getContext('2d');
    if (!sctx) throw new Error('Canvas 2D indisponível');
    this.selectionCtx = sctx;
    this.attach(sim);
  }

  attach(sim: Simulation): void {
    for (const off of this.unsubscribe) off();
    this.sim = sim;
    this.unsubscribe = [
      sim.bus.on('provinceChanged', ({ province }) => {
        this.political.invalidateProvince(province);
        this.selectionKey = '';
      }),
      sim.bus.on('countryChanged', () => {
        this.political.invalidateAll();
        this.labels.invalidate();
      }),
      sim.bus.on('countryCreated', () => this.labels.invalidate()),
      sim.bus.on('countryDestroyed', () => this.labels.invalidate()),
    ];
    this.political.invalidateAll();
    this.labels.invalidate();
    this.selectionKey = '';
  }

  detach(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
  }

  get legend(): LegendItem[] {
    return this.political.legend;
  }

  resize(width: number, height: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.camera.setViewport(width, height);
  }

  private buildSelection(): void {
    const sel = this.selectedCountry;
    const key = `${sel}:${this.sim.index.ownershipVersion}`;
    if (key === this.selectionKey) return;
    this.selectionKey = key;
    const m = this.map;
    const W = m.width;
    const P = m.provinceCount;
    const provs = this.sim.state.provinces;
    const ctx = this.selectionCtx;
    ctx.clearRect(0, 0, W, m.height);
    if (sel < 0) return;
    const img = ctx.getImageData(0, 0, W, m.height);
    const d = img.data;
    for (const p of this.sim.index.ownedBy[sel] ?? []) {
      for (let k = m.cellStart[p]; k < m.cellStart[p + 1]; k++) {
        const i = m.cellList[k];
        const x = i % W;
        const isBorder = (j: number) => {
          const c = m.cells[j];
          return c >= P || provs[c].owner !== sel;
        };
        const edge = (x > 0 && isBorder(i - 1)) || (x < W - 1 && isBorder(i + 1)) || (i >= W && isBorder(i - W)) || (i + W < m.cells.length && isBorder(i + W));
        const o = i * 4;
        if (edge) {
          d[o] = 255;
          d[o + 1] = 246;
          d[o + 2] = 190;
          d[o + 3] = 255;
        } else {
          d[o] = 255;
          d[o + 1] = 255;
          d[o + 2] = 255;
          d[o + 3] = 34;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private buildHover(): void {
    const p = this.hoverProvince;
    if (p === this.hoverKey) return;
    this.hoverKey = p;
    this.hoverCanvas = null;
    if (p < 0) return;
    const m = this.map;
    const [x0, y0, x1, y1] = m.provinces[p].bbox;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const W = m.width;
    for (let k = m.cellStart[p]; k < m.cellStart[p + 1]; k++) {
      const i = m.cellList[k];
      const x = i % W;
      const y = (i / W) | 0;
      const edge = (x > 0 && m.cells[i - 1] !== p) || (x < W - 1 && m.cells[i + 1] !== p) || (y > 0 && m.cells[i - W] !== p) || (y < m.height - 1 && m.cells[i + W] !== p);
      const o = ((y - y0) * w + (x - x0)) * 4;
      img.data[o] = 255;
      img.data[o + 1] = 255;
      img.data[o + 2] = 255;
      img.data[o + 3] = edge ? 230 : 40;
    }
    ctx.putImageData(img, 0, 0);
    this.hoverCanvas = canvas;
    this.hoverOrigin = [x0, y0];
  }

  render(time: number, dt: number, frac: number): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const sim = this.sim;
    const s = this.settings;
    cam.update(dt);
    this.political.update(sim, { mode: s.mapMode, provinceBorders: s.provinceBorders, selected: this.selectedCountry });
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#243a5a';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    const [ox, oy] = cam.mapToScreen(0, 0);
    const mw = this.map.width * cam.zoom;
    const mh = this.map.height * cam.zoom;
    ctx.drawImage(this.political.canvas, ox, oy, mw, mh);

    this.buildSelection();
    if (this.selectedCountry >= 0) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time / 260);
      ctx.drawImage(this.selection, ox, oy, mw, mh);
      ctx.globalAlpha = 1;
    }
    this.buildHover();
    if (this.hoverCanvas) {
      const [hx, hy] = cam.mapToScreen(this.hoverOrigin[0], this.hoverOrigin[1]);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(this.hoverCanvas, hx, hy, this.hoverCanvas.width * cam.zoom, this.hoverCanvas.height * cam.zoom);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#1a120b';
    ctx.lineWidth = 3;
    ctx.strokeRect(ox - 1.5, oy - 1.5, mw + 3, mh + 3);

    if (s.showSeaRoutes) this.units.drawRoutes(ctx, cam);
    if (s.showGeoLabels) this.labels.drawGeo(ctx, cam);
    if (s.showCities) this.markers.drawCities(ctx, cam, sim);
    this.markers.drawSieges(ctx, cam, sim, time);
    const countryLabels = s.showLabels && s.mapMode !== 'terrain';
    if (countryLabels) {
      this.labels.update(sim, time, s.formalNames);
      this.labels.draw(ctx, cam, this.selectedCountry);
    }
    if (s.showStateLabels) this.labels.drawStates(ctx, cam, countryLabels);
    if (s.showArrows) this.units.drawArrows(ctx, cam, sim, frac, s.showArmies, this.selectedCountry);
    if (s.showArmies !== 'none' || this.selectedCountry >= 0) {
      this.units.drawArmies(ctx, cam, sim, frac, s.showArmies, this.selectedCountry, this.selectedArmy, time);
    }
    if (s.showBattles) this.markers.drawBattles(ctx, cam, sim, time);
  }

  pick(sx: number, sy: number): PickResult {
    const battle = this.settings.showBattles ? this.markers.pickBattle(sx, sy) : -1;
    const army = this.units.pickArmy(sx, sy);
    const [mx, my] = this.camera.screenToMap(sx, sy);
    return { province: this.map.provinceAt(mx, my), army, battle };
  }

  focusProvince(p: number, zoom?: number): void {
    const mp = this.map.provinces[p];
    if (mp) this.camera.focus(mp.x, mp.y, zoom ?? Math.max(this.camera.targetZoom, 3));
  }

  focusCountry(id: number): void {
    const owned = this.sim.index.ownedBy[id];
    if (!owned?.length) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of owned) {
      const bb = this.map.provinces[p].bbox;
      x0 = Math.min(x0, bb[0]);
      y0 = Math.min(y0, bb[1]);
      x1 = Math.max(x1, bb[2]);
      y1 = Math.max(y1, bb[3]);
    }
    const zoom = Math.max(this.camera.minZoom(), Math.min(12, Math.min(this.camera.viewW / (x1 - x0 + 20), this.camera.viewH / (y1 - y0 + 20)) * 0.8));
    this.camera.focus((x0 + x1) / 2, (y0 + y1) / 2, zoom);
  }
}
