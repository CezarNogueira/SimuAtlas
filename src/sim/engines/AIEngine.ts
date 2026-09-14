// AI ENGINE (estrategica): cada nacao decide periodicamente sobre guerra, alvos, objetivos,
// diplomacia, coalizoes e investimentos, guiada por sua personalidade e situacao.
import type { GameDate } from '../../core/calendar';
import { clamp } from '../../core/math';
import { CULTURES } from '../../data/cultures';
import { GOVERNMENTS } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { PERSONALITIES, type PersonalityInfo } from '../../data/personalities';
import { RELIGIONS } from '../../data/religions';
import type { Country, WarGoal } from '../../state/types';
import type { Simulation } from '../Simulation';

export class AIEngine {
  constructor(private sim: Simulation) {}

  daily(_d: GameDate): void {
    const sim = this.sim;
    const day = sim.day;
    for (const c of sim.state.countries) {
      if (!c.alive || c.kind !== 'nation' || day < c.decisionDay) continue;
      c.decisionDay = day + 25 + sim.rng.int(0, 10);
      this.decide(c);
    }
  }

  private decide(c: Country): void {
    const sim = this.sim;
    sim.economy.invest(c);
    if (!c.ai) return;
    this.considerWar(c);
    this.considerDiplomacy(c);
    this.considerCoalition(c);
  }

  aggressionOf(c: Country): number {
    const pers = PERSONALITIES[c.personality];
    const traitBonus = c.ruler.traits.includes('Ambicioso') ? 0.1 : c.ruler.traits.includes('Cauteloso') ? -0.08 : 0;
    const raw = pers.aggression + GOVERNMENTS[c.government].aggression + IDEOLOGIES[c.ideology].aggression + (c.ruler.skills.mil - 5) * 0.02 + traitBonus;
    return clamp(raw, 0, 1.2) * this.sim.state.settings.aggression;
  }

  private defensivePower(t: number): number {
    const sim = this.sim;
    let power = sim.countries.strength(t);
    for (const ally of sim.diplomacy.partners(t, 'alliance')) power += sim.countries.strength(ally) * 0.5;
    for (const g of sim.diplomacy.guarantorsOf(t)) power += sim.countries.strength(g) * 0.5;
    const over = sim.country(t).overlord;
    if (over >= 0) power += sim.countries.strength(over) * 0.7;
    return power;
  }

  considerWar(c: Country): void {
    const sim = this.sim;
    const rng = sim.rng;
    const pers = PERSONALITIES[c.personality];
    const wars = sim.wars.warsOf(c.id);
    if (sim.day < 540) return;
    if (wars.length >= 2 || c.warExhaustion > 35 || c.stability < 25 || c.overlord >= 0 || c.provinceCount === 0) return;
    const aggression = this.aggressionOf(c);
    const lastWarEnd = c.pastWars.length ? sim.index.warById.get(c.pastWars[c.pastWars.length - 1])?.end ?? -1 : -1;
    const recentPeace = lastWarEnd >= 0 && sim.day - lastWarEnd < 4 * 365 ? 0.5 : 1;
    if (!rng.chance((0.06 + aggression * 0.25) * recentPeace)) return;
    const owned = sim.index.ownedBy[c.id];
    const nonCore = owned.filter((p) => !sim.state.provinces[p].cores.includes(c.id)).length / Math.max(1, owned.length);
    const myPower = sim.countries.strength(c.id) + sim.diplomacy.partners(c.id, 'alliance').reduce((acc, a) => acc + sim.countries.strength(a) * 0.3, 0);
    const landNeighbors = sim.countries.landNeighbors(c.id);
    let best: { target: number; score: number; ratio: number } | null = null;
    for (const t of sim.countries.neighbors(c.id)) {
      const T = sim.country(t);
      if (!T.alive || T.kind !== 'nation' || sim.wars.canDeclare(c.id, t)) continue;
      const byLand = landNeighbors.has(t);
      if (!byLand && c.navy < 1) continue;
      const ratio = myPower / Math.max(1, this.defensivePower(t));
      const distracted = sim.index.isAtWar(t);
      if (ratio < 1.15 && !(distracted && ratio > 0.8)) continue;
      const rel = sim.diplomacy.relation(c.id, t);
      let score = aggression * 40 + clamp((ratio - 1) * 25, -20, 60) - rel * 0.35;
      score -= c.aggressiveExpansion * 0.4 + nonCore * 25 + c.warExhaustion * 0.5;
      // Rivalidade entre potencias vizinhas de porte semelhante.
      if (rel < -20 && T.provinceCount > c.provinceCount * 0.5 && T.provinceCount < c.provinceCount * 2) score += 15;
      if (distracted) score += pers.opportunism * 25;
      if (T.stability < 30) score += pers.opportunism * 15;
      const claims = (sim.index.ownedBy[t] ?? []).filter((p) => sim.state.provinces[p].cores.includes(c.id)).length;
      score += Math.min(30, claims * 8);
      if (CULTURES[T.culture].group === CULTURES[c.culture].group && T.provinceCount < c.provinceCount) score += 10 * pers.annexation;
      if (c.government === 'theocracy' && RELIGIONS[T.religion].group !== RELIGIONS[c.religion].group) score += 12;
      if (T.aggressiveExpansion > 40) score += 10;
      if (!byLand) score -= 15;
      score -= (T.provinceCount / Math.max(1, c.provinceCount)) * 5;
      if (c.provinceCount > 40) score -= 10;
      if (sim.diplomacy.priorWars(c.id, t) > 0 && T.provincesConquered > 0) score += 5;
      if (!best || score > best.score) best = { target: t, score, ratio };
    }
    const threshold = 45 + (wars.length ? 25 : 0);
    if (!best || best.score < threshold) return;
    const goal = this.chooseGoal(c, best.target, best.ratio, pers);
    sim.wars.declareWar(c.id, best.target, goal);
  }

