// Rotas maritimas entre provincias costeiras: Voronoi sobre a agua (BFS multi-fonte).
// Onde regioes de agua de duas provincias se encontram, nasce uma rota candidata.
// Mantem rotas curtas e as pontes minimas necessarias para conectar massas de terra.
import { simplifyLine } from './geo.mjs';

class UnionFind {
  constructor(n) {
    this.p = new Int32Array(n);
    for (let i = 0; i < n; i++) this.p[i] = i;
  }
  find(a) {
    const p = this.p;
    while (p[a] !== a) {
      p[a] = p[p[a]];
      a = p[a];
    }
    return a;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[ra] = rb;
  }
}

export function buildSeaRoutes({ W, H, owner, prov, provCount, landNb, maxDist, maxBridge, perProvince = 5 }) {
  const N = W * H;
  const label = new Int32Array(N).fill(-1);
  const dist = new Int32Array(N);
  const parent = new Int32Array(N).fill(-1);
  const coastRef = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) {
    if (owner[i] !== -1) continue;
    const x = i % W;
    const nbs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i + W < N ? i + W : -1];
    for (const nb of nbs) {
      if (nb >= 0 && prov[nb] >= 0) {
        label[i] = prov[nb];
        coastRef[i] = nb;
        queue[qt++] = i;
        break;
      }
    }
  }
  const best = new Map();
  while (qh < qt) {
    const c = queue[qh++];
    const cx = c % W;
    const cy = (c / W) | 0;
    const lc = label[c];
    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        if (nx < 0 || nx >= W) continue;
        const nb = ny * W + nx;
        if (owner[nb] !== -1) continue;
        if (label[nb] === -1) {
          label[nb] = lc;
          dist[nb] = dist[c] + 1;
          parent[nb] = c;
          queue[qt++] = nb;
        } else if (label[nb] !== lc) {
          const a = Math.min(lc, label[nb]);
          const b = Math.max(lc, label[nb]);
          const key = a * 100000 + b;
          const d = dist[c] + dist[nb] + 1;
          const cur = best.get(key);
          if (!cur || d < cur.d) best.set(key, { a, b, d, ca: lc === a ? c : nb, cb: lc === a ? nb : c });
        }
      }
    }
  }

  const cands = [...best.values()].filter((e) => !landNb[e.a].has(e.b)).sort((p, q) => p.d - q.d);
  const uf = new UnionFind(provCount);
  for (let p = 0; p < provCount; p++) for (const q of landNb[p]) uf.union(p, q);
  const count = new Int32Array(provCount);
  const kept = [];
  const used = new Set();
  for (const e of cands) {
    if (e.d > maxDist) break;
    if (count[e.a] >= perProvince && count[e.b] >= perProvince) continue;
    kept.push(e);
    used.add(e);
    count[e.a]++;
    count[e.b]++;
    uf.union(e.a, e.b);
  }
  for (const e of cands) {
    if (e.d > maxBridge) break;
    if (used.has(e)) continue;
    if (uf.find(e.a) !== uf.find(e.b)) {
      kept.push(e);
      used.add(e);
      uf.union(e.a, e.b);
    }
  }

  const trace = (c) => {
    const cells = [];
    let cur = c;
    while (cur !== -1) {
      cells.push(cur);
      if (parent[cur] === -1) {
        cells.push(coastRef[cur]);
        break;
      }
      cur = parent[cur];
    }
    return cells;
  };
  return kept.map((e) => {
    const cells = trace(e.ca).reverse().concat(trace(e.cb));
    const pts = simplifyLine(cells.map((c) => [(c % W) + 0.5, ((c / W) | 0) + 0.5]), 1.2);
    return { a: e.a, b: e.b, d: e.d, pts: pts.flat().map((v) => Math.round(v * 2) / 2) };
  });
}
