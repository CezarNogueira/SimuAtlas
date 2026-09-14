// CITY ENGINE: cidades derivadas das provincias (populacao urbana, importancia, infraestrutura, valor estrategico).
import { terrainInfo } from '../../data/terrain';
import type { Simulation } from '../Simulation';

export interface CityInfo {
  id: number;
  name: string;
  province: number;
  x: number;
  y: number;
  population: number;
  importance: number; // 0..100
  infrastructure: number; // 0..100
  production: number; // mensal
  strategic: number; // 0..100
  isCapital: boolean;
  synthetic: boolean;
}

export class CityEngine {
  constructor(private sim: Simulation) {}

  urbanShare(tech: number): number {
    return Math.min(0.75, 0.07 + tech * 0.022);
  }

  provinceCities(pid: number): CityInfo[] {
    const sim = this.sim;
    const mp = sim.map.provinces[pid];
    const ps = sim.state.provinces[pid];
    const owner = ps.owner >= 0 ? sim.country(ps.owner) : null;
    const tech = owner?.tech ?? sim.era.tech;
    const weights = mp.cities.map((cid) => Math.max(20000, sim.map.cities[cid].pop) ** 0.85);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const urban = ps.population * this.urbanShare(tech);
    const gdppc = owner ? sim.economy.gdpPerCapita(owner) : sim.era.gdpPerCapita;
    const t = terrainInfo(mp.terrain);
    return mp.cities.map((cid, i) => {
      const city = sim.map.cities[cid];
      const isCapital = owner !== null && owner.capital === pid && i === 0;
      const population = (urban * weights[i]) / total;
      const importance = Math.min(100, Math.log10(population + 10) * 14 + (isCapital ? 25 : 0) + ps.development);
      const infrastructure = Math.min(100, ps.development * 3 * (isCapital ? 1.3 : 1) * (1 - ps.devastation * 0.5));
      const strategic = Math.min(100, (mp.coast > 0 ? 12 : 0) + (mp.river > 0 ? 10 : 0) + ps.fort * 12 + (isCapital ? 30 : 0) + (t.defense - 1) * 40);
      return {
        id: cid,
        name: city.name,
        province: pid,
        x: city.x,
        y: city.y,
        population,
        importance,
        infrastructure,
        production: (population * gdppc * 1.6) / 12,
        strategic,
        isCapital,
        synthetic: !!city.synthetic,
      };
    });
  }

  citiesOf(countryId: number, limit = 12): CityInfo[] {
    const out: CityInfo[] = [];
    for (const pid of this.sim.index.ownedBy[countryId] ?? []) out.push(...this.provinceCities(pid));
    return out.sort((a, b) => b.population - a.population).slice(0, limit);
  }
}
