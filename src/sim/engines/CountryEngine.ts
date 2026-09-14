// COUNTRY ENGINE: agregados nacionais, estabilidade, prestigio, capital, criacao e extincao de paises.
import { clamp } from '../../core/math';
import { GOVERNMENTS, type GovernmentId } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { PERSONALITIES, PERSONALITY_IDS, type PersonalityId } from '../../data/personalities';
import type { CultureId } from '../../data/cultures';
import type { ReligionId } from '../../data/religions';
import { articleFor, deName, inName, toName, type Article } from '../../data/language';
import { pickDistinctColor } from '../../data/palette';
import type { RGB } from '../../data/terrain';
import { techEffects } from '../../data/techs';
import type { Country, CountryKind, FlagDesign, RebelInfo } from '../../state/types';
import { newFlag } from '../flags';
import { newLeader } from '../names';
import type { Simulation } from '../Simulation';

export interface CreateCountryOptions {
  name: string;
  article?: Article;
  kind: CountryKind;
  parent: number;
  provinces: number[];
  capital?: number;
  government?: GovernmentId;
  culture?: CultureId;
  religion?: ReligionId;
  personality?: PersonalityId;
  color?: RGB;
  flag?: FlagDesign;
  rebel?: RebelInfo | null;
  code?: string;
}

export class CountryEngine {
  private neighborCache = new Map<number, { version: number; set: Set<number> }>();

  constructor(private sim: Simulation) {}

  get(id: number): Country {
    return this.sim.state.countries[id];
  }

  alive(): Country[] {
    return this.sim.state.countries.filter((c) => c.alive);
  }

  nations(): Country[] {
    return this.sim.state.countries.filter((c) => c.alive && c.kind === 'nation');
  }

  de(id: number): string {
    const c = this.get(id);
    return deName(c.name, c.article);
  }

  to(id: number): string {
    const c = this.get(id);
    return toName(c.name, c.article);
  }

  in(id: number): string {
    const c = this.get(id);
    return inName(c.name, c.article);
  }

  isPlural(id: number): boolean {
    const a = this.get(id).article;
    return a === 'os' || a === 'as';
  }

  // Sujeito de frase: "Brasil", "Os Separatistas de Córdoba".
  subject(id: number): string {
    const c = this.get(id);
    if (c.article === 'os') return `Os ${c.name}`;
    if (c.article === 'as') return `As ${c.name}`;
    return c.name;
  }

  // Concorda o verbo com o sujeito (singular/plural).
  verb(id: number, singular: string, plural: string): string {
    return this.isPlural(id) ? plural : singular;
  }

  formalName(id: number): string {
    const c = this.get(id);
    if (c.kind === 'rebel') return c.name;
    return `${GOVERNMENTS[c.government].title} ${deName(c.name, c.article)}`;
  }

  private strengthCache: Float64Array = new Float64Array(0);
  private strengthDay = -1;

  // Poder militar estimado (soldados ponderados por tecnologia e moral), com cache diario.
  strength(id: number): number {
    const s = this.sim.state;
    if (this.strengthDay !== s.day || this.strengthCache.length < s.countries.length) {
      this.strengthDay = s.day;
      this.strengthCache = new Float64Array(s.countries.length);
      for (const a of s.armies) {
        this.strengthCache[a.owner] += (a.infantry + a.cavalry * 1.4 + a.artillery * 1.2) * (0.4 + 0.6 * a.morale);
      }
      for (const c of s.countries) {
        if (!c.alive) continue;
        this.strengthCache[c.id] = this.strengthCache[c.id] * (1 + techEffects(c.tech).military) + c.manpower * 0.15;
      }
    }
    return this.strengthCache[id] ?? 0;
  }

