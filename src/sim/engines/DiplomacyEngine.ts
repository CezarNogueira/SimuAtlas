// DIPLOMACY ENGINE: relacoes bilaterais (-100 inimigo mortal .. 100 aliado), tratados
// (aliancas, pactos, comercio, garantias, sancoes, acesso, vassalagem, coalizoes, tregua, paz)
// e acoes diplomaticas usadas pela IA e pelo jogador.
import { fmtMoney } from '../../core/format';
import { clamp } from '../../core/math';
import { CULTURES } from '../../data/cultures';
import { GOVERNMENTS } from '../../data/governments';
import { PERSONALITIES } from '../../data/personalities';
import { RELIGIONS } from '../../data/religions';
import type { Treaty, TreatyType } from '../../state/types';
import type { Simulation } from '../Simulation';
import { pairKey } from '../WorldIndex';

export const TREATY_NAMES: Record<TreatyType, string> = {
  alliance: 'Aliança',
  nap: 'Pacto de não agressão',
  truce: 'Trégua',
  trade: 'Acordo comercial',
  guarantee: 'Garantia de independência',
  access: 'Acesso militar',
  sanction: 'Sanções',
  vassal: 'Vassalagem',
  coalition: 'Coalizão',
  peace: 'Tratado de paz',
};

const DEFAULT_YEARS: Partial<Record<TreatyType, number>> = { nap: 10, trade: 20, sanction: 6, access: 10, truce: 5 };

export function relationLabel(v: number): string {
  if (v <= -75) return 'Inimigo mortal';
  if (v <= -40) return 'Hostil';
  if (v <= -10) return 'Tenso';
  if (v < 10) return 'Neutro';
  if (v < 40) return 'Cordial';
  if (v < 75) return 'Amigável';
  return 'Aliado próximo';
}

export interface TreatyOptions {
  name?: string;
  years?: number;
  war?: number;
  target?: number;
  silent?: boolean;
}

export class DiplomacyEngine {
  private relations: Map<number, number>;
  treatyVersion = 0;
  private accessCache = new Map<number, { key: number; set: Set<number> }>();

  constructor(private sim: Simulation) {
    this.relations = new Map(sim.state.relations);
  }

  serializeRelations(): [number, number][] {
    return [...this.relations.entries()].map(([k, v]) => [k, Math.round(v * 10) / 10]);
  }

  relation(a: number, b: number): number {
    if (a === b) return 100;
    return this.relations.get(pairKey(a, b)) ?? this.baseRelation(a, b);
  }

  setRelation(a: number, b: number, v: number): void {
    if (a === b) return;
    this.relations.set(pairKey(a, b), clamp(v, -100, 100));
  }

  addRelation(a: number, b: number, delta: number): void {
    this.setRelation(a, b, this.relation(a, b) + delta);
  }

  baseRelation(a: number, b: number): number {
    const s = this.sim.state;
    const A = s.countries[a];
    const B = s.countries[b];
    if (!A || !B) return 0;
    let r = 0;
    if (A.religion === B.religion) r += 12;
    else if (RELIGIONS[A.religion].group === RELIGIONS[B.religion].group) r += 3;
    else r -= 8;
    if (A.culture === B.culture) r += 14;
    else if (CULTURES[A.culture].group === CULTURES[B.culture].group) r += 6;
    if (A.government === B.government) r += 5;
    const autocratic = (g: string) => g === 'dictatorship' || g === 'theocracy';
    if ((A.government === 'democracy' && autocratic(B.government)) || (B.government === 'democracy' && autocratic(A.government))) r -= 10;
    r += (GOVERNMENTS[A.government].diplomacy + GOVERNMENTS[B.government].diplomacy) / 2;
    const pa = PERSONALITIES[A.personality];
    const pb = PERSONALITIES[B.personality];
    r += (pa.allianceSeek + pb.allianceSeek - 1) * 8 - (pa.isolation + pb.isolation) * 5;
    r -= (A.aggressiveExpansion + B.aggressiveExpansion) * 0.35;
    if (A.kind === 'rebel' || B.kind === 'rebel') r -= 30;
    if (this.hasTreaty(a, b, 'alliance')) r += 20;
    if (this.hasTreaty(a, b, 'trade')) r += 10;
    if (this.hasTreaty(a, b, 'nap')) r += 5;
    if (A.overlord === b || B.overlord === a) r += 10;
    if (this.sim.index.atWar(a, b)) r -= 50;
    return clamp(r, -100, 100);
  }

