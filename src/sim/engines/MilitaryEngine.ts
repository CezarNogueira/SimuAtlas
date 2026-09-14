// MILITARY ENGINE: exercitos (recrutamento, generais, marcha, cercos, suprimento,
// desgaste, moral, recuo, retorno para casa), marinha e forca aerea.
import { clamp } from '../../core/math';
import { season } from '../../core/calendar';
import { GOVERNMENTS } from '../../data/governments';
import { PERSONALITIES } from '../../data/personalities';
import { terrainInfo } from '../../data/terrain';
import type { Army, ArmyMission, Country, General } from '../../state/types';
import { newGeneral } from '../names';
import type { CanEnter } from '../Pathfinder';
import type { Simulation } from '../Simulation';

export const soldiersOf = (a: Army) => a.infantry + a.cavalry + a.artillery;

export function compositionFor(tech: number): [number, number, number] {
  if (tech < 3) return [0.7, 0.28, 0.02];
  if (tech < 7) return [0.68, 0.24, 0.08];
  if (tech < 13) return [0.66, 0.18, 0.16];
  if (tech < 20) return [0.7, 0.1, 0.2];
  return [0.6, 0.15, 0.25];
}

export class MilitaryEngine {
  constructor(private sim: Simulation) {}

  armiesOf(countryId: number): Army[] {
    return this.sim.state.armies.filter((a) => a.owner === countryId);
  }

  general(a: Army): General | undefined {
    if (a.general < 0) return undefined;
    return this.sim.country(a.owner)?.generals.find((g) => g.id === a.general);
  }

  armyPower(a: Army): number {
    const c = this.sim.country(a.owner);
    return (a.infantry + a.cavalry * 1.4 + a.artillery * 1.2) * (1 + this.sim.technology.fx(c).military) * (0.35 + 0.65 * a.morale) * (1 + a.experience * 0.4);
  }

  speed(a: Army): number {
    const c = this.sim.country(a.owner);
    const g = this.general(a);
    const total = Math.max(1, soldiersOf(a));
    return (1 + this.sim.technology.fx(c).transport) * (1 + (g?.maneuver ?? 0) * 0.04) * (a.mission === 'retreat' ? 1.25 : 1) * (a.cavalry / total > 0.3 ? 1.1 : 1);
  }

  canUseSea(countryId: number): boolean {
    return this.sim.country(countryId).navy >= 1;
  }

  // Regra de passagem: territorio proprio/aliado, inimigo em guerra, ou retorno em tempo de paz.
  passable(countryId: number, mode: 'normal' | 'friendly' | 'return'): CanEnter {
    const sim = this.sim;
    const provs = sim.state.provinces;
    const friends = sim.diplomacy.accessSet(countryId);
    if (mode === 'return') return () => true;
    if (mode === 'friendly') return (p) => friends.has(provs[p].controller);
    const enemies = sim.wars.enemiesOf(countryId);
    return (p) => {
      const ps = provs[p];
      return friends.has(ps.controller) || enemies.has(ps.controller) || enemies.has(ps.owner);
    };
  }

  canEnterNow(countryId: number, p: number, returning: boolean): boolean {
    if (returning) return true;
    const sim = this.sim;
    const ps = sim.state.provinces[p];
    if (ps.controller === countryId || ps.owner === countryId) return true;
    if (sim.index.atWar(countryId, ps.controller) || sim.index.atWar(countryId, ps.owner)) return true;
    return sim.diplomacy.accessSet(countryId).has(ps.controller);
  }

  raiseArmy(countryId: number, province: number, soldiers: number, name?: string): Army {
    const sim = this.sim;
    const c = sim.country(countryId);
    const [fi, fc, fa] = compositionFor(c.tech);
    const count = this.armiesOf(countryId).length + 1;
    const army: Army = {
      id: sim.nextId('army'),
      owner: countryId,
      name: name ?? (c.kind === 'rebel' ? c.name : `${count}º Exército ${sim.countries.de(countryId)}`),
      general: -1,
      infantry: soldiers * fi,
      cavalry: soldiers * fc,
      artillery: soldiers * fa,
      morale: 0.75,
      experience: 0.05,
      supply: 1,
      location: province,
      path: [],
      progress: 0,
      edgeDays: 0,
      naval: false,
      mission: 'idle',
      target: -1,
      battle: -1,
      thinkDay: sim.day + sim.rng.int(0, 4),
      retreatUntil: 0,
      raised: sim.day,
      player: false,
    };
    this.assignGeneral(army, c);
    sim.state.armies.push(army);
    sim.index.addArmy(army);
    return army;
  }

