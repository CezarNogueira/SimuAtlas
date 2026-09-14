// Textura estatica do terreno em pixel art (1 texel = 1 celula): oceano texturizado com halo
// costeiro e grade de latitude/longitude, relevo sombreado, rios e glifos de montanhas,
// colinas, florestas, dunas e pantanos no estilo de atlas antigo.
import { TERRAIN, TERRAINS } from '../../data/terrain';
import { CELL_FOREIGN, CELL_LAKE, CELL_OCEAN, FLAG_ICE, FLAG_RIVER, type MapData } from '../../map/MapData';
import { makeInverse, type GridTransform, type ProjectionDef } from '../../map/projection';
import { hash01, mix, scale, valueNoise, type RGB } from '../colors';

export interface TerrainTexture {
  width: number;
  height: number;
  base: Uint8ClampedArray; // RGBA por celula
  tone: Uint8Array; // luminancia relativa do solo (128 = neutro), usada na mesclagem politica
}

const COAST_INK: RGB = [30, 52, 84];
const HALO: RGB = [140, 184, 212];
const SHALLOW: RGB = [98, 142, 188];
const MID: RGB = [74, 116, 166];
const DEEP: RGB = [60, 98, 148];
const GRID: RGB = [112, 150, 192];
const RIVER: RGB = [74, 122, 172];
const FOREIGN: RGB = [184, 176, 154];
const ICE: RGB = [238, 241, 240];

