// POPULATION ENGINE: crescimento logistico por provincia, afetado por tecnologia,
// terreno, estabilidade, guerra, devastacao, epidemias e modificadores nacionais.
import { terrainInfo } from '../../data/terrain';
import { techEffects } from '../../data/techs';
import type { Simulation } from '../Simulation';

export class PopulationEngine {
  constructor(private sim: Simulation) {}

  capacity(pid: number): number {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const tech = ps.owner >= 0 ? sim.country(ps.owner).tech : sim.era.tech;
    return ps.capacity * Math.pow(1.13, Math.max(-3, tech - sim.era.tech)) * (1 - ps.devastation * 0.5) * (0.8 + ps.development / 50);
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const growthMods = new Float64Array(s.countries.length);
    for (const c of s.countries) {
      if (!c.alive) continue;
      growthMods[c.id] = c.modifiers.reduce((acc, m) => acc + (m.growth ?? 0), 0);
    }
    for (let pid = 0; pid < s.provinces.length; pid++) {
      const ps = s.provinces[pid];
      if (ps.owner < 0) continue;
      const c = s.countries[ps.owner];
      const fx = techEffects(c.tech);
      const base = 0.005 + fx.growth + c.tech * 0.00025;
      const terrainF = Math.pow(terrainInfo(sim.map.provinces[pid].terrain).habitability, 0.3);
      const stabilityF = 0.4 + (c.stability / 100) * 0.8;
      const cap = this.capacity(pid);
      const logistic = 1 - ps.population / Math.max(1000, cap);
      let annual = base * terrainF * stabilityF * logistic;
      // Ocupacao militar (guerras podem durar ate a dominacao, entao o efeito e moderado).
      if (ps.controller !== ps.owner) annual -= 0.006;
      annual -= ps.devastation * 0.02;
      annual += growthMods[ps.owner];
      if (ps.epidemic > 0) annual -= 0.09;
      ps.population = Math.max(500, ps.population * (1 + annual / 12));
    }
  }
}
