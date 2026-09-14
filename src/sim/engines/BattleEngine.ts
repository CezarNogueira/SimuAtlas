// BATTLE ENGINE: batalhas com rodadas diarias. Considera numero de soldados, tipos de tropa,
// tecnologia, moral, experiencia, comandante, terreno, fortificacao, travessia de rio,
// suprimento e clima. Ao fim: perseguicao, baixas, recuo do perdedor e registro historico.
import { season } from '../../core/calendar';
import { fmtInt } from '../../core/format';
import { clamp } from '../../core/math';
import { terrainInfo, type TerrainInfo } from '../../data/terrain';
import { techEffects } from '../../data/techs';
import type { Army, Battle, BattleSide } from '../../state/types';
import { battleName } from '../names';
import type { Simulation } from '../Simulation';
import { soldiersOf } from './MilitaryEngine';

const MAX_BATTLES_KEPT = 900;

export class BattleEngine {
  ongoing: Battle[] = [];
  private nameCount = new Map<number, number>();

  constructor(private sim: Simulation) {
    for (const b of sim.state.battles) {
      if (b.end < 0) this.ongoing.push(b);
      this.nameCount.set(b.province, (this.nameCount.get(b.province) ?? 0) + 1);
    }
  }

  totals(side: BattleSide): number {
    return side.initial.infantry + side.initial.cavalry + side.initial.artillery;
  }

  private makeSide(armies: Army[]): BattleSide {
    const sim = this.sim;
    let best = '';
    let bestSkill = -1;
    for (const a of armies) {
      const g = sim.military.general(a);
      if (g && g.attack + g.defense > bestSkill) {
        bestSkill = g.attack + g.defense;
        best = g.name;
      }
    }
    return {
      countries: [...new Set(armies.map((a) => a.owner))],
      armies: armies.map((a) => a.id),
      initial: {
        infantry: armies.reduce((s, a) => s + a.infantry, 0),
        cavalry: armies.reduce((s, a) => s + a.cavalry, 0),
        artillery: armies.reduce((s, a) => s + a.artillery, 0),
      },
      losses: 0,
      morale: armies.reduce((s, a) => s + a.morale, 0) / Math.max(1, armies.length),
      general: best,
    };
  }

  engage(pid: number, arriving: Army, hostiles: Army[]): void {
    const sim = this.sim;
    const existing = this.ongoing.find((b) => b.province === pid);
    if (existing) {
      this.join(existing, arriving);
      for (const h of hostiles) this.join(existing, h);
      return;
    }
    const here = sim.index.armiesIn(pid);
    const defenders = here.filter((a) => a.battle < 0 && sim.index.atWar(a.owner, arriving.owner));
    if (!defenders.length) return;
    const attackers = here.filter(
      (a) => a.battle < 0 && !sim.index.atWar(a.owner, arriving.owner) && defenders.some((d) => sim.index.atWar(a.owner, d.owner)),
    );
    if (!attackers.includes(arriving)) attackers.push(arriving);
    const war = sim.wars.warBetween(arriving.owner, defenders[0].owner);
    const mp = sim.map.provinces[pid];
    const ps = sim.state.provinces[pid];
    const count = (this.nameCount.get(pid) ?? 0) + 1;
    this.nameCount.set(pid, count);
    const defenderHoldsFort = defenders.some((d) => d.owner === ps.controller || sim.wars.sameSide(d.owner, ps.controller));
    const battle: Battle = {
      id: sim.nextId('battle'),
      name: battleName(sim.provinces.cityName(pid), count),
      war: war?.id ?? -1,
      province: pid,
      x: mp.x,
      y: mp.y,
      start: sim.day,
      end: -1,
      attacker: this.makeSide(attackers),
      defender: this.makeSide(defenders),
      terrain: mp.terrain,
      river: mp.river > 0 && sim.rng.chance(0.5),
      fort: defenderHoldsFort ? ps.fort : 0,
      winner: null,
      days: 0,
      log: [],
    };
    for (const a of attackers) a.battle = battle.id;
    for (const a of defenders) a.battle = battle.id;
    sim.state.battles.push(battle);
    sim.index.battleById.set(battle.id, battle);
    this.ongoing.push(battle);
    if (war) war.battles.push(battle.id);
    const an = sim.country(attackers[0].owner).name;
    const dn = sim.country(defenders[0].owner).name;
    battle.log.push(`${an} (${fmtInt(this.totals(battle.attacker))} soldados) ataca ${dn} (${fmtInt(this.totals(battle.defender))} soldados) em terreno de ${terrainInfo(mp.terrain).name.toLowerCase()}.`);
    if (battle.river) battle.log.push('O atacante precisa atravessar um rio.');
    if (battle.fort > 0) battle.log.push(`Os defensores contam com fortificações de nível ${battle.fort}.`);
    sim.bus.emit('battleStarted', battle);
  }

