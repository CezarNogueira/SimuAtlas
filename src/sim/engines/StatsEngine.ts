// STATS ENGINE: series temporais anuais (mundo e paises), rankings e retratos territoriais.
import type { Country, StatsSeries } from '../../state/types';
import type { Simulation } from '../Simulation';

const MAX_SAMPLES = 400;

export type RankMetric = 'population' | 'gdp' | 'army' | 'area' | 'provinces' | 'tech' | 'gdpPerCapita' | 'prestige';

export const RANK_LABELS: Record<RankMetric, string> = {
  population: 'Maior população',
  gdp: 'Maior PIB',
  army: 'Maior exército',
  area: 'Maior território',
  provinces: 'Mais estados',
  tech: 'Mais avançado',
  gdpPerCapita: 'Maior PIB per capita',
  prestige: 'Maior prestígio',
};

function push(series: StatsSeries, year: number, pop: number, gdp: number, army: number, provinces: number): void {
  series.years.push(year);
  series.pop.push(pop);
  series.gdp.push(gdp);
  series.army.push(army);
  series.provinces.push(provinces);
  if (series.years.length > MAX_SAMPLES) {
    for (const key of ['years', 'pop', 'gdp', 'army', 'provinces'] as const) {
      series[key] = series[key].filter((_, i) => i % 2 === 0);
    }
  }
}

export class StatsEngine {
  constructor(private sim: Simulation) {}

  metric(c: Country, m: RankMetric): number {
    switch (m) {
      case 'population': return c.population;
      case 'gdp': return c.gdp;
      case 'army': return c.armySize;
      case 'area': return c.area;
      case 'provinces': return c.provinceCount;
      case 'tech': return c.tech;
      case 'gdpPerCapita': return c.population > 0 ? c.gdp / c.population : 0;
      case 'prestige': return c.prestige;
    }
  }

  ranking(m: RankMetric, limit = 10): { country: Country; value: number }[] {
    return this.sim.countries
      .nations()
      .map((c) => ({ country: c, value: this.metric(c, m) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  rankOf(id: number, m: RankMetric): number {
    const list = this.sim.countries.nations().sort((a, b) => this.metric(b, m) - this.metric(a, m));
    return list.findIndex((c) => c.id === id) + 1;
  }

  yearly(): void {
    const sim = this.sim;
    const s = sim.state;
    const year = sim.year();
    const w = s.stats.world;
    if (w.years.length && w.years[w.years.length - 1] === year) return;
    let pop = 0;
    let gdp = 0;
    let army = 0;
    let alive = 0;
    for (const c of s.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      alive++;
      pop += c.population;
      gdp += c.gdp;
      army += c.armySize;
      let series = s.stats.countries[c.id];
      if (!series) {
        series = { years: [], pop: [], gdp: [], army: [], provinces: [] };
        s.stats.countries[c.id] = series;
      }
      push(series, year, c.population, c.gdp, c.armySize, c.provinceCount);
    }
    const lenBefore = w.years.length;
    push(w, year, pop, gdp, army, s.provinces.length);
    w.countries.push(alive);
    w.wars.push(sim.index.activeWars.length);
    if (w.years.length < lenBefore + 1) {
      w.countries = w.countries.filter((_, i) => i % 2 === 0);
      w.wars = w.wars.filter((_, i) => i % 2 === 0);
    }
    if ((year - s.startYear) % 10 === 0) {
      s.stats.snapshots.push({ year, owners: s.provinces.map((p) => p.owner) });
    }
  }
}
