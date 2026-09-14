// Comandos do jogador (observador/controlador). A interface nunca altera o estado diretamente:
// toda intervencao passa por esta camada, que usa os motores da simulacao.
import { GOVERNMENTS, type GovernmentId } from '../data/governments';
import { articleFor } from '../data/language';
import { PERSONALITIES, type PersonalityId } from '../data/personalities';
import type { WarGoal } from '../state/types';
import { soldiersOf } from './engines/MilitaryEngine';
import { isRebelGoal } from './engines/WarEngine';
import type { Simulation } from './Simulation';

export type PlayerGoal = 'conquest' | 'annex' | 'subjugate';
export type TreatyAction = 'alliance' | 'nap' | 'trade' | 'access';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ok = (message: string): ActionResult => ({ ok: true, message });
const fail = (message: string): ActionResult => ({ ok: false, message });

export class PlayerActions {
  constructor(private readonly sim: Simulation) {}

  private note(text: string, countries: number[]): void {
    this.sim.history.add('event', `Intervenção do observador: ${text}`, { countries, importance: 1 });
  }

  declareWar(a: number, d: number, goalType: PlayerGoal): ActionResult {
    const sim = this.sim;
    if (a === d || !sim.country(d)?.alive) return fail('Escolha outra nação.');
    if (sim.index.atWar(a, d)) return fail('Essas nações já estão em guerra.');
    const D = sim.country(d);
    const owned = sim.index.ownedBy[d] ?? [];
    let goal: WarGoal;
    if (goalType === 'annex') {
      goal = { type: 'annex', provinces: [...owned], description: `Anexação total ${sim.countries.de(d)}` };
    } else if (goalType === 'subjugate') {
      goal = { type: 'subjugate', provinces: D.capital >= 0 ? [D.capital] : [], description: `Subjugação ${sim.countries.de(d)}` };
    } else {
      const m = sim.map;
      const provs = sim.state.provinces;
      const border = owned.filter((p) => {
        for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) if (provs[m.edgeTo[e]].owner === a) return true;
        return false;
      });
      const pool = (border.length ? border : owned).slice().sort((x, y) => sim.provinces.value(y) - sim.provinces.value(x)).slice(0, 4);
      goal = { type: 'conquest', provinces: pool, description: `Conquista: ${sim.provinces.nameList(pool, 4)}` };
    }
    const war = sim.wars.declareWar(a, d, goal, { forced: true });
    return war ? ok(`${war.name} começou.`) : fail('Não foi possível declarar guerra.');
  }

  endWar(warId: number, outcome: 'white' | 'attackers' | 'defenders'): ActionResult {
    const sim = this.sim;
    const war = sim.index.warById.get(warId);
    if (!war?.active) return fail('Esta guerra já terminou.');
    if (isRebelGoal(war.goal.type)) {
      sim.rebellion.forceOutcome(war, outcome === 'attackers');
      return ok('A rebelião teve seu desfecho decidido.');
    }
    if (outcome === 'white') sim.wars.whitePeace(war);
    else sim.wars.enforcePeace(war, outcome, 75);
    return ok('A paz foi assinada.');
  }

  joinWar(warId: number, c: number, side: 0 | 1): ActionResult {
    const sim = this.sim;
    const war = sim.index.warById.get(warId);
    if (!war?.active) return fail('Esta guerra já terminou.');
    if (sim.wars.sideOf(war, c) >= 0) return fail('Esta nação já participa da guerra.');
    sim.wars.joinWar(war, c, side);
    return ok(`${sim.country(c).name} entrou na guerra.`);
  }

  treaty(a: number, b: number, type: TreatyAction): ActionResult {
    const sim = this.sim;
    if (a === b) return fail('Escolha outra nação.');
    if (sim.index.atWar(a, b)) return fail('As nações estão em guerra.');
    return sim.diplomacy.propose(a, b, type, true) ? ok('Tratado assinado.') : fail('O tratado já existe ou não é possível.');
  }

  breakAlliance(a: number, b: number): ActionResult {
    return this.sim.diplomacy.breakAlliance(a, b) ? ok('Aliança rompida.') : fail('Não há aliança entre essas nações.');
  }

  guarantee(a: number, b: number): ActionResult {
    return this.sim.diplomacy.guarantee(a, b) ? ok('Independência garantida.') : fail('Garantia já existente.');
  }

  sanction(a: number, b: number): ActionResult {
    return this.sim.diplomacy.sanction(a, b) ? ok('Sanções impostas.') : fail('Sanções já estão em vigor.');
  }

  support(a: number, b: number): ActionResult {
    const amount = this.sim.diplomacy.support(a, b);
    return amount > 0 ? ok('Apoio financeiro enviado.') : fail('Tesouro vazio.');
  }

  threaten(a: number, b: number): ActionResult {
    return this.sim.diplomacy.threaten(a, b) ? ok('A nação ameaçada cedeu.') : ok('A ameaça foi rejeitada.');
  }

  recognize(a: number, b: number): ActionResult {
    this.sim.diplomacy.recognize(a, b);
    return ok('Independência reconhecida.');
  }

  coalition(a: number, target: number): ActionResult {
    return this.sim.diplomacy.formCoalition(a, target) ? ok('Coalizão formada.') : fail('Nenhum vizinho aceitou participar.');
  }

  incite(countryId: number, pid = -1): ActionResult {
    const sim = this.sim;
    const c = sim.country(countryId);
    let target = pid;
    if (target < 0) {
      let best = -1;
      for (const p of sim.index.ownedBy[countryId] ?? []) {
        const ps = sim.state.provinces[p];
        if (ps.controller === countryId && (best < 0 || ps.unrest > sim.state.provinces[best].unrest)) best = p;
      }
      target = best;
    }
    if (target < 0) return fail('Nenhum estado disponível.');
    sim.state.provinces[target].unrest = Math.max(sim.state.provinces[target].unrest, 70);
    return sim.rebellion.spawnRevolt(c, target, undefined, true) ? ok('Rebelião incitada.') : fail('O estado não pode se rebelar agora.');
  }

  civilWar(countryId: number): ActionResult {
    const c = this.sim.country(countryId);
    const before = this.sim.index.activeWars.length;
    this.sim.rebellion.startCivilWar(c, 'a intervenção de forças ocultas', true);
    return this.sim.index.activeWars.length > before ? ok('Guerra civil deflagrada.') : fail('O país é pequeno ou já está em guerra civil.');
  }

  changeGovernment(countryId: number, gov: GovernmentId): ActionResult {
    const sim = this.sim;
    const c = sim.country(countryId);
    if (c.government === gov) return fail('Este já é o governo atual.');
    const before = sim.countries.formalName(countryId);
    sim.government.changeGovernment(c, gov, '', 2, true);
    sim.history.add('government', `${before} torna-se ${sim.countries.formalName(countryId)} (${GOVERNMENTS[gov].name}).`, { countries: [countryId], importance: 2 });
    return ok('Governo alterado.');
  }

  setPersonality(countryId: number, p: PersonalityId): ActionResult {
    const c = this.sim.country(countryId);
    c.personality = p;
    c.militaryBudget = PERSONALITIES[p].militaryBudget;
    return ok(`Personalidade: ${PERSONALITIES[p].name}.`);
  }

  adjust(countryId: number, field: 'stability' | 'prestige' | 'happiness', delta: number): ActionResult {
    const c = this.sim.country(countryId);
    c[field] = Math.max(0, Math.min(100, c[field] + delta));
    return ok('Ajuste aplicado.');
  }

  corruption(countryId: number, delta: number): ActionResult {
    const c = this.sim.country(countryId);
    c.corruption = Math.max(0, Math.min(1, c.corruption + delta));
    return ok('Corrupção ajustada.');
  }

  grantArmy(countryId: number): ActionResult {
    const sim = this.sim;
    const c = sim.country(countryId);
    const home = c.capital >= 0 && sim.state.provinces[c.capital].controller === countryId ? c.capital : (sim.index.ownedBy[countryId] ?? []).find((p) => sim.state.provinces[p].controller === countryId);
    if (home === undefined || home < 0) return fail('Não há estado controlado para reunir tropas.');
    const size = Math.max(5000, c.armySize * 0.25);
    const army = sim.military.raiseArmy(countryId, home, size);
    army.morale = 0.85;
    this.note(`${c.name} recebeu um novo exército de ${Math.round(size).toLocaleString('pt-BR')} soldados.`, [countryId]);
    return ok('Exército concedido.');
  }

  grantGold(countryId: number): ActionResult {
    const c = this.sim.country(countryId);
    c.treasury += Math.max(c.income * 12, c.gdp * 0.1);
    return ok('Ouro concedido.');
  }

  // Concede a tecnologia mais antiga ja descoberta no mundo que a nacao ainda nao domina (nunca antes da data historica).
  boostTech(countryId: number): ActionResult {
    const c = this.sim.country(countryId);
    const t = this.sim.technology.grantByObserver(c);
    return t ? ok(`${c.name} recebeu a tecnologia ${t.nome}.`) : fail('Não há tecnologia já descoberta no mundo que esta nação ainda não domine.');
  }

  rename(countryId: number, name: string): ActionResult {
    const clean = name.trim().slice(0, 40);
    if (!clean) return fail('Nome inválido.');
    const c = this.sim.country(countryId);
    const old = c.name;
    c.name = clean;
    c.article = articleFor(clean);
    this.sim.history.add('government', `${old} passou a se chamar ${clean}.`, { countries: [countryId], importance: 2 });
    this.sim.bus.emit('countryChanged', { country: countryId });
    return ok('Nação renomeada.');
  }

  toggleAI(countryId: number): ActionResult {
    const c = this.sim.country(countryId);
    c.ai = !c.ai;
    return ok(c.ai ? 'Diplomacia autônoma ativada.' : 'Diplomacia autônoma desativada: a nação só age por suas ordens.');
  }

  transferProvince(pid: number, to: number): ActionResult {
    const sim = this.sim;
    if (!sim.country(to)?.alive) return fail('Nação inválida.');
    const from = sim.state.provinces[pid].owner;
    if (from === to) return fail('O estado já pertence a esta nação.');
    sim.provinces.transfer(pid, to, 'annex');
    this.note(`Estado transferido: ${sim.provinces.name(pid)} passou de ${sim.country(from).name} para ${sim.country(to).name}.`, [from, to]);
    return ok('Estado transferido.');
  }

  fortify(pid: number): ActionResult {
    const ps = this.sim.state.provinces[pid];
    if (ps.fort >= 3) return fail('Fortificação máxima.');
    ps.fort++;
    return ok(`Fortificação nível ${ps.fort}.`);
  }

  triggerEvent(countryId: number, eventId: string): ActionResult {
    return this.sim.events.trigger(eventId, countryId) ? ok('Evento disparado.') : fail('Evento indisponível.');
  }

  // ---------- Exercitos ----------

  orderArmy(armyId: number, pid: number): ActionResult {
    const sim = this.sim;
    const a = sim.index.armyById.get(armyId);
    if (!a) return fail('Exército inexistente.');
    if (a.battle >= 0) return fail('O exército está em combate.');
    if (a.location === pid) return fail('O exército já está neste estado.');
    return sim.military.orderMove(a, pid) ? ok(`${a.name} recebeu ordem de marcha: ${sim.provinces.placeName(pid)}.`) : fail('Não há caminho transitável até lá.');
  }

  stopArmy(armyId: number): ActionResult {
    const sim = this.sim;
    const a = sim.index.armyById.get(armyId);
    if (!a || a.battle >= 0) return fail('Não é possível parar agora.');
    sim.military.setPath(a, [], 'idle', -1);
    a.player = true;
    a.thinkDay = sim.day + 30;
    return ok('Exército parado.');
  }

  sendHome(armyId: number): ActionResult {
    const a = this.sim.index.armyById.get(armyId);
    if (!a || a.battle >= 0) return fail('Não é possível agora.');
    this.sim.military.sendHome(a);
    a.player = true;
    a.thinkDay = this.sim.day + 60;
    return ok('Retornando para casa.');
  }

  splitArmy(armyId: number): ActionResult {
    const sim = this.sim;
    const a = sim.index.armyById.get(armyId);
    if (!a || a.battle >= 0 || soldiersOf(a) < 2000) return fail('Exército pequeno demais para dividir.');
    const b = sim.military.raiseArmy(a.owner, a.location, 0);
    b.infantry = a.infantry / 2;
    b.cavalry = a.cavalry / 2;
    b.artillery = a.artillery / 2;
    a.infantry /= 2;
    a.cavalry /= 2;
    a.artillery /= 2;
    b.morale = a.morale;
    b.experience = a.experience;
    return ok('Exército dividido.');
  }

  mergeHere(armyId: number): ActionResult {
    const sim = this.sim;
    const a = sim.index.armyById.get(armyId);
    if (!a || a.battle >= 0) return fail('Não é possível agora.');
    let merged = 0;
    for (const o of [...sim.index.armiesIn(a.location)]) {
      if (o !== a && o.owner === a.owner && o.battle < 0) {
        sim.military.merge(a, o);
        merged++;
      }
    }
    return merged ? ok(`${merged} exército(s) incorporados.`) : fail('Não há outros exércitos aqui.');
  }

  disband(armyId: number): ActionResult {
    const sim = this.sim;
    const a = sim.index.armyById.get(armyId);
    if (!a || a.battle >= 0) return fail('Não é possível dissolver em combate.');
    sim.country(a.owner).manpower += soldiersOf(a) * 0.7;
    sim.military.removeArmy(a);
    return ok('Exército dissolvido.');
  }
}
