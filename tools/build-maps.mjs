// Pipeline de geracao dos mapas jogaveis a partir de dados geograficos reais
// (Natural Earth + NASA). Uso: node tools/build-maps.mjs [idDoMapa ...]
// Com STATES_REPORT=<pasta>, grava a lista de estados de cada mapa para conferencia.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MAPS, PARENT, EXCLUDED_PLACE_CLASSES } from './maps.config.mjs';
import { createGrid, normalizeLon } from './lib/projection.mjs';
import { loadFeatures, polygonsOf, linesOf, ringBBox, bboxTouches, projectRing, ringArea, ringCentroid, shiftLon } from './lib/geo.mjs';
import { fillRings, drawLine4, loadJpeg, makeSampler } from './lib/raster.mjs';
import { countryName, cityName, regionName } from './lib/names.mjs';
import { F, classifyTerrain, applySwamps } from './lib/terrain.mjs';
import { buildStates } from './lib/states.mjs';
import { computeProvinceStats } from './lib/provstats.mjs';
import { buildSeaRoutes } from './lib/searoutes.mjs';
import { writeGrid, writePreview } from './lib/output.mjs';

const RAW = path.resolve('data-raw');
const OUT = path.resolve('public/maps');
const raw = (f) => path.join(RAW, f);
const clock = () => {
  const t0 = Date.now();
  return () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
};
const round1 = (v) => Math.round(v * 10) / 10;
const MAX_CITIES_PER_STATE = 6;

function isIncluded(def, props) {
  const code = props.ADM0_A3;
  if (def.exclude.includes(code)) return false;
  if (def.include.includes(code)) return true;
  if (props.CONTINENT === 'Antarctica') return false;
  if (def.continents === '*') return true;
  return def.continents.includes(props.CONTINENT);
}

// Celulas "pendentes" (-3) sao absorvidas pela terra vizinha; o que sobra vira terra estrangeira.
function absorbPending(owner, W, H) {
  const N = W * H;
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  const isPending = (j) => owner[j] === -3;
  for (let i = 0; i < N; i++) {
    if (owner[i] < 0 && owner[i] !== -2) continue;
    const x = i % W;
    if ((x > 0 && isPending(i - 1)) || (x < W - 1 && isPending(i + 1)) || (i >= W && isPending(i - W)) || (i + W < N && isPending(i + W))) {
      q[qt++] = i;
    }
  }
  while (qh < qt) {
    const c = q[qh++];
    const x = c % W;
    const nbs = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c >= W ? c - W : -1, c + W < N ? c + W : -1];
    for (const nb of nbs) {
      if (nb >= 0 && owner[nb] === -3) {
        owner[nb] = owner[c];
        q[qt++] = nb;
      }
    }
  }
  for (let i = 0; i < N; i++) if (owner[i] === -3) owner[i] = -2;
}

function nearestNationCell(owner, W, H, x, y, radius) {
  let best = -1;
  let bd = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (owner[j] < 0) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
  }
  return best;
}

console.log('Carregando dados brutos...');
const loadClock = clock();
const data = {
  countries: loadFeatures(raw('ne_10m_admin_0_countries.geojson')),
  places: loadFeatures(raw('ne_10m_populated_places.geojson')).filter((f) => !EXCLUDED_PLACE_CLASSES.has(f.properties.FEATURECLA)),
  rivers: loadFeatures(raw('ne_10m_rivers_lake_centerlines.geojson')),
  lakes: loadFeatures(raw('ne_10m_lakes.geojson')),
  regions: loadFeatures(raw('ne_10m_geography_regions_polys.geojson')),
  marine: loadFeatures(raw('ne_10m_geography_marine_polys.geojson')),
  admin1: loadFeatures(raw('ne_10m_admin_1_states_provinces.geojson')),
  elev: makeSampler(loadJpeg(raw('elev_5400x2700.jpg'))),
  landcover: makeSampler(loadJpeg(raw('landcover_july_5400x2700.jpg'))),
};
for (const list of [data.countries, data.lakes, data.regions, data.marine, data.admin1]) {
  for (const f of list) f.bboxes = polygonsOf(f.geometry).map((poly) => ringBBox(poly[0]));
}
const countryByCode = new Map(data.countries.map((f) => [f.properties.ADM0_A3, f]));
// Populacao urbana global por pais: estima a fracao da populacao que cai dentro de mapas regionais.
const globalCityPop = new Map();
for (const f of data.places) {
  const p = f.properties;
  globalCityPop.set(p.ADM0_A3, (globalCityPop.get(p.ADM0_A3) || 0) + (p.POP_MAX || 0));
}
console.log(`Dados carregados em ${loadClock()}`);

