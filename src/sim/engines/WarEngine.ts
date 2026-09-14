// WAR ENGINE: declaracao de guerra, casus belli, chamada de aliados, war score, exaustao,
// queda de capitais, paz (cessoes, anexacao, vassalagem, reparacoes, paz branca) e tregua.
import { fmtMoney } from '../../core/format';
import { clamp } from '../../core/math';
import { GOVERNMENTS } from '../../data/governments';
import { PERSONALITIES } from '../../data/personalities';
import type { HistoryType, War, WarGoal, WarGoalType, WarResult } from '../../state/types';
import type { Simulation } from '../Simulation';

const REBEL_GOALS: WarGoalType[] = ['independence', 'revolution', 'restoration', 'civil_war'];
export const isRebelGoal = (t: WarGoalType) => REBEL_GOALS.includes(t);

export const GOAL_NAMES: Record<WarGoalType, string> = {
  conquest: 'Conquista territorial',
  annex: 'Anexação',
  subjugate: 'Subjugação',
  reconquest: 'Reconquista',
  unification: 'Unificação cultural',
  holy_war: 'Guerra santa',
  coalition: 'Coalizão contra agressor',
  independence: 'Independência',
  revolution: 'Revolução',
  restoration: 'Restauração',
  civil_war: 'Guerra civil',
};