  assignGeneral(army: Army, c: Country): void {
    const sim = this.sim;
    let g = c.generals.find((x) => x.army < 0);
    if (!g && c.generals.length < 14) {
      g = newGeneral(sim.rng, c.culture, sim.day, sim.nextId('person'), c.tech / 10);
      c.generals.push(g);
    }
    if (g) {
      g.army = army.id;
      army.general = g.id;
    }
  }

  removeArmy(army: Army): void {
    const sim = this.sim;
    const list = sim.state.armies;
    const i = list.indexOf(army);
    if (i >= 0) list.splice(i, 1);
    sim.index.removeArmy(army);
    const c = sim.country(army.owner);
    const g = c?.generals.find((x) => x.id === army.general);
    if (g) g.army = -1;
    army.battle = -1;
  }

  disbandAll(countryId: number): void {
    for (const a of this.armiesOf(countryId)) this.removeArmy(a);
  }

  destroyArmy(a: Army, pid: number): void {
    const sim = this.sim;
    if (soldiersOf(a) >= 3000) {
      sim.history.add('battle', `${a.name} foi aniquilado em ${sim.provinces.cityName(pid)}.`, { countries: [a.owner], province: pid, importance: 1 });
    }
    this.removeArmy(a);
  }

  applyLosses(a: Army, n: number): number {
    const total = soldiersOf(a);
    if (total <= 0 || n <= 0) return 0;
    const k = Math.max(0, 1 - n / total);
    a.infantry *= k;
    a.cavalry *= k;
    a.artillery *= k;
    return total - soldiersOf(a);
  }

  addSoldiers(a: Army, n: number, tech: number): void {
    const [fi, fc, fa] = compositionFor(tech);
    const old = soldiersOf(a);
    a.infantry += n * fi;
    a.cavalry += n * fc;
    a.artillery += n * fa;
    const w = old / Math.max(1, old + n);
    a.experience = a.experience * w + 0.02 * (1 - w);
    a.morale = a.morale * w + 0.6 * (1 - w);
  }

  merge(target: Army, source: Army): void {
    const t = soldiersOf(target);
    const s = soldiersOf(source);
    const w = t / Math.max(1, t + s);
    target.morale = target.morale * w + source.morale * (1 - w);
    target.experience = target.experience * w + source.experience * (1 - w);
    target.infantry += source.infantry;
    target.cavalry += source.cavalry;
    target.artillery += source.artillery;
    this.removeArmy(source);
  }

  setPath(a: Army, path: number[], mission: ArmyMission, target: number): void {
    a.path = path;
    a.mission = mission;
    a.target = target;
    a.progress = 0;
    a.naval = false;
    if (path.length) this.startEdge(a);
  }

  private startEdge(a: Army): void {
    const m = this.sim.map;
    const next = a.path[0];
    const e = m.edgeBetween(a.location, next);
    if (e < 0) {
      a.path = [];
      return;
    }
    const mp = m.provinces[next];
    const winter = season(this.sim.day, mp.lat) === 0 && Math.abs(mp.lat) > 42;
    a.edgeDays = Math.max(1, (m.edgeDays[e] / this.speed(a)) * (winter ? 1.3 : 1));
    a.progress = 0;
    a.naval = m.edgeSea[e] === 1;
  }

  dailyMovement(): void {
    const sim = this.sim;
    const armies = sim.state.armies;
    for (let i = 0; i < armies.length; i++) {
      const a = armies[i];
      if (a.battle >= 0 || a.path.length === 0) continue;
      a.progress += 1;
      if (a.progress < a.edgeDays) continue;
      const next = a.path[0];
      const returning = a.mission === 'return' || a.mission === 'retreat';
      if (!this.canEnterNow(a.owner, next, returning)) {
        a.path = [];
        a.progress = 0;
        a.naval = false;
        a.mission = 'idle';
        a.thinkDay = sim.day;
        continue;
      }
      a.path.shift();
      sim.index.moveArmy(a, next);
      a.progress = 0;
      a.naval = false;
      const engaged = this.checkContact(a);
      if (!engaged && a.path.length) this.startEdge(a);
      if (!a.path.length) {
        if (a.mission === 'retreat' || a.mission === 'return' || a.mission === 'move') a.mission = 'idle';
        if (!a.player) a.thinkDay = Math.min(a.thinkDay, sim.day + 1);
      }
    }
  }

  private checkContact(a: Army): boolean {
    const sim = this.sim;
    let enemies: Army[] | null = null;
    for (const o of sim.index.armiesIn(a.location)) {
      if (o !== a && o.owner !== a.owner && sim.index.atWar(o.owner, a.owner)) (enemies ??= []).push(o);
    }
    if (!enemies) return false;
    sim.battles.engage(a.location, a, enemies);
    return true;
  }

