// Estatisticas geograficas de cada provincia: area, terreno dominante, costa, rios,
// vizinhanca terrestre, polo de inacessibilidade (posicao de rotulo) e deteccao de ilhas.
import { T, F } from './terrain.mjs';
import { HAB } from './provinces.mjs';

const D2R = Math.PI / 180;
export const PT = { ...T, COAST: 9, ISLAND: 10 };

export function computeProvinceStats({ W, H, grid, owner, prov, terrain, flags, elev, provinces, islandKm2 }) {
  const N = W * H;
  const st = provinces.map(() => ({
    cells: 0, sx: 0, sy: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1,
    tc: new Int32Array(9), coast: 0, river: 0, hab: 0, elev: 0, area: 0, nbMap: new Map(),
  }));
  let totalArea = 0;
  let landCells = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (owner[i] === -1) continue;
      const west = x > 0 ? owner[i - 1] : 0;
      const east = x < W - 1 ? owner[i + 1] : 0;
      const north = y > 0 ? owner[i - W] : 0;
      const south = y < H - 1 ? owner[i + W] : 0;
      const coastal = west === -1 || east === -1 || north === -1 || south === -1;
      if (coastal) flags[i] |= F.COAST;
      const p = prov[i];
      if (p < 0) continue;
      const s = st[p];
      s.cells++;
      s.sx += x;
      s.sy += y;
      if (x < s.x0) s.x0 = x;
      if (y < s.y0) s.y0 = y;
      if (x > s.x1) s.x1 = x;
      if (y > s.y1) s.y1 = y;
      s.tc[terrain[i]]++;
      s.hab += HAB[terrain[i]];
      s.elev += elev[i];
      if (flags[i] & F.RIVER) s.river++;
      if (coastal) s.coast++;
      if (x < W - 1) {
        const q = prov[i + 1];
        if (q >= 0 && q !== p) {
          s.nbMap.set(q, (s.nbMap.get(q) || 0) + 1);
          st[q].nbMap.set(p, (st[q].nbMap.get(p) || 0) + 1);
        }
      }
      if (y < H - 1) {
        const q = prov[i + W];
        if (q >= 0 && q !== p) {
          s.nbMap.set(q, (s.nbMap.get(q) || 0) + 1);
          st[q].nbMap.set(p, (st[q].nbMap.get(p) || 0) + 1);
        }
      }
      const [lo0, la0] = grid.toLonLat(x + 0.5, y + 0.5);
      const [lo1, la1] = grid.toLonLat(x + 1.5, y + 0.5);
      const [lo2, la2] = grid.toLonLat(x + 0.5, y + 1.5);
      const k = Math.cos(la0 * D2R) * 111.32;
      const ax = (lo1 - lo0) * k;
      const ay = (la1 - la0) * 110.57;
      const bx = (lo2 - lo0) * k;
      const by = (la2 - la0) * 110.57;
      const a = Math.abs(ax * by - ay * bx);
      s.area += a;
      totalArea += a;
      landCells++;
    }
  }

  // Distancia ate a borda da provincia (para achar o polo de inacessibilidade).
  const dd = new Int32Array(N).fill(-1);
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) {
    const p = prov[i];
    if (p < 0) continue;
    const x = i % W;
    const edge =
      x === 0 || x === W - 1 || i < W || i + W >= N ||
      prov[i - 1] !== p || prov[i + 1] !== p || prov[i - W] !== p || prov[i + W] !== p;
    if (edge) {
      dd[i] = 0;
      q[qt++] = i;
    }
  }
  while (qh < qt) {
    const c = q[qh++];
    const x = c % W;
    const p = prov[c];
    const nbs = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c + W < N ? c + W : -1];
    for (const nb of nbs) {
      if (nb < 0 || prov[nb] !== p || dd[nb] !== -1) continue;
      dd[nb] = dd[c] + 1;
      q[qt++] = nb;
    }
  }

  // Massas de terra (inclui terra estrangeira) para detectar ilhas.
  const land = new Int32Array(N).fill(-1);
  const landSize = [];
  for (let i = 0; i < N; i++) {
    if (owner[i] === -1 || land[i] !== -1) continue;
    const id = landSize.length;
    let count = 0;
    qh = 0;
    qt = 0;
    q[qt++] = i;
    land[i] = id;
    while (qh < qt) {
      const c = q[qh++];
      count++;
      const x = c % W;
      const nbs = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c + W < N ? c + W : -1];
      for (const nb of nbs) {
        if (nb < 0 || owner[nb] === -1 || land[nb] !== -1) continue;
        land[nb] = id;
        q[qt++] = nb;
      }
    }
    landSize.push(count);
  }

  const best = provinces.map(() => ({ d: -1, c: -1, cd: Infinity }));
  for (let i = 0; i < N; i++) {
    const p = prov[i];
    if (p < 0) continue;
    const s = st[p];
    const cx = s.sx / s.cells;
    const cy = s.sy / s.cells;
    const dx = (i % W) - cx;
    const dy = ((i / W) | 0) - cy;
    const cd = dx * dx + dy * dy;
    const b = best[p];
    if (dd[i] > b.d || (dd[i] === b.d && cd < b.cd)) {
      b.d = dd[i];
      b.c = i;
      b.cd = cd;
    }
  }

  // Massas de terra menores que islandKm2 contam como ilha (terreno de guerra proprio).
  const islandLimit = islandKm2 / Math.max(1e-6, totalArea / Math.max(1, landCells));
  const stats = st.map((s, p) => {
    const pole = best[p].c;
    const px = pole % W;
    const py = (pole / W) | 0;
    const massSize = landSize[land[pole]];
    const island = massSize < islandLimit;
    let dom = T.PLAINS;
    let dc = -1;
    for (let t = 1; t <= 8; t++) {
      if (s.tc[t] > dc) {
        dc = s.tc[t];
        dom = t;
      }
    }
    let pt = dom;
    if (island) pt = PT.ISLAND;
    else if (dom === T.PLAINS && s.coast / s.cells >= 0.35) pt = PT.COAST;
    const [lon, lat] = grid.toLonLat(px + 0.5, py + 0.5);
    return {
      ...s,
      px,
      py,
      island,
      landmass: land[pole],
      terrain: pt,
      lon,
      lat,
      nb: [...s.nbMap.entries()].sort((a, b) => b[1] - a[1]),
    };
  });
  return { stats, totalArea, landCells, landOf: land };
}