const ORDINAL_FEM = ['', '', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona', 'Décima'];
const ORDINAL_MASC = ['', '', 'Segundo', 'Terceiro', 'Quarto', 'Quinto', 'Sexto', 'Sétimo', 'Oitavo', 'Nono', 'Décimo'];

function withOrdinal(base: string, count: number, feminine: boolean): string {
  if (count <= 1) return base;
  const words = feminine ? ORDINAL_FEM : ORDINAL_MASC;
  return `${words[count] ?? `${count}${feminine ? 'ª' : 'º'}`} ${base}`;
}

function countNamed(names: string[], base: string): number {
  return names.filter((n) => n === base || (n.endsWith(` ${base}`) && n.split(' ').length === base.split(' ').length + 1)).length;
}

export interface DeclareOptions {
  forced?: boolean;
  callAllies?: boolean;
  name?: string;
}

export class WarEngine {
  private fallenCapitals = new Set<string>();

  constructor(private sim: Simulation) {}

  sideOf(war: War, c: number): 0 | 1 | -1 {
    if (war.attackers.includes(c)) return 0;
    if (war.defenders.includes(c)) return 1;
    return -1;
  }

  warsOf(c: number): War[] {
    return this.sim.index.warsOf.get(c) ?? [];
  }

  warBetween(a: number, b: number): War | undefined {
    for (const w of this.warsOf(a)) {
      const sa = this.sideOf(w, a);
      const sb = this.sideOf(w, b);
      if (sa >= 0 && sb >= 0 && sa !== sb) return w;
    }
    return undefined;
  }

  sameSide(a: number, b: number): boolean {
    if (a === b) return true;
    for (const w of this.warsOf(a)) {
      const sb = this.sideOf(w, b);
      if (sb >= 0 && sb === this.sideOf(w, a)) return true;
    }
    return false;
  }

  enemiesOf(c: number): Set<number> {
    const out = new Set<number>();
    for (const w of this.warsOf(c)) for (const e of this.sideOf(w, c) === 0 ? w.defenders : w.attackers) out.add(e);
    return out;
  }

  canDeclare(a: number, d: number): string | null {
    const sim = this.sim;
    const A = sim.country(a);
    const D = sim.country(d);
    if (!A?.alive || !D?.alive) return 'País inexistente.';
    if (a === d) return 'Um país não pode declarar guerra a si mesmo.';
    if (sim.index.atWar(a, d)) return 'Já estão em guerra.';
    if (sim.diplomacy.hasTreaty(a, d, 'alliance')) return 'São aliados.';
    if (A.overlord === d || D.overlord === a) return 'Relação de vassalagem.';
    if (sim.diplomacy.hasTreaty(a, d, 'truce')) return 'Trégua em vigor.';
    if (sim.diplomacy.hasTreaty(a, d, 'nap')) return 'Pacto de não agressão em vigor.';
    return null;
  }

  private warName(a: number, d: number, goal: WarGoal): string {
    const sim = this.sim;
    const A = sim.country(a);
    const D = sim.country(d);
    let base: string;
    switch (goal.type) {
      case 'independence': base = `Guerra de Independência de ${A.capital >= 0 ? sim.provinces.cityName(A.capital) : A.name}`; break;
      case 'revolution': base = `Revolução ${sim.countries.de(d)}`; break;
      case 'civil_war': base = `Guerra Civil ${sim.countries.de(d)}`; break;
      case 'restoration': base = A.rebel && A.rebel.restore >= 0 ? `Guerra de Restauração ${sim.countries.de(A.rebel.restore)}` : `Guerra de Restauração`; break;
      case 'coalition': base = `Guerra da Coalizão contra ${D.name}`; break;
      case 'holy_war': base = `Guerra Santa ${sim.countries.de(a)}`; break;
      default: base = `Guerra ${A.name}–${D.name}`;
    }
    const count = countNamed(sim.state.wars.map((w) => w.name), base);
    return withOrdinal(base, count + 1, true);
  }

  declareWar(attacker: number, defender: number, goal: WarGoal, opts: DeclareOptions = {}): War | null {
    const sim = this.sim;
    const reason = this.canDeclare(attacker, defender);
    if (reason && !(opts.forced && !sim.index.atWar(attacker, defender) && attacker !== defender && sim.country(attacker)?.alive && sim.country(defender)?.alive)) return null;
    const A = sim.country(attacker);
    const D = sim.country(defender);
    if (opts.forced && reason) {
      A.prestige = Math.max(0, A.prestige - 15);
      A.stability = Math.max(0, A.stability - 8);
    }
    const war: War = {
      id: sim.nextId('war'),
      name: opts.name ?? this.warName(attacker, defender, goal),
      goal,
      attackers: [attacker],
      defenders: [defender],
      attackerLeader: attacker,
      defenderLeader: defender,
      start: sim.day,
      end: -1,
      active: true,
      warscore: 0,
      exhaustion: [0, 0],
      casualties: [0, 0],
      battlesWon: [0, 0],
      battles: [],
      occupied: [0, 0],
      goalHeldMonths: 0,
      scoreHistory: [],
      result: null,
      log: [],
    };
    sim.state.wars.push(war);
    sim.diplomacy.breakTreatiesBetween(attacker, defender);
    sim.diplomacy.addRelation(attacker, defender, -60);
    sim.index.rebuildWars();
    A.lastWarDay = sim.day;
    const rebel = isRebelGoal(goal.type);
    const plural = A.article === 'os' || A.article === 'as';
    const subject = plural ? `Os ${A.name}` : A.name;
    const text = rebel
      ? `${war.name}: ${subject} ${plural ? 'pegaram' : 'pegou'} em armas contra ${D.name}.`
      : `${A.name} declarou guerra ${sim.countries.to(defender)}. Casus belli: ${goal.description}.`;
    war.log.push({ day: sim.day, text });
    const big = A.provinceCount + D.provinceCount >= 25;
    sim.history.add(rebel ? 'rebellion' : 'war_declared', text, { countries: [attacker, defender], war: war.id, importance: big ? 3 : 2 });

    if (opts.callAllies !== false && !rebel) this.callAllies(war);
    for (const army of sim.state.armies) {
      if (!army.player && (war.attackers.includes(army.owner) || war.defenders.includes(army.owner))) {
        army.thinkDay = Math.min(army.thinkDay, sim.day + sim.rng.int(0, 3));
      }
    }
    sim.bus.emit('warStarted', war);
    return war;
  }

  private callAllies(war: War): void {
    const sim = this.sim;
    const a = war.attackerLeader;
    const d = war.defenderLeader;
    const willing = (m: number, friend: number, foe: number, base: number) => {
      const c = sim.country(m);
      if (!c.alive || sim.index.atWar(m, friend) || sim.diplomacy.hasTreaty(m, foe, 'alliance')) return false;
      if (this.sideOf(war, m) >= 0) return false;
      const p = PERSONALITIES[c.personality];
      const chance = base + sim.diplomacy.relation(m, friend) / 250 - sim.diplomacy.relation(m, foe) / 400 + p.allianceSeek * 0.15 - c.warExhaustion / 200;
      return sim.rng.chance(clamp(chance, 0.05, 0.95));
    };
    for (const ally of sim.diplomacy.partners(d, 'alliance')) if (willing(ally, d, a, 0.55)) this.joinWar(war, ally, 1);
    for (const g of sim.diplomacy.guarantorsOf(d)) if (willing(g, d, a, 0.7)) this.joinWar(war, g, 1);
    for (const m of sim.diplomacy.coalitionPartnersAgainst(d, a)) if (willing(m, d, a, 0.6)) this.joinWar(war, m, 1);
    for (const c of sim.state.countries) {
      if (!c.alive) continue;
      if (c.overlord === d) this.joinWar(war, c.id, 1);
      if (c.overlord === a) this.joinWar(war, c.id, 0);
    }
    const overD = sim.country(d).overlord;
    if (overD >= 0 && overD !== a) this.joinWar(war, overD, 1);
    for (const ally of sim.diplomacy.partners(a, 'alliance')) if (willing(ally, a, d, 0.25)) this.joinWar(war, ally, 0);
  }

  joinWar(war: War, c: number, side: 0 | 1): void {
    const sim = this.sim;
    if (!war.active || this.sideOf(war, c) >= 0 || !sim.country(c).alive) return;
    const enemies = side === 0 ? war.defenders : war.attackers;
    (side === 0 ? war.attackers : war.defenders).push(c);
    const leader = side === 0 ? war.attackerLeader : war.defenderLeader;
    for (const e of enemies) {
      sim.diplomacy.breakTreatiesBetween(c, e);
      sim.diplomacy.addRelation(c, e, -30);
    }
    sim.index.rebuildWars();
    const text = `${sim.country(c).name} entrou na ${war.name} ao lado ${sim.countries.de(leader)}.`;
    war.log.push({ day: sim.day, text });
    sim.history.add('war_joined', text, { countries: [c, leader], war: war.id, importance: 1 });
  }

  monthly(): void {
    for (const war of [...this.sim.index.activeWars]) {
      if (!war.active) continue;
      this.updateScore(war);
      if (isRebelGoal(war.goal.type)) this.sim.rebellion.checkWar(war);
      else this.checkPeace(war);
    }
  }

  private sideValues(members: number[], enemies: Set<number>): { total: number; occupied: number; count: number } {
    const sim = this.sim;
    let total = 0;
    let occupied = 0;
    let count = 0;
    for (const c of members) {
      for (const p of sim.index.ownedBy[c] ?? []) {
        const v = sim.provinces.value(p);
        total += v;
        if (enemies.has(sim.state.provinces[p].controller)) {
          occupied += v;
          count++;
        }
      }
    }
    return { total, occupied, count };
  }

  updateScore(war: War): void {
    const sim = this.sim;
    const att = new Set(war.attackers);
    const def = new Set(war.defenders);
    const attV = this.sideValues(war.attackers, def);
    const defV = this.sideValues(war.defenders, att);
    const occScore = (defV.occupied / Math.max(1, defV.total) - attV.occupied / Math.max(1, attV.total)) * 100 * 0.65;
    const [ca, cd] = war.casualties;
    const batScore = ca + cd >= 1000 ? ((cd - ca) / (ca + cd)) * 30 : 0;
    let goalScore = 0;
    if (war.goal.provinces.length) {
      const held = war.goal.provinces.filter((p) => att.has(sim.state.provinces[p].controller)).length / war.goal.provinces.length;
      goalScore = held * 20;
      war.goalHeldMonths = held >= 0.99 ? war.goalHeldMonths + 1 : 0;
      goalScore += Math.min(10, war.goalHeldMonths);
    }
    war.warscore = clamp(occScore + batScore + goalScore, -100, 100);
    war.occupied = [defV.count, attV.count];
    const months = (sim.day - war.start) / 30;
    const sides: [number[], { total: number; occupied: number }][] = [[war.attackers, attV], [war.defenders, defV]];
    sides.forEach(([members, vals], s) => {
      const pop = members.reduce((acc, c) => acc + sim.country(c).population, 0);
      const exh = months * 0.7 + (war.casualties[s] / Math.max(1, pop * 0.015)) * 35 + (vals.occupied / Math.max(1, vals.total)) * 45;
      war.exhaustion[s] = clamp(exh, 0, 100);
      for (const c of members) {
        const country = sim.country(c);
        const leader = c === (s === 0 ? war.attackerLeader : war.defenderLeader);
        country.warExhaustion = Math.max(country.warExhaustion * 0.98, war.exhaustion[s] * (leader ? 1 : 0.7));
      }
    });
    war.scoreHistory.push(Math.round(war.warscore));
    if (war.scoreHistory.length > 600) war.scoreHistory.shift();
  }

  controlledCount(c: number): number {
    const provs = this.sim.state.provinces;
    return (this.sim.index.ownedBy[c] ?? []).filter((p) => provs[p].controller === c).length;
  }

  checkPeace(war: War): void {
    const sim = this.sim;
    const rng = sim.rng;
    const A = sim.country(war.attackerLeader);
    const D = sim.country(war.defenderLeader);
    if (this.controlledCount(D.id) === 0) {
      this.enforcePeace(war, 'attackers', 100);
      return;
    }
    if (this.controlledCount(A.id) === 0) {
      this.enforcePeace(war, 'defenders', 100);
      return;
    }
    const months = (sim.day - war.start) / 30;
    for (const side of [0, 1] as const) {
      const members = side === 0 ? war.attackers : war.defenders;
      const leader = side === 0 ? war.attackerLeader : war.defenderLeader;
      for (const m of [...members]) {
        if (m === leader) continue;
        const c = sim.country(m);
        if (this.controlledCount(m) === 0 || (c.warExhaustion > 70 && rng.chance(0.1))) this.leaveWar(war, m);
      }
    }
    if (months < 6) return;
    const ws = war.warscore;
    const [ea, ed] = war.exhaustion;
    const pa = PERSONALITIES[A.personality].peaceWillingness;
    const pd = PERSONALITIES[D.personality].peaceWillingness;
    if (ws >= 20) {
      const accept = (ws - 15) / 70 + ed / 160 + pd * 0.15 + (months > 24 ? 0.1 : 0) - 0.12;
      if ((A.ai || D.ai) && rng.chance(clamp(accept, 0, 0.9) * 0.25)) this.enforcePeace(war, 'attackers', ws);
    } else if (ws <= -20) {
      const accept = (-ws - 15) / 70 + ea / 160 + pa * 0.15 + (months > 24 ? 0.1 : 0) - 0.12;
      if ((A.ai || D.ai) && rng.chance(clamp(accept, 0, 0.9) * 0.25)) this.enforcePeace(war, 'defenders', -ws);
    } else if (months >= 18) {
      const chance = ((ea + ed) / 200) * 0.15 * ((pa + pd) / 2) + (months > 60 ? 0.05 : 0);
      if (rng.chance(chance)) this.whitePeace(war);
    }
  }

  private provinceCost(pid: number): number {
    const ps = this.sim.state.provinces[pid];
    return 10 + ps.development * 1.2 + (this.sim.provinces.isCapital(pid) ? 20 : 0);
  }

  enforcePeace(war: War, winnerSide: 'attackers' | 'defenders', score: number): void {
    const sim = this.sim;
    if (!war.active) return;
    const winners = new Set(winnerSide === 'attackers' ? war.attackers : war.defenders);
    const losers = winnerSide === 'attackers' ? war.defenders : war.attackers;
    const winLeader = winnerSide === 'attackers' ? war.attackerLeader : war.defenderLeader;
    const loseLeader = winnerSide === 'attackers' ? war.defenderLeader : war.attackerLeader;
    const W = sim.country(winLeader);
    const L = sim.country(loseLeader);
    const result: WarResult = { winner: winnerSide, ceded: [], annexed: [], vassals: [], reparations: 0, treaty: -1, summary: '' };
    const provs = sim.state.provinces;
    const loserOwned = [...(sim.index.ownedBy[loseLeader] ?? [])];
    const occupiedByWinners = loserOwned.filter((p) => winners.has(provs[p].controller));
    const allOccupied = loserOwned.length > 0 && occupiedByWinners.length === loserOwned.length;
    const goal = war.goal.type;
    const recipientOf = (p: number) => {
      const ctrl = provs[p].controller;
      return winners.has(ctrl) && sim.country(ctrl).kind === 'nation' ? ctrl : winLeader;
    };
    const parts: string[] = [];

    const annex =
      winnerSide === 'attackers' &&
      L.kind === 'nation' &&
      allOccupied &&
      (loserOwned.length <= 2 || (goal === 'annex' && score >= 90 && loserOwned.length <= 6));
    if (annex) {
      W.aggressiveExpansion = Math.min(100, W.aggressiveExpansion + 12);
      for (const p of loserOwned) result.ceded.push({ province: p, from: loseLeader, to: recipientOf(p) });
      // As provincias do lider vencedor sao transferidas por ultimo: o fim do pais e creditado a ele.
      result.ceded.sort((a, b) => (a.to === winLeader ? 1 : 0) - (b.to === winLeader ? 1 : 0));
      result.annexed.push(loseLeader);
      const partners = [...new Set(result.ceded.map((c) => c.to))].filter((id) => id !== winLeader);
      if (partners.length) {
        const names = [W.name, ...partners.map((id) => sim.country(id).name)];
        parts.push(`${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} partilharam o território ${sim.countries.de(loseLeader)}.`);
      } else {
        parts.push(`${W.name} anexou ${L.name}.`);
      }
    } else if (goal === 'subjugate' && winnerSide === 'attackers' && score >= 60 && L.overlord < 0) {
      result.vassals.push(loseLeader);
      parts.push(`${L.name} tornou-se vassalo ${sim.countries.de(winLeader)}.`);
    } else {
      let budget = score;
      const maxTake = Math.max(1, Math.floor(loserOwned.length * 0.35));
      const goalSet = new Set(war.goal.provinces);
      const candidates: number[] = [];
      for (const l of losers) for (const p of sim.index.ownedBy[l] ?? []) if (winners.has(provs[p].controller)) candidates.push(p);
      const adjacency = (p: number) => {
        const to = recipientOf(p);
        const m = sim.map;
        for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) if (provs[m.edgeTo[e]].owner === to) return 1;
        return 0;
      };
      candidates.sort((x, y) => (goalSet.has(y) ? 1 : 0) - (goalSet.has(x) ? 1 : 0) || adjacency(y) - adjacency(x) || sim.provinces.value(y) - sim.provinces.value(x));
      const takenBy = new Map<number, number>();
      for (const p of candidates) {
        const cost = this.provinceCost(p);
        const owner = provs[p].owner;
        const ownerCap = Math.max(1, Math.floor((sim.index.ownedBy[owner]?.length ?? 1) * 0.35));
        if (cost > budget || (takenBy.get(owner) ?? 0) >= (owner === loseLeader ? maxTake : ownerCap)) continue;
        budget -= cost;
        takenBy.set(owner, (takenBy.get(owner) ?? 0) + 1);
        result.ceded.push({ province: p, from: owner, to: recipientOf(p) });
      }
      if (budget >= 10 && L.treasury > 0) {
        const amount = Math.min(L.treasury * 0.5, Math.max(0, L.income) * 6) * Math.min(1, budget / 60);
        if (amount > 0) {
          L.treasury -= amount;
          W.treasury += amount;
          result.reparations = amount;
        }
      }
      if (result.ceded.length) {
        const list = sim.provinces.nameList(result.ceded.map((c) => c.province), 4);
        parts.push(`${W.name} incorporou ${result.ceded.length === 1 ? 'o estado' : 'os estados'}: ${list}.`);
      }
      if (result.reparations > 0) parts.push(`${L.name} pagará ${fmtMoney(result.reparations)} em reparações.`);
      if (!parts.length) parts.push('Nenhuma mudança territorial.');
    }

    for (const c of result.ceded) {
      sim.provinces.transfer(c.province, c.to, 'peace');
      sim.country(c.to).aggressiveExpansion = Math.min(100, sim.country(c.to).aggressiveExpansion + 4);
    }
    for (const v of result.vassals) {
      sim.country(v).overlord = winLeader;
      sim.diplomacy.createTreaty('vassal', [winLeader, v], { name: `Vassalagem ${sim.countries.de(v)}` });
    }
    for (const w of winners) {
      const c = sim.country(w);
      c.warsWon++;
      c.prestige = Math.min(100, c.prestige + (w === winLeader ? 15 : 6));
    }
    for (const l of losers) {
      const c = sim.country(l);
      if (!c.alive) continue;
      c.warsLost++;
      c.prestige = Math.max(0, c.prestige - 12);
      c.stability = Math.max(0, c.stability - 8);
    }
    result.summary = parts.join(' ');
    this.endWar(war, result);
  }

  whitePeace(war: War): void {
    this.endWar(war, { winner: 'white', ceded: [], annexed: [], vassals: [], reparations: 0, treaty: -1, summary: 'Paz branca: as fronteiras anteriores foram restauradas.' });
  }

  leaveWar(war: War, c: number): void {
    const sim = this.sim;
    const side = this.sideOf(war, c);
    if (side < 0) return;
    const list = side === 0 ? war.attackers : war.defenders;
    list.splice(list.indexOf(c), 1);
    const enemies = side === 0 ? war.defenders : war.attackers;
    const provs = sim.state.provinces;
    for (const p of [...(sim.index.ownedBy[c] ?? [])]) if (enemies.includes(provs[p].controller)) sim.provinces.setController(p, c);
    for (const e of enemies) {
      for (const p of [...(sim.index.ownedBy[e] ?? [])]) if (provs[p].controller === c) sim.provinces.setController(p, e);
      if (sim.country(e).kind === 'nation') sim.diplomacy.createTreaty('truce', [c, e], { years: 5, silent: true });
    }
    sim.index.rebuildWars();
    for (const a of sim.military.armiesOf(c)) if (a.battle < 0) sim.military.sendHome(a);
    const text = `${sim.country(c).name} assinou uma paz em separado e deixou a ${war.name}.`;
    war.log.push({ day: sim.day, text });
    sim.history.add('peace', text, { countries: [c], war: war.id, importance: 1 });
  }

  private treatyName(war: War, result: WarResult): string {
    const sim = this.sim;
    const loser = result.winner === 'defenders' ? war.attackerLeader : war.defenderLeader;
    const winner = result.winner === 'defenders' ? war.defenderLeader : war.attackerLeader;
    const L = sim.country(loser);
    let place = L.capital >= 0 ? sim.provinces.cityName(L.capital) : '';
    if (result.ceded.length) place = sim.provinces.cityName(result.ceded[0].province);
    if (!place) place = sim.provinces.cityName(Math.max(0, sim.country(winner).capital));
    const white = result.winner === 'white';
    const base = white ? `Paz de ${place}` : `Tratado de ${place}`;
    const names = sim.state.treaties.filter((t) => t.type === 'peace').map((t) => t.name);
    return withOrdinal(base, countNamed(names, base) + 1, white);
  }

  endWar(war: War, result: WarResult, opts: { text?: string; type?: HistoryType; importance?: 1 | 2 | 3 } = {}): void {
    const sim = this.sim;
    if (!war.active) return;
    const rebelCrushed = isRebelGoal(war.goal.type) && result.winner !== 'attackers';
    war.active = false;
    war.end = sim.day;
    war.result = result;
    const att = new Set(war.attackers);
    const def = new Set(war.defenders);
    const provs = sim.state.provinces;
    for (const side of [att, def]) {
      const other = side === att ? def : att;
      for (const c of side) {
        for (const p of [...(sim.index.ownedBy[c] ?? [])]) {
          if (provs[p].controller !== provs[p].owner && other.has(provs[p].controller)) sim.provinces.setController(p, provs[p].owner);
          provs[p].siege = null;
        }
      }
    }
    const name = this.treatyName(war, result);
    const members = [...att, ...def].filter((c) => sim.country(c).alive);
    if (!isRebelGoal(war.goal.type)) {
      const treaty = sim.diplomacy.createTreaty('peace', members, { name, war: war.id, silent: true });
      result.treaty = treaty.id;
      for (const a of att) {
        for (const d of def) {
          if (!sim.country(a).alive || !sim.country(d).alive) continue;
          const years = Math.min(10, 4 + sim.diplomacy.priorWars(a, d));
          sim.diplomacy.createTreaty('truce', [a, d], { name: `Trégua de ${name}`, years, silent: true });
        }
      }
    }
    for (const c of members) {
      const country = sim.country(c);
      country.pastWars.push(war.id);
      if (country.pastWars.length > 60) country.pastWars.shift();
    }
    for (const key of [...this.fallenCapitals]) if (key.startsWith(`${war.id}:`)) this.fallenCapitals.delete(key);
    sim.index.rebuildWars();
    sim.battles.endBattlesBetween(att, def);
    for (const a of [...sim.state.armies]) {
      if (!att.has(a.owner) && !def.has(a.owner)) continue;
      a.player = false;
      if (a.battle >= 0) continue;
      sim.military.sendHome(a);
    }
    const text = opts.text ?? `${name}: fim da ${war.name}. ${result.summary}`;
    war.log.push({ day: sim.day, text });
    const big = members.reduce((acc, c) => acc + sim.country(c).provinceCount, 0) >= 25;
    const importance = opts.importance ?? (big || result.annexed.length ? 3 : rebelCrushed ? 1 : 2);
    sim.history.add(opts.type ?? 'peace', text, { countries: members, war: war.id, importance });
    sim.bus.emit('warEnded', war);
  }

  onCapitalOccupied(pid: number, occupier: number, owner: number): void {
    const sim = this.sim;
    const c = sim.country(owner);
    if (!c.alive) return;
    const war = this.warBetween(occupier, owner);
    const key = `${war?.id ?? -1}:${owner}`;
    const city = sim.provinces.cityName(pid);
    const text = `Queda de ${city}: ${sim.countries.subject(occupier)} ${sim.countries.verb(occupier, 'tomou', 'tomaram')} a capital ${sim.countries.de(owner)}!`;
    if (war) war.log.push({ day: sim.day, text });
    if (this.fallenCapitals.has(key)) {
      sim.history.add('capital_fall', text, { countries: [occupier, owner], province: pid, war: war?.id ?? -1, importance: 1 });
      return;
    }
    this.fallenCapitals.add(key);
    const gov = GOVERNMENTS[c.government];
    c.stability = Math.max(0, c.stability - (6 + 16 * gov.centralization));
    c.prestige = Math.max(0, c.prestige - 10);
    c.warExhaustion = Math.min(100, c.warExhaustion + 10);
    for (const a of sim.military.armiesOf(owner)) a.morale = Math.max(0, a.morale - 0.12);
    const major = pid === c.originalCapital && c.provinceCount >= 3;
    sim.history.add('capital_fall', text, { countries: [occupier, owner], province: pid, war: war?.id ?? -1, importance: major ? 3 : 2 });
    if (major && c.stability < 20 && sim.rng.chance(0.1)) sim.rebellion.startCivilWar(c, `a queda de ${city}`);
  }

  onCountryDestroyed(id: number, by: number): void {
    const sim = this.sim;
    for (const war of [...sim.index.activeWars]) {
      const side = this.sideOf(war, id);
      if (side < 0) continue;
      const list = side === 0 ? war.attackers : war.defenders;
      list.splice(list.indexOf(id), 1);
      const leaderLost = (side === 0 ? war.attackerLeader : war.defenderLeader) === id;
      if (leaderLost) {
        const remaining = list.filter((c) => sim.country(c).alive);
        if (remaining.length) {
          const next = remaining.sort((a, b) => sim.country(b).provinceCount - sim.country(a).provinceCount)[0];
          if (side === 0) war.attackerLeader = next;
          else war.defenderLeader = next;
        } else {
          const winner = side === 0 ? 'defenders' : 'attackers';
          this.endWar(war, { winner, ceded: [], annexed: [id], vassals: [], reparations: 0, treaty: -1, summary: `${sim.country(id).name} deixou de existir.` });
          continue;
        }
      }
      sim.index.rebuildWars();
    }
  }
}
