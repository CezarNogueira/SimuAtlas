// Classificacao de terreno por celula usando elevacao (GEBCO) e cobertura do solo (Blue Marble, julho).
export const T = { WATER: 0, PLAINS: 1, HILLS: 2, MOUNTAINS: 3, FOREST: 4, JUNGLE: 5, DESERT: 6, TUNDRA: 7, SWAMP: 8 };
export const F = { RIVER: 1, ICE: 2, LAKE: 4, COAST: 8 };

const D2R = Math.PI / 180;
const METERS_PER_UNIT = 25;
const SUB = [-0.33, 0, 0.33];
const RING = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

function jitter(i) {
  let h = Math.imul(i ^ 0x27d4eb2d, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296 - 0.5;
}

function hsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx / 255];
}

export function classifyTerrain({ W, H, grid, owner, flags, elevS, lcS, desertMask }) {
  const terrain = new Uint8Array(W * H);
  const elev = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (owner[i] === -1) continue;
      const [lon, lat] = grid.toLonLat(x + 0.5, y + 0.5);
      const [lonB, latB] = grid.toLonLat(x + 1.5, y + 1.5);
      const dLon = Math.min(2, Math.abs(lonB - lon));
      const dLat = Math.min(2, Math.abs(latB - lat));
      let es = 0;
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let n = 0;
      for (const fy of SUB) {
        for (const fx of SUB) {
          const lo = lon + fx * dLon;
          const la = lat + fy * dLat;
          es += elevS.red(lo, la);
          const k = lcS.idx(lo, la);
          rs += lcS.data[k];
          gs += lcS.data[k + 1];
          bs += lcS.data[k + 2];
          n++;
        }
      }
      const e = es / n;
      elev[i] = Math.round(e);
      // Rugosidade: desvio padrao da elevacao em offsets geograficos fixos (independente da resolucao).
      let sum = e;
      let sq = e * e;
      let m = 1;
      const cosL = Math.max(0.2, Math.cos(lat * D2R));
      for (const off of [0.15, 0.32]) {
        for (const [ax, ay] of RING) {
          const v = elevS.red(lon + (ax * off) / cosL, lat + ay * off);
          sum += v;
          sq += v * v;
          m++;
        }
      }
      const mean = sum / m;
      const rough = Math.sqrt(Math.max(0, sq / m - mean * mean)) * METERS_PER_UNIT;
      const meters = e * METERS_PER_UNIT;
      const [h, s, v] = hsv(rs / n, gs / n, bs / n);
      const aLat = Math.abs(lat);
      // Latitude com ruido por celula: evita fronteiras de bioma em linha reta.
      const latJ = aLat + jitter(i) * 5;

      const ice = v >= 0.8 && s <= 0.12;
      const forestColor = (v <= 0.17 && s >= 0.45 && h >= 40 && h <= 115) || (v <= 0.22 && s >= 0.65 && h >= 45 && h <= 110);
      const wetShield = h >= 170 && h <= 260 && v < 0.25;
      const desertColor =
        (v >= 0.45 && h >= 18 && h <= 46 && s >= 0.25) ||
        (v >= 0.38 && h >= 15 && h <= 32 && s >= 0.5) ||
        (desertMask[i] && v >= 0.33 && h <= 60);

      let t;
      if (ice) {
        flags[i] |= F.ICE;
        t = meters >= 2000 && rough >= 250 ? T.MOUNTAINS : T.TUNDRA;
      } else if (meters >= 2600 || (meters >= 1500 && rough >= 300) || (meters >= 700 && rough >= 450)) {
        t = T.MOUNTAINS;
      } else if (desertColor && aLat < 52) {
        t = T.DESERT;
      } else if (meters >= 1000 || (meters >= 350 && rough >= 150) || rough >= 230) {
        t = T.HILLS;
      } else if (forestColor || wetShield) {
        if (latJ >= 69 || (wetShield && latJ >= 60)) t = T.TUNDRA;
        else if (latJ <= 20 && !wetShield) t = T.JUNGLE;
        else t = T.FOREST;
      } else if (latJ >= 60 && v <= 0.5) {
        t = T.TUNDRA;
      } else {
        t = T.PLAINS;
      }
      terrain[i] = t;
    }
  }
  return { terrain, elev };
}

// Pantanos: poligonos de areas umidas/deltas + planicies boreais baixas ao longo de rios.
export function applySwamps({ W, H, grid, owner, terrain, flags, elev, wetMask, deltaMask }) {
  let count = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (owner[i] === -1) continue;
      const t = terrain[i];
      const soft = t === T.PLAINS || t === T.FOREST || t === T.JUNGLE || t === T.TUNDRA;
      if (!soft) continue;
      let swamp = false;
      if (wetMask[i]) swamp = true;
      else if (deltaMask[i] && t !== T.TUNDRA) swamp = true;
      else if (elev[i] <= 6 && (flags[i] & F.RIVER || flags[i - 1] & F.RIVER || flags[i + 1] & F.RIVER || flags[i - W] & F.RIVER || flags[i + W] & F.RIVER)) {
        const lat = Math.abs(grid.toLonLat(x + 0.5, y + 0.5)[1]);
        swamp = lat >= 55 && lat <= 68;
      }
      if (swamp) {
        terrain[i] = T.SWAMP;
        count++;
      }
    }
  }
  return count;
}
