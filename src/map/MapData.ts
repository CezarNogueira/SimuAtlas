// MAP ENGINE (dados estaticos): grade de celulas, provincias, cidades, rotas maritimas
// e grafo de movimentacao entre provincias. Independente de DOM (roda no navegador e no Node).
import { terrainInfo } from '../data/terrain';
import type { GridTransform, ProjectionDef } from './projection';

export const CELL_OCEAN = 0xffff;
export const CELL_LAKE = 0xfffe;
export const CELL_FOREIGN = 0xfffd;
export const FLAG_RIVER = 1;
export const FLAG_ICE = 2;
export const FLAG_LAKE = 4;
export const FLAG_COAST = 8;

export interface MapNation {
  code: string;
  name: string;
  nameEn: string;
  continent: string;
  subregion: string;
  pop: number;
  gdp: number;
  income: string;
  economy: string;
  capital: number;
  popShare: number;
  provinces: number[];
}

export interface MapProvince {
  id: number;
  name: string;
  nation: number;
  cells: number;
  area: number;
  x: number;
  y: number;
  lx: number;
  ly: number;
  bbox: [number, number, number, number];
  terrain: number;
  mix: number[];
  coast: number;
  river: number;
  island: number;
  hab: number;
  elev: number;
  lat: number;
  lon: number;
  cities: number[];
  nb: [number, number][];
}

export interface MapCity {
  id: number;
  name: string;
  p: number;
  x: number;
  y: number;
  pop: number;
  cap: number;
  rank: number;
  synthetic?: number;
}

export interface SeaRoute {
  a: number;
  b: number;
  d: number;
  pts: number[];
}

export interface MapLabel {
  name: string;
  type: string;
  x: number;
  y: number;
  rank: number;
  size?: number;
}

export interface MapJson {
  id: string;
  name: string;
  description: string;
  version: number;
  width: number;
  height: number;
  projection?: ProjectionDef;
  transform?: GridTransform;
  avgProvinceCells: number;
  kmPerCell: number;
  nations: MapNation[];
  provinces: MapProvince[];
  cities: MapCity[];
  seaRoutes: SeaRoute[];
  features: MapLabel[];
  seas: MapLabel[];
}

export interface MapSummary {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  nations: number;
  provinces: number;
  cities: number;
}

export class MapData {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly cells: Uint16Array;
  readonly terrain: Uint8Array;
  readonly elev: Uint8Array;
  readonly flags: Uint8Array;
  readonly provinces: MapProvince[];
  readonly cities: MapCity[];
  readonly nations: MapNation[];
  readonly seaRoutes: SeaRoute[];
  readonly features: MapLabel[];
  readonly seas: MapLabel[];
  readonly avgDiameter: number;
  readonly kmPerCell: number;
  readonly projection?: ProjectionDef;
  readonly transform?: GridTransform;
  // Celulas por provincia (CSR).
  readonly cellStart: Int32Array;
  readonly cellList: Int32Array;
  // Grafo de movimento (CSR): arestas terrestres e maritimas.
  readonly edgeStart: Int32Array;
  readonly edgeTo: Int32Array;
  readonly edgeDays: Float32Array;
  readonly edgeSea: Uint8Array;
  readonly edgeRoute: Int32Array;
  readonly coastal: Uint8Array;

  constructor(json: MapJson, grid: ArrayBuffer) {
    this.id = json.id;
    this.name = json.name;
    const view = new DataView(grid);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'AVMG') throw new Error('Arquivo de grade inválido');
    this.width = view.getUint16(6, true);
    this.height = view.getUint16(8, true);
    const N = this.width * this.height;
    this.cells = new Uint16Array(grid, 12, N);
    this.terrain = new Uint8Array(grid, 12 + N * 2, N);
    this.elev = new Uint8Array(grid, 12 + N * 3, N);
    this.flags = new Uint8Array(grid, 12 + N * 4, N);
    this.provinces = json.provinces;
    this.cities = json.cities;
    this.nations = json.nations;
    this.seaRoutes = json.seaRoutes;
    this.features = json.features;
    this.seas = json.seas;
    this.kmPerCell = json.kmPerCell;
    this.projection = json.projection;
    this.transform = json.transform;
    this.avgDiameter = Math.sqrt(json.avgProvinceCells);