  chooseGoal(c: Country, t: number, ratio: number, pers: PersonalityInfo): WarGoal {
    const sim = this.sim;
    const rng = sim.rng;
    const T = sim.country(t);
    const provs = sim.state.provinces;
    const owned = sim.index.ownedBy[t] ?? [];
    const names = (list: number[]) => sim.provinces.nameList(list);
    const claims = owned.filter((p) => provs[p].cores.includes(c.id));
    if (claims.length) return { type: 'reconquest', provinces: claims.slice(0, 6), description: `Reconquista: ${names(claims)}` };
    if (T.provinceCount <= 3 && ratio > 3 && rng.chance(0.4 + pers.annexation * 0.5)) {
      return { type: 'annex', provinces: [...owned], description: `Anexação total ${sim.countries.de(t)}` };
    }
    if (pers.annexation > 0.6 && ratio > 2 && T.provinceCount <= 8 && rng.chance(0.5)) {
      return { type: 'subjugate', provinces: T.capital >= 0 ? [T.capital] : [], description: `Subjugação ${sim.countries.de(t)}` };
    }
    const m = sim.map;
    const border: number[] = [];
    for (const p of owned) {
      for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
        if (provs[m.edgeTo[e]].owner === c.id) {
          border.push(p);
          break;
        }
      }
    }
    const pool = border.length ? border : owned.slice(0, 3);
    pool.sort((x, y) => sim.provinces.value(y) - sim.provinces.value(x));
    const count = clamp(Math.ceil(ratio * 1.5), 1, 4);
    const targets = pool.slice(0, count);
    if (c.government === 'theocracy' && RELIGIONS[T.religion].group !== RELIGIONS[c.religion].group) {
      return { type: 'holy_war', provinces: targets, description: `Guerra santa: ${names(targets)}` };
    }
    if (CULTURES[T.culture].group === CULTURES[c.culture].group && rng.chance(0.3)) {
      return { type: 'unification', provinces: targets, description: `Unificação dos povos de cultura ${CULTURES[c.culture].group.toLowerCase()}` };
    }
    return { type: 'conquest', provinces: targets, description: `Conquista: ${names(targets)}` };
  }

  considerDiplomacy(c: Country): void {
    const sim = this.sim;
    const rng = sim.rng;
    const dip = sim.diplomacy;
    const pers = PERSONALITIES[c.personality];
    if (!rng.chance(0.35 * sim.state.settings.diplomacyFrequency)) return;
    const neighbors = [...sim.countries.neighbors(c.id)].filter((n) => sim.country(n).alive && sim.country(n).kind === 'nation');
    if (!neighbors.length) return;
    const myStrength = sim.countries.strength(c.id);
    const roll = rng.next();
    const allies = dip.partners(c.id, 'alliance');

    // Aliancas e rompimentos
    if (roll < 0.3) {
      for (const ally of allies) {
        if (dip.relation(c.id, ally) < -5 && rng.chance(0.25)) {
          dip.breakAlliance(c.id, ally);
          return;
        }
      }
      if (allies.length >= 3 || !rng.chance(pers.allianceSeek)) return;
      const pool = new Set<number>(neighbors);
      for (const n of neighbors) for (const nn of sim.countries.neighbors(n)) if (nn !== c.id) pool.add(nn);
      let best = -1;
      let bestScore = 0;
      for (const cand of pool) {
        const C = sim.country(cand);
        if (!C.alive || C.kind !== 'nation' || dip.hasTreaty(c.id, cand, 'alliance') || sim.index.atWar(c.id, cand)) continue;
        const rel = dip.relation(c.id, cand);
        if (rel < 25) continue;
        const score = rel + (dip.sharedRival(c.id, cand) >= 0 ? 30 : 0) + Math.min(20, (sim.countries.strength(cand) / Math.max(1, myStrength)) * 10);
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      if (best >= 0) dip.propose(c.id, best, 'alliance');
      return;
    }
    // Pacto de nao agressao com vizinho forte
    if (roll < 0.45) {
      if (pers.peaceWillingness < 0.4) return;
      const strong = neighbors.find((n) => sim.countries.strength(n) > myStrength * 1.2 && !dip.hasTreaty(c.id, n, 'nap') && dip.relation(c.id, n) > -20);
      if (strong !== undefined) dip.propose(c.id, strong, 'nap');
      return;
    }
    // Comercio
    if (roll < 0.62) {
      if (!rng.chance(pers.tradeSeek) || dip.partners(c.id, 'trade').length >= 5) return;
      const partner = neighbors.find((n) => !dip.hasTreaty(c.id, n, 'trade') && dip.relation(c.id, n) >= 5);
      if (partner !== undefined) dip.propose(c.id, partner, 'trade');
      return;
    }
    // Garantia a vizinho pequeno e amigo
    if (roll < 0.7) {
      if (pers.allianceSeek < 0.5 && pers.coalitionJoin < 0.6) return;
      const small = neighbors.find((n) => sim.country(n).provinceCount * 3 <= c.provinceCount && dip.relation(c.id, n) >= 40 && !dip.guarantorsOf(n).includes(c.id));
      if (small !== undefined) dip.guarantee(c.id, small);
      return;
    }
    // Sancoes contra inimigos
    if (roll < 0.77) {
      if (pers.tradeSeek < 0.4 && pers.allianceSeek < 0.6) return;
      const hated = neighbors.find((n) => dip.relation(c.id, n) < -50 && sim.country(n).gdp < c.gdp * 1.5);
      if (hated !== undefined) dip.sanction(c.id, hated);
      return;
    }
    // Apoio financeiro a aliado em guerra
    if (roll < 0.84) {
      const needy = allies.find((a) => sim.index.isAtWar(a));
      if (needy !== undefined && c.treasury > c.income * 6) dip.support(c.id, needy);
      return;
    }
    // Ameacas
    if (roll < 0.9) {
      if (pers.aggression < 0.5) return;
      const weak = neighbors.find((n) => sim.countries.strength(n) * 2 < myStrength && dip.relation(c.id, n) < 0 && !sim.index.atWar(c.id, n));
      if (weak !== undefined) dip.threaten(c.id, weak);
      return;
    }
    // Reconhecimento de novas nacoes
    if (roll < 0.95) {
      const fresh = sim.state.countries.find((n) => n.alive && n.kind === 'nation' && n.id !== c.id && sim.day - n.founded < 3 * 365 && sim.day - n.founded > 30 && dip.relation(c.id, n.id) > -10 && neighbors.includes(n.id));
      if (fresh) dip.recognize(c.id, fresh.id);
      return;
    }
    // Missao diplomatica para melhorar relacoes
    if (pers.allianceSeek > 0.5) {
      const tense = neighbors.find((n) => dip.relation(c.id, n) < 0 && !sim.index.atWar(c.id, n));
      if (tense !== undefined) dip.addRelation(c.id, tense, 5);
    }
  }

  considerCoalition(c: Country): void {
    const sim = this.sim;
    const rng = sim.rng;
    const pers = PERSONALITIES[c.personality];
    if (pers.coalitionJoin < 0.3 || !rng.chance(0.25)) return;
    for (const t of sim.countries.neighbors(c.id)) {
      const T = sim.country(t);
      if (!T.alive || T.kind !== 'nation' || T.aggressiveExpansion < 40 || sim.diplomacy.relation(c.id, t) >= 10) continue;
      if (sim.countries.strength(t) < sim.countries.strength(c.id)) continue;
      const coalition = sim.diplomacy.formCoalition(c.id, t);
      if (!coalition) return;
      const members = coalition.members.filter((m) => sim.country(m).alive);
      const power = members.reduce((acc, m) => acc + sim.countries.strength(m), 0);
      if (power > sim.countries.strength(t) * 1.3 && !members.some((m) => sim.index.atWar(m, t)) && rng.chance(0.2)) {
        const leader = members.sort((a, b) => sim.countries.strength(b) - sim.countries.strength(a))[0];
        const lost = sim.country(t).recentChanges.filter((ch) => ch.to === t && members.includes(ch.from)).map((ch) => ch.province);
        const war = sim.wars.declareWar(leader, t, { type: 'coalition', provinces: [...new Set(lost)].slice(0, 8), description: `Conter o expansionismo ${sim.countries.de(t)}` });
        if (war) for (const m of members) if (m !== leader) sim.wars.joinWar(war, m, 0);
      }
      return;
    }
  }
}