  private join(b: Battle, army: Army): void {
    const sim = this.sim;
    if (army.battle >= 0) return;
    const attLeader = b.attacker.countries[0];
    const defLeader = b.defender.countries[0];
    let side: BattleSide | null = null;
    if (sim.index.atWar(army.owner, attLeader)) side = b.defender;
    else if (sim.index.atWar(army.owner, defLeader)) side = b.attacker;
    if (!side) return;
    side.armies.push(army.id);
    if (!side.countries.includes(army.owner)) side.countries.push(army.owner);
    side.initial.infantry += army.infantry;
    side.initial.cavalry += army.cavalry;
    side.initial.artillery += army.artillery;
    army.battle = b.id;
    b.log.push(`Dia ${b.days + 1}: reforços ${sim.countries.de(army.owner)} chegam (${fmtInt(soldiersOf(army))} soldados).`);
  }

  daily(): void {
    for (const b of [...this.ongoing]) this.round(b);
  }

  private sideArmies(side: BattleSide, battleId: number): Army[] {
    const out: Army[] = [];
    for (const id of side.armies) {
      const a = this.sim.index.armyById.get(id);
      if (a && a.battle === battleId) out.push(a);
    }
    return out;
  }

  private power(armies: Army[], t: TerrainInfo, mode: 'attack' | 'defense'): number {
    let p = 0;
    for (const a of armies) {
      const c = this.sim.country(a.owner);
      const fx = techEffects(c.tech);
      const g = this.sim.military.general(a);
      const skill = g ? (mode === 'attack' ? g.attack : g.defense) : 0;
      const armor = c.tech >= 20 ? 1.2 : 1;
      const base = a.infantry + a.cavalry * 1.5 * t.cavalry * armor + a.artillery * 1.3;
      p += base * (1 + fx.military) * (0.35 + 0.65 * a.morale) * (1 + a.experience * 0.4) * (1 + skill * 0.05) * (0.6 + 0.4 * a.supply);
    }
    return p;
  }

  private distribute(armies: Army[], damage: number): number {
    const total = armies.reduce((s, a) => s + soldiersOf(a), 0);
    if (total <= 0) return 0;
    let lost = 0;
    for (const a of armies) {
      const n = soldiersOf(a);
      const d = Math.min(n, damage * (n / total));
      const w = a.infantry + a.cavalry + a.artillery * 0.5;
      if (w <= 0) continue;
      const k = Math.min(1, d / w);
      const li = a.infantry * k;
      const lc = a.cavalry * k;
      const la = a.artillery * 0.5 * k;
      a.infantry -= li;
      a.cavalry -= lc;
      a.artillery -= la;
      lost += li + lc + la;
    }
    return lost;
  }

  private round(b: Battle): void {
    const sim = this.sim;
    const rng = sim.rng;
    const att = this.sideArmies(b.attacker, b.id);
    const def = this.sideArmies(b.defender, b.id);
    if (!att.length || !def.length) {
      this.finish(b, att.length ? 'attacker' : 'defender', att, def);
      return;
    }
    b.days++;
    const t = terrainInfo(b.terrain);
    const lat = sim.map.provinces[b.province].lat;
    const climate = season(sim.day, lat) === 0 && Math.abs(lat) > 40 ? 0.85 : 1;
    const A = this.power(att, t, 'attack') * climate;
    const D = this.power(def, t, 'defense') * climate;
    const defTech = Math.max(...def.map((a) => sim.country(a.owner).tech));
    const defense = t.defense * (1 + b.fort * 0.12) * (1 + techEffects(defTech).defense) * (b.river ? 1.2 : 1);
    const attTotal = att.reduce((s, a) => s + soldiersOf(a), 0);
    const defTotal = def.reduce((s, a) => s + soldiersOf(a), 0);
    const lostDef = this.distribute(def, (A * 0.013 * rng.float(0.7, 1.3)) / defense);
    const lostAtt = this.distribute(att, D * 0.013 * rng.float(0.7, 1.3));
    b.attacker.losses += lostAtt;
    b.defender.losses += lostDef;
    const hitDef = (lostDef / Math.max(1, defTotal)) * 3.4 + 0.03 * clamp(A / Math.max(1, D), 0.3, 3);
    const hitAtt = (lostAtt / Math.max(1, attTotal)) * 3.4 + 0.03 * clamp(D / Math.max(1, A), 0.3, 3);
    for (const a of def) a.morale = Math.max(0, a.morale - hitDef);
    for (const a of att) a.morale = Math.max(0, a.morale - hitAtt);
    b.attacker.morale = att.reduce((s, a) => s + a.morale, 0) / att.length;
    b.defender.morale = def.reduce((s, a) => s + a.morale, 0) / def.length;
    if (b.days === 1 || b.days % 5 === 0) {
      b.log.push(`Dia ${b.days}: baixas ${fmtInt(b.attacker.losses)} x ${fmtInt(b.defender.losses)}; moral ${Math.round(b.attacker.morale * 100)}% x ${Math.round(b.defender.morale * 100)}%.`);
    }
    const attBroken = b.attacker.morale <= 0.1 || attTotal - lostAtt < this.totals(b.attacker) * 0.3;
    const defBroken = b.defender.morale <= 0.1 || defTotal - lostDef < this.totals(b.defender) * 0.3;
    if (attBroken || defBroken || b.days >= 30) {
      let winner: 'attacker' | 'defender';
      if (attBroken && defBroken) winner = b.attacker.morale >= b.defender.morale ? 'attacker' : 'defender';
      else if (attBroken) winner = 'defender';
      else if (defBroken) winner = 'attacker';
      else winner = 'defender';
      this.finish(b, winner, att, def);
    }
  }

