// Geracao de provincias dentro de cada nacao:
// 1) sementes em cidades reais (capital primeiro) + preenchimento por ponto mais distante;
// 2) crescimento por custo de terreno (Dijkstra) com rios como fronteiras naturais;
// 3) relaxamento de Lloyd para sementes sinteticas; 4) fusao de provincias minusculas.
import { F } from './terrain.mjs';

// Habitabilidade e custo de travessia por tipo de terreno (indice = T.*).
export const HAB = new Float32Array([0, 1.0, 0.72, 0.28, 0.6, 0.42, 0.1, 0.1, 0.32]);
const COST = new Float32Array([99, 1.0, 1.6, 2.8, 1.3, 1.5, 1.15, 1.2, 1.7]);

export function hashCell(i) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const cityWeight = (pop) => Math.min(30, (pop || 0) / 120000);

class Heap {
  constructor(cap) {
    this.keys = new Float64Array(cap);
    this.vals = new Int32Array(cap);
    this.size = 0;
    this.lastKey = 0;
  }
  clear() {
    this.size = 0;
  }
  push(k, v) {
    if (this.size === this.keys.length) {
      const nk = new Float64Array(this.size * 2);
      nk.set(this.keys);
      this.keys = nk;
      const nv = new Int32Array(this.size * 2);
      nv.set(this.vals);
      this.vals = nv;
    }
    const keys = this.keys;
    const vals = this.vals;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= k) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = k;
    vals[i] = v;
  }
  pop() {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0];
    this.lastKey = keys[0];
    const n = --this.size;
    if (n > 0) {
      const k = keys[n];
      const v = vals[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= k) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = k;
      vals[i] = v;
    }
    return top;
  }
}