  private bump(): void {
    this.treatyVersion++;
    this.sim.index.rebuildTreaties();
    this.accessCache.clear();
  }

  hasTreaty(a: number, b: number, type: TreatyType): boolean {
    for (const t of this.sim.index.treatiesOf.get(a) ?? []) if (t.type === type && t.members.includes(b)) return true;
    return false;
  }

  treatiesBetween(a: number, b: number): Treaty[] {
    return (this.sim.index.treatiesOf.get(a) ?? []).filter((t) => t.members.includes(b));
  }

  treatiesOf(c: number): Treaty[] {
    return this.sim.index.treatiesOf.get(c) ?? [];
  }

  partners(c: number, type: TreatyType): number[] {
    const out: number[] = [];
    for (const t of this.sim.index.treatiesOf.get(c) ?? []) {
      if (t.type !== type) continue;
      for (const m of t.members) if (m !== c && !out.includes(m)) out.push(m);
    }
    return out;
  }

  guarantorsOf(c: number): number[] {
    return this.sim.state.treaties.filter((t) => t.active && t.type === 'guarantee' && t.target === c).map((t) => t.members[0]);
  }

  coalitionPartnersAgainst(member: number, target: number): number[] {
    const out: number[] = [];
    for (const t of this.sim.index.treatiesOf.get(member) ?? []) {
      if (t.type !== 'coalition' || t.target !== target) continue;
      for (const m of t.members) if (m !== member && !out.includes(m)) out.push(m);
    }
    return out;
  }