  private finish(b: Battle, winner: 'attacker' | 'defender', att: Army[], def: Army[]): void {
    const sim = this.sim;
    b.end = sim.day;
    b.winner = winner;
    const idx = this.ongoing.indexOf(b);
    if (idx >= 0) this.ongoing.splice(idx, 1);
    const winners = winner === 'attacker' ? att : def;
    const losers = winner === 'attacker' ? def : att;
    const winSide = winner === 'attacker' ? b.attacker : b.defender;
    const loseSide = winner === 'attacker' ? b.defender : b.attacker;
    const winSoldiers = winners.reduce((s, a) => s + soldiersOf(a), 0);
    const winCav = winners.reduce((s, a) => s + a.cavalry, 0);
    const pursuit = 0.04 + 0.12 * (winSoldiers > 0 ? winCav / winSoldiers : 0);
    for (const a of losers) {
      loseSide.losses += sim.military.applyLosses(a, soldiersOf(a) * pursuit);
      a.morale = Math.min(a.morale, 0.2);
      a.experience = Math.min(1, a.experience + 0.02);
      const g = sim.military.general(a);
      if (g) g.defeats++;
    }
    for (const a of winners) {
      a.experience = Math.min(1, a.experience + 0.04);
      a.morale = Math.max(0.1, a.morale - 0.05);
      a.battle = -1;
      if (!a.player) a.thinkDay = sim.day + 1;
      const g = sim.military.general(a);
      if (g) g.victories++;
    }
    const winCountry = winSide.countries[0];
    const loseCountry = loseSide.countries[0];
    const war = b.war >= 0 ? sim.index.warById.get(b.war) : undefined;
    if (war) {
      const ws = sim.wars.sideOf(war, winCountry);
      if (ws !== -1) {
        const other = ws === 0 ? 1 : 0;
        war.battlesWon[ws]++;
        war.casualties[ws] += winSide.losses;
        war.casualties[other] += loseSide.losses;
      }
    }
    const total = this.totals(b.attacker) + this.totals(b.defender);
    const prestige = clamp(total / 40000, 0.3, 4);
    for (const id of winSide.countries) {
      const c = sim.country(id);
      c.battlesWon++;
      c.prestige = Math.min(100, c.prestige + prestige);
    }
    for (const id of loseSide.countries) {
      const c = sim.country(id);
      c.battlesLost++;
      c.prestige = Math.max(0, c.prestige - prestige * 0.7);
    }
    for (const a of losers) {
      a.battle = -1;
      sim.military.retreat(a, b.province);
    }
    const loserName = sim.countries.isPlural(loseCountry) ? `os ${sim.country(loseCountry).name}` : sim.country(loseCountry).name;
    const text = `${b.name}: ${sim.countries.subject(winCountry)} ${sim.countries.verb(winCountry, 'derrotou', 'derrotaram')} ${loserName} (baixas ${fmtInt(winSide.losses)} x ${fmtInt(loseSide.losses)}).`;
    b.log.push(`Resultado: vitória ${winner === 'attacker' ? 'do atacante' : 'do defensor'} após ${b.days} dias.`);
    if (war) war.log.push({ day: sim.day, text });
    if (total >= 2000) {
      sim.history.add('battle', text, {
        countries: [winCountry, loseCountry],
        province: b.province,
        war: b.war,
        battle: b.id,
        importance: total >= 150000 ? 2 : 1,
      });
    }
    sim.bus.emit('battleEnded', b);
    this.trim();
  }

  // Encerra batalhas entre lados que fizeram paz.
  endBattlesBetween(sideA: Set<number>, sideB: Set<number>): void {
    const sim = this.sim;
    for (const b of [...this.ongoing]) {
      const involved = b.attacker.countries.some((c) => sideA.has(c) || sideB.has(c));
      if (!involved) continue;
      b.end = sim.day;
      b.winner = null;
      b.log.push('A batalha foi interrompida pela assinatura da paz.');
      this.ongoing.splice(this.ongoing.indexOf(b), 1);
      for (const id of [...b.attacker.armies, ...b.defender.armies]) {
        const a = sim.index.armyById.get(id);
        if (a && a.battle === b.id) a.battle = -1;
      }
      sim.bus.emit('battleEnded', b);
    }
  }

  private trim(): void {
    const s = this.sim.state;
    if (s.battles.length <= MAX_BATTLES_KEPT + 100) return;
    const cut = s.battles.length - MAX_BATTLES_KEPT;
    const removed = s.battles.slice(0, cut).filter((b) => b.end >= 0);
    const removedIds = new Set(removed.map((b) => b.id));
    s.battles = s.battles.filter((b) => !removedIds.has(b.id));
    for (const id of removedIds) this.sim.index.battleById.delete(id);
  }
}