export function buildProvinces({ W, H, owner, terrain, flags, nationCount, cities, targetProvinces, nationMult }) {
  const N = W * H;
  const counts = new Int32Array(nationCount);
  for (let i = 0; i < N; i++) if (owner[i] >= 0) counts[owner[i]]++;
  const start = new Int32Array(nationCount + 1);
  for (let n = 0; n < nationCount; n++) start[n + 1] = start[n] + counts[n];
  const cellsOf = new Int32Array(start[nationCount]);
  const fillPos = start.slice(0, nationCount);
  for (let i = 0; i < N; i++) if (owner[i] >= 0) cellsOf[fillPos[owner[i]]++] = i;
  const totalLand = start[nationCount];

  const natW = new Float64Array(nationCount);
  for (let n = 0; n < nationCount; n++) {
    for (let k = start[n]; k < start[n + 1]; k++) natW[n] += HAB[terrain[cellsOf[k]]] + 0.03;
    if (nationMult) natW[n] *= nationMult[n];
  }
  const citiesByNation = Array.from({ length: nationCount }, () => []);
  for (const c of cities) {
    if (c.nation < 0) continue;
    natW[c.nation] += cityWeight(c.pop);
    citiesByNation[c.nation].push(c);
  }
  let totalW = 0;
  for (const w of natW) totalW += w;
  const wpp = totalW / targetProvinces;
  const avgCells = totalLand / targetProvinces;
  const minProvCells = Math.max(4, Math.round(avgCells * 0.12));

  const prov = new Int32Array(N).fill(-1);
  const comp = new Int32Array(N).fill(-1);
  const dist = new Float64Array(N);
  const bfsDist = new Int32Array(N);
  const queue = new Int32Array(N);
  const heap = new Heap(1 << 16);
  const provinces = [];
  let compCounter = 0;

  for (let n = 0; n < nationCount; n++) {
    const s = start[n];
    const e = start[n + 1];
    if (s === e) continue;

    // Componentes conexas (ilhas/exclaves) da nacao.
    const comps = [];
    for (let k = s; k < e; k++) {
      const c0 = cellsOf[k];
      if (comp[c0] !== -1) continue;
      const id = compCounter++;
      const cells = [];
      let w = 0;
      let qh = 0;
      let qt = 0;
      queue[qt++] = c0;
      comp[c0] = id;
      while (qh < qt) {
        const c = queue[qh++];
        cells.push(c);
        w += HAB[terrain[c]] + 0.03;
        const x = c % W;
        if (x > 0 && owner[c - 1] === n && comp[c - 1] === -1) { comp[c - 1] = id; queue[qt++] = c - 1; }
        if (x < W - 1 && owner[c + 1] === n && comp[c + 1] === -1) { comp[c + 1] = id; queue[qt++] = c + 1; }
        if (c >= W && owner[c - W] === n && comp[c - W] === -1) { comp[c - W] = id; queue[qt++] = c - W; }
        if (c + W < N && owner[c + W] === n && comp[c + W] === -1) { comp[c + W] = id; queue[qt++] = c + W; }
      }
      comps.push({ id, cells, w, k: 0 });
    }

    const cellsN = e - s;
    let nProv = Math.max(1, Math.round(natW[n] / wpp));
    nProv = Math.min(nProv, Math.max(1, Math.floor(cellsN / (minProvCells * 1.5))));
    nProv = Math.max(nProv, Math.ceil(cellsN / (avgCells * 3.5)));

    comps.sort((a, b) => b.cells.length - a.cells.length);
    const minComp = Math.max(minProvCells, 3);
    let big = comps.filter((c) => c.cells.length >= minComp);
    if (!big.length) big = [comps[0]];
    const bigSet = new Set(big);
    const bigW = big.reduce((acc, c) => acc + c.w, 0);
    for (const c of big) {
      c.k = Math.max(1, Math.round((nProv * c.w) / bigW));
      c.k = Math.min(c.k, Math.max(1, Math.floor(c.cells.length / minProvCells)));
    }

    const cityList = citiesByNation[n].slice().sort((a, b) => b.isCapital - a.isCapital || b.pop - a.pop);
    const seeds = [];

    const bfs = (src, compId) => {
      let qh = 0;
      let qt = 0;
      bfsDist[src] = 0;
      queue[qt++] = src;
      while (qh < qt) {
        const c = queue[qh++];
        const d = bfsDist[c] + 1;
        const x = c % W;
        if (x > 0 && comp[c - 1] === compId && bfsDist[c - 1] > d) { bfsDist[c - 1] = d; queue[qt++] = c - 1; }
        if (x < W - 1 && comp[c + 1] === compId && bfsDist[c + 1] > d) { bfsDist[c + 1] = d; queue[qt++] = c + 1; }
        if (c >= W && comp[c - W] === compId && bfsDist[c - W] > d) { bfsDist[c - W] = d; queue[qt++] = c - W; }
        if (c + W < N && comp[c + W] === compId && bfsDist[c + W] > d) { bfsDist[c + W] = d; queue[qt++] = c + W; }
      }
    };

    for (const cpt of big) {
      const chosen = [];
      const minD = 0.7 * Math.sqrt(cpt.cells.length / cpt.k);
      const minD2 = minD * minD;
      for (const city of cityList) {
        if (chosen.length >= cpt.k) break;
        if (comp[city.cell] !== cpt.id) continue;
        const cx = city.cell % W;
        const cy = (city.cell / W) | 0;
        let ok = true;
        for (const sd of chosen) {
          const dx = (sd.cell % W) - cx;
          const dy = ((sd.cell / W) | 0) - cy;
          if (dx * dx + dy * dy < minD2 || sd.cell === city.cell) {
            ok = false;
            break;
          }
        }
        if (ok) chosen.push({ cell: city.cell, city: city.idx });
      }
      if (chosen.length < cpt.k) {
        for (const c of cpt.cells) bfsDist[c] = 1 << 29;
        if (!chosen.length) {
          let sx = 0;
          let sy = 0;
          for (const c of cpt.cells) {
            sx += c % W;
            sy += (c / W) | 0;
          }
          sx /= cpt.cells.length;
          sy /= cpt.cells.length;
          let best = cpt.cells[0];
          let bd = Infinity;
          for (const c of cpt.cells) {
            const dx = (c % W) - sx;
            const dy = ((c / W) | 0) - sy;
            const d = dx * dx + dy * dy - HAB[terrain[c]] * 4;
            if (d < bd) {
              bd = d;
              best = c;
            }
          }
          chosen.push({ cell: best, city: -1 });
        }
        for (const sd of chosen) bfs(sd.cell, cpt.id);
        while (chosen.length < cpt.k) {
          let best = -1;
          let bestScore = -1;
          for (const c of cpt.cells) {
            const sc = bfsDist[c] * (0.55 + 0.45 * HAB[terrain[c]]);
            if (sc > bestScore) {
              bestScore = sc;
              best = c;
            }
          }
          if (best < 0 || bfsDist[best] < 2) break;
          chosen.push({ cell: best, city: -1 });
          bfs(best, cpt.id);
        }
      }
      seeds.push(...chosen);
    }

    const base = provinces.length;
    const grow = () => {
      for (let k = s; k < e; k++) {
        dist[cellsOf[k]] = Infinity;
        prov[cellsOf[k]] = -1;
      }
      heap.clear();
      seeds.forEach((sd, j) => {
        dist[sd.cell] = 0;
        prov[sd.cell] = base + j;
        heap.push(0, sd.cell);
      });
      while (heap.size) {
        const c = heap.pop();
        const d = heap.lastKey;
        if (d > dist[c]) continue;
        const x = c % W;
        const p = prov[c];
        for (let dir = 0; dir < 4; dir++) {
          let nb;
          if (dir === 0) { if (x === 0) continue; nb = c - 1; }
          else if (dir === 1) { if (x === W - 1) continue; nb = c + 1; }
          else if (dir === 2) { if (c < W) continue; nb = c - W; }
          else { if (c + W >= N) continue; nb = c + W; }
          if (owner[nb] !== n) continue;
          const nd = d + COST[terrain[nb]] + (flags[nb] & F.RIVER ? 0.9 : 0) + hashCell(nb) * 0.35;
          if (nd < dist[nb]) {
            dist[nb] = nd;
            prov[nb] = p;
            heap.push(nd, nb);
          }
        }
      }
    };
    grow();

    // Relaxamento de Lloyd para sementes sem cidade.
    for (let it = 0; it < 2 && seeds.some((sd) => sd.city < 0); it++) {
      const sx = new Float64Array(seeds.length);
      const sy = new Float64Array(seeds.length);
      const sc = new Float64Array(seeds.length);
      for (let k = s; k < e; k++) {
        const c = cellsOf[k];
        const p = prov[c] - base;
        if (p < 0) continue;
        sx[p] += c % W;
        sy[p] += (c / W) | 0;
        sc[p]++;
      }
      const bestD = new Float64Array(seeds.length).fill(Infinity);
      const bestC = new Int32Array(seeds.length).fill(-1);
      for (let k = s; k < e; k++) {
        const c = cellsOf[k];
        const p = prov[c] - base;
        if (p < 0 || seeds[p].city >= 0 || !sc[p]) continue;
        const dx = (c % W) - sx[p] / sc[p];
        const dy = ((c / W) | 0) - sy[p] / sc[p];
        const d = dx * dx + dy * dy;
        if (d < bestD[p]) {
          bestD[p] = d;
          bestC[p] = c;
        }
      }
      seeds.forEach((sd, j) => {
        if (sd.city < 0 && bestC[j] >= 0) sd.cell = bestC[j];
      });
      grow();
    }

    // Ilhotas sem semente: anexadas a provincia mais proxima da mesma nacao.
    for (const cpt of comps) {
      if (bigSet.has(cpt)) continue;
      let sx = 0;
      let sy = 0;
      for (const c of cpt.cells) {
        sx += c % W;
        sy += (c / W) | 0;
      }
      sx /= cpt.cells.length;
      sy /= cpt.cells.length;
      let best = 0;
      let bd = Infinity;
      seeds.forEach((sd, j) => {
        const dx = (sd.cell % W) - sx;
        const dy = ((sd.cell / W) | 0) - sy;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      for (const c of cpt.cells) prov[c] = base + best;
    }

    for (const sd of seeds) provinces.push({ nation: n, seed: sd.cell, city: sd.city });
  }

  // Fusao de provincias muito pequenas com a vizinha de maior fronteira (mesma nacao).
  const P = provinces.length;
  const size = new Int32Array(P);
  for (let i = 0; i < N; i++) if (prov[i] >= 0) size[prov[i]]++;
  const adj = Array.from({ length: P }, () => new Map());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p = prov[i];
      if (p < 0) continue;
      const qs = [x < W - 1 ? prov[i + 1] : -1, y < H - 1 ? prov[i + W] : -1];
      for (const q of qs) {
        if (q < 0 || q === p || provinces[p].nation !== provinces[q].nation) continue;
        adj[p].set(q, (adj[p].get(q) || 0) + 1);
        adj[q].set(p, (adj[q].get(p) || 0) + 1);
      }
    }
  }
  const parent = new Int32Array(P);
  for (let p = 0; p < P; p++) parent[p] = p;
  const find = (p) => {
    while (parent[p] !== p) {
      parent[p] = parent[parent[p]];
      p = parent[p];
    }
    return p;
  };
  const order = Array.from({ length: P }, (_, i) => i).sort((a, b) => size[a] - size[b]);
  for (const p of order) {
    if (size[p] >= minProvCells || find(p) !== p) continue;
    const pc = provinces[p].city;
    if (pc >= 0 && cities[pc].isCapital) continue;
    let best = -1;
    let bl = 0;
    for (const [q, len] of adj[p]) {
      if (len > bl) {
        bl = len;
        best = q;
      }
    }
    if (best < 0) {
      let bd = Infinity;
      const px = provinces[p].seed % W;
      const py = (provinces[p].seed / W) | 0;
      for (let q = 0; q < P; q++) {
        if (q === p || provinces[q].nation !== provinces[p].nation || find(q) !== q) continue;
        const dx = (provinces[q].seed % W) - px;
        const dy = ((provinces[q].seed / W) | 0) - py;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
    }
    if (best < 0) continue;
    const rb = find(best);
    if (rb === p) continue;
    parent[p] = rb;
    size[rb] += size[p];
    for (const [q, len] of adj[p]) {
      const rq = find(q);
      if (rq !== rb) adj[rb].set(rq, (adj[rb].get(rq) || 0) + len);
    }
  }
  const newId = new Int32Array(P).fill(-1);
  const out = [];
  for (let p = 0; p < P; p++) {
    if (find(p) === p) {
      newId[p] = out.length;
      out.push(provinces[p]);
    }
  }
  for (let i = 0; i < N; i++) if (prov[i] >= 0) prov[i] = newId[find(prov[i])];

  return { prov, provinces: out, avgCells, minProvCells };
}
