// TECHNOLOGY RESEARCH ENGINE: capacidade cientifica de cada pais (educacao, universidades, cientistas, riqueza,
// industrializacao, estabilidade, infraestrutura e tecnologias ja dominadas); projetos de pesquisa propria, inclusive
// a pesquisa preparatoria de descobertas cuja data historica se aproxima; desenvolvimento independente de tecnologias
// que ja existem em outros paises; e adaptacao do conhecimento a producao em larga escala (fabricas, materias-primas,
// mao de obra especializada, infraestrutura e capital).
import { clamp } from '../../core/math';
import { eraOfYear } from '../../data/eras';
import { historicalAdvancement, newWorldFactor, scientificTradition } from '../../data/historicalCenters';
import { incomeLevel } from '../../data/income';
import { TECHNOLOGIES, type EraId, type TechCategory, type Technology } from '../../data/technologies';
import type { Country, ScienceState, TechAcquisition, TechHolding } from '../../state/types';
import type { Simulation } from '../Simulation';
import type { TechnologyEngine } from './TechnologyEngine';

// Antes da data historica, a pesquisa pode avancar ate aqui; a conclusao so ocorre a partir do ano da tecnologia.
export const PREPARATION_LIMIT = 0.9;

// Fracao do PIB anual gasta com pesquisa em cada era.
const RESEARCH_SHARE: Record<EraId, number> = {
  medieval: 0.001, moderna: 0.002, primeira_revolucao: 0.003, segunda_revolucao: 0.005, terceira_revolucao: 0.008, quarta_revolucao: 0.01,
};

// Categorias que dependem de fabricas para produzir em escala.
const INDUSTRIAL = new Set<TechCategory>([
  'Metalurgia', 'Química', 'Energia', 'Transporte', 'Eletrônica', 'Indústria', 'Militar', 'Materiais', 'Computação', 'Tecnologia Digital', 'Tecnologia Espacial',
]);

// Alfabetizacao tipica de uma sociedade avancada em cada epoca.
const LITERACY: [number, number][] = [[476, 0.05], [1000, 0.06], [1450, 0.1], [1600, 0.15], [1750, 0.25], [1850, 0.4], [1950, 0.75], [2000, 0.9], [2025, 0.95]];

function literacyOf(year: number): number {
  if (year <= LITERACY[0][0]) return LITERACY[0][1];
  for (let i = 1; i < LITERACY.length; i++) {
    if (year <= LITERACY[i][0]) {
      const [y0, l0] = LITERACY[i - 1];
      const [y1, l1] = LITERACY[i];
      return l0 + ((l1 - l0) * (year - y0)) / (y1 - y0);
    }
  }
  return LITERACY[LITERACY.length - 1][1];
}

// Base cientifica de um pais recem-criado (ajustada pela inicializacao do mundo ou pela heranca do pais de origem).
export function emptyScience(): ScienceState {
  return {
    education: 0.05, universities: 0, scientists: 0, capacity: 0, industrialization: 0, intelligence: 0.1, security: 0.15,
    spending: 0, techIncome: 0, techCosts: 0, nextTrade: 0, nextEspionage: 365,
  };
}

export class TechnologyResearchEngine {
  private reference = 1;
  private avgGdppc = 1;

  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  maxUniversities(c: Country): number {
    return Math.floor(Math.sqrt(Math.max(0, c.population) / 200000) * (0.3 + c.science.education) * 2);
  }

  // Base cientifica inicial: educacao e universidades conforme a tradicao da cultura na epoca.
  initialize(): void {
    const sim = this.sim;
    const year = sim.state.startYear;
    for (const c of sim.state.countries) {
      if (!c.alive) continue;
      const adv = historicalAdvancement(c.culture, incomeLevel(sim.map.nations[c.id]?.income ?? ''), year, c.continent);
      const s = c.science;
      s.education = clamp(literacyOf(year) * (0.35 + 0.65 * adv), 0.01, 0.97);
      s.universities = this.tech.ownership.knows(c, 'university') ? Math.round(this.maxUniversities(c) * (0.3 + 0.5 * adv)) : 0;
      s.intelligence = clamp(0.1 + adv * 0.3, 0, 1);
      s.security = clamp(0.15 + adv * 0.3, 0, 1);
      s.nextTrade = sim.rng.int(0, 180);
      s.nextEspionage = sim.rng.int(90, 900);
    }
    this.updateCapacities();
  }