  garrison(pid: number): number {
    const ps = this.sim.state.provinces[pid];
    return (ps.population * 0.004 + 3000) * (1 + ps.fort) * (this.sim.provinces.isCapital(pid) ? 1.5 : 1);
  }

  siegeDays(pid: number, country: number): number {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const t = terrainInfo(sim.map.provinces[pid].terrain);
    const liberation = ps.owner === country || (ps.owner >= 0 && sim.wars.sameSide(country, ps.owner));
    let d = 45 * (1 + ps.fort * 0.7) * t.siege * (sim.provinces.isCapital(pid) ? 1.4 : 1) * (0.7 + Math.min(1, ps.development / 20) * 0.6);
    if (liberation) d *= 0.35;
    return Math.max(6, d);
  }

  dailySieges(): void {
    const sim = this.sim;
    const s = sim.state;
    for (const [pid, list] of sim.index.armiesAt) {
      if (!list.length) continue;
      const ps = s.provinces[pid];
      let lead: Army | null = null;
      let power = 0;
      let art = 0;
      let total = 0;
      for (const a of list) {
        if (a.battle >= 0 || a.path.length || a.owner === ps.controller) continue;
        if (!sim.index.atWar(a.owner, ps.controller)) continue;
        const n = soldiersOf(a);
        total += n;
        art += a.artillery;
        power += this.armyPower(a);
        if (!lead || soldiersOf(lead) < n) lead = a;
      }
      if (!lead) {
        if (ps.siege) ps.siege = null;
        continue;
      }
      const leader = lead;
      const hostiles = list.filter((o) => o.battle < 0 && o.path.length === 0 && sim.index.atWar(o.owner, leader.owner));
      if (hostiles.length) {
        sim.battles.engage(pid, leader, hostiles);
        continue;
      }
      const country = leader.owner;
      if (!ps.siege || ps.siege.country !== country) {
        ps.siege = { country, progress: 0, needed: this.siegeDays(pid, country), start: sim.day };
      }
      const c = sim.country(country);
      const g = this.general(leader);
      const rate = clamp(power / this.garrison(pid), 0.3, 2) * (1 + (art / Math.max(1, total)) * 1.5 + this.sim.technology.fx(c).siege) * (1 + (g?.siege ?? 0) * 0.08);
      ps.siege.progress += rate;
      // Cerco: lavouras queimadas, rebanhos confiscados e arredores saqueados.
      ps.devastation = Math.min(1, ps.devastation + 0.0008);
      if (ps.siege.progress >= ps.siege.needed) this.completeSiege(pid, country, list);
    }
  }

  private completeSiege(pid: number, country: number, list: Army[]): void {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const previous = ps.controller;
    const owner = ps.owner;
    const liberation = owner === country || (owner >= 0 && sim.wars.sameSide(country, owner) && sim.index.atWar(owner, previous));
    const war = sim.wars.warBetween(country, previous);
    sim.provinces.setController(pid, liberation ? owner : country);
    if (!liberation) {
      // Cidade tomada: saques e incendios destroem oficinas, pontes, estradas e armazens.
      ps.devastation = Math.min(1, ps.devastation + 0.08);
      ps.development = Math.max(1, ps.development * 0.95 - 0.1);
      ps.population = Math.max(500, ps.population * 0.995);
    }
    const city = sim.provinces.cityName(pid);
    const who = sim.countries.subject(country);
    const text = liberation
      ? `${who} ${sim.countries.verb(country, 'libertou', 'libertaram')} ${city}.`
      : `${who} ${sim.countries.verb(country, 'conquistou', 'conquistaram')} ${city}${owner >= 0 && owner !== country ? ` (${sim.country(owner).name})` : ''}, saqueando a cidade.`;
    if (war) war.log.push({ day: sim.day, text });
    sim.history.add('conquest', text, { countries: [country, previous], province: pid, war: war?.id ?? -1, importance: 1 });
    for (const a of list) {
      if (a.owner !== country && !sim.wars.sameSide(a.owner, country)) continue;
      a.experience = Math.min(1, a.experience + 0.01);
      if (!a.path.length && !a.player) {
        a.mission = 'idle';
        a.thinkDay = sim.day;
      }
    }
  }