export function buildTerrainTexture(map: MapData, projection?: ProjectionDef, transform?: GridTransform): TerrainTexture {
  const W = map.width;
  const H = map.height;
  const N = W * H;
  const P = map.provinceCount;
  const cells = map.cells;
  const base = new Uint8ClampedArray(N * 4);
  const tone = new Uint8Array(N).fill(128);
  const isWater = (c: number) => c === CELL_OCEAN || c === CELL_LAKE;

  // Distancia ate a terra para o halo costeiro: transformada de chanfro 3-4 (quase euclidiana),
  // para que ilhas pequenas ganhem halos arredondados em vez de losangos.
  const cham = new Uint16Array(N).fill(65535);
  for (let i = 0; i < N; i++) if (!isWater(cells[i])) cham[i] = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = cham[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, cham[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, cham[i - W] + 3);
        if (x > 0) v = Math.min(v, cham[i - W - 1] + 4);
        if (x < W - 1) v = Math.min(v, cham[i - W + 1] + 4);
      }
      cham[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = cham[i];
      if (v === 0) continue;
      if (x < W - 1) v = Math.min(v, cham[i + 1] + 3);
      if (y < H - 1) {
        v = Math.min(v, cham[i + W] + 3);
        if (x < W - 1) v = Math.min(v, cham[i + W + 1] + 4);
        if (x > 0) v = Math.min(v, cham[i + W - 1] + 4);
      }
      cham[i] = v;
    }
  }
  const dist = new Uint8Array(N);
  // Vizinhos diagonais (4) contam como distancia 2: o contorno do litoral continua com 1 pixel.
  for (let i = 0; i < N; i++) dist[i] = cham[i] === 4 ? 2 : Math.min(255, Math.round(cham[i] / 3));

  // Grade de latitude/longitude.
  const gridMask = new Uint8Array(N);
  if (projection && transform) {
    const inv = makeInverse(projection, transform);
    const span = Math.abs(inv(W - 1, H / 2)[0] - inv(0, H / 2)[0]);
    const step = span > 200 ? 15 : span > 90 ? 10 : 5;
    const lonCell = new Float64Array(N);
    const latCell = new Float64Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [lon, lat] = inv(x + 0.5, y + 0.5);
        lonCell[y * W + x] = lon;
        latCell[y * W + x] = lat;
      }
    }
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x;
        if (Math.floor(lonCell[i] / step) !== Math.floor(lonCell[i + 1] / step)) gridMask[i] = 1;
        if (Math.floor(latCell[i] / step) !== Math.floor(latCell[i + W] / step)) gridMask[i] = 1;
      }
    }
  }

  const put = (i: number, c: RGB) => {
    const o = i * 4;
    base[o] = c[0];
    base[o + 1] = c[1];
    base[o + 2] = c[2];
    base[o + 3] = 255;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = cells[i];
      if (isWater(c)) {
        const d = dist[i];
        let col: RGB;
        if (d <= 1) col = COAST_INK;
        else if (d === 2) col = HALO;
        else if (d === 3) col = (x + y) % 2 ? HALO : SHALLOW;
        else if (d <= 5) col = SHALLOW;
        else if (d === 6) col = (x + y) % 2 ? SHALLOW : MID;
        else if (d <= 10) col = MID;
        else if (d === 11) col = (x + y) % 2 ? MID : DEEP;
        else col = DEEP;
        const n = (valueNoise(x / 23, y / 23) - 0.5) * 0.16 + (valueNoise(x / 6, y / 6) - 0.5) * 0.06;
        col = scale(col, 1 + n);
        if (gridMask[i] && d > 2 && (x + y) % 3 !== 0) col = mix(col, GRID, 0.7);
        put(i, col);
        continue;
      }
      const t = map.terrain[i] || TERRAIN.PLAINS;
      let col: RGB = TERRAINS[t]?.color ?? TERRAINS[1].color;
      if (map.flags[i] & FLAG_ICE) col = ICE;
      if (c === CELL_FOREIGN) col = mix(col, FOREIGN, 0.65);
      const e = map.elev[i];
      const nw = x > 0 && y > 0 ? map.elev[i - W - 1] : e;
      const se = x < W - 1 && y < H - 1 ? map.elev[i + W + 1] : e;
      let shade = 1 + (nw - se) * 0.014;
      shade = Math.max(0.74, Math.min(1.22, shade));
      const n = (valueNoise(x / 9, y / 9) - 0.5) * 0.08 + (hash01(x, y) - 0.5) * 0.05;
      col = scale(col, shade + n);
      if (map.flags[i] & FLAG_RIVER && c !== CELL_FOREIGN) col = mix(col, RIVER, 0.85);
      put(i, col);
      tone[i] = Math.max(40, Math.min(210, Math.round(128 * (shade + n))));
    }
  }

  // Glifos de terreno.
  const terrainAt = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H && !isWater(cells[y * W + x]) ? map.terrain[y * W + x] : -1);
  const riverAt = (x: number, y: number) => (map.flags[y * W + x] & FLAG_RIVER) !== 0;
  const stamp = (gx: number, gy: number, rows: string[], palette: Record<string, (c: RGB) => RGB>, allowed: number[]) => {
    for (let dy = 0; dy < rows.length; dy++) {
      for (let dx = 0; dx < rows[dy].length; dx++) {
        const ch = rows[dy][dx];
        if (ch === '.') continue;
        const x = gx + dx;
        const y = gy + dy;
        const t = terrainAt(x, y);
        if (t < 0 || !allowed.includes(t) || riverAt(x, y)) continue;
        const i = y * W + x;
        const o = i * 4;
        const cur: RGB = [base[o], base[o + 1], base[o + 2]];
        const next = palette[ch](cur);
        put(i, next);
        tone[i] = Math.max(40, Math.min(210, Math.round(tone[i] * (next[0] + next[1] + next[2] + 1) / (cur[0] + cur[1] + cur[2] + 1))));
      }
    }
  };
  const L = (c: RGB) => scale(c, 1.28);
  const M = (c: RGB) => scale(c, 1.0);
  const D = (c: RGB) => scale(c, 0.62);
  const DD = (c: RGB) => scale(c, 0.48);
  const TRUNK = () => [104, 80, 50] as RGB;
  const MOUNTAIN = ['...L...', '..LMD..', '.LMMDD.', 'LMMMDDD'];
  const HILL = ['.LMD.', 'LMMDD'];
  const TREE = ['.D.', 'DMD', '.T.'];
  const PALM = ['D.D', '.D.', '.T.'];
  const DUNE = ['.LL..', 'L..DD'];
  const REED = ['D.D', '.D.'];
  const SNOW = ['L'];
  for (let gy = 0; gy < H; gy += 3) {
    for (let gx = 0; gx < W; gx += 3) {
      const jx = gx + Math.floor(hash01(gx, gy) * 3);
      const jy = gy + Math.floor(hash01(gy, gx) * 3);
      const t = terrainAt(jx, jy);
      if (t < 0 || cells[jy * W + jx] === CELL_FOREIGN) continue;
      const r = hash01(jx * 7, jy * 13);
      if (t === TERRAIN.MOUNTAINS && r < 0.5) stamp(jx - 3, jy - 3, MOUNTAIN, { L, M, D }, [TERRAIN.MOUNTAINS, TERRAIN.HILLS]);
      else if (t === TERRAIN.HILLS && r < 0.22) stamp(jx - 2, jy - 1, HILL, { L, M, D }, [TERRAIN.HILLS, TERRAIN.MOUNTAINS]);
      else if (t === TERRAIN.FOREST && r < 0.45) stamp(jx - 1, jy - 1, TREE, { D, M: (c) => scale(c, 0.85), T: TRUNK }, [TERRAIN.FOREST]);
      else if (t === TERRAIN.JUNGLE && r < 0.6) stamp(jx - 1, jy - 1, PALM, { D: DD, T: TRUNK }, [TERRAIN.JUNGLE]);
      else if (t === TERRAIN.DESERT && r < 0.18) stamp(jx - 2, jy, DUNE, { L, D: (c) => scale(c, 0.8) }, [TERRAIN.DESERT]);
      else if (t === TERRAIN.SWAMP && r < 0.35) stamp(jx - 1, jy, REED, { D: () => [96, 128, 118] as RGB }, [TERRAIN.SWAMP]);
      else if (t === TERRAIN.TUNDRA && r < 0.12) stamp(jx, jy, SNOW, { L: () => [240, 242, 238] as RGB }, [TERRAIN.TUNDRA]);
    }
  }
  return { width: W, height: H, base, tone };
}

export function terrainProvinceCount(map: MapData): number {
  return map.provinceCount;
}

export const isLandCell = (c: number, P: number) => c < P || c === CELL_FOREIGN;