  private rawCapacity(c: Country): number {
    const s = c.science;
    const fx = this.tech.fx(c);
    const pop = Math.max(1e4, c.population);
    // Paises grandes sustentam mais cientistas, laboratorios e projetos simultaneos.
    const size = Math.pow(Math.max(0.3, Math.log10(pop) - 4.5), 1.3);
    const base = Math.pow(0.02 + s.education, 1.1) * (1 + 0.25 * Math.pow(Math.min(s.universities, 40), 0.6)) * size;
    const gdppc = c.population > 0 ? c.gdp / c.population : 0;
    const wealth = Math.sqrt(clamp(gdppc / Math.max(1e-6, this.avgGdppc), 0.3, 2.5));
    const stability = 0.4 + c.stability / 166;
    const infra = 0.4 + Math.min(0.8, this.tech.devIndex(c) / 15);
    const funding = c.treasury > 0 || c.income >= c.expenses ? 1 : 0.6;
    const mods = c.modifiers.reduce((acc, m) => acc + (m.research ?? 0), 0);
    // Tradicao cientifica da cultura na epoca (redes de sabios, academias, escolas, circulacao de livros).
    const year = this.sim.year();
    const tradition = 0.3 + 0.7 * scientificTradition(c.culture, year) * newWorldFactor(c.continent, year);
    return base * wealth * stability * infra * funding * tradition * Math.max(0.2, 1 + fx.research + mods);
  }

  // Capacidade relativa: 1,5 equivale a media dos tres paises mais avancados do mundo na epoca.
  updateCapacities(): void {
    const sim = this.sim;
    const nations = sim.countries.nations();
    let total = 0;
    for (const c of nations) total += c.population > 0 ? c.gdp / c.population : 0;
    this.avgGdppc = nations.length ? Math.max(1e-6, total / nations.length) : 1;
    const raws = new Map<number, number>();
    for (const c of nations) raws.set(c.id, this.rawCapacity(c));
    const top = [...raws.values()].sort((a, b) => b - a).slice(0, 3);
    this.reference = Math.max(1e-6, top.reduce((a, b) => a + b, 0) / Math.max(1, top.length));
    for (const c of nations) {
      const s = c.science;
      s.capacity = clamp(((raws.get(c.id) ?? 0) / this.reference) * 1.5, 0, 4);
      s.scientists = Math.round(c.population * s.education * (0.00003 + 0.00001 * Math.sqrt(s.universities)));
    }
  }

  monthly(): void {
    const sim = this.sim;
    this.updateCapacities();
    const year = sim.year();
    const month = sim.date().month;
    const share = RESEARCH_SHARE[eraOfYear(year).id];
    for (const c of sim.countries.nations()) {
      if ((c.id + month) % 6 === 0) this.chooseProjects(c, year);
      const capex = this.advance(c, year);
      c.science.spending = (Math.max(0, c.gdp) / 12) * share * (c.treasury > 0 ? 1 : 0.5) + capex;
    }
  }

  // Avanca projetos de pesquisa e adaptacoes produtivas; retorna o investimento mensal em fabricas.
  private advance(c: Country, year: number): number {
    const s = c.science;
    let capex = 0;
    const projects: [Technology, TechHolding][] = [];
    const adapting: [Technology, TechHolding][] = [];
    for (const id in c.techs) {
      const h = c.techs[id];
      if (h.stage === 'producao' || (h.stage === 'importacao' && h.progress <= 0)) continue;
      const t = TECHNOLOGIES.get(id);
      if (!t) continue;
      if (h.stage === 'conhecimento') adapting.push([t, h]);
      else projects.push([t, h]);
    }
    const nations = this.tech.nationCount();
    const k = Math.max(1, projects.length);
    for (const [t, h] of projects) {
      const rec = this.tech.record(t.id);
      let ease = 1;
      if (rec.discovered && rec.holders > 0) {
        // Saber que a tecnologia existe, estudar seus produtos e sua literatura acelera a pesquisa.
        ease = (1 + 2 * (rec.holders / Math.max(1, nations))) * (this.tech.ownership.openHolders(t.id) > 0 ? 1 : 0.5);
      }
      h.progress += (s.capacity / k / Math.max(1, t.tempoParaDominar)) * ease;
      const limit = t.anoDescoberta > year || !rec.discovered ? PREPARATION_LIMIT : 1;
      if (h.progress >= limit) {
        h.progress = limit;
        if (limit === 1) this.tech.ownership.grantKnowledge(c, t, this.completionSource(c, t), -1);
      }
    }
    for (const [t, h] of adapting) capex += this.adapt(c, t, h);
    return capex;
  }