  // Paises vizinhos por terra ou rota maritima.
  neighbors(id: number): Set<number> {
    const version = this.sim.index.ownershipVersion;
    const cached = this.neighborCache.get(id);
    if (cached && cached.version === version) return cached.set;
    const m = this.sim.map;
    const s = this.sim.state;
    const set = new Set<number>();
    for (const p of this.sim.index.ownedBy[id] ?? []) {
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        const o = s.provinces[m.edgeTo[e]].owner;
        if (o >= 0 && o !== id) set.add(o);
      }
    }
    this.neighborCache.set(id, { version, set });
    return set;
  }

  landNeighbors(id: number): Set<number> {
    const m = this.sim.map;
    const s = this.sim.state;
    const set = new Set<number>();
    for (const p of this.sim.index.ownedBy[id] ?? []) {
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        if (m.edgeSea[e]) continue;
        const o = s.provinces[m.edgeTo[e]].owner;
        if (o >= 0 && o !== id) set.add(o);
      }
    }
    return set;
  }

  recompute(id: number): void {
    const sim = this.sim;
    const c = this.get(id);
    const owned = sim.index.ownedBy[id] ?? [];
    let pop = 0;
    let area = 0;
    for (const p of owned) {
      pop += sim.state.provinces[p].population;
      area += sim.map.provinces[p].area;
    }
    c.population = pop;
    c.area = area;
    c.provinceCount = owned.length;
    let army = 0;
    for (const a of sim.state.armies) if (a.owner === id) army += a.infantry + a.cavalry + a.artillery;
    c.armySize = army;
    const gov = GOVERNMENTS[c.government];
    c.maxManpower = pop * sim.era.mobilization * 3.2 * gov.military * (0.7 + PERSONALITIES[c.personality].militaryBudget * 2);
  }

  recomputeAll(): void {
    for (const c of this.sim.state.countries) if (c.alive) this.recompute(c.id);
  }

  relocateCapital(id: number, announce: boolean): void {
    const sim = this.sim;
    const c = this.get(id);
    const owned = sim.index.ownedBy[id] ?? [];
    let best = -1;
    let bestScore = -1;
    for (const p of owned) {
      const ps = sim.state.provinces[p];
      const score = ps.population * (1 + ps.development / 10) * (ps.controller === id ? 1 : 0.05);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best < 0 || best === c.capital) return;
    const old = c.capital;
    c.capital = best;
    if (announce && c.kind === 'nation') {
      sim.history.add('government', `${c.name} transferiu sua capital para ${sim.provinces.cityName(best)}.`, {
        countries: [id],
        province: best,
        importance: old >= 0 ? 2 : 1,
      });
    }
    sim.bus.emit('countryChanged', { country: id });
  }

  destroy(id: number, by: number): void {
    const sim = this.sim;
    const c = this.get(id);
    if (!c.alive) return;
    c.alive = false;
    c.died = sim.day;
    sim.military.disbandAll(id);
    sim.wars.onCountryDestroyed(id, by);
    sim.diplomacy.onCountryDestroyed(id);
    for (let p = 0; p < sim.state.provinces.length; p++) {
      const ps = sim.state.provinces[p];
      if (ps.controller === id && ps.owner !== id) sim.provinces.setController(p, ps.owner);
    }
    if (c.kind === 'nation') {
      const text = by >= 0 && sim.country(by).alive
        ? `${c.name} deixou de existir: seu território foi tomado por ${sim.country(by).name}.`
        : `${c.name} deixou de existir.`;
      sim.history.add('destroyed', text, { countries: by >= 0 ? [id, by] : [id], importance: 3 });
    }
    sim.bus.emit('countryDestroyed', { country: id });
  }

  // Cria (ou revive) um pais a partir de provincias e de um pais de origem.
  create(opts: CreateCountryOptions): Country {
    const sim = this.sim;
    const s = sim.state;
    const rng = sim.rng;
    const parent = opts.parent >= 0 ? this.get(opts.parent) : null;
    const id = s.countries.length;
    const neighborColors: RGB[] = [];
    const secondary: RGB[] = [];
    const m = sim.map;
    const provSet = new Set(opts.provinces);
    for (const p of opts.provinces) {
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        const q = m.edgeTo[e];
        if (provSet.has(q)) continue;
        const o = s.provinces[q].owner;
        if (o >= 0) neighborColors.push(sim.country(o).color);
      }
    }
    if (parent) neighborColors.push(parent.color);
    for (const other of s.countries) if (other.alive) secondary.push(other.color);
    const color = opts.color ?? pickDistinctColor(neighborColors, secondary.slice(0, 60), () => rng.next());
    const culture = opts.culture ?? parent?.culture ?? 'hispanica';
    const government = opts.government ?? parent?.government ?? 'republic';
    const personality = opts.personality ?? rng.pick(PERSONALITY_IDS);
    const regnal: Record<string, number> = {};
    const capital = opts.capital ?? opts.provinces[0] ?? -1;
    const c: Country = {
      id,
      code: opts.code ?? `N${id}`,
      name: opts.name,
      article: opts.article ?? articleFor(opts.name),
      kind: opts.kind,
      alive: true,
      color,
      flag: opts.flag ?? newFlag(rng, color),
      capital,
      originalCapital: capital,
      government,
      ideology: parent?.ideology ?? 'traditionalism',
      religion: opts.religion ?? parent?.religion ?? 'catholic',
      culture,
      personality,
      ruler: newLeader(rng, culture, s.day, sim.nextId('person'), regnal),
      regnalCount: regnal,
      generals: [],
      founded: s.day,
      died: -1,
      continent: parent?.continent ?? '',
      lastElection: s.day,
      treasury: 0,
      debt: 0,
      inflation: parent ? parent.inflation * 0.5 : 0.02,
      unemployment: 0.08,
      taxRate: parent?.taxRate ?? sim.era.taxRate,
      gdp: 0,
      gdpLastYear: 0,
      growth: 0,
      income: 0,
      expenses: 0,
      tradeIncome: 0,
      militaryBudget: PERSONALITIES[personality].militaryBudget,
      population: 0,
      stability: opts.kind === 'rebel' ? 40 : 45,
      corruption: GOVERNMENTS[government].corruption,
      prestige: 15,
      happiness: 55,
      warExhaustion: 0,
      aggressiveExpansion: 0,
      tech: parent ? parent.tech * rng.float(0.94, 1.0) : sim.era.tech,
      manpower: 0,
      maxManpower: 0,
      navy: 0,
      airForce: 0,
      provinceCount: 0,
      area: 0,
      armySize: 0,
      traits: [],
      modifiers: [],
      battlesWon: 0,
      battlesLost: 0,
      warsWon: 0,
      warsLost: 0,
      provincesConquered: 0,
      provincesLost: 0,
      recentChanges: [],
      pastWars: [],
      ai: true,
      overlord: -1,
      rebel: opts.rebel ?? null,
      decisionDay: s.day + rng.int(20, 60),
      lastWarDay: s.day,
    };
    s.countries.push(c);
    sim.index.ensureCountry(id);
    for (const p of opts.provinces) sim.provinces.transfer(p, id, opts.kind === 'rebel' ? 'revolt' : 'independence');
    if (capital >= 0) c.capital = capital;
    this.recompute(id);
    if (parent && opts.provinces.length) {
      const share = parent.population > 0 ? c.population / (parent.population + c.population) : 0.1;
      const moved = parent.treasury * share * 0.5;
      parent.treasury -= moved;
      c.treasury = moved + c.population * sim.economy.gdpPerCapita(c) * 0.05;
      c.manpower = c.maxManpower * 0.3;
      c.navy = Math.round(parent.navy * share);
    }
    sim.bus.emit('countryCreated', { country: id });
    return c;
  }

  // Revive um pais extinto (restauracao).
  revive(id: number, provinces: number[]): Country {
    const sim = this.sim;
    const c = this.get(id);
    c.alive = true;
    c.died = -1;
    c.founded = sim.day;
    c.stability = 45;
    c.warExhaustion = 0;
    c.debt = 0;
    c.treasury = 0;
    c.overlord = -1;
    c.rebel = null;
    c.ruler = newLeader(sim.rng, c.culture, sim.day, sim.nextId('person'), c.regnalCount);
    for (const p of provinces) sim.provinces.transfer(p, id, 'restore');
    if (!provinces.includes(c.capital)) c.capital = provinces[0];
    this.recompute(id);
    c.manpower = c.maxManpower * 0.3;
    sim.bus.emit('countryCreated', { country: id });
    return c;
  }

  monthly(): void {
    const sim = this.sim;
    const day = sim.day;
    for (const c of sim.state.countries) {
      if (!c.alive) continue;
      this.recompute(c.id);
      c.modifiers = c.modifiers.filter((m) => m.until > day);
      if (c.kind === 'rebel') continue;
      const gov = GOVERNMENTS[c.government];
      const ideology = IDEOLOGIES[c.ideology];
      const owned = sim.index.ownedBy[c.id];
      let unrest = 0;
      let nonCore = 0;
      for (const p of owned) {
        const ps = sim.state.provinces[p];
        unrest += ps.unrest;
        if (!ps.cores.includes(c.id)) nonCore++;
      }
      const n = Math.max(1, owned.length);
      const modStability = c.modifiers.reduce((acc, m) => acc + (m.stability ?? 0), 0);
      const debtRatio = c.gdp > 0 ? c.debt / c.gdp : 0;
      let target =
        55 + gov.stability + ideology.stability + c.ruler.skills.adm * 1.1 - c.corruption * 40 - c.warExhaustion * 0.35 -
        (unrest / n) * 0.25 - (nonCore / n) * 22 - Math.min(15, debtRatio * 12) - Math.min(12, c.inflation * 40) +
        (c.happiness - 50) * 0.25 + c.prestige * 0.08 + modStability;
      if (c.overlord >= 0) target -= 4;
      target = clamp(target, 0, 100);
      c.stability = clamp(c.stability + (target - c.stability) * 0.06, 0, 100);

      const growthTerm = clamp(c.growth * 150, -15, 15);
      // O efeito da inflacao satura: acima de ~30% o pais ja vive a crise (a escassez e a fome fazem o resto).
      const happyTarget = clamp(52 + growthTerm - c.unemployment * 110 - Math.min(18, c.inflation * 60) - c.warExhaustion * 0.3 + (c.taxRate < sim.era.taxRate ? 4 : -4), 0, 100);
      c.happiness = clamp(c.happiness + (happyTarget - c.happiness) * 0.1, 0, 100);

      const corrTarget = clamp(gov.corruption + owned.length / 300 - c.ruler.skills.adm * 0.01 + (c.stability < 30 ? 0.06 : 0), 0.01, 0.9);
      c.corruption = clamp(c.corruption + (corrTarget - c.corruption) * 0.03, 0, 1);

      c.prestige = clamp(c.prestige + (8 - c.prestige) * 0.01, 0, 100);
      c.aggressiveExpansion = Math.max(0, c.aggressiveExpansion - 0.6);
      if (!sim.index.isAtWar(c.id)) c.warExhaustion = Math.max(0, c.warExhaustion * 0.92 - 0.3);
      c.manpower = Math.min(c.maxManpower, c.manpower + c.maxManpower / 90);
    }
  }
}