  retreat(a: Army, from: number): void {
    const sim = this.sim;
    const friends = sim.diplomacy.accessSet(a.owner);
    const provs = sim.state.provinces;
    const hostileAt = (p: number) => sim.index.armiesIn(p).some((o) => o.owner !== a.owner && sim.index.atWar(o.owner, a.owner));
    sim.pathfinder.explore(from, (p) => friends.has(provs[p].controller) && !hostileAt(p), this.canUseSea(a.owner), 60, this.speed(a));
    const best = sim.pathfinder.reached.find((p) => p !== from) ?? -1;
    if (best < 0 || soldiersOf(a) < 800) {
      this.destroyArmy(a, from);
      return;
    }
    this.setPath(a, sim.pathfinder.pathTo(best), 'retreat', best);
    a.retreatUntil = sim.day + 20;
    a.thinkDay = sim.day + 20;
    a.player = false;
  }

  sendHome(a: Army): void {
    const sim = this.sim;
    const provs = sim.state.provinces;
    const friends = sim.diplomacy.accessSet(a.owner);
    if (friends.has(provs[a.location].controller)) {
      a.path = [];
      a.mission = 'idle';
      return;
    }
    sim.pathfinder.explore(a.location, () => true, this.canUseSea(a.owner), 500, this.speed(a));
    const target = sim.pathfinder.reached.find((p) => provs[p].controller === a.owner) ?? -1;
    if (target < 0) {
      this.removeArmy(a);
      return;
    }
    this.setPath(a, sim.pathfinder.pathTo(target), 'return', target);
    a.thinkDay = sim.day + Math.ceil(a.edgeDays * (a.path.length + 1));
  }

  // Ordem do jogador: marchar ate uma provincia.
  orderMove(a: Army, target: number): boolean {
    const sim = this.sim;
    if (a.battle >= 0) return false;
    const path = sim.pathfinder.findPath(a.location, target, this.passable(a.owner, 'normal'), this.canUseSea(a.owner), 900, this.speed(a));
    if (!path) return false;
    const ps = sim.state.provinces[target];
    const hostile = sim.index.atWar(a.owner, ps.controller);
    this.setPath(a, path, hostile ? 'siege' : 'move', target);
    a.player = true;
    a.thinkDay = sim.day + 60;
    return true;
  }

  targetArmySize(c: Country): number {
    const sim = this.sim;
    const pers = PERSONALITIES[c.personality];
    const gov = GOVERNMENTS[c.government];
    const atWar = sim.index.isAtWar(c.id);
    let t = c.population * sim.era.mobilization * gov.military * (0.5 + pers.militaryBudget * 3);
    if (atWar) t *= 2.2;
    // Em guerra cada soldado custa bem mais (armamentos, municao, provisoes) e o governo financia o
    // exercito com divida enquanto houver credito; esgotado o credito, o exercito que da para manter encolhe.
    const perSoldier = sim.economy.soldierMonthlyCost(c) * sim.economy.warCostFactor(c);
    const credit = atWar ? sim.economy.warCredit(c) / 12 : 0;
    const affordable = (c.income * (atWar ? 0.9 : 0.25 + pers.militaryBudget) + credit) / Math.max(1e-6, perSoldier);
    if (affordable > 0) t = Math.min(t, affordable * (c.treasury > c.income * 6 ? 1.3 : 1));
    const mod = c.modifiers.reduce((acc, m) => acc + (m.military ?? 0), 0);
    return Math.max(0, t * (1 + mod));
  }

  maxArmies(c: Country, atWar: boolean): number {
    return clamp(1 + Math.floor(c.provinceCount / 6), 1, 7) + (atWar ? 2 : 0);
  }

  // Recrutas so se reunem em estados seguros: controlados, sem cerco e sem exercitos inimigos presentes
  // (senao cada nova leva nasceria dentro de uma batalha perdida).
  private recruitmentProvince(c: Country): number {
    const sim = this.sim;
    const provs = sim.state.provinces;
    const safe = (p: number) => {
      if (provs[p].controller !== c.id || provs[p].siege) return false;
      for (const a of sim.index.armiesIn(p)) if (a.owner !== c.id && sim.index.atWar(a.owner, c.id)) return false;
      return true;
    };
    if (c.capital >= 0 && provs[c.capital].owner === c.id && safe(c.capital)) return c.capital;
    let best = -1;
    let bp = -1;
    for (const p of sim.index.ownedBy[c.id]) {
      if (!safe(p)) continue;
      if (provs[p].population > bp) {
        bp = provs[p].population;
        best = p;
      }
    }
    return best;
  }

