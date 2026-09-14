// REBELLION ENGINE: revoltas nascidas da agitacao, separatismo, restauracao de paises extintos,
// revolucoes, guerras civis (com provincias e exercitos desertando), colapso de imperios
// e revoltas de vassalos.
import { formatDuration } from '../../core/calendar';
import { GOVERNMENTS, type GovernmentId } from '../../data/governments';
import type { RGB } from '../../data/terrain';
import type { Army, Country, RebelType, War } from '../../state/types';
import { rebelFlag } from '../flags';
import type { Simulation } from '../Simulation';
import { isRebelGoal } from './WarEngine';

const darken = (c: RGB, k = 0.7): RGB => c.map((v) => Math.round(v * k)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class RebellionEngine {
  constructor(private sim: Simulation) {}

  factionsAgainst(id: number): Country[] {
    return this.sim.state.countries.filter((c) => c.alive && c.kind === 'rebel' && c.rebel?.target === id);
  }

  controlledBy(id: number): number[] {
    const out: number[] = [];
    const provs = this.sim.state.provinces;
    for (let p = 0; p < provs.length; p++) if (provs[p].controller === id) out.push(p);
    return out;
  }

  private rebelWar(id: number): War | undefined {
    return this.sim.wars.warsOf(id).find((w) => isRebelGoal(w.goal.type));
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const rng = sim.rng;
    // Rebelioes desligadas: nenhuma revolta, guerra civil ou colapso espontaneo (rebeldes ja em armas seguem lutando).
    const enabled = s.settings.rebellions;
    for (const c of [...s.countries]) {
      if (!c.alive) continue;
      if (c.kind === 'rebel') {
        this.sustainRebels(c);
        continue;
      }
      if (c.provinceCount === 0) continue;
      if (c.overlord >= 0) this.checkVassal(c);
      if (!enabled) continue;
      const factions = this.factionsAgainst(c.id).length;
      if (factions < 2) {
        let hot = -1;
        let hv = 0;
        for (const p of sim.index.ownedBy[c.id]) {
          const ps = s.provinces[p];
          if (ps.unrest > hv && ps.controller === c.id) {
            hv = ps.unrest;
            hot = p;
          }
        }
        if (hot >= 0 && hv > 55 && rng.chance((hv - 55) / 300)) this.spawnRevolt(c, hot);
      }
      if (factions === 0 && c.stability < 10 && c.provinceCount >= 5 && rng.chance(0.006)) {
        this.startCivilWar(c, 'a instabilidade crônica');
      } else if (c.provinceCount >= 12 && c.stability < 10 && c.warExhaustion > 40 && rng.chance(0.02)) {
        const owned = sim.index.ownedBy[c.id];
        const nonCore = owned.filter((p) => !s.provinces[p].cores.includes(c.id)).length / owned.length;
        if (nonCore > 0.3) this.collapse(c);
      }
    }
  }

  private sustainRebels(r: Country): void {
    const sim = this.sim;
    const controlled = this.controlledBy(r.id);
    const armies = sim.military.armiesOf(r.id);
    const war = this.rebelWar(r.id);
    if (!war) {
      sim.countries.destroy(r.id, -1);
      return;
    }
    if (!armies.length && !controlled.length) {
      this.crush(war, r, sim.country(r.rebel?.target ?? war.defenderLeader));
      return;
    }
    if (controlled.length) {
      const recruits = controlled.reduce((acc, p) => acc + sim.state.provinces[p].population * 0.0015, 0);
      if (armies.length) {
        armies.sort((a, b) => b.infantry - a.infantry);
        sim.military.addSoldiers(armies[0], recruits, r.tech);
      } else {
        sim.military.raiseArmy(r.id, controlled[0], recruits + 1500, `Exército ${sim.countries.de(r.id)}`);
      }
    }
  }

  private regionAround(countryId: number, pid: number, deadCore: number): number[] {
    const sim = this.sim;
    const provs = sim.state.provinces;
    const m = sim.map;
    const origin = provs[pid];
    const out = [pid];
    const seen = new Set([pid]);
    let frontier = [pid];
    for (let depth = 0; depth < 3 && out.length < 8; depth++) {
      const next: number[] = [];
      for (const p of frontier) {
        for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
          const q = m.edgeTo[e];
          if (seen.has(q)) continue;
          seen.add(q);
          const ps = provs[q];
          if (ps.owner !== countryId || ps.controller !== countryId) continue;
          const fits = deadCore >= 0 ? ps.cores.includes(deadCore) : (ps.culture === origin.culture && ps.unrest >= 30) || !ps.cores.includes(countryId);
          if (!fits) continue;
          out.push(q);
          next.push(q);
          if (out.length >= 8) break;
        }
      }
      frontier = next;
    }
    return out;
  }

  revolutionaryGovernment(c: Country): GovernmentId {
    const rng = this.sim.rng;
    switch (c.government) {
      case 'monarchy':
      case 'empire':
        return c.tech >= 16 ? 'democracy' : 'republic';
      case 'republic':
      case 'democracy':
        return rng.chance(0.5) ? 'dictatorship' : 'federation';
      case 'dictatorship':
        return c.tech >= 14 ? 'democracy' : 'republic';
      case 'theocracy':
        return 'republic';
      case 'federation':
        return 'republic';
      default:
        return 'federation';
    }
  }

  // byPlayer: rebeliao incitada pelo jogador (acontece mesmo com as rebelioes espontaneas desligadas).
  spawnRevolt(c: Country, pid: number, forced?: RebelType, byPlayer = false): Country | null {
    const sim = this.sim;
    const s = sim.state;
    const rng = sim.rng;
    if (!byPlayer && !s.settings.rebellions) return null;
    const ps = s.provinces[pid];
    if (ps.owner !== c.id || c.kind !== 'nation') return null;
    const deadCore = ps.cores.find((k) => k !== c.id && !s.countries[k].alive && s.countries[k].kind === 'nation' && sim.day - s.countries[k].died > 5 * 365);
    let type: RebelType = forced ?? 'separatist';
    if (!forced) {
      if (deadCore !== undefined && rng.chance(0.7)) type = 'restoration';
      else if (ps.culture === c.culture && ps.cores.includes(c.id) && c.stability < 40 && rng.chance(0.6)) type = 'revolution';
    }
    if (type === 'restoration' && deadCore === undefined) type = 'separatist';
    if (type === 'civil_war') type = 'revolution';
    const restore = type === 'restoration' ? (deadCore as number) : -1;
    const city = sim.provinces.cityName(pid);
    const claims = type === 'revolution' ? [...new Set([c.capital >= 0 ? c.capital : pid, pid])] : this.regionAround(c.id, pid, restore);
    let name: string;
    let color: RGB;
    let newGov: GovernmentId | '' = '';
    if (type === 'restoration') {
      name = `Restauracionistas ${sim.countries.de(restore)}`;
      color = s.countries[restore].color;
    } else if (type === 'revolution') {
      newGov = this.revolutionaryGovernment(c);
      name = `Revolucionários ${sim.countries.de(c.id)}`;
      color = darken(c.color, 0.55);
    } else {
      name = `Separatistas de ${city}`;
      color = mix(c.color, [70, 60, 60], 0.45);
    }
    const rebel = sim.countries.create({
      name, article: 'os', kind: 'rebel', parent: c.id, provinces: [], capital: pid, government: c.government,
      culture: ps.culture, religion: ps.religion, color, flag: rebelFlag(rng, color),
      rebel: { type, target: c.id, claims, restore, newGovernment: newGov },
    });
    const pool = claims.reduce((acc, p) => acc + s.provinces[p].population, 0);
    const soldiers = Math.min(pool * 0.02 * (ps.unrest / 100) + 2500, c.armySize * 0.8 + 6000);
    sim.military.raiseArmy(rebel.id, pid, soldiers, `Exército ${sim.countries.de(rebel.id)}`);
    for (const p of claims) s.provinces[p].unrest = Math.max(0, s.provinces[p].unrest - 15);
    const goalType = type === 'separatist' ? 'independence' : type;
    const description = type === 'separatist' ? `Independência: ${sim.provinces.nameList(claims)}` : type === 'restoration' ? `Restaurar ${s.countries[restore].name}` : `Derrubar o governo ${sim.countries.de(c.id)}`;
    sim.wars.declareWar(rebel.id, c.id, { type: goalType, provinces: claims, description }, { callAllies: false });
    return rebel;
  }

  startCivilWar(c: Country, reason: string, byPlayer = false): void {
    const sim = this.sim;
    const s = sim.state;
    const m = sim.map;
    if (!byPlayer && !s.settings.rebellions) return;
    if (c.kind !== 'nation' || !c.alive || c.provinceCount < 3) return;
    if (sim.wars.warsOf(c.id).some((w) => w.goal.type === 'civil_war' || w.goal.type === 'revolution')) return;
    const owned = new Set(sim.index.ownedBy[c.id].filter((p) => s.provinces[p].controller === c.id));
    if (owned.size < 3) return;
    const capital = c.capital >= 0 && owned.has(c.capital) ? c.capital : [...owned][0];
    const dist = new Map<number, number>([[capital, 0]]);
    const queue = [capital];
    while (queue.length) {
      const p = queue.shift() as number;
      const d = dist.get(p) as number;
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        const q = m.edgeTo[e];
        if (owned.has(q) && !dist.has(q)) {
          dist.set(q, d + 1);
          queue.push(q);
        }
      }
    }
    let seed = capital;
    let far = -1;
    for (const [p, d] of dist) {
      if (d > far) {
        far = d;
        seed = p;
      }
    }
    if (seed === capital) return;
    const want = Math.max(1, Math.floor(dist.size * 0.42));
    const region: number[] = [];
    const seen = new Set([seed]);
    const q2 = [seed];
    while (q2.length && region.length < want) {
      const p = q2.shift() as number;
      if (p === capital) continue;
      region.push(p);
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        const q = m.edgeTo[e];
        if (dist.has(q) && !seen.has(q)) {
          seen.add(q);
          q2.push(q);
        }
      }
    }
    if (region.length < 1) return;
    const pretender = this.revolutionaryGovernment(c);
    const rebelColor = mix(c.color, [40, 40, 40], 0.35);
    const rebel = sim.countries.create({
      name: `Insurgentes de ${sim.provinces.cityName(region[0])}`, article: 'os', kind: 'rebel', parent: c.id, provinces: [],
      capital: region[0], government: pretender, culture: c.culture, religion: c.religion, color: rebelColor,
      flag: rebelFlag(sim.rng, rebelColor), rebel: { type: 'civil_war', target: c.id, claims: region, restore: -1, newGovernment: pretender },
    });
    const regionSet = new Set(region);
    for (const a of sim.military.armiesOf(c.id)) if (a.battle < 0 && regionSet.has(a.location)) this.transferArmy(a, rebel.id);
    const levy = region.reduce((acc, p) => acc + s.provinces[p].population, 0) * 0.004 + 3000;
    sim.military.raiseArmy(rebel.id, region[0], levy, `Exército ${sim.countries.de(rebel.id)}`);
    const moved = c.treasury * 0.3;
    c.treasury -= moved;
    rebel.treasury += moved;
    c.stability = Math.max(0, c.stability - 10);
    sim.history.add('civil_war', `Guerra civil ${sim.countries.in(c.id)}! ${capitalize(reason)} dividiu o país: os ${rebel.name} controlam ${region.length === 1 ? '1 estado' : `${region.length} estados`}.`, {
      countries: [c.id, rebel.id], province: region[0], importance: 3,
    });
    sim.wars.declareWar(rebel.id, c.id, { type: 'civil_war', provinces: [capital, ...region], description: `Tomar o poder ${sim.countries.in(c.id)}` }, { callAllies: false });
    for (const p of region) sim.provinces.setController(p, rebel.id);
  }

  transferArmy(a: Army, newOwner: number): void {
    const sim = this.sim;
    const old = sim.country(a.owner);
    const g = old.generals.find((x) => x.id === a.general);
    if (g) g.army = -1;
    a.owner = newOwner;
    a.general = -1;
    a.path = [];
    a.mission = 'idle';
    a.target = -1;
    a.thinkDay = sim.day + 1;
    a.player = false;
    a.name = `${sim.military.armiesOf(newOwner).length}º Exército ${sim.countries.de(newOwner)}`;
    sim.military.assignGeneral(a, sim.country(newOwner));
  }

  checkWar(war: War): void {
    const sim = this.sim;
    const s = sim.state;
    const rebel = sim.country(war.attackerLeader);
    const target = sim.country(war.defenderLeader);
    if (!rebel.alive || rebel.kind !== 'rebel' || !rebel.rebel) {
      if (war.active && !rebel.alive) sim.wars.endWar(war, { winner: 'defenders', ceded: [], annexed: [], vassals: [], reparations: 0, treaty: -1, summary: 'A rebelião foi esmagada.' });
      return;
    }
    const info = rebel.rebel;
    const controlled = this.controlledBy(rebel.id);
    const armies = sim.military.armiesOf(rebel.id);
    const months = (sim.day - war.start) / 30;
    if ((armies.length === 0 && controlled.length === 0) || (war.warscore <= -40 && months > 3) || (armies.length === 0 && months > 6 && sim.rng.chance(0.3))) {
      this.crush(war, rebel, target);
      return;
    }
    const claimControl = info.claims.filter((p) => s.provinces[p].controller === rebel.id).length / Math.max(1, info.claims.length);
    const capitalTaken = target.capital >= 0 && s.provinces[target.capital].controller === rebel.id;
    const targetControlled = (sim.index.ownedBy[target.id] ?? []).filter((p) => s.provinces[p].controller === target.id).length;
    const wins =
      targetControlled === 0 ||
      war.warscore >= 60 ||
      (claimControl >= 0.75 && months >= 6) ||
      (capitalTaken && (info.type === 'revolution' || info.type === 'civil_war') && months >= 2) ||
      (months > 48 && war.exhaustion[1] > 60 && sim.rng.chance(0.1));
    if (wins) this.victory(war, rebel, target, controlled, capitalTaken);
  }

  // Forca o desfecho de uma guerra rebelde (acao do jogador).
  forceOutcome(war: War, rebelsWin: boolean): void {
    const sim = this.sim;
    const rebel = sim.country(war.attackerLeader);
    const target = sim.country(war.defenderLeader);
    if (!war.active || rebel.kind !== 'rebel') return;
    if (!rebelsWin) {
      this.crush(war, rebel, target);
      return;
    }
    for (const p of rebel.rebel?.claims ?? []) {
      const ps = sim.state.provinces[p];
      if (ps.owner === target.id && ps.controller !== rebel.id) sim.provinces.setController(p, rebel.id);
    }
    const capitalTaken = target.capital >= 0 && sim.state.provinces[target.capital].controller === rebel.id;
    this.victory(war, rebel, target, this.controlledBy(rebel.id), capitalTaken);
  }

  private victory(war: War, rebel: Country, target: Country, controlled: number[], capitalTaken: boolean): void {
    const sim = this.sim;
    const s = sim.state;
    const info = rebel.rebel;
    if (!info) return;
    const owned = controlled.filter((p) => s.provinces[p].owner === target.id);
    const base = { vassals: [], reparations: 0, treaty: -1, annexed: [] };

    if (info.type === 'revolution' || (info.type === 'civil_war' && capitalTaken)) {
      const newGov = info.newGovernment || 'republic';
      for (const a of sim.military.armiesOf(rebel.id)) this.transferArmy(a, target.id);
      for (const p of controlled) sim.provinces.setController(p, s.provinces[p].owner);
      sim.wars.endWar(war, { ...base, winner: 'attackers', ceded: [], summary: 'O antigo regime caiu.' }, {
        text: `Os ${rebel.name} triunfaram: o governo ${sim.countries.de(target.id)} foi derrubado.`, type: 'revolution', importance: 3,
      });
      sim.government.changeGovernment(target, newGov, '', 3, true);
      sim.history.add('government', `Nasce um novo regime: ${sim.countries.formalName(target.id)} (${GOVERNMENTS[newGov].name}).`, { countries: [target.id], importance: 2 });
      target.stability = Math.max(target.stability, 35);
      sim.countries.destroy(rebel.id, -1);
      return;
    }

    if (!owned.length) {
      this.crush(war, rebel, target);
      return;
    }

    if (info.type === 'restoration' && info.restore >= 0) {
      const dead = s.countries[info.restore];
      const years = formatDuration(sim.day - dead.died);
      const armies = sim.military.armiesOf(rebel.id);
      sim.countries.revive(dead.id, owned);
      for (const a of armies) this.transferArmy(a, dead.id);
      sim.wars.endWar(war, { ...base, winner: 'attackers', ceded: owned.map((p) => ({ province: p, from: target.id, to: dead.id })), summary: `${dead.name} foi restaurado.` }, {
        text: `${dead.name} renasce! Após ${years} sob domínio estrangeiro, o país foi restaurado.`, type: 'independence', importance: 3,
      });
      sim.diplomacy.createTreaty('truce', [dead.id, target.id], { years: 10, silent: true });
      sim.countries.destroy(rebel.id, -1);
      return;
    }

    const capital = rebel.capital >= 0 && owned.includes(rebel.capital) ? rebel.capital : owned[0];
    const armies = sim.military.armiesOf(rebel.id);
    const government: GovernmentId = info.type === 'civil_war' ? info.newGovernment || target.government : target.tech < 10 && sim.rng.chance(0.4) ? 'monarchy' : 'republic';
    // Nome do novo pais: o estado da capital; se ja for o nome de uma nacao (estado unico "Bahrein"), a cidade ("Manama").
    const stateName = sim.provinces.name(capital);
    const nameTaken = s.countries.some((k) => k.alive && k.name === stateName);
    const nation = sim.countries.create({
      name: nameTaken ? sim.provinces.cityName(capital) : stateName, article: '', kind: 'nation', parent: target.id, provinces: owned, capital, government,
      culture: s.provinces[capital].culture, religion: s.provinces[capital].religion,
    });
    for (const a of armies) this.transferArmy(a, nation.id);
    sim.wars.endWar(war, { ...base, winner: 'attackers', ceded: owned.map((p) => ({ province: p, from: target.id, to: nation.id })), summary: `${nation.name} tornou-se independente.` }, {
      text: `${nation.name} conquistou sua independência ${sim.countries.de(target.id)}! Nasce uma nova nação: ${sim.countries.formalName(nation.id)}.`,
      type: 'independence',
      importance: 3,
    });
    sim.history.add('founded', `Fundação ${sim.countries.de(nation.id)} (${sim.countries.formalName(nation.id)}), com ${owned.length === 1 ? '1 estado' : `${owned.length} estados`}.`, { countries: [nation.id], province: capital, importance: 2 });
    sim.diplomacy.createTreaty('truce', [nation.id, target.id], { years: 10, silent: true });
    sim.countries.destroy(rebel.id, -1);
  }

  private crush(war: War, rebel: Country, target: Country): void {
    const sim = this.sim;
    for (const p of rebel.rebel?.claims ?? []) sim.state.provinces[p].unrest = Math.max(0, sim.state.provinces[p].unrest - 40);
    target.stability = Math.min(100, target.stability + 5);
    target.prestige = Math.min(100, target.prestige + 3);
    if (war.active) {
      sim.wars.endWar(war, { winner: 'defenders', ceded: [], annexed: [], vassals: [], reparations: 0, treaty: -1, summary: `Os ${rebel.name} foram derrotados.` }, {
        text: `${target.name} esmagou a rebelião: os ${rebel.name} foram derrotados.`, type: 'rebellion', importance: 2,
      });
    }
    sim.countries.destroy(rebel.id, target.id);
  }

  collapse(c: Country): void {
    const sim = this.sim;
    const s = sim.state;
    const groups = new Map<number, number[]>();
    for (const p of sim.index.ownedBy[c.id]) {
      const ps = s.provinces[p];
      if (ps.controller !== c.id) continue;
      const core = ps.cores.find((k) => k !== c.id && !s.countries[k].alive && s.countries[k].kind === 'nation');
      if (core === undefined) continue;
      const list = groups.get(core) ?? [];
      list.push(p);
      groups.set(core, list);
    }
    const released: string[] = [];
    for (const [dead, provinces] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      if (released.length >= 3 || provinces.length >= sim.index.ownedBy[c.id].length) break;
      sim.countries.revive(dead, provinces);
      sim.diplomacy.createTreaty('truce', [dead, c.id], { years: 5, silent: true });
      released.push(s.countries[dead].name);
    }
    if (!released.length) {
      this.startCivilWar(c, 'o colapso do império');
      return;
    }
    c.stability = 25;
    sim.history.add('collapse', `Colapso ${sim.countries.de(c.id)}: ${released.join(', ')} ${released.length > 1 ? 'recuperaram suas independências' : 'recuperou sua independência'}.`, {
      countries: [c.id], importance: 3,
    });
  }

  private checkVassal(v: Country): void {
    const sim = this.sim;
    const o = sim.country(v.overlord);
    if (!o?.alive) {
      v.overlord = -1;
      return;
    }
    const tribute = Math.max(0, v.income) * 0.1;
    v.treasury -= tribute;
    o.treasury += tribute;
  }

  // Motivacao de um vassalo para lutar pela independencia (0 = nenhuma). A guerra so comeca pelo sorteio mensal
  // de conflitos entre nacoes, e apenas com as rebelioes ligadas.
  liberationWeight(v: Country): number {
    const sim = this.sim;
    const o = v.overlord >= 0 ? sim.country(v.overlord) : null;
    if (!o?.alive || !v.alive || !v.ai || v.kind !== 'nation' || sim.day - v.founded < 365 || !sim.state.settings.rebellions) return 0;
    const rel = sim.diplomacy.relation(v.id, o.id);
    const ratio = sim.countries.strength(v.id) / Math.max(1, sim.countries.strength(o.id));
    return 5 + (rel < -10 ? 20 : 0) + (sim.index.isAtWar(o.id) ? 20 : 0) + (ratio > 0.6 ? 20 : 0);
  }

  liberate(v: Country): boolean {
    const sim = this.sim;
    const o = sim.country(v.overlord);
    const t = sim.state.treaties.find((x) => x.active && x.type === 'vassal' && x.members[0] === o.id && x.members[1] === v.id);
    if (t) sim.diplomacy.endTreaty(t);
    v.overlord = -1;
    sim.history.add('independence', `${v.name} rebelou-se contra seu suserano, ${o.name}.`, { countries: [v.id, o.id], importance: 2 });
    sim.wars.declareWar(v.id, o.id, { type: 'conquest', provinces: [], description: `Libertação do jugo ${sim.countries.de(o.id)}` });
    return true;
  }
}
