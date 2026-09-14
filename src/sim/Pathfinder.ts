// Busca de caminhos no grafo de provincias (Dijkstra limitado e A*), sem alocacoes por consulta.
import type { MapData } from '../map/MapData';

export type CanEnter = (province: number) => boolean;

class MinHeap {
  keys = new Float64Array(1024);
  vals = new Int32Array(1024);
  size = 0;
  lastKey = 0;
  push(k: number, v: number): void {
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
  pop(): number {
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

export class Pathfinder {
  private readonly dist: Float64Array;
  private readonly prev: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private gen = 1;
  private heap = new MinHeap();
  // Resultado da ultima exploracao (provincias alcancadas em ordem de distancia).
  reached: number[] = [];

  constructor(private readonly map: MapData) {
    const P = map.provinceCount;
    this.dist = new Float64Array(P);
    this.prev = new Int32Array(P);
    this.stamp = new Uint32Array(P);
    this.closed = new Uint32Array(P);
  }

  private reset(): void {
    this.gen++;
    if (this.gen > 0xfffffff0) {
      this.stamp.fill(0);
      this.closed.fill(0);
      this.gen = 1;
    }
    this.heap.size = 0;
    this.reached.length = 0;
  }

  // Dijkstra a partir de "from" ate maxDays. speed divide o custo das arestas.
  explore(from: number, canEnter: CanEnter, allowSea: boolean, maxDays: number, speed = 1): void {
    this.reset();
    const m = this.map;
    const g = this.gen;
    this.stamp[from] = g;
    this.dist[from] = 0;
    this.prev[from] = -1;
    this.heap.push(0, from);
    while (this.heap.size) {
      const p = this.heap.pop();
      const d = this.heap.lastKey;
      if (this.closed[p] === g) continue;
      this.closed[p] = g;
      this.reached.push(p);
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        if (m.edgeSea[e] && !allowSea) continue;
        const q = m.edgeTo[e];
        if (this.closed[q] === g) continue;
        const nd = d + m.edgeDays[e] / speed;
        if (nd > maxDays) continue;
        if (this.stamp[q] === g && nd >= this.dist[q]) continue;
        if (!canEnter(q)) continue;
        this.stamp[q] = g;
        this.dist[q] = nd;
        this.prev[q] = p;
        this.heap.push(nd, q);
      }
    }
  }

  distanceTo(p: number): number {
    return this.closed[p] === this.gen ? this.dist[p] : Infinity;
  }

  // Caminho (sem a origem) ate p usando a ultima exploracao.
  pathTo(p: number): number[] {
    if (this.closed[p] !== this.gen) return [];
    const out: number[] = [];
    let cur = p;
    while (cur >= 0 && this.prev[cur] >= 0) {
      out.push(cur);
      cur = this.prev[cur];
    }
    return out.reverse();
  }

  // A* direto entre duas provincias.
  findPath(from: number, to: number, canEnter: CanEnter, allowSea: boolean, maxDays = 720, speed = 1): number[] | null {
    if (from === to) return [];
    this.reset();
    const m = this.map;
    const g = this.gen;
    const target = m.provinces[to];
    const h = (p: number) => {
      const pr = m.provinces[p];
      return (Math.hypot(pr.x - target.x, pr.y - target.y) / m.avgDiameter) * 2.5 / speed;
    };
    this.stamp[from] = g;
    this.dist[from] = 0;
    this.prev[from] = -1;
    this.heap.push(h(from), from);
    while (this.heap.size) {
      const p = this.heap.pop();
      if (this.closed[p] === g) continue;
      this.closed[p] = g;
      if (p === to) return this.pathTo(to);
      const d = this.dist[p];
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        if (m.edgeSea[e] && !allowSea) continue;
        const q = m.edgeTo[e];
        if (this.closed[q] === g) continue;
        const nd = d + m.edgeDays[e] / speed;
        if (nd > maxDays) continue;
        if (this.stamp[q] === g && nd >= this.dist[q]) continue;
        if (q !== to && !canEnter(q)) continue;
        this.stamp[q] = g;
        this.dist[q] = nd;
        this.prev[q] = p;
        this.heap.push(nd + h(q), q);
      }
    }
    return null;
  }
}