    const P = this.provinces.length;
    const counts = new Int32Array(P + 1);
    for (let i = 0; i < N; i++) {
      const c = this.cells[i];
      if (c < P) counts[c + 1]++;
    }
    this.cellStart = new Int32Array(P + 1);
    for (let p = 0; p < P; p++) this.cellStart[p + 1] = this.cellStart[p] + counts[p + 1];
    this.cellList = new Int32Array(this.cellStart[P]);
    const fill = this.cellStart.slice(0, P);
    for (let i = 0; i < N; i++) {
      const c = this.cells[i];
      if (c < P) this.cellList[fill[c]++] = i;
    }

    this.coastal = new Uint8Array(P);
    for (const prov of this.provinces) this.coastal[prov.id] = prov.coast > 0 ? 1 : 0;

    const edges: { from: number; to: number; days: number; sea: number; route: number }[] = [];
    const diam = this.avgDiameter;
    for (const prov of this.provinces) {
      for (const [q] of prov.nb) {
        const other = this.provinces[q];
        const d = Math.hypot(other.x - prov.x, other.y - prov.y) / diam;
        const days = Math.max(3, Math.min(45, 8 * Math.max(0.5, d) * terrainInfo(other.terrain).moveCost));
        edges.push({ from: prov.id, to: q, days, sea: 0, route: -1 });
      }
    }
    this.seaRoutes.forEach((r, idx) => {
      const days = Math.max(4, Math.min(120, 5 + (4 * r.d) / diam));
      edges.push({ from: r.a, to: r.b, days, sea: 1, route: idx });
      edges.push({ from: r.b, to: r.a, days, sea: 1, route: idx });
    });
    edges.sort((a, b) => a.from - b.from);
    this.edgeStart = new Int32Array(P + 1);
    this.edgeTo = new Int32Array(edges.length);
    this.edgeDays = new Float32Array(edges.length);
    this.edgeSea = new Uint8Array(edges.length);
    this.edgeRoute = new Int32Array(edges.length);
    edges.forEach((e, i) => {
      this.edgeTo[i] = e.to;
      this.edgeDays[i] = e.days;
      this.edgeSea[i] = e.sea;
      this.edgeRoute[i] = e.route;
      this.edgeStart[e.from + 1]++;
    });
    for (let p = 0; p < P; p++) this.edgeStart[p + 1] += this.edgeStart[p];
  }

  get provinceCount(): number {
    return this.provinces.length;
  }

  provinceAt(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) return -1;
    const c = this.cells[iy * this.width + ix];
    return c < this.provinces.length ? c : -1;
  }

  edgeBetween(a: number, b: number): number {
    for (let e = this.edgeStart[a]; e < this.edgeStart[a + 1]; e++) if (this.edgeTo[e] === b) return e;
    return -1;
  }

  areLandNeighbors(a: number, b: number): boolean {
    for (let e = this.edgeStart[a]; e < this.edgeStart[a + 1]; e++) if (this.edgeTo[e] === b && !this.edgeSea[e]) return true;
    return false;
  }
}

export interface MapSource {
  json(path: string): Promise<unknown>;
  gzipBinary(path: string): Promise<ArrayBuffer>;
}

export const browserMapSource = (base = 'maps'): MapSource => ({
  async json(path) {
    const res = await fetch(`${base}/${path}`);
    if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
    return res.json();
  },
  async gzipBinary(path) {
    const res = await fetch(`${base}/${path}`);
    if (!res.ok || !res.body) throw new Error(`Falha ao carregar ${path}`);
    const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  },
});

export async function loadMap(id: string, source: MapSource): Promise<MapData> {
  const [json, grid] = await Promise.all([source.json(`${id}/map.json`), source.gzipBinary(`${id}/grid.dat`)]);
  return new MapData(json as MapJson, grid);
}

export async function loadMapIndex(source: MapSource): Promise<MapSummary[]> {
  return (await source.json('index.json')) as MapSummary[];
}
