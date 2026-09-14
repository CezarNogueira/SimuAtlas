// ECONOMY ENGINE: producao das provincias, PIB, impostos, comercio, despesas militares,
// tesouro, divida, inflacao, desemprego, crescimento, falencias e os custos reais da guerra:
// gastos com tropas e armamentos pagos com divida, escassez que dispara a inflacao e producao
// perdida com a destruicao da infraestrutura.
import { clamp } from '../../core/math';
import { GOVERNMENTS } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { resourceValue } from '../../data/resources';
import { terrainInfo } from '../../data/terrain';
import type { Country } from '../../state/types';
import type { Simulation } from '../Simulation';

// Credito de guerra: ate quanto do PIB um pais em guerra consegue se endividar para manter os exercitos.
export const WAR_CREDIT_LIMIT = 1.2;
// Fracao da producao de um estado perdida quando ele esta totalmente arrasado.
export const DEVASTATION_OUTPUT_LOSS = 0.75;

export interface WarEconomy {
  atWar: boolean;
  militaryCost: number; // gasto militar mensal (tropas, armamentos, marinha e aviacao)
  warFactor: number; // multiplicador do custo das tropas em campanha
  mobilization: number; // fracao da populacao em armas
  lostShare: number; // fracao da producao perdida por destruicao e ocupacao
  occupiedShare: number; // fracao da producao em estados ocupados pelo inimigo
  devastation: number; // destruicao media ponderada pela populacao
  ruined: number; // estados arrasados (devastacao >= 40%)
  credit: number; // credito de guerra ainda disponivel
  debtRatio: number;
}

export class EconomyEngine {
  constructor(private sim: Simulation) {}

  gdpPerCapita(c: Country): number {
    return this.sim.era.gdpPerCapita * Math.pow(1.09, c.tech - this.sim.state.techBaseline);
  }

  soldierMonthlyCost(c: Country): number {
    return ((this.gdpPerCapita(c) * this.sim.era.soldierCost) / 12) * (1 + c.inflation);
  }

  recruitCost(c: Country, soldiers: number): number {
    return soldiers * this.gdpPerCapita(c) * 0.7;
  }

  // Tropas em campanha custam muito mais que em quarteis: soldos de campanha, armamentos, municao e
  // provisoes; quanto maior a mobilizacao, mais caro fica equipar cada novo soldado.
  warCostFactor(c: Country): number {
    if (!this.sim.index.isAtWar(c.id)) return 1;
    return 2.3 + Math.min(1.2, (c.armySize / Math.max(1, c.population)) * 30);
  }

  militaryCost(c: Country): number {
    const gdppc = this.gdpPerCapita(c);
    const factor = this.warCostFactor(c);
    const navy = ((c.navy * gdppc * 30) / 12) * (factor > 1 ? 1.5 : 1);
    const air = ((c.airForce * gdppc * 60) / 12) * (factor > 1 ? 1.5 : 1);
    return c.armySize * this.soldierMonthlyCost(c) * factor + navy + air;
  }

  // Quanto o pais ainda consegue tomar emprestado para financiar a guerra.
  warCredit(c: Country): number {
    return Math.max(0, c.gdp * WAR_CREDIT_LIMIT - c.debt);
  }

  // intact = producao potencial, sem destruicao nem ocupacao.
  provinceOutput(pid: number, c: Country, intact = false): number {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const mp = sim.map.provinces[pid];
    const fx = sim.technology.fx(c);
    let mult =
      terrainInfo(mp.terrain).production * resourceValue(ps.resource, sim.technology.resourceUnlocked(c, ps.resource)) * (0.45 + ps.development * 0.055) *
      (1 + fx.economy) * (1 + fx.industry * clamp(ps.development / 12, 0.2, 1.5)) * (mp.coast > 0 ? 1.08 : 1) * (mp.river > 0 ? 1.05 : 1);
    if (!intact) {
      // Fabricas, estradas, pontes e plantacoes destruidas param a producao.
      mult *= 1 - ps.devastation * DEVASTATION_OUTPUT_LOSS;
      if (ps.controller !== ps.owner) mult *= 0.35;
    }
    return ((ps.population * this.gdpPerCapita(c)) / 12) * mult;
  }

