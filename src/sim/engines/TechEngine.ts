// TECH ENGINE: progresso tecnologico anual com difusao entre vizinhos.
import { clamp } from '../../core/math';
import { GOVERNMENTS } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { TECHS, techEffects } from '../../data/techs';
import type { Simulation } from '../Simulation';

export class TechEngine {
  constructor(private sim: Simulation) {}

  yearly(): void {
    const sim = this.sim;
    const s = sim.state;
    const nations = sim.countries.nations();
    const techNow = new Map(nations.map((c) => [c.id, c.tech]));
    const perCapita = (c: { gdp: number; population: number }) => (c.population > 0 ? c.gdp / c.population : 0);
    const avgGdppc = nations.reduce((acc, c) => acc + perCapita(c), 0) / Math.max(1, nations.length);
    for (const c of nations) {
      const fx = techEffects(c.tech);
      const wealth = perCapita(c) / Math.max(1e-6, avgGdppc);
      const tradeCount = (sim.index.treatiesOf.get(c.id) ?? []).filter((t) => t.type === 'trade').length;
      const researchMod = c.modifiers.reduce((acc, m) => acc + (m.research ?? 0), 0);
      let rate =
        (0.012 + 0.001 * c.tech) * (1 + fx.research + researchMod) * clamp(0.55 + wealth * 0.45, 0.4, 1.6) *
        (0.6 + c.stability / 250) * (1 + tradeCount * 0.03) * IDEOLOGIES[c.ideology].growth * GOVERNMENTS[c.government].growth;
      let maxNeighbor = 0;
      for (const n of sim.countries.neighbors(c.id)) maxNeighbor = Math.max(maxNeighbor, techNow.get(n) ?? 0);
      if (maxNeighbor > c.tech + 0.5) rate += 0.015 * (maxNeighbor - c.tech);
      const before = Math.floor(c.tech);
      c.tech += Math.max(0.005, rate);
      const after = Math.floor(c.tech);
      for (let lvl = before + 1; lvl <= after; lvl++) {
        const tech = TECHS.find((t) => t.level === lvl);
        if (!tech) continue;
        if (s.stats.techFirsts[tech.id] === undefined) {
          s.stats.techFirsts[tech.id] = c.id;
          sim.history.add('tech', `${c.name} foi a primeira nação a desenvolver ${tech.name}: ${tech.description}`, { countries: [c.id], importance: 2 });
        } else if (c.provinceCount >= 5) {
          sim.history.add('tech', `${c.name} desenvolveu ${tech.name}.`, { countries: [c.id], importance: 1 });
        }
      }
    }
  }
}