  // Pesquisa propria quando ha vizinhos ou parceiros que dominam e compartilham; desenvolvimento independente quando nao.
  private completionSource(c: Country, t: Technology): TechAcquisition {
    const m = this.tech.ownership.matrixOf(t.id);
    if (m) {
      for (const n of this.sim.countries.neighbors(c.id)) if (m[n] === 2) return 'pesquisa';
      for (const n of this.sim.diplomacy.partners(c.id, 'trade')) if (m[n] === 2) return 'pesquisa';
    }
    return 'independente';
  }

  // Do conhecimento a producao: exige infraestrutura, materias-primas, industria, mao de obra e capital.
  private adapt(c: Country, t: Technology, h: TechHolding): number {
    const sim = this.sim;
    for (const tag of t.infraestruturaNecessaria) if (!this.tech.infraSatisfied(c, tag, 'production')) return 0;
    const s = c.science;
    const industrial = INDUSTRIAL.has(t.categoria) ? 0.35 + s.industrialization * 0.9 : 0.6 + s.education * 0.6;
    const resources = this.tech.resourceAccess(c, t);
    const labor = 0.5 + s.education * 0.8;
    const gdppc = sim.economy.gdpPerCapita(c);
    const monthlyCapex = (t.custoBase * gdppc * 0.25) / Math.max(1, t.tempoParaProduzir);
    const funded = c.treasury > monthlyCapex * 3;
    const know = h.source === 'licenciamento' || h.source === 'investimento' || h.source === 'transferencia' ? 1.5 : h.source === 'roubo' || h.source === 'espionagem' ? 0.7 : 1;
    h.progress += (1 / Math.max(1, t.tempoParaProduzir)) * industrial * resources * labor * (funded ? 1 : 0.4) * know;
    if (h.progress >= 1) this.tech.ownership.setProduction(c, t);
    return funded ? monthlyCapex : monthlyCapex * 0.3;
  }

  private categoryWeight(c: Country, category: TechCategory): number {
    const p = c.personality;
    let w = 1;
    if (category === 'Militar') {
      if (p === 'militarist' || p === 'expansionist' || p === 'imperialist') w *= 1.6;
      else if (p === 'defensive') w *= 1.2;
      else if (p === 'pacifist') w *= 0.6;
      if (this.sim.index.isAtWar(c.id)) w *= 1.5;
    } else if (category === 'Construção' && p === 'defensive') {
      w *= 1.3;
    } else if ((category === 'Indústria' || category === 'Transporte' || category === 'Navegação' || category === 'Tecnologia Digital') && p === 'commercial') {
      w *= 1.4;
    } else if ((category === 'Medicina' || category === 'Agricultura') && p === 'pacifist') {
      w *= 1.3;
    }
    return w;
  }

  // Escolhe novos projetos: tecnologias com dependencias dominadas, da data historica ate 12 anos no futuro.
  // Descobertas que ja passaram da data historica ganham prioridade crescente.
  private chooseProjects(c: Country, year: number): void {
    const s = c.science;
    const slots = clamp(1 + Math.floor(s.capacity * 1.5), 1, 5);
    let current = 0;
    for (const id in c.techs) if (c.techs[id].stage === 'pesquisa') current++;
    if (current >= slots) return;
    const limit = TECHNOLOGIES.countUntil(year + 12);
    const scored: { t: Technology; score: number }[] = [];
    for (let i = 0; i < limit; i++) {
      const t = TECHNOLOGIES.all[i];
      if (c.techs[t.id]) continue;
      if (!this.tech.ownership.depsKnown(c, t)) continue;
      if (t.substituidaPor.some((id) => this.tech.ownership.knows(c, id))) continue;
      const rec = this.tech.record(t.id);
      if (rec.discovered && year < 1850 && year - rec.discoveryYear < 100 && !this.exposed(c, t.id)) continue;
      const time = t.anoDescoberta > year ? 0.8 : !rec.discovered ? 2.2 + Math.min(6, (year - t.anoDescoberta) / 3) : 1 + Math.min(1.5, (year - rec.discoveryYear) / 25);
      scored.push({ t, score: t.valorEstrategico * this.categoryWeight(c, t.categoria) * time / (1 + t.tempoParaDominar / 120) });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { t } of scored.slice(0, slots - current)) this.tech.ownership.startResearch(c, t);
  }

