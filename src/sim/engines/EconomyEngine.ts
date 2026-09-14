// ECONOMY ENGINE: producao das provincias, PIB, impostos, comercio, despesas militares,
// tesouro, divida, inflacao, desemprego, crescimento e falencias.
import { clamp } from '../../core/math';
import { GOVERNMENTS } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { resourceValue } from '../../data/resources';
import { terrainInfo } from '../../data/terrain';
import { techEffects } from '../../data/techs';
import type { Country } from '../../state/types';
import type { Simulation } from '../Simulation';

export class EconomyEngine {
  constructor(private sim: Simulation) {}

  gdpPerCapita(c: Country): number {
    return this.sim.era.gdpPerCapita * Math.pow(1.09, c.tech - this.sim.era.tech);
  }

  soldierMonthlyCost(c: Country): number {
    return ((this.gdpPerCapita(c) * this.sim.era.soldierCost) / 12) * (1 + c.inflation);
  }

  recruitCost(c: Country, soldiers: number): number {
    return soldiers * this.gdpPerCapita(c) * 0.7;
  }

  provinceOutput(pid: number, c: Country): number {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const mp = sim.map.provinces[pid];
    const fx = techEffects(c.tech);
    let mult =
      terrainInfo(mp.terrain).production * resourceValue(ps.resource, c.tech) * (0.45 + ps.development * 0.055) *
      (1 + fx.economy) * (mp.coast > 0 ? 1.08 : 1) * (mp.river > 0 ? 1.05 : 1) * (1 - ps.devastation * 0.6);
    if (ps.controller !== ps.owner) mult *= 0.35;
    return ((ps.population * this.gdpPerCapita(c)) / 12) * mult;
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const d = sim.date();
    const outputs = new Float64Array(s.countries.length);
    const loot = new Float64Array(s.countries.length);
    for (const c of s.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      let total = 0;
      for (const pid of sim.index.ownedBy[c.id]) {
        const o = this.provinceOutput(pid, c);
        total += o;
        const ctrl = s.provinces[pid].controller;
        if (ctrl !== c.id && ctrl >= 0) loot[ctrl] += o * 0.4;
      }
      outputs[c.id] = total;
    }
    for (const c of s.countries) {
      if (!c.alive) continue;
      if (c.kind === 'rebel') {
        c.treasury += loot[c.id];
        continue;
      }
      const gov = GOVERNMENTS[c.government];
      const ideology = IDEOLOGIES[c.ideology];
      const modEconomy = c.modifiers.reduce((acc, m) => acc * (1 + (m.economy ?? 0)), 1);
      const stabF = 0.7 + c.stability / 333;
      const gdpMonthly = outputs[c.id] * stabF * (1 - c.unemployment * 0.5) * (1 - c.inflation * 0.25) * gov.growth * ideology.growth * modEconomy;
      const annual = gdpMonthly * 12;
      c.gdp = c.gdp > 0 ? c.gdp * 0.75 + annual * 0.25 : annual;

      const treaties = sim.index.treatiesOf.get(c.id) ?? [];
      let tradePartners = 0;
      for (const t of treaties) if (t.type === 'trade') tradePartners++;
      let sanctions = 0;
      for (const t of s.treaties) if (t.active && t.type === 'sanction' && t.target === c.id) sanctions++;
      const coastShare = c.provinceCount > 0 ? sim.index.ownedBy[c.id].filter((p) => sim.map.coastal[p]).length / c.provinceCount : 0;
      c.tradeIncome = gdpMonthly * (0.01 + 0.012 * Math.min(6, tradePartners) * ideology.trade + coastShare * 0.02) * Math.max(0.4, 1 - 0.12 * sanctions);
      const taxes = gdpMonthly * c.taxRate * gov.tax * (1 - c.corruption * 0.7);
      const atWar = sim.index.isAtWar(c.id);
      const gdppc = this.gdpPerCapita(c);
      const armyCost = c.armySize * this.soldierMonthlyCost(c) * (atWar ? 1.15 : 1);
      const navyCost = (c.navy * gdppc * 30) / 12;
      const airCost = (c.airForce * gdppc * 60) / 12;
      const adminCost = gdpMonthly * 0.03;
      const debtRatio = c.debt / Math.max(1, c.gdp);
      const interest = (c.debt * (0.04 + Math.min(0.12, debtRatio * 0.05))) / 12;
      c.income = taxes + c.tradeIncome + loot[c.id];
      c.expenses = armyCost + navyCost + airCost + adminCost + interest;
      c.treasury += c.income - c.expenses;
      if (c.treasury < 0) {
        c.debt -= c.treasury;
        c.treasury = 0;
      } else if (c.debt > 0 && c.treasury > c.income * 2) {
        const pay = Math.min(c.debt, (c.treasury - c.income * 2) * 0.3);
        c.debt -= pay;
        c.treasury -= pay;
      }

      const infTarget = clamp(0.01 + debtRatio * 0.08 + (atWar ? 0.02 : 0) + (c.treasury > c.gdp ? 0.02 : 0), 0, 0.6);
      c.inflation = clamp(c.inflation + (infTarget - c.inflation) * 0.04, 0, 0.8);
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

      if (debtRatio > 1.6 && taxes < interest * 1.2) this.bankruptcy(c);
    }
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

  // Investimento em infraestrutura quando o tesouro esta muito cheio.
  invest(c: Country): void {
    const sim = this.sim;
    const reserve = c.income * 18;
    if (c.treasury <= reserve || c.provinceCount === 0) return;
    const budget = (c.treasury - reserve) * 0.25;
    const owned = sim.index.ownedBy[c.id];
    const gdppc = this.gdpPerCapita(c);
    let spent = 0;
    for (let i = 0; i < 4 && spent < budget; i++) {
      const pid = sim.rng.pick(owned);
      const ps = sim.state.provinces[pid];
      const cost = (ps.population * gdppc * 0.02 + gdppc * 2000) * (1 + ps.development / 10);
      if (spent + cost > budget || ps.development >= 30) continue;
      ps.development = Math.min(30, ps.development + 0.25);
      spent += cost;
    }
    c.treasury -= spent;
  }
}