  // Retrato da economia de guerra de um pais (usado pela interface e pela IA).
  warEconomy(c: Country): WarEconomy {
    const sim = this.sim;
    let potential = 0;
    let actual = 0;
    let occupied = 0;
    let devPop = 0;
    let pop = 0;
    let ruined = 0;
    for (const pid of sim.index.ownedBy[c.id] ?? []) {
      const ps = sim.state.provinces[pid];
      const base = this.provinceOutput(pid, c, true);
      potential += base;
      actual += this.provinceOutput(pid, c);
      if (ps.controller !== c.id) occupied += base;
      devPop += ps.devastation * ps.population;
      pop += ps.population;
      if (ps.devastation >= 0.4) ruined++;
    }
    const warFactor = this.warCostFactor(c);
    return {
      atWar: warFactor > 1,
      militaryCost: this.militaryCost(c),
      warFactor,
      mobilization: c.armySize / Math.max(1, c.population),
      lostShare: potential > 0 ? 1 - actual / potential : 0,
      occupiedShare: potential > 0 ? occupied / potential : 0,
      devastation: pop > 0 ? devPop / pop : 0,
      ruined,
      credit: this.warCredit(c),
      debtRatio: c.debt / Math.max(1, c.gdp),
    };
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const d = sim.date();
    const n = s.countries.length;
    const outputs = new Float64Array(n);
    const potential = new Float64Array(n);
    const occupied = new Float64Array(n);
    const loot = new Float64Array(n);
    for (const c of s.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      let total = 0;
      let pot = 0;
      let occ = 0;
      for (const pid of sim.index.ownedBy[c.id]) {
        const ps = s.provinces[pid];
        const base = this.provinceOutput(pid, c, true);
        const ctrl = ps.controller;
        const o = base * (1 - ps.devastation * DEVASTATION_OUTPUT_LOSS) * (ctrl !== c.id ? 0.35 : 1);
        total += o;
        pot += base;
        if (ctrl !== c.id) {
          occ += base;
          if (ctrl >= 0) loot[ctrl] += o * 0.4;
        }
      }
      outputs[c.id] = total;
      potential[c.id] = pot;
      occupied[c.id] = occ;
    }
    for (const c of s.countries) {
      if (!c.alive) continue;
      if (c.kind === 'rebel') {
        c.treasury += loot[c.id];
        continue;
      }
      const gov = GOVERNMENTS[c.government];
      const ideology = IDEOLOGIES[c.ideology];
      const fx = sim.technology.fx(c);
      const modEconomy = c.modifiers.reduce((acc, m) => acc * (1 + (m.economy ?? 0)), 1);
      const stabF = 0.7 + c.stability / 333;
      // Inflacao alta desorganiza a economia (escassez, especulacao, poupanca destruida).
      const gdpMonthly = outputs[c.id] * stabF * (1 - c.unemployment * 0.5) * (1 - c.inflation * 0.35) * gov.growth * ideology.growth * modEconomy;
      const annual = gdpMonthly * 12;
      c.gdp = c.gdp > 0 ? c.gdp * 0.75 + annual * 0.25 : annual;

      const treaties = sim.index.treatiesOf.get(c.id) ?? [];
      let tradePartners = 0;
      for (const t of treaties) if (t.type === 'trade') tradePartners++;
      let sanctions = 0;
      for (const t of s.treaties) if (t.active && t.type === 'sanction' && t.target === c.id) sanctions++;
      const coastShare = c.provinceCount > 0 ? sim.index.ownedBy[c.id].filter((p) => sim.map.coastal[p]).length / c.provinceCount : 0;
      c.tradeIncome = gdpMonthly * (0.01 + 0.012 * Math.min(6, tradePartners) * ideology.trade + coastShare * 0.02) * Math.max(0.4, 1 - 0.12 * sanctions) * (1 + fx.transport * 0.5);
      const taxes = gdpMonthly * c.taxRate * gov.tax * (1 - c.corruption * 0.7) * (1 + fx.administration * 0.3);
      const atWar = sim.index.isAtWar(c.id);
      const adminCost = gdpMonthly * 0.03;
      const debtRatio = c.debt / Math.max(1, c.gdp);
      const interest = (c.debt * (0.04 + Math.min(0.12, debtRatio * 0.05))) / 12;
      c.income = taxes + c.tradeIncome + loot[c.id];
      // Pesquisa e adaptacao de tecnologias a producao (fabricas, laboratorios, formacao de engenheiros).
      c.expenses = this.militaryCost(c) + adminCost + interest + c.science.spending;
      const balance = c.income - c.expenses;
      let unpaid = 0;
      if (atWar && balance < 0) {
        // Titulos de guerra: o governo financia metade do deficit com emprestimos mesmo tendo reservas.
        const credit = this.warCredit(c);
        const bonds = Math.min(-balance * 0.5, credit);
        c.debt += bonds;
        c.treasury += balance + bonds;
        if (c.treasury < 0) {
          // O que o tesouro nao cobre sai do credito restante; sem credito, os soldos simplesmente atrasam.
          const borrowed = Math.min(-c.treasury, credit - bonds);
          c.debt += borrowed;
          unpaid = -c.treasury - borrowed;
          c.treasury = 0;
        }
      } else {
        c.treasury += balance;
      }
      if (c.treasury < 0) {
        c.debt -= c.treasury;
        c.treasury = 0;
      } else if (c.debt > 0 && c.treasury > c.income * 2) {
        const pay = Math.min(c.debt, (c.treasury - c.income * 2) * 0.3);
        c.debt -= pay;
        c.treasury -= pay;
      }

      // Inflacao de guerra: divida emitida para pagar tropas, mobilizacao que tira bracos do campo e das
      // fabricas, producao destruida e territorio ocupado fazem faltar produtos basicos. Sobe rapido e so
      // cede devagar depois da guerra.
      const mobilization = c.armySize / Math.max(1, c.population);
      const lostShare = potential[c.id] > 0 ? 1 - outputs[c.id] / potential[c.id] : 0;
      const occShare = potential[c.id] > 0 ? occupied[c.id] / potential[c.id] : 0;
      const warInflation = atWar ? 0.02 + mobilization * 1.2 + lostShare * 0.2 + occShare * 0.1 : 0;
      const infTarget = clamp(0.01 + debtRatio * 0.06 + warInflation + (c.treasury > c.gdp ? 0.02 : 0), 0, 0.45);
      c.inflation = clamp(c.inflation + (infTarget - c.inflation) * (infTarget > c.inflation ? 0.08 : 0.05), 0, 0.8);
      const modUnemployment = c.modifiers.some((m) => (m.economy ?? 0) < -0.05) ? 0.05 : 0;
      const unTarget = clamp(0.05 + (c.growth < 0 ? -c.growth * 1.2 : -c.growth * 0.3) + (atWar ? -0.02 : 0) + (c.stability < 30 ? 0.04 : 0) + modUnemployment, 0.01, 0.5);
      c.unemployment = clamp(c.unemployment + (unTarget - c.unemployment) * 0.08, 0, 0.6);

      if (c.ai) {
        const lo = sim.era.taxRate * 0.5;
        const hi = sim.era.taxRate * 1.8;
        if (c.income < c.expenses && c.treasury < c.income * 3) c.taxRate = Math.min(hi, c.taxRate + 0.002);
        else if (c.treasury > c.income * 24) c.taxRate = Math.max(lo, c.taxRate - 0.002);
      }

      if (d.month === 1) {
        c.growth = c.gdpLastYear > 0 ? (c.gdp - c.gdpLastYear) / c.gdpLastYear : 0;
        c.gdpLastYear = c.gdp;
      }

      this.warHardships(c, atWar, debtRatio, unpaid);
      if (debtRatio > 1.6 && taxes < interest * 1.2) {
        // Uma moratoria por vez: sem dinheiro para os soldos durante a crise, as tropas desertam.
        if (c.modifiers.some((m) => m.id === 'bankruptcy' && m.until > sim.day)) this.desertion(c);
        else this.bankruptcy(c);
      }
    }
  }