function buildMap(def) {
  const elapsed = clock();
  const grid = createGrid(def);
  const W = grid.width;
  const H = grid.height;
  const N = W * H;
  const log = (msg) => console.log(`  [${elapsed()}] ${msg}`);
  console.log(`\n=== ${def.name} (${def.id}) ${W}x${H} ===`);
  const margin = def.projection.type === 'lcc' ? 25 : 2;
  const touches = (bb) =>
    bboxTouches(bb, def.bounds, margin) ||
    (def.bounds.lonMax > 180 && bboxTouches([bb[0] + 360, bb[1], bb[2] + 360, bb[3]], def.bounds, margin));
  const inLatLon = (lon, lat) =>
    lat >= def.bounds.latMin - margin && lat <= def.bounds.latMax + margin &&
    lon >= def.bounds.lonMin - margin && lon <= def.bounds.lonMax + margin;
  const rasterize = (feature, set, minArea = 0) => {
    let filled = 0;
    polygonsOf(feature.geometry).forEach((poly, pi) => {
      if (!touches(feature.bboxes[pi])) return;
      const rings = poly.map((r) => projectRing(r, grid, def.bounds)).filter((r) => r.length >= 3);
      if (!rings.length) return;
      const n = fillRings(rings, W, H, (i) => set(i, false));
      filled += n;
      if (n === 0 && minArea > 0 && ringArea(rings[0]) >= minArea) {
        const [cx, cy] = ringCentroid(rings[0]);
        const x = Math.floor(cx);
        const y = Math.floor(cy);
        if (x >= 0 && y >= 0 && x < W && y < H) {
          set(y * W + x, true);
          filled++;
        }
      }
    });
    return filled;
  };

  // 1. Nacoes e terras estrangeiras.
  const owner = new Int32Array(N).fill(-1);
  const flags = new Uint8Array(N);
  const nationFeats = [];
  const nationIndex = new Map();
  for (const f of data.countries) {
    const p = f.properties;
    if (p.ADM0_A3 in PARENT || !isIncluded(def, p) || !f.bboxes.some(touches)) continue;
    nationIndex.set(p.ADM0_A3, nationFeats.length);
    nationFeats.push(f);
  }
  for (const f of data.countries) {
    const p = f.properties;
    if (p.CONTINENT === 'Antarctica' || !f.bboxes.some(touches)) continue;
    let label;
    if (p.ADM0_A3 in PARENT) {
      const par = PARENT[p.ADM0_A3];
      label = par && nationIndex.has(par) ? nationIndex.get(par) : -2;
    } else {
      label = nationIndex.has(p.ADM0_A3) ? nationIndex.get(p.ADM0_A3) : -2;
    }
    rasterize(f, (i, forced) => {
      if (forced && owner[i] !== -1) return;
      owner[i] = label;
    }, 0.15);
  }

  // 2. Lagos.
  for (const f of data.lakes) {
    if ((f.properties.scalerank ?? 99) > def.lakeRank || !f.bboxes.some(touches)) continue;
    rasterize(f, (i, forced) => {
      if (forced) return;
      owner[i] = -1;
      flags[i] |= F.LAKE;
    });
  }

  // 3. Remove micro-nacoes (celulas absorvidas pelos vizinhos) e compacta indices.
  const cellCount = new Int32Array(nationFeats.length);
  for (let i = 0; i < N; i++) if (owner[i] >= 0) cellCount[owner[i]]++;
  const keep = nationFeats.map((f, n) => cellCount[n] >= def.minNationCells || (cellCount[n] >= 1 && f.properties.POP_EST >= 1e6));
  let pending = 0;
  for (let i = 0; i < N; i++) {
    if (owner[i] >= 0 && !keep[owner[i]]) {
      owner[i] = -3;
      pending++;
    }
  }
  if (pending) absorbPending(owner, W, H);
  const remap = new Int32Array(nationFeats.length).fill(-1);
  const nations = [];
  nationFeats.forEach((f, n) => {
    if (keep[n] && cellCount[n] > 0) {
      remap[n] = nations.length;
      nations.push(f);
    }
  });
  for (let i = 0; i < N; i++) if (owner[i] >= 0) owner[i] = remap[owner[i]];
  const nationNames = nations.map((f) => countryName(f.properties.ADM0_A3, f.properties.NAME_PT, f.properties.NAME));
  log(`${nations.length} nacoes rasterizadas`);

  // 4. Mascaras auxiliares (desertos, areas umidas, deltas).
  const desertMask = new Uint8Array(N);
  const wetMask = new Uint8Array(N);
  const deltaMask = new Uint8Array(N);
  for (const f of data.regions) {
    const cls = f.properties.FEATURECLA;
    let mask = null;
    if (cls === 'Desert' && !['Caatinga', 'Punjab'].includes(f.properties.NAME)) mask = desertMask;
    else if (cls === 'Wetlands') mask = wetMask;
    else if (cls === 'Delta') mask = deltaMask;
    if (!mask || !f.bboxes.some(touches)) continue;
    rasterize(f, (i, forced) => {
      if (!forced) mask[i] = 1;
    });
  }

  // 5. Terreno, rios e pantanos.
  const { terrain, elev } = classifyTerrain({ W, H, grid, owner, flags, elevS: data.elev, lcS: data.landcover, desertMask });
  let riverCells = 0;
  for (const f of data.rivers) {
    const p = f.properties;
    if (p.featurecla !== 'River' || (p.scalerank ?? 99) > def.riverRank) continue;
    for (const line of linesOf(f.geometry)) {
      let prev = null;
      for (const [lon0, lat] of line) {
        const lon = shiftLon(lon0, def.bounds);
        if (!inLatLon(lon, lat)) {
          prev = null;
          continue;
        }
        const pt = grid.toGrid(lon, lat);
        if (prev) {
          drawLine4(prev[0], prev[1], pt[0], pt[1], W, H, (i) => {
            if (owner[i] !== -1 && !(flags[i] & F.RIVER)) {
              flags[i] |= F.RIVER;
              riverCells++;
            }
          });
        }
        prev = pt;
      }
    }
  }
  const swamps = applySwamps({ W, H, grid, owner, terrain, flags, elev, wetMask, deltaMask });
  log(`terreno classificado, ${riverCells} celulas de rio, ${swamps} de pantano`);

  // 6. Cidades reais.
  const cities = [];
  const cellCity = new Map();
  const cityScore = (c) => (c.cls === 'Admin-0 capital' ? 1e12 : 0) + c.pop;
  for (const f of data.places) {
    const p = f.properties;
    const lat = p.LATITUDE;
    const lon = shiftLon(p.LONGITUDE, def.bounds);
    if (!inLatLon(lon, lat)) continue;
    let [gx, gy] = grid.toGrid(lon, lat);
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
    let cell = Math.floor(gy) * W + Math.floor(gx);
    if (owner[cell] < 0) {
      if (owner[cell] === -2) continue;
      cell = nearestNationCell(owner, W, H, Math.floor(gx), Math.floor(gy), 3);
      if (cell < 0) continue;
      gx = (cell % W) + 0.5;
      gy = ((cell / W) | 0) + 0.5;
    }
    const entry = {
      name: cityName(p.NAME_PT, p.NAME, p.ADM0_A3), gx, gy, cell, nation: owner[cell],
      pop: p.POP_MAX || p.POP_MIN || 0, cls: p.FEATURECLA, adm0: p.ADM0_A3, rank: p.SCALERANK, isCapital: false,
    };
    const existing = cellCity.get(cell);
    if (existing) {
      if (cityScore(existing) >= cityScore(entry)) continue;
      entry.idx = existing.idx;
      cities[existing.idx] = entry;
      cellCity.set(cell, entry);
      continue;
    }
    entry.idx = cities.length;
    cities.push(entry);
    cellCity.set(cell, entry);
  }
  const capitalCity = new Int32Array(nations.length).fill(-1);
  {
    const bestScore = new Float64Array(nations.length).fill(-1);
    for (const c of cities) {
      const code = nations[c.nation].properties.ADM0_A3;
      let score = c.pop;
      if (c.cls === 'Admin-0 capital') score += c.adm0 === code ? 4e12 : 3e12;
      else if (c.cls === 'Admin-0 capital alt') score += 2e12;
      else if (c.cls.startsWith('Admin-1')) score += 1e12;
      if (score > bestScore[c.nation]) {
        bestScore[c.nation] = score;
        capitalCity[c.nation] = c.idx;
      }
    }
    for (const idx of capitalCity) if (idx >= 0) cities[idx].isCapital = true;
  }
  log(`${cities.length} cidades posicionadas`);

  // 7. Estados reais (admin-1), agrupados e fundidos conforme a escala do mapa.
  const territoryName = (code) => {
    const f = countryByCode.get(code);
    return countryName(code, f?.properties.NAME_PT, f?.properties.NAME);
  };
  const { prov, states: provinces, report } = buildStates({
    W, H, grid, owner, nationCodes: nations.map((f) => f.properties.ADM0_A3), nationNames, admin1: data.admin1, rasterize,
    parent: PARENT, territoryName, minStateKm2: def.minStateKm2, islandMergeKm: def.islandMergeKm,
  });
  const { stats, totalArea, landCells } = computeProvinceStats({ W, H, grid, owner, prov, terrain, flags, elev, provinces, islandKm2: def.islandKm2 });
  const avgCells = landCells / Math.max(1, provinces.length);
  log(`${provinces.length} estados (${report.units} unidades admin-1, ${report.merges} fusoes, media ${avgCells.toFixed(0)} celulas)`);

  // 8. Cidades de cada estado (a principal primeiro); estados sem cidade ganham um marco com o proprio nome.
  const provCities = provinces.map(() => []);
  for (const c of cities) {
    const p = prov[c.cell];
    if (p >= 0) provCities[p].push(c);
  }
  const outCities = [];
  const pushCity = (c, pid) => {
    const id = outCities.length;
    outCities.push({
      id, name: c.name, p: pid, x: round1(c.gx), y: round1(c.gy), pop: c.pop,
      cap: c.isCapital ? 2 : c.cls && c.cls.startsWith('Admin-1') ? 1 : 0, rank: c.rank ?? 10,
    });
    return id;
  };
  provinces.forEach((P, pid) => {
    const list = provCities[pid].sort((a, b) => b.isCapital - a.isCapital || b.pop - a.pop);
    P.cityIds = list.slice(0, MAX_CITIES_PER_STATE).map((c) => pushCity(c, pid));
    if (!P.cityIds.length) {
      const s = stats[pid];
      P.cityIds = [pushCity({ name: P.name, gx: s.px + 0.5, gy: s.py + 0.5, pop: 0, isCapital: false, cls: '', rank: 10 }, pid)];
      outCities[P.cityIds[0]].synthetic = 1;
    }
  });

  // 9. Capital de cada nacao.
  const capitalProv = nations.map((_, n) => {
    const ci = capitalCity[n];
    if (ci >= 0 && prov[cities[ci].cell] >= 0) return prov[cities[ci].cell];
    let best = -1;
    let bh = -1;
    provinces.forEach((P, pid) => {
      if (P.nation === n && stats[pid].hab > bh) {
        bh = stats[pid].hab;
        best = pid;
      }
    });
    return best;
  });

  // 10. Rotas maritimas.
  const landNb = stats.map((s) => new Set(s.nb.map(([q]) => q)));
  const seaRoutes = buildSeaRoutes({ W, H, owner, prov, provCount: provinces.length, landNb, maxDist: def.maxSeaDist, maxBridge: def.maxBridgeDist });
  log(`${seaRoutes.length} rotas maritimas`);

  // 11. Rotulos geograficos (cordilheiras, desertos...) e mares.
  const FEATURE_TYPES = { 'Range/mtn': 'mountains', Desert: 'desert', Plateau: 'plateau', Plain: 'plain', Basin: 'basin', Tundra: 'tundra', Wetlands: 'wetlands' };
  const features = [];
  for (const f of data.regions) {
    const p = f.properties;
    const type = FEATURE_TYPES[p.FEATURECLA];
    if (!type || p.SCALERANK > def.featureRank || !f.bboxes.some(touches)) continue;
    let bestRing = null;
    let ba = 0;
    for (const poly of polygonsOf(f.geometry)) {
      const a = ringArea(poly[0]);
      if (a > ba) {
        ba = a;
        bestRing = poly[0];
      }
    }
    if (!bestRing) continue;
    const [clon, clat] = ringCentroid(bestRing);
    const [gx, gy] = grid.toGrid(shiftLon(clon, def.bounds), clat);
    if (gx < 2 || gy < 2 || gx >= W - 2 || gy >= H - 2) continue;
    if (owner[Math.floor(gy) * W + Math.floor(gx)] === -1) continue;
    features.push({ name: regionName(p.NAME_PT, p.NAME, ''), type, x: round1(gx), y: round1(gy), rank: p.SCALERANK });
  }
  const seas = [];
  for (const f of data.marine) {
    const p = f.properties;
    const rank = p.scalerank ?? p.SCALERANK ?? 99;
    const cls = String(p.featurecla ?? p.FEATURECLA ?? '').toLowerCase();
    if (rank > def.seaRank || !['ocean', 'sea', 'gulf', 'bay'].includes(cls) || !f.bboxes.some(touches)) continue;
    let sx = 0;
    let sy = 0;
    let n = 0;
    const samples = [];
    rasterize(f, (i, forced) => {
      if (forced || owner[i] !== -1 || flags[i] & F.LAKE) return;
      const x = i % W;
      const y = (i / W) | 0;
      sx += x;
      sy += y;
      n++;
      if (x % 5 === 0 && y % 5 === 0) samples.push(i);
    });
    if (n < 40 || !samples.length) continue;
    const cx = sx / n;
    const cy = sy / n;
    let best = samples[0];
    let bd = Infinity;
    for (const i of samples) {
      const d = ((i % W) - cx) ** 2 + (((i / W) | 0) - cy) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    seas.push({ name: regionName(p.name_pt ?? p.NAME_PT, p.name ?? p.NAME, ''), type: cls, x: (best % W) + 0.5, y: ((best / W) | 0) + 0.5, rank, size: n });
  }
  log(`${features.length} rotulos geograficos, ${seas.length} mares`);

  // 12. Saida.
  const mapCityPop = new Float64Array(nations.length);
  for (const c of cities) {
    if (c.adm0 === nations[c.nation].properties.ADM0_A3) mapCityPop[c.nation] += c.pop;
  }
  const nationOut = nations.map((f, n) => {
    const p = f.properties;
    const globalPop = globalCityPop.get(p.ADM0_A3) || 0;
    const popShare = globalPop > 0 ? Math.max(0.03, Math.min(1, mapCityPop[n] / globalPop)) : 1;
    return {
      code: p.ADM0_A3, name: nationNames[n], nameEn: p.NAME, continent: p.CONTINENT, subregion: p.SUBREGION,
      pop: p.POP_EST, gdp: p.GDP_MD, income: p.INCOME_GRP, economy: p.ECONOMY, capital: capitalProv[n],
      popShare: Math.round(popShare * 1000) / 1000, provinces: [],
    };
  });
  const provOut = provinces.map((P, pid) => {
    const s = stats[pid];
    nationOut[P.nation].provinces.push(pid);
    const main = outCities[P.cityIds[0]];
    return {
      id: pid, name: P.name, nation: P.nation, cells: s.cells, area: Math.round(s.area),
      x: main.x, y: main.y, lx: s.px + 0.5, ly: s.py + 0.5, bbox: [s.x0, s.y0, s.x1, s.y1],
      terrain: s.terrain, mix: Array.from(s.tc).slice(1), coast: s.coast, river: s.river, island: s.island ? 1 : 0,
      hab: round1(s.hab), elev: Math.round((s.elev / s.cells) * 25), lat: round1(s.lat), lon: round1(normalizeLon(s.lon)),
      cities: P.cityIds, nb: s.nb,
    };
  });
  const dir = path.join(OUT, def.id);
  mkdirSync(dir, { recursive: true });
  const meta = {
    id: def.id, name: def.name, description: def.description, version: 2, division: 'states', width: W, height: H,
    projection: def.projection, bounds: def.bounds, transform: { xmin: grid.xmin, ymax: grid.ymax, scale: grid.scale },
    avgProvinceCells: round1(avgCells), kmPerCell: Math.round(Math.sqrt(totalArea / landCells) * 100) / 100,
    nations: nationOut, provinces: provOut, cities: outCities, seaRoutes, features, seas,
  };
  writeFileSync(path.join(dir, 'map.json'), JSON.stringify(meta));
  const gz = writeGrid(path.join(dir, 'grid.dat'), { W, H, owner, prov, terrain, elev, flags });
  writePreview(path.join(dir, 'preview.png'), { W, H, owner, elev });
  const summary = {
    id: def.id, name: def.name, description: def.description, width: W, height: H,
    nations: nations.length, provinces: provinces.length, cities: outCities.length,
  };
  writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary));
  if (process.env.STATES_REPORT) {
    mkdirSync(process.env.STATES_REPORT, { recursive: true });
    const lines = nationOut
      .map((nat) => ({ nat, list: nat.provinces.map((pid) => provOut[pid]) }))
      .sort((a, b) => b.list.length - a.list.length)
      .map(({ nat, list }) => `${nat.name} [${nat.code}] (${list.length}): ${list.map((p) => `${p.name} ${Math.round(p.area / 1000)}k`).join(', ')}`);
    writeFileSync(path.join(process.env.STATES_REPORT, `${def.id}-estados.txt`), lines.join('\n'));
  }
  log(`gravado: map.json + grid.dat (${(gz / 1024).toFixed(0)} KB) + preview.png`);
}

const only = process.argv.slice(2);
for (const def of MAPS) {
  if (only.length && !only.includes(def.id)) continue;
  buildMap(def);
}
const index = MAPS.map((def) => {
  const file = path.join(OUT, def.id, 'summary.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}).filter(Boolean);
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\nindex.json com ${index.length} mapas.`);
