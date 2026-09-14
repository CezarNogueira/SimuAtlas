// TECHNOLOGY DISCOVERY ENGINE: descobertas mundiais. Nenhuma tecnologia surge antes da sua data historica. Quando o
// ano chega, sao elegiveis os paises que ja dominam as dependencias, possuem a infraestrutura exigida e concluiram a
// pesquisa preparatoria; entre eles, o descobridor e sorteado com peso pela capacidade cientifica e estabilidade.
// Se ninguem estiver apto, a descoberta espera ate que algum pais esteja. Tambem distribui, no inicio da partida, o
// conhecimento que ja existia antes do ano inicial.
import { historicalAdvancement } from '../../data/historicalCenters';
import { incomeLevel } from '../../data/income';
import { TECHNOLOGIES, type EraId, type Technology } from '../../data/technologies';
import type { Country } from '../../state/types';
import type { Simulation } from '../Simulation';
import { PREPARATION_LIMIT } from './TechnologyResearchEngine';
import type { TechnologyEngine } from './TechnologyEngine';

// Tempo caracteristico (anos) para uma tecnologia da era se espalhar pelo mundo antes da partida.
const DIFFUSION_TAU: Record<EraId, number> = {
  medieval: 250, moderna: 110, primeira_revolucao: 55, segunda_revolucao: 30, terceira_revolucao: 14, quarta_revolucao: 7,
};

// Chance mensal de a descoberta acontecer quando ha paises aptos.
const MONTHLY_DISCOVERY_CHANCE = 0.35;

export class TechnologyDiscoveryEngine {
  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  monthly(): void {
    const sim = this.sim;
    const year = sim.year();
    const count = TECHNOLOGIES.countUntil(year);
    const nations = sim.countries.nations();
    for (let i = 0; i < count; i++) {
      const t = TECHNOLOGIES.all[i];
      if (this.tech.record(t.id).discovered) continue;
      const eligible: Country[] = [];
      for (const c of nations) {
        const h = c.techs[t.id];
        if (!h || (h.stage !== 'pesquisa' && h.stage !== 'importacao')) continue;
        if (h.progress < PREPARATION_LIMIT - 1e-9) continue;
        if (this.isEligible(c, t)) eligible.push(c);
      }
      const overdue = year - t.anoDescoberta;
      if (!eligible.length && overdue >= 3) {
        // Inventores fora dos grandes projetos: com a data historica ja passada, paises cientificamente fortes chegam la.
        for (const c of nations) if (c.science.capacity >= 0.9 && this.isEligible(c, t)) eligible.push(c);
        if (!eligible.length || !sim.rng.chance(Math.min(0.3, 0.02 * overdue))) continue;
      } else if (!eligible.length || !sim.rng.chance(MONTHLY_DISCOVERY_CHANCE)) {
        continue;
      }
      const discoverer = sim.rng.weighted(eligible, (c) => Math.max(0.01, c.science.capacity) * (t.paisesOrigem.includes(c.code) ? 1.5 : 1) * (0.5 + c.stability / 100));
      if (discoverer) this.discover(discoverer, t);
    }
  }

  isEligible(c: Country, t: Technology): boolean {
    if (!this.tech.ownership.depsKnown(c, t)) return false;
    for (const tag of t.infraestruturaNecessaria) if (!this.tech.infraSatisfied(c, tag, 'discovery')) return false;
    return true;
  }

  discover(c: Country, t: Technology): void {
    const sim = this.sim;
    const rec = this.tech.record(t.id);
    rec.discovered = true;
    rec.discoverer = c.id;
    rec.discoveryDay = sim.day;
    rec.discoveryYear = sim.year();
    rec.monopolyEnded = -1;
    // O descobridor registra patentes e guarda os detalhes: quem pesquisava em paralelo precisa refazer parte do caminho.
    for (const other of sim.state.countries) {
      const h = other.techs[t.id];
      if (other.id !== c.id && h && (h.stage === 'pesquisa' || h.stage === 'importacao')) h.progress = Math.min(h.progress, 0.5);
    }
    this.tech.ownership.grantKnowledge(c, t, 'descoberta', -1, { production: true, announce: false });
    this.tech.history.discovered(c, t);
    c.prestige = Math.min(100, c.prestige + Math.min(5, t.valorEstrategico * 0.4));
    rec.marketPrice = this.tech.trade.marketPrice(t);
  }