  // Dificuldades visiveis da guerra: escassez com inflacao alta, divida de guerra e, com o credito
  // esgotado e o tesouro vazio, soldos atrasados que corroem os exercitos.
  private warHardships(c: Country, atWar: boolean, debtRatio: number, unpaid: number): void {
    const sim = this.sim;
    const active = (id: string) => c.modifiers.find((m) => m.id === id && m.until > sim.day);
    const shortage = active('shortage');
    if (shortage && c.inflation >= 0.15) {
      shortage.until = sim.day + 60;
    } else if (!shortage && c.inflation >= 0.2) {
      c.modifiers.push({ id: 'shortage', name: 'Escassez', until: sim.day + 60, growth: -0.004, stability: -2 });
      sim.history.add('economy', `Escassez ${sim.countries.in(c.id)}: faltam alimentos e produtos básicos, e os preços disparam (inflação de ${Math.round(c.inflation * 100)}%).`, {
        countries: [c.id], importance: 2,
      });
    }
    const warDebt = active('war_debt');
    if (warDebt && atWar && debtRatio >= 0.5) {
      warDebt.until = sim.day + 60;
    } else if (!warDebt && atWar && debtRatio >= 0.6) {
      c.modifiers.push({ id: 'war_debt', name: 'Dívida de guerra', until: sim.day + 60, economy: -0.03 });
      sim.history.add('economy', `${c.name} afunda em dívidas para pagar a guerra: a dívida pública chega a ${Math.round(debtRatio * 100)}% do PIB.`, {
        countries: [c.id], importance: 2,
      });
    }
    // Soldos atrasados: quanto maior a parte do gasto militar sem pagamento, mais tropas desertam.
    if (unpaid > 0) this.desertion(c, 0.02 + 0.1 * Math.min(1, unpaid / Math.max(1, this.militaryCost(c))), 0.03);
  }