  // Antes da era industrial, so se pesquisa o que foi visto em vizinhos, parceiros ou aliados (ou o que ja e muito antigo).
  private exposed(c: Country, id: string): boolean {
    const m = this.tech.ownership.matrixOf(id);
    if (!m) return false;
    for (const n of this.sim.countries.neighbors(c.id)) if (m[n]) return true;
    for (const n of this.sim.diplomacy.partners(c.id, 'trade')) if (m[n]) return true;
    for (const n of this.sim.diplomacy.partners(c.id, 'alliance')) if (m[n]) return true;
    return false;
  }

  // Grande avanco cientifico (evento): acelera o projeto mais adiantado.
  breakthrough(c: Country): Technology | null {
    const year = this.sim.year();
    if (!Object.values(c.techs).some((h) => h.stage === 'pesquisa')) this.chooseProjects(c, year);
    let best: [Technology, TechHolding] | null = null;
    for (const id in c.techs) {
      const h = c.techs[id];
      const t = TECHNOLOGIES.get(id);
      if (!t || h.stage !== 'pesquisa') continue;
      if (!best || h.progress > best[1].progress) best = [t, h];
    }
    if (!best) return null;
    const [t, h] = best;
    const rec = this.tech.record(t.id);
    const limit = t.anoDescoberta > year || !rec.discovered ? PREPARATION_LIMIT : 1;
    h.progress = Math.min(limit, h.progress + 0.35);
    if (h.progress >= 1) this.tech.ownership.grantKnowledge(c, t, this.completionSource(c, t), -1);
    return t;
  }

  // Educacao, universidades, inteligencia e contraespionagem evoluem ano a ano.
  yearly(): void {
    const sim = this.sim;
    for (const c of sim.countries.nations()) {
      const s = c.science;
      const fx = this.tech.fx(c);
      const gdppc = c.population > 0 ? c.gdp / c.population : 0;
      const wealth = clamp(Math.log10(Math.max(1, gdppc) / 15) * 0.12, 0, 0.3);
      // Escolas e universidades dependem de cidades, estradas e renda: estados pouco desenvolvidos alfabetizam menos.
      const development = clamp(this.tech.devIndex(c) / 12, 0, 1);
      const target = clamp(0.02 + fx.education * 1.2 * (0.4 + 0.6 * development) + wealth, 0.01, 0.99) * (0.7 + c.stability / 333);
      s.education = clamp(s.education + (target - s.education) * 0.04, 0.005, 0.99);
      const max = this.maxUniversities(c);
      const cost = c.gdp * 0.004;
      if (this.tech.ownership.knows(c, 'university') && s.universities < max && c.stability > 30 && c.treasury > cost * 5 && sim.rng.chance(0.35)) {
        s.universities++;
        c.treasury -= cost;
      } else if (s.universities > max * 1.5 && s.universities > 0) {
        s.universities--;
      }
      const spy = c.personality === 'opportunist' || c.personality === 'militarist' || c.personality === 'imperialist' ? 0.1 : 0;
      const intelTarget = clamp(0.1 + s.education * 0.4 + fx.administration * 0.4 + spy, 0, 1);
      const securityTarget = clamp(0.15 + s.education * 0.35 + fx.administration * 0.4 + c.stability / 400, 0, 1);
      s.intelligence += (intelTarget - s.intelligence) * 0.1;
      s.security += (securityTarget - s.security) * 0.1;
    }
  }
}