  // Conhecimento anterior ao inicio: quanto mais antiga a tecnologia, mais paises a conhecem; os mais avancados
  // (tradicao cientifica da cultura na epoca e, nos seculos recentes, renda) a conhecem primeiro.
  initializeWorld(): void {
    const sim = this.sim;
    const s = sim.state;
    const start = s.startYear;
    for (const t of TECHNOLOGIES.all) {
      s.technologies[t.id] = {
        discovered: false, discoverer: -1, discoveryDay: -1, discoveryYear: 0, preStart: false, holders: 0, producers: 0, importers: 0,
        researchers: 0, monopolyEnded: -1, marketPrice: 0, obsolete: false, log: [],
      };
    }
    this.tech.history.muted = true;
    const nations = sim.countries.nations();
    const adv = new Map<number, number>();
    for (const c of nations) adv.set(c.id, historicalAdvancement(c.culture, incomeLevel(sim.map.nations[c.id]?.income ?? ''), start, c.continent) * sim.rng.float(0.9, 1.1));
    const maxAdv = Math.max(1e-6, ...adv.values());
    const rel = (c: Country) => (adv.get(c.id) ?? 0) / maxAdv;

    // 1) Quem conhece cada tecnologia antiga.
    const known: Technology[] = [];
    for (const t of TECHNOLOGIES.all) {
      if (t.anoDescoberta >= start) break;
      const age = start - t.anoDescoberta;
      const tau = DIFFUSION_TAU[t.era] * (0.6 + t.nivelComplexidade / 10);
      const threshold = Math.exp(-age / tau);
      const holders = nations.filter((c) => rel(c) + 1e-9 >= threshold && this.tech.ownership.depsKnown(c, t));
      if (!holders.length) continue;
      const rec = s.technologies[t.id];
      const origin = holders.filter((c) => t.paisesOrigem.includes(c.code));
      const discoverer = (origin.length ? origin : holders).reduce((best, c) => (rel(c) > rel(best) ? c : best));
      rec.discovered = true;
      rec.preStart = true;
      rec.discoverer = discoverer.id;
      rec.discoveryYear = t.anoDescoberta;
      rec.discoveryDay = (t.anoDescoberta - start) * 365;
      for (const c of holders) {
        this.tech.ownership.grantKnowledge(c, t, 'pre_existente', -1, { progress: Math.min(0.9, (age * 12) / Math.max(1, t.tempoParaProduzir)), announce: false, refresh: false });
      }
      if (holders.length >= 2) rec.monopolyEnded = rec.discoveryDay;
      known.push(t);
    }

    // 2) Base cientifica (educacao, universidades) conforme o conhecimento e a tradicao.
    this.tech.effects.refreshAll();
    this.tech.research.initialize();
    this.tech.ownership.recount();

    // 3) Producao: tecnologias antigas o bastante ja sao produzidas por quem tem infraestrutura e insumos.
    for (const t of known) {
      const age = start - t.anoDescoberta;
      if (age * 12 < t.tempoParaProduzir * 1.5) continue;
      for (const c of nations) {
        const h = c.techs[t.id];
        if (h?.stage !== 'conhecimento') continue;
        if (!t.infraestruturaNecessaria.every((tag) => this.tech.infraSatisfied(c, tag, 'production'))) continue;
        if (this.tech.resourceAccess(c, t) < 0.5 && age < 60) continue;
        this.tech.ownership.setProduction(c, t, false);
        // Recalcula na hora quando a producao altera a industrializacao (que libera outras producoes).
        if ((t.efeitos.industry ?? 0) > 0) this.tech.effects.compute(c);
      }
    }

    // 4) Um unico registro por tecnologia pre-existente na trajetoria (quantos a conheciam e a origem atribuida).
    this.tech.history.muted = false;
    for (const t of known) {
      const rec = s.technologies[t.id];
      this.tech.history.log(t.id, 'pre_existente', rec.discoverer, rec.holders, 'pre_existente');
    }
  }
}