  bankruptcy(c: Country): void {
    const sim = this.sim;
    c.debt = 0;
    c.stability = Math.max(0, c.stability - 25);
    c.prestige = Math.max(0, c.prestige - 20);
    c.inflation = Math.min(0.8, c.inflation + 0.1);
    c.modifiers.push({ id: 'bankruptcy', name: 'Moratória', until: sim.day + 3 * 365, economy: -0.12, stability: -8 });
    sim.history.add('economy', `${c.name} declarou moratória da dívida pública e mergulhou em crise.`, { countries: [c.id], importance: 2 });
  }

  // Soldos atrasados: parte das tropas fora de combate deserta por mes (parte volta a reserva de
  // manpower) e o moral cai.
  private desertion(c: Country, rate = 0.05, moraleHit = 0): void {
    const sim = this.sim;
    for (const a of sim.military.armiesOf(c.id)) {
      if (a.battle >= 0) continue;
      const cut = sim.military.applyLosses(a, (a.infantry + a.cavalry + a.artillery) * rate);
      c.manpower = Math.min(c.maxManpower, c.manpower + cut * 0.5);
      if (moraleHit) a.morale = Math.max(0.1, a.morale - moraleHit);
    }
  }

  // Tesouro cheio: primeiro reconstroi os estados arrasados pela guerra, depois investe em infraestrutura.
  // Paises endividados nao tem esse dinheiro e ficam anos com a producao reduzida.
  invest(c: Country): void {
    const sim = this.sim;
    const reserve = c.income * 18;
    if (c.treasury <= reserve || c.provinceCount === 0) return;
    const budget = (c.treasury - reserve) * 0.25;
    const owned = sim.index.ownedBy[c.id];
    const provs = sim.state.provinces;
    const gdppc = this.gdpPerCapita(c);
    let spent = 0;
    const ruined = owned.filter((p) => provs[p].devastation > 0.15 && provs[p].controller === c.id).sort((a, b) => provs[b].devastation - provs[a].devastation);
    for (const pid of ruined) {
      const ps = provs[pid];
      const cost = (ps.population * gdppc * 0.04 + gdppc * 1500) * ps.devastation;
      if (spent + cost > budget) break;
      ps.devastation *= 0.6;
      spent += cost;
    }
    for (let i = 0; i < 4 && spent < budget; i++) {
      const pid = sim.rng.pick(owned);
      const ps = provs[pid];
      const cost = (ps.population * gdppc * 0.02 + gdppc * 2000) * (1 + ps.development / 10);
      if (spent + cost > budget || ps.development >= 30) continue;
      ps.development = Math.min(30, ps.development + 0.25);
      spent += cost;
    }
    c.treasury -= spent;
  }
}
