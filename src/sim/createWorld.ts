// WORLD GENERATION: cria o estado inicial a partir dos dados do mapa e da era escolhida
// (paises, governos, personalidades, populacao, economia, provincias, exercitos e relacoes).
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { countryMeta, FRIENDSHIPS, MODERN_GOVERNMENT, RIVALRIES } from '../data/countryMeta';
import { eraById, type EraPreset } from '../data/eras';
import { GOVERNMENTS, type GovernmentId } from '../data/governments';
import { articleFor } from '../data/language';
import { pickDistinctColor } from '../data/palette';
import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from '../data/personalities';
import { RESOURCE_IDS, RESOURCES, type ResourceId } from '../data/resources';
import type { RGB } from '../data/terrain';
import type { MapData } from '../map/MapData';
import { DEFAULT_SETTINGS, type Country, type GameState, type SimSettings } from '../state/types';
import { newFlag } from './flags';
import { newLeader } from './names';
import { Simulation } from './Simulation';

// 2: mapas divididos em estados reais (saves da versao 1 usavam provincias geradas por cidades).
export const SAVE_VERSION = 2;

export interface NewGameOptions {
  eraId: string;
  seed: number;
  settings?: Partial<SimSettings>;
}

function incomeLevel(income: string): number {
  if (!income) return 1;
  if (income.startsWith('1')) return 4;
  if (income.startsWith('2')) return 3;
  if (income.startsWith('3')) return 2;
  if (income.startsWith('4')) return 1;
  return 0;
}

type NationSize = 'large' | 'medium' | 'small';

// Porte pela fatia de area e populacao do mapa: so potencias realmente grandes comecam como imperios.
function chooseGovernment(rng: Rng, era: EraPreset, code: string, provinces: number, size: NationSize, religion: string, income: number): GovernmentId {
  if (era.id === 'contemporary') {
    const modern = MODERN_GOVERNMENT[code];
    if (modern) return modern;
    return rng.weighted<GovernmentId>(['democracy', 'republic', 'dictatorship'], (g) => (g === 'democracy' ? 1 + income : g === 'republic' ? 2 : 1.5 - income * 0.3)) ?? 'republic';
  }
  const weights: Partial<Record<GovernmentId, number>> = { ...era.governments };
  if (size === 'large') {
    weights.empire = (weights.empire ?? 0) + 3;
    if (era.tech >= 13) weights.federation = (weights.federation ?? 0) + 1.5;
  } else if (size === 'medium') {
    weights.empire = (weights.empire ?? 0) * 0.1;
  } else {
    weights.empire = 0;
  }
  if (provinces <= 3) weights.republic = (weights.republic ?? 0) + 0.6;
  const muslim = religion === 'sunni' || religion === 'shia';
  if (muslim && era.tech < 13) weights.theocracy = (weights.theocracy ?? 0) + 0.6;
  else weights.theocracy = (weights.theocracy ?? 0) * 0.05;
  const ids = Object.keys(weights) as GovernmentId[];
  return rng.weighted(ids, (g) => weights[g] ?? 0) ?? 'monarchy';
}

function choosePersonality(rng: Rng, size: NationSize, provinces: number): PersonalityId {
  const w: Record<PersonalityId, number> = {
    expansionist: 1, defensive: 1, militarist: 0.8, pacifist: 0.6, imperialist: 0.7, commercial: 1, isolationist: 0.6, diplomatic: 1, opportunist: 1.2,
  };
  if (size === 'large') {
    w.expansionist += 1.2;
    w.imperialist += 1;
    w.militarist += 0.6;
  } else if (size === 'small' && provinces <= 3) {
    w.defensive += 0.8;
    w.diplomatic += 0.6;
    w.commercial += 0.5;
    w.pacifist += 0.3;
    w.isolationist += 0.3;
  }
  return rng.weighted(PERSONALITY_IDS, (id) => w[id]) ?? 'opportunist';
}

function pickResource(rng: Rng, terrain: number, lat: number): ResourceId {
  const aLat = Math.abs(lat);
  return (
    rng.weighted(RESOURCE_IDS, (id) => {
      const r = RESOURCES[id];
      let w = r.terrains[terrain] ?? 0.15;
      if (r.tropical && aLat > 32) w = 0;
      if (r.cold && aLat < 45) w = 0;
      return w;
    }) ?? 'grain'
  );
}