  private recruit(c: Country): void {
    const sim = this.sim;
    const atWar = sim.index.isAtWar(c.id);
    const target = this.targetArmySize(c);
    const current = c.armySize;
    const armies = this.armiesOf(c.id);
    if (current < target * 0.97) {
      const unitCost = sim.economy.recruitCost(c, 1);
      let want = Math.min(target - current, c.manpower * 0.4);
      // Em guerra, recrutas e armamentos podem ser comprados a credito (o saldo negativo vira divida).
      want = Math.min(want, (c.treasury * (atWar ? 0.8 : 0.4) + (atWar ? sim.economy.warCredit(c) * 0.2 : 0)) / Math.max(1e-6, unitCost));
      if (want < 200) return;
      let used = 0;
      const chunk = sim.era.armyChunk * (1 + c.tech / 30);
      for (const a of armies) {
        if (used >= want) break;
        if (a.battle >= 0 || sim.state.provinces[a.location].controller !== c.id) continue;
        const room = chunk - soldiersOf(a);
        if (room <= 0) continue;
        const add = Math.min(room, want - used);
        this.addSoldiers(a, add, c.tech);
        used += add;
      }
      const maxArmies = this.maxArmies(c, atWar);
      while (want - used >= Math.min(5000, chunk * 0.15) && armies.length < maxArmies) {
        const home = this.recruitmentProvince(c);
        if (home < 0) break;
        const size = Math.min(chunk * 0.6, want - used);
        armies.push(this.raiseArmy(c.id, home, size));
        used += size;
      }
      c.manpower = Math.max(0, c.manpower - used);
      c.treasury -= used * unitCost;
    } else if (!atWar && current > target * 1.35 && current > 0) {
      const excess = (current - target) * 0.15;
      for (const a of armies) {
        if (a.battle >= 0) continue;
        const cut = this.applyLosses(a, excess * (soldiersOf(a) / current));
        c.manpower += cut * 0.8;
      }
    }
  }

  private navalAndAir(c: Country): void {
    const sim = this.sim;
    const owned = sim.index.ownedBy[c.id];
    let coastal = 0;
    for (const p of owned) if (sim.map.coastal[p]) coastal++;
    const pers = PERSONALITIES[c.personality];
    const target = coastal > 0 ? coastal * (0.8 + c.tech / 12) * (0.6 + pers.tradeSeek * 0.4 + pers.militaryBudget) * (1 + this.sim.technology.fx(c).naval) : 0;
    c.navy += (target - c.navy) * 0.05;
    if (target > 0 && c.navy < 1) c.navy = 1;
    if (this.sim.technology.hasAirForce(c)) c.airForce += (c.armySize / 15000 - c.airForce) * 0.05;
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const day = sim.day;
    const stack = new Map<number, number>();
    for (const a of s.armies) {
      const k = a.location * 8192 + a.owner;
      stack.set(k, (stack.get(k) ?? 0) + soldiersOf(a));
    }
    for (const a of [...s.armies]) {
      const c = sim.country(a.owner);
      if (!c || !c.alive) {
        this.removeArmy(a);
        continue;
      }
      const ps = s.provinces[a.location];
      const mp = sim.map.provinces[a.location];
      const t = terrainInfo(mp.terrain);
      const friendly = sim.diplomacy.accessSet(a.owner).has(ps.controller);
      // Terra arrasada abastece mal: exercitos em estados destruidos passam fome e sofrem mais atricao.
      const capacity = (ps.population * 0.02 + 8000) * t.supply * (friendly ? 1.6 : 0.8) * (1 + ps.development / 15) * (1 - ps.devastation * 0.7);
      const stacked = stack.get(a.location * 8192 + a.owner) ?? soldiersOf(a);
      // Exercitos em territorio inimigo vivem do saque: confiscam colheitas e destroem o que encontram.
      if (!friendly && a.battle < 0) ps.devastation = Math.min(1, ps.devastation + 0.006 * Math.min(1, soldiersOf(a) / 40000));
      a.supply = clamp(capacity / Math.max(1, stacked), 0.2, 1);
      const winter = season(day, mp.lat) === 0 && Math.abs(mp.lat) > 40;
      const rate = t.attrition * (winter ? 2 : 1) + (1 - a.supply) * 0.05 + (a.naval ? 0.01 : 0);
      if (a.battle < 0) {
        if (rate > 0) this.applyLosses(a, soldiersOf(a) * rate);
        const maxMorale = 0.75 + Math.min(0.25, c.tech * 0.01);
        a.morale = Math.min(maxMorale, a.morale + (friendly ? 0.12 : 0.04) * a.supply);
        if (soldiersOf(a) < 300) {
          this.removeArmy(a);
          continue;
        }
        if (a.general < 0) this.assignGeneral(a, c);
      }
      if (a.player && day > a.thinkDay) a.player = false;
    }
    for (const c of s.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      this.recruit(c);
      this.navalAndAir(c);
    }
  }
}
