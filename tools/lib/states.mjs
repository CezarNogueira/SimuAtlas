// ESTADOS: divide cada nacao em seus estados, provincias ou regioes reais (Natural Earth admin-1).
// 1) rasteriza as unidades admin-1 dentro da nacao dona de cada celula; paises com divisoes finas
//    demais (condados, departamentos...) sao agrupados pela regiao oficial, e territorios incorporados
//    a uma nacao-mae (Hong Kong, Andorra...) viram uma unidade unica;
// 2) celulas sem unidade (diferencas de contorno, ilhotas) recebem a unidade vizinha ou a mais proxima;
// 3) fusoes: vizinhas de mesmo nome, cidades-estado encravadas e unidades pequenas demais para a escala
//    do mapa juntam-se a vizinha com maior fronteira (ilhas pequenas, a unidade mais proxima).
import { regionGroup, stateName } from './names.mjs';

const D2R = Math.PI / 180;

export function buildStates({ W, H, grid, owner, nationCodes, nationNames, admin1, rasterize, parent, territoryName, minStateKm2, islandMergeKm }) {
  const N = W * H;
  const codeToNation = new Map(nationCodes.map((code, n) => [code, n]));

  // 1. Unidades e rasterizacao.
  const adm = new Int32Array(N).fill(-1);
  const units = [];
  const keyIndex = new Map();
  const unitOf = (key, nation, name) => {
    let u = keyIndex.get(key);
    if (u === undefined) {
      u = units.length;
      keyIndex.set(key, u);
      units.push({ key, nation, name });
    }
    return u;
  };
  for (const f of admin1) {
    const props = f.properties;
    const code = props.adm0_a3;
    let nationCode = code;
    if (code in parent) {
      if (!parent[code]) continue;
      nationCode = parent[code];
    }
    const n = codeToNation.get(nationCode);
    if (n === undefined) continue;
    let key;
    let name;
    if (code !== nationCode) {
      key = `T:${code}`;
      name = territoryName(code);
    } else {
      const group = regionGroup(code, props.region);
      if (group) {
        key = `R:${code}:${group}`;
        name = group;
      } else {
        key = `U:${props.adm1_code || props.ne_id}`;
        name = stateName(props);
      }
    }
    const u = unitOf(key, n, name);
    rasterize(f, (i, forced) => {
      if (!forced && owner[i] === n) adm[i] = u;
    });
  }

  // 2. Celulas sem unidade: crescem a partir das vizinhas da mesma nacao.
  const queue = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) if (adm[i] >= 0) queue[qt++] = i;
  while (qh < qt) {
    const c = queue[qh++];
    const u = adm[c];
    const n = owner[c];
    const x = c % W;
    if (x > 0 && owner[c - 1] === n && adm[c - 1] < 0) { adm[c - 1] = u; queue[qt++] = c - 1; }
    if (x < W - 1 && owner[c + 1] === n && adm[c + 1] < 0) { adm[c + 1] = u; queue[qt++] = c + 1; }
    if (c >= W && owner[c - W] === n && adm[c - W] < 0) { adm[c - W] = u; queue[qt++] = c - W; }
    if (c + W < N && owner[c + W] === n && adm[c + W] < 0) { adm[c + W] = u; queue[qt++] = c + W; }
  }
  // Ilhotas isoladas sem unidade: vao para a unidade mais proxima da nacao (ou uma unidade com o nome da nacao).
  const cen = units.map(() => ({ x: 0, y: 0, n: 0 }));
  for (let i = 0; i < N; i++) {
    const u = adm[i];
    if (u < 0) continue;
    cen[u].x += i % W;
    cen[u].y += (i / W) | 0;
    cen[u].n++;
  }
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0 || adm[i] !== -1) continue;
    const n = owner[i];
    const comp = [i];
    adm[i] = -2;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k];
      const x = c % W;
      const nbs = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c + W < N ? c + W : -1];
      for (const nb of nbs) {
        if (nb >= 0 && owner[nb] === n && adm[nb] === -1) {
          adm[nb] = -2;
          comp.push(nb);
        }
      }
    }
    let cx = 0;
    let cy = 0;
    for (const c of comp) {
      cx += c % W;
      cy += (c / W) | 0;
    }
    cx /= comp.length;
    cy /= comp.length;
    let best = -1;
    let bd = Infinity;
    for (let u = 0; u < units.length; u++) {
      if (units[u].nation !== n || !cen[u].n) continue;
      const d = (cen[u].x / cen[u].n - cx) ** 2 + (cen[u].y / cen[u].n - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (best < 0) {
      best = unitOf(`N:${n}`, n, nationNames[n]);
      if (!cen[best]) cen[best] = { x: 0, y: 0, n: 0 };
    }
    for (const c of comp) {
      adm[c] = best;
      cen[best].x += c % W;
      cen[best].y += (c / W) | 0;
      cen[best].n++;
    }
  }

  // 3. Area, centroide e fronteiras de cada unidade.
  const U = units.length;
  const area = new Float64Array(U);
  const cells = new Int32Array(U);
  const sx = new Float64Array(U);
  const sy = new Float64Array(U);
  const foreign = new Int32Array(U);
  const adj = Array.from({ length: U }, () => new Map());
  let totalArea = 0;
  let totalCells = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = adm[i];
      if (a >= 0) {
        const [lo0, la0] = grid.toLonLat(x + 0.5, y + 0.5);
        const [lo1, la1] = grid.toLonLat(x + 1.5, y + 0.5);
        const [lo2, la2] = grid.toLonLat(x + 0.5, y + 1.5);
        let d1 = lo1 - lo0;
        let d2 = lo2 - lo0;
        if (d1 > 180) d1 -= 360;
        else if (d1 < -180) d1 += 360;
        if (d2 > 180) d2 -= 360;
        else if (d2 < -180) d2 += 360;
        const k = Math.cos(la0 * D2R) * 111.32;
        const cellArea = Math.abs(d1 * k * (la2 - la0) * 110.57 - (la1 - la0) * 110.57 * d2 * k);
        area[a] += cellArea;
        cells[a]++;
        sx[a] += x;
        sy[a] += y;
        totalArea += cellArea;
        totalCells++;
      }
      for (let side = 0; side < 2; side++) {
        let j;
        if (side === 0) {
          if (x === W - 1) continue;
          j = i + 1;
        } else {
          if (y === H - 1) continue;
          j = i + W;
        }
        const b = adm[j];
        if (a === b) continue;
        if (a >= 0 && b >= 0) {
          if (units[a].nation === units[b].nation) {
            adj[a].set(b, (adj[a].get(b) || 0) + 1);
            adj[b].set(a, (adj[b].get(a) || 0) + 1);
          } else {
            foreign[a]++;
            foreign[b]++;
          }
        } else if (a >= 0 && owner[j] !== -1) {
          foreign[a]++;
        } else if (b >= 0 && owner[i] !== -1) {
          foreign[b]++;
        }
      }
    }
  }
  const kmPerCell = Math.sqrt(totalArea / Math.max(1, totalCells));
  const unitCount = [...cells].filter((c) => c > 0).length;

  // Celulas de cada unidade original (CSR) para buscas de proximidade.
  const ustart = new Int32Array(U + 1);
  for (let i = 0; i < N; i++) if (adm[i] >= 0) ustart[adm[i] + 1]++;
  for (let u = 0; u < U; u++) ustart[u + 1] += ustart[u];
  const ulist = new Int32Array(ustart[U]);
  const fill = ustart.slice(0, U);
  for (let i = 0; i < N; i++) if (adm[i] >= 0) ulist[fill[adm[i]]++] = i;

  // 4. Fusoes (union-find sobre as unidades).
  const root = new Int32Array(U);
  for (let u = 0; u < U; u++) root[u] = u;
  const find = (u) => {
    while (root[u] !== u) {
      root[u] = root[root[u]];
      u = root[u];
    }
    return u;
  };
  const names = units.map((u) => u.name);
  const nameArea = Float64Array.from(area);
  const members = units.map((_, u) => [u]);
  const alive = (u) => cells[u] > 0 && root[u] === u;
  let merges = 0;
  const merge = (a, b) => {
    root[a] = b;
    cells[b] += cells[a];
    area[b] += area[a];
    sx[b] += sx[a];
    sy[b] += sy[a];
    foreign[b] += foreign[a];
    if (nameArea[a] > nameArea[b]) {
      names[b] = names[a];
      nameArea[b] = nameArea[a];
    }
    for (const m of members[a]) members[b].push(m);
    members[a] = [];
    for (const [c, len] of adj[a]) {
      if (c === b) continue;
      adj[b].set(c, (adj[b].get(c) || 0) + len);
      adj[c].delete(a);
      adj[c].set(b, (adj[c].get(b) || 0) + len);
    }
    adj[b].delete(a);
    adj[a].clear();
    merges++;
  };

  // 4a. Vizinhas com o mesmo nome (ex.: cidade e provincia homonimas).
  for (let changed = true; changed; ) {
    changed = false;
    for (let u = 0; u < U; u++) {
      if (!alive(u)) continue;
      for (const v of adj[u].keys()) {
        if (names[v] !== names[u]) continue;
        if (area[u] < area[v]) merge(u, v);
        else merge(v, u);
        changed = true;
        break;
      }
    }
  }

  // 4b. Cidades-estado encravadas em uma unica unidade (Berlim, Viena, Moscou...).
  for (let u = 0; u < U; u++) {
    if (!alive(u) || adj[u].size !== 1 || foreign[u] > 0) continue;
    const [v] = adj[u].keys();
    if (area[u] < area[v] * 0.25 && area[u] < minStateKm2 * 4) merge(u, v);
  }

  // 4c. Unidades pequenas demais para a escala: vizinha de maior fronteira; ilhas, a unidade mais proxima.
  const radius = Math.max(1, Math.ceil(islandMergeKm / kmPerCell));
  const stamp = new Int32Array(N);
  const dist = new Int32Array(N);
  let stampId = 0;
  const nearbyUnit = (u) => {
    stampId++;
    const n = units[u].nation;
    let h = 0;
    let t = 0;
    for (const m of members[u]) {
      for (let k = ustart[m]; k < ustart[m + 1]; k++) {
        const c = ulist[k];
        stamp[c] = stampId;
        dist[c] = 0;
        queue[t++] = c;
      }
    }
    while (h < t) {
      const c = queue[h++];
      const d = dist[c];
      if (d >= radius) continue;
      const x = c % W;
      const nbs = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c + W < N ? c + W : -1];
      for (const nb of nbs) {
        if (nb < 0 || stamp[nb] === stampId) continue;
        stamp[nb] = stampId;
        dist[nb] = d + 1;
        const a = adm[nb];
        if (a >= 0 && units[a].nation === n) {
          const r = find(a);
          if (r !== u) return r;
        }
        queue[t++] = nb;
      }
    }
    return -1;
  };
  const nearestByCentroid = (u) => {
    const n = units[u].nation;
    const ux = sx[u] / cells[u];
    const uy = sy[u] / cells[u];
    let best = -1;
    let bd = Infinity;
    for (let v = 0; v < U; v++) {
      if (v === u || !alive(v) || units[v].nation !== n) continue;
      const d = (sx[v] / cells[v] - ux) ** 2 + (sy[v] / cells[v] - uy) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  };
  for (let pass = 0; pass < 60; pass++) {
    const order = [];
    for (let u = 0; u < U; u++) if (alive(u) && area[u] < minStateKm2) order.push(u);
    order.sort((a, b) => area[a] - area[b]);
    let did = 0;
    for (const u of order) {
      if (!alive(u) || area[u] >= minStateKm2) continue;
      let best = -1;
      let bestLen = -1;
      for (const [v, len] of adj[u]) {
        if (len > bestLen || (len === bestLen && area[v] > area[best])) {
          best = v;
          bestLen = len;
        }
      }
      if (best < 0) best = nearbyUnit(u);
      // Ilhotas remotas minusculas (Svalbard recortado, Guernsey...): unidade mais proxima da nacao.
      if (best < 0 && area[u] < minStateKm2 * 0.25) best = nearestByCentroid(u);
      if (best < 0) continue;
      merge(u, best);
      did++;
    }
    if (!did) break;
  }

  // 5. Nomes finais: nacao com um unico estado leva o nome da nacao; homonimos ganham orientacao.
  const byNation = new Map();
  for (let u = 0; u < U; u++) {
    if (!alive(u)) continue;
    const n = units[u].nation;
    if (!byNation.has(n)) byNation.set(n, []);
    byNation.get(n).push(u);
  }
  for (const [n, list] of byNation) {
    if (list.length === 1) {
      names[list[0]] = nationNames[n];
      continue;
    }
    const groups = new Map();
    for (const u of list) {
      if (!groups.has(names[u])) groups.set(names[u], []);
      groups.get(names[u]).push(u);
    }
    for (const [base, same] of groups) {
      if (same.length < 2) continue;
      same.sort((a, b) => area[b] - area[a]);
      const main = same[0];
      const mx = sx[main] / cells[main];
      const my = sy[main] / cells[main];
      const used = new Set([base]);
      for (const u of same.slice(1)) {
        const dx = sx[u] / cells[u] - mx;
        const dy = sy[u] / cells[u] - my;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Oriental' : 'Ocidental') : dy > 0 ? 'Meridional' : 'Setentrional';
        let name = `${base} ${dir}`;
        for (let k = 2; used.has(name); k++) name = `${base} ${dir} ${k}`;
        used.add(name);
        names[u] = name;
      }
    }
  }

  // 6. Compactacao: ids ordenados por nacao e posicao (norte -> sul, oeste -> leste).
  const roots = [];
  for (let u = 0; u < U; u++) if (alive(u)) roots.push(u);
  roots.sort((a, b) => units[a].nation - units[b].nation || sy[a] / cells[a] - sy[b] / cells[b] || sx[a] / cells[a] - sx[b] / cells[b]);
  const pid = new Int32Array(U).fill(-1);
  roots.forEach((u, k) => {
    pid[u] = k;
  });
  const prov = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (adm[i] >= 0) prov[i] = pid[find(adm[i])];
  const states = roots.map((u) => ({ nation: units[u].nation, name: names[u], cells: cells[u], area: area[u], members: members[u].length }));
  return { prov, states, report: { units: unitCount, merges, kmPerCell } };
}