export function createWorld(map: MapData, opts: NewGameOptions): Simulation {
  const rng = new Rng(opts.seed);
  const era = eraById(opts.eraId);
  const state: GameState = {
    version: SAVE_VERSION,
    mapId: map.id,
    eraId: era.id,
    seed: opts.seed,
    rng: rng.state,
    day: 0,
    startYear: era.year,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    countries: [],
    provinces: [],
    armies: [],
    wars: [],
    battles: [],
    treaties: [],
    relations: [],
    history: [],
    stats: {
      world: { years: [], pop: [], gdp: [], army: [], provinces: [], countries: [], wars: [] },
      countries: {},
      snapshots: [],
      techFirsts: {},
    },
    nextId: { army: 1, war: 1, battle: 1, treaty: 1, history: 1, person: 1 },
  };

  // Adjacencia entre nacoes (para cores distintas).
  const adjacency = map.nations.map(() => new Set<number>());
  for (const mp of map.provinces) {
    for (let e = map.edgeStart[mp.id]; e < map.edgeStart[mp.id + 1]; e++) {
      const other = map.provinces[map.edgeTo[e]].nation;
      if (other !== mp.nation) adjacency[mp.nation].add(other);
    }
  }
  const colors: RGB[] = new Array(map.nations.length);
  const order = map.nations.map((_, i) => i).sort((a, b) => map.nations[b].provinces.length - map.nations[a].provinces.length);
  for (const n of order) {
    const neighborColors = [...adjacency[n]].filter((o) => colors[o]).map((o) => colors[o]);
    const second = new Set<number>();
    for (const o of adjacency[n]) for (const oo of adjacency[o]) if (oo !== n && colors[oo]) second.add(oo);
    colors[n] = pickDistinctColor(neighborColors, [...second].map((o) => colors[o]), () => rng.next());
  }

  // Paises.
  const person = () => state.nextId.person++;
  const mapArea = map.provinces.reduce((acc, p) => acc + p.area, 0);
  const mapPop = map.nations.reduce((acc, n) => acc + n.pop * n.popShare, 0);
  map.nations.forEach((n, id) => {
    const meta = countryMeta(n.code, n.subregion);
    const income = incomeLevel(n.income);
    const provinces = n.provinces.length;
    const areaShare = n.provinces.reduce((acc, p) => acc + map.provinces[p].area, 0) / Math.max(1, mapArea);
    const popShare = (n.pop * n.popShare) / Math.max(1, mapPop);
    const size: NationSize = areaShare >= 0.06 || popShare >= 0.1 ? 'large' : areaShare >= 0.02 || popShare >= 0.04 ? 'medium' : 'small';
    const government = chooseGovernment(rng, era, n.code, provinces, size, meta.religion, income);
    const personality = choosePersonality(rng, size, provinces);
    const regnal: Record<string, number> = {};
    const c: Country = {
      id, code: n.code, name: n.name, article: articleFor(n.name), kind: 'nation', alive: true, color: colors[id],
      flag: newFlag(rng, colors[id]), capital: n.capital, originalCapital: n.capital, government, ideology: 'traditionalism',
      religion: meta.religion, culture: meta.culture, personality, ruler: newLeader(rng, meta.culture, 0, person(), regnal),
      regnalCount: regnal, generals: [], founded: 0, died: -1, continent: n.continent, lastElection: -rng.int(0, 5) * 365,
      treasury: 0, debt: 0, inflation: 0.02, unemployment: 0.06, taxRate: era.taxRate, gdp: 0, gdpLastYear: 0, growth: 0.01,
      income: 0, expenses: 0, tradeIncome: 0, militaryBudget: PERSONALITIES[personality].militaryBudget, population: 0,
      stability: rng.int(50, 72), corruption: GOVERNMENTS[government].corruption, prestige: clamp(10 + (size === 'large' ? 22 : size === 'medium' ? 10 : 0) + provinces * 0.3, 10, 50),
      happiness: 55, warExhaustion: 0, aggressiveExpansion: 0, tech: Math.max(0, era.tech + (income - 2) * 0.35 + rng.float(-0.25, 0.25)),
      manpower: 0, maxManpower: 0, navy: 0, airForce: 0, provinceCount: 0, area: 0, armySize: 0, traits: [], modifiers: [],
      battlesWon: 0, battlesLost: 0, warsWon: 0, warsLost: 0, provincesConquered: 0, provincesLost: 0, recentChanges: [],
      pastWars: [], ai: true, overlord: -1, rebel: null, decisionDay: rng.int(5, 40), lastWarDay: -3650,
    };
    if (era.tech >= 11) c.ideology = rng.pick(['liberalism', 'conservatism', 'nationalism']);
    else if (era.tech >= 5) c.ideology = rng.pick(['traditionalism', 'absolutism', 'mercantilism']);
    state.countries.push(c);
  });

  // Provincias: populacao, desenvolvimento, recursos, fortificacoes.
  for (const mp of map.provinces) {
    const meta = state.countries[mp.nation];
    state.provinces.push({
      owner: mp.nation, controller: mp.nation, cores: [mp.nation], population: 0, capacity: 0, development: 1,
      resource: pickResource(rng, mp.terrain, mp.lat), unrest: rng.float(0, 12), fort: 0, devastation: 0,
      culture: meta.culture, religion: meta.religion, siege: null, lastChange: -50 * 365, occupiedSince: -1, epidemic: 0,
    });
  }
  map.nations.forEach((n, id) => {
    const c = state.countries[id];
    const income = incomeLevel(n.income);
    const total = Math.max(20000, n.pop * n.popShare * era.popScale * rng.float(0.9, 1.1));
    let habSum = 0;
    let citySum = 0;
    const cityPop = n.provinces.map((p) => map.provinces[p].cities.reduce((acc, cid) => acc + map.cities[cid].pop, 0));
    n.provinces.forEach((p, i) => {
      habSum += map.provinces[p].hab;
      citySum += cityPop[i];
    });
    n.provinces.forEach((p, i) => {
      const mp = map.provinces[p];
      const ps = state.provinces[p];
      const habShare = habSum > 0 ? mp.hab / habSum : 1 / n.provinces.length;
      const cityShare = citySum > 0 ? cityPop[i] / citySum : habShare;
      ps.population = Math.max(800, total * (0.55 * habShare + 0.45 * cityShare));
      ps.capacity = Math.max(ps.population * 2.5, habSum > 0 ? (mp.hab / habSum) * total * 2 : ps.population * 2.5);
      const isCapital = p === n.capital;
      const dev = (1 + income * 1.6 + Math.log10(Math.max(1, cityPop[i])) * 0.7 + (mp.coast > 0 ? 1 : 0) + (isCapital ? 3 : 0) + rng.float(-1, 1)) * (0.55 + era.tech / 30);
      ps.development = clamp(dev, 1, 30);
      ps.fort = isCapital ? 2 : (mp.terrain === 3 || mp.terrain === 2) && rng.chance(0.2) ? 1 : 0;
    });
    c.capital = n.capital;
  });

  const sim = new Simulation(map, state);
  sim.countries.recomputeAll();
  for (const c of state.countries) {
    c.manpower = c.maxManpower * 0.6;
    const coastal = sim.index.ownedBy[c.id].filter((p) => map.coastal[p]).length;
    c.navy = coastal > 0 ? Math.max(1, coastal * (0.8 + c.tech / 12) * 0.7) : 0;
  }
  sim.economy.monthly();
  for (const c of state.countries) {
    c.treasury = Math.max(0, c.income) * rng.float(6, 12);
    c.gdpLastYear = c.gdp;
  }

  // Exercitos iniciais: capital + provincias de fronteira.
  for (const c of state.countries) {
    const owned = sim.index.ownedBy[c.id];
    if (!owned.length) continue;
    const total = sim.military.targetArmySize(c) * rng.float(0.8, 1.1);
    if (total < 500) continue;
    const count = clamp(1 + Math.floor(owned.length / 8), 1, 5);
    const border = owned.filter((p) => {
      for (let e = map.edgeStart[p]; e < map.edgeStart[p + 1]; e++) if (state.provinces[map.edgeTo[e]].owner !== c.id) return true;
      return false;
    });
    rng.shuffle(border);
    const spots = [c.capital, ...border.filter((p) => p !== c.capital)].slice(0, count);
    for (const spot of spots) {
      const army = sim.military.raiseArmy(c.id, spot, total / spots.length);
      army.morale = 0.8;
      army.experience = rng.float(0.05, 0.2);
    }
  }
  sim.countries.recomputeAll();

  // Relacoes iniciais entre vizinhos (com rivalidades e afinidades historicas).
  const codeToId = new Map(state.countries.map((c) => [c.code, c.id]));
  for (const c of state.countries) {
    for (const n of sim.countries.neighbors(c.id)) {
      if (n < c.id) continue;
      sim.diplomacy.setRelation(c.id, n, sim.diplomacy.baseRelation(c.id, n) + rng.float(-25, 20));
    }
  }
  for (const [a, b, v] of [...RIVALRIES, ...FRIENDSHIPS]) {
    const ia = codeToId.get(a);
    const ib = codeToId.get(b);
    if (ia !== undefined && ib !== undefined) sim.diplomacy.addRelation(ia, ib, v);
  }

  sim.history.add('start', `Início da simulação: ${state.countries.length} nações disputam o ${map.name} no ano de ${era.year} (${era.name}).`, { importance: 3 });
  // Aquecimento diplomatico: alguns meses de diplomacia antes do inicio (aliancas, pactos, garantias).
  for (let round = 0; round < 6; round++) {
    for (const c of state.countries) if (c.alive) sim.ai.considerDiplomacy(c);
  }
  sim.initialize();
  return sim;
}