  priorWars(a: number, b: number): number {
    return this.sim.state.wars.filter(
      (w) => !w.active && ((w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a))),
    ).length;
  }

  // Paises em cujo territorio o exercito de "c" pode transitar.
  accessSet(c: number): Set<number> {
    const key = this.treatyVersion * 1_000_000 + this.sim.index.warVersion;
    const cached = this.accessCache.get(c);
    if (cached && cached.key === key) return cached.set;
    const set = new Set<number>([c]);
    for (const t of this.sim.index.treatiesOf.get(c) ?? []) {
      if (t.type === 'alliance' || t.type === 'vassal' || t.type === 'access' || t.type === 'coalition') for (const m of t.members) set.add(m);
    }
    for (const w of this.sim.wars.warsOf(c)) for (const m of this.sim.wars.sideOf(w, c) === 0 ? w.attackers : w.defenders) set.add(m);
    this.accessCache.set(c, { key, set });
    return set;
  }

  private defaultName(type: TreatyType, members: number[], target: number): string {
    const n = (id: number) => this.sim.country(id).name;
    const [a, b] = members;
    switch (type) {
      case 'alliance': return `Aliança ${n(a)}–${n(b)}`;
      case 'nap': return `Pacto de Não Agressão ${n(a)}–${n(b)}`;
      case 'trade': return `Acordo Comercial ${n(a)}–${n(b)}`;
      case 'guarantee': return `Garantia ${this.sim.countries.de(target >= 0 ? target : b)}`;
      case 'sanction': return `Sanções contra ${n(target >= 0 ? target : b)}`;
      case 'coalition': return `Coalizão contra ${n(target)}`;
      case 'access': return `Acesso Militar ${n(a)}–${n(b)}`;
      case 'vassal': return `Vassalagem ${this.sim.countries.de(b)}`;
      case 'truce': return `Trégua ${n(a)}–${n(b)}`;
      default: return TREATY_NAMES[type];
    }
  }

  createTreaty(type: TreatyType, members: number[], opts: TreatyOptions = {}): Treaty {
    const sim = this.sim;
    const target = opts.target ?? -1;
    const years = opts.years ?? DEFAULT_YEARS[type];
    const t: Treaty = {
      id: sim.nextId('treaty'),
      type,
      name: opts.name ?? this.defaultName(type, members, target),
      members: [...members],
      target,
      start: sim.day,
      end: years ? sim.day + Math.round(years * 365) : -1,
      active: true,
      war: opts.war ?? -1,
    };
    sim.state.treaties.push(t);
    this.bump();
    const [a, b] = members;
    const n = (id: number) => sim.country(id).name;
    let text = '';
    let importance: 1 | 2 | 3 = 1;
    switch (type) {
      case 'alliance':
        this.addRelation(a, b, 25);
        text = `${n(a)} e ${n(b)} formaram uma aliança.`;
        importance = 2;
        break;
      case 'nap':
        this.addRelation(a, b, 10);
        text = `${n(a)} e ${n(b)} assinaram um pacto de não agressão.`;
        break;
      case 'trade':
        this.addRelation(a, b, 10);
        text = `${n(a)} e ${n(b)} assinaram um acordo comercial.`;
        break;
      case 'guarantee':
        this.addRelation(a, target, 15);
        text = `${n(a)} garantiu a independência ${sim.countries.de(target)}.`;
        break;
      case 'sanction':
        this.addRelation(a, target, -25);
        text = `${n(a)} impôs sanções econômicas ${sim.countries.to(target)}.`;
        break;
      case 'access':
        this.addRelation(a, b, 5);
        text = `${n(a)} concedeu acesso militar ${sim.countries.to(b)}.`;
        break;
      case 'coalition':
        for (const m of members) this.addRelation(m, target, -15);
        text = `Formada a ${t.name}: ${members.map(n).join(', ')}.`;
        importance = 2;
        break;
      case 'vassal':
        text = `${n(b)} tornou-se vassalo ${sim.countries.de(a)}.`;
        importance = 2;
        break;
      default:
        break;
    }
    if (!opts.silent && text) sim.history.add(type === 'alliance' ? 'alliance' : 'treaty', text, { countries: target >= 0 ? [...members, target] : members, importance });
    return t;
  }

  endTreaty(t: Treaty, text?: string, importance: 1 | 2 | 3 = 1): void {
    if (!t.active) return;
    t.active = false;
    t.end = this.sim.day;
    if (t.type === 'vassal') {
      const v = this.sim.country(t.members[1]);
      if (v.overlord === t.members[0]) v.overlord = -1;
    }
    this.bump();
    if (text) this.sim.history.add(t.type === 'alliance' ? 'alliance_broken' : 'treaty', text, { countries: t.members, importance });
  }

  breakTreatiesBetween(a: number, b: number): void {
    for (const t of this.treatiesBetween(a, b)) {
      if (['alliance', 'nap', 'trade', 'access', 'truce', 'vassal', 'coalition'].includes(t.type)) this.endTreaty(t);
    }
    for (const t of this.sim.state.treaties) {
      if (t.active && t.type === 'guarantee' && ((t.members[0] === a && t.target === b) || (t.members[0] === b && t.target === a))) this.endTreaty(t);
    }
  }

  onCountryDestroyed(id: number): void {
    let changed = false;
    for (const t of this.sim.state.treaties) {
      if (!t.active) continue;
      if (t.members.includes(id) || t.target === id) {
        t.active = false;
        t.end = this.sim.day;
        changed = true;
      }
    }
    for (const c of this.sim.state.countries) if (c.overlord === id) c.overlord = -1;
    for (const k of [...this.relations.keys()]) if (Math.floor(k / 65536) === id || k % 65536 === id) this.relations.delete(k);
    if (changed) this.bump();
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const day = sim.day;
    for (const [k, v] of this.relations) {
      const a = Math.floor(k / 65536);
      const b = k % 65536;
      if (!s.countries[a]?.alive || !s.countries[b]?.alive) {
        this.relations.delete(k);
        continue;
      }
      const base = this.baseRelation(a, b);
      this.relations.set(k, v + (base - v) * 0.03);
    }
    let changed = false;
    for (const t of s.treaties) {
      if (!t.active || t.end < 0 || day < t.end) continue;
      t.active = false;
      changed = true;
    }
    if (changed) this.bump();
    for (const t of [...(s.treaties)]) {
      if (!t.active) continue;
      if (t.type === 'alliance') {
        const [a, b] = t.members;
        if (this.relation(a, b) < -25 && (sim.country(a).ai || sim.country(b).ai) && sim.rng.chance(0.2)) {
          this.endTreaty(t, `${sim.country(a).name} e ${sim.country(b).name} romperam sua aliança.`, 2);
        }
      } else if (t.type === 'coalition') {
        const target = sim.country(t.target);
        if (!target?.alive || target.aggressiveExpansion < 12 || day - t.start > 25 * 365) this.endTreaty(t, `A ${t.name} foi dissolvida.`);
      }
    }
  }

  yearly(): void {
    const s = this.sim.state;
    const day = this.sim.day;
    if (s.treaties.length < 2500) return;
    s.treaties = s.treaties.filter((t) => t.active || t.type === 'peace' || day - t.end < 60 * 365);
    this.bump();
  }

  // ---------- Avaliacao e acoes (IA e jogador) ----------

  sharedRival(a: number, b: number): number {
    const sim = this.sim;
    const pool = new Set([...sim.countries.neighbors(a), ...sim.countries.neighbors(b)]);
    for (const x of pool) {
      if (x === a || x === b) continue;
      if (this.relation(a, x) < -30 && this.relation(b, x) < -30) return x;
    }
    return -1;
  }

  acceptance(target: number, from: number, type: TreatyType): number {
    const sim = this.sim;
    const B = sim.country(target);
    if (!B.alive || !sim.country(from).alive) return 0;
    if (!B.ai) return 1;
    const pb = PERSONALITIES[B.personality];
    const rel = this.relation(from, target);
    if (sim.index.atWar(from, target)) return 0;
    switch (type) {
      case 'alliance': {
        const allies = this.partners(target, 'alliance').length;
        const stronger = sim.countries.strength(from) > sim.countries.strength(target) ? 0.1 : 0;
        return clamp((rel - 20) / 60 + pb.allianceSeek * 0.4 - pb.isolation * 0.6 + stronger + (this.sharedRival(from, target) >= 0 ? 0.25 : 0) - (allies >= 3 ? 0.35 : 0), 0, 1);
      }
      case 'nap':
        return clamp((rel + 20) / 80 + pb.peaceWillingness * 0.3 - pb.aggression * 0.3, 0, 1);
      case 'trade':
        return clamp((rel + 10) / 60 + pb.tradeSeek * 0.5 - pb.isolation * 0.5, 0, 1);
      case 'access':
        return clamp((rel - 10) / 50 + pb.allianceSeek * 0.2, 0, 1);
      default:
        return clamp((rel + 20) / 80, 0, 1);
    }
  }

  propose(from: number, target: number, type: 'alliance' | 'nap' | 'trade' | 'access', force = false): boolean {
    const sim = this.sim;
    if (from === target || this.hasTreaty(from, target, type) || sim.index.atWar(from, target)) return false;
    const ok = force || sim.rng.chance(this.acceptance(target, from, type));
    if (!ok) {
      this.addRelation(from, target, -3);
      return false;
    }
    this.createTreaty(type, type === 'access' ? [target, from] : [from, target]);
    return true;
  }

  breakAlliance(a: number, b: number): boolean {
    const t = this.treatiesBetween(a, b).find((x) => x.type === 'alliance');
    if (!t) return false;
    this.addRelation(a, b, -30);
    this.sim.country(a).prestige = Math.max(0, this.sim.country(a).prestige - 3);
    this.endTreaty(t, `${this.sim.country(a).name} rompeu a aliança com ${this.sim.country(b).name}.`, 2);
    return true;
  }

  guarantee(a: number, b: number): boolean {
    if (this.guarantorsOf(b).includes(a) || a === b) return false;
    this.createTreaty('guarantee', [a, b], { target: b });
    return true;
  }

  sanction(a: number, b: number): boolean {
    if (this.sim.state.treaties.some((t) => t.active && t.type === 'sanction' && t.members[0] === a && t.target === b)) return false;
    this.createTreaty('sanction', [a, b], { target: b });
    return true;
  }

  support(a: number, b: number): number {
    const sim = this.sim;
    const A = sim.country(a);
    const amount = Math.max(0, A.treasury * 0.08);
    if (amount <= 0) return 0;
    A.treasury -= amount;
    sim.country(b).treasury += amount;
    this.addRelation(a, b, 15);
    sim.history.add('diplomacy', `${A.name} enviou ${fmtMoney(amount)} em apoio ${sim.countries.to(b)}.`, { countries: [a, b], importance: 1 });
    return amount;
  }

  threaten(a: number, b: number): boolean {
    const sim = this.sim;
    const A = sim.country(a);
    const B = sim.country(b);
    this.addRelation(a, b, -20);
    const ratio = sim.countries.strength(a) / Math.max(1, sim.countries.strength(b));
    const pb = PERSONALITIES[B.personality];
    const yields = ratio > 2 && sim.rng.chance(0.3 + pb.peaceWillingness * 0.4);
    if (yields) {
      const tribute = B.treasury * 0.15;
      B.treasury -= tribute;
      A.treasury += tribute;
      A.prestige = Math.min(100, A.prestige + 4);
      B.prestige = Math.max(0, B.prestige - 4);
      sim.history.add('diplomacy', `Ameaçado ${sim.countries.de(a).replace(/^d[oa]s? /, 'por ').replace(/^de /, 'por ')}, ${B.name} cedeu e pagou ${fmtMoney(tribute)} em tributo.`, { countries: [a, b], importance: 1 });
    } else {
      B.prestige = Math.min(100, B.prestige + 2);
      sim.history.add('diplomacy', `${A.name} ameaçou ${B.name}, que rejeitou as exigências.`, { countries: [a, b], importance: 1 });
    }
    return yields;
  }

  recognize(a: number, b: number): void {
    const sim = this.sim;
    this.addRelation(a, b, 12);
    const B = sim.country(b);
    B.prestige = Math.min(100, B.prestige + 2);
    B.stability = Math.min(100, B.stability + 2);
    sim.history.add('diplomacy', `${sim.country(a).name} reconheceu a independência ${sim.countries.de(b)}.`, { countries: [a, b], importance: 1 });
  }

  formCoalition(founder: number, target: number): Treaty | null {
    const sim = this.sim;
    const existing = sim.state.treaties.find((t) => t.active && t.type === 'coalition' && t.target === target);
    if (existing) {
      if (!existing.members.includes(founder)) {
        existing.members.push(founder);
        this.bump();
        sim.history.add('treaty', `${sim.country(founder).name} aderiu à ${existing.name}.`, { countries: [founder, target], importance: 1 });
      }
      return existing;
    }
    const members = [founder];
    for (const n of sim.countries.neighbors(target)) {
      if (n === founder || sim.index.atWar(n, founder) || !sim.country(n).alive || sim.country(n).kind !== 'nation') continue;
      const p = PERSONALITIES[sim.country(n).personality];
      if (this.relation(n, target) < 0 && sim.rng.chance(0.3 + p.coalitionJoin * 0.5)) members.push(n);
    }
    if (members.length < 2) return null;
    return this.createTreaty('coalition', members, { target });
  }
}
