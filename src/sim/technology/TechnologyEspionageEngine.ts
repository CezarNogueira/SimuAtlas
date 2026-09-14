// TECHNOLOGY ESPIONAGE ENGINE: tentativas de roubar tecnologias guardadas em segredo ou caras demais. A chance
// depende da inteligencia do espiao, da seguranca do alvo, das relacoes diplomaticas (embaixadas e acesso), da
// importancia da tecnologia (quanto mais estrategica, mais protegida), da distancia e dos recursos investidos.
import { clamp } from '../../core/math';
import { TECHNOLOGIES, type Technology } from '../../data/technologies';
import type { Country } from '../../state/types';
import type { Simulation } from '../Simulation';
import { PREPARATION_LIMIT } from './TechnologyResearchEngine';
import type { TechnologyEngine } from './TechnologyEngine';

const AGGRESSIVE = new Set(['opportunist', 'militarist', 'imperialist', 'expansionist']);

export class TechnologyEspionageEngine {
  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  monthly(): void {
    const sim = this.sim;
    for (const c of sim.countries.nations()) {
      if (!c.ai || c.science.nextEspionage > sim.day) continue;
      c.science.nextEspionage = sim.day + Math.round(sim.rng.int(540, 1440) * (AGGRESSIVE.has(c.personality) ? 0.7 : 1.2));
      // Servicos de espionagem exigem educacao, inteligencia e uma economia minimamente relevante.
      if (c.science.education < 0.12 || c.science.intelligence < 0.3 || c.treasury <= 0 || c.gdp < this.tech.trade.worldGdp() * 0.3) continue;
      const target = this.chooseTarget(c);
      if (target) this.attempt(c, target.victim, target.t);
    }
  }

  private chooseTarget(c: Country): { victim: Country; t: Technology } | null {
    const sim = this.sim;
    const count = TECHNOLOGIES.countUntil(sim.year());
    let best: { victim: Country; t: Technology; score: number } | null = null;
    for (let tries = 0; tries < 30; tries++) {
      const t = TECHNOLOGIES.all[sim.rng.int(0, Math.max(0, count - 1))];
      if (!t || t.valorEstrategico < 5) continue;
      const rec = this.tech.record(t.id);
      if (!rec.discovered || rec.producers === 0 || this.tech.ownership.knows(c, t.id) || !this.tech.ownership.depsKnown(c, t)) continue;
      const m = this.tech.ownership.matrixOf(t.id);
      if (!m) continue;
      for (const v of sim.countries.nations()) {
        if (v.id === c.id || !m[v.id] || v.techs[t.id]?.stage !== 'producao' || !this.tech.inContact(c, v)) continue;
        const rel = sim.diplomacy.relation(c.id, v.id);
        const secret = m[v.id] === 1;
        const expensive = this.tech.trade.price(t, v, c) > c.treasury * 0.5;
        if (!secret && !expensive) continue;
        const score = t.valorEstrategico * (secret ? 1.8 : 1) * (expensive ? 1.3 : 0.8) * (rel < -20 ? 1.5 : rel > 40 ? 0.6 : 1) * sim.rng.float(0.8, 1.2);
        if (!best || score > best.score) best = { victim: v, t, score };
      }
    }
    return best;
  }

  private attempt(spy: Country, victim: Country, t: Technology): void {
    const sim = this.sim;
    const rel = sim.diplomacy.relation(spy.id, victim.id);
    const secret = victim.techs[t.id]?.policy === 'segredo';
    const security = victim.science.security + (secret ? 0.25 : 0);
    const access = clamp(1 + rel / 300, 0.6, 1.3);
    const importance = 1.25 - t.valorEstrategico * 0.06;
    const distance = sim.countries.neighbors(spy.id).has(victim.id) ? 1.2 : spy.continent && spy.continent === victim.continent ? 1 : 0.75;
    const price = this.tech.trade.price(t, victim, spy);
    const spend = Math.min(spy.treasury * 0.05, price * 0.06);
    spy.treasury -= spend;
    spy.science.techCosts += spend;
    const investment = clamp(spend / Math.max(1, price * 0.04), 0.5, 1.5);
    // Economias pequenas nao sustentam redes de espionagem contra potencias.
    const resources = Math.sqrt(clamp(spy.gdp / Math.max(1, victim.gdp), 0.1, 1));
    const chance = clamp((0.3 * spy.science.intelligence) / Math.max(0.1, security) * access * importance * distance * investment * resources, 0.01, 0.6);
    if (sim.rng.next() < chance) {
      if (sim.rng.chance(0.55)) {
        this.tech.ownership.grantKnowledge(spy, t, 'roubo', victim.id);
      } else {
        // Espionagem parcial: documentos e projetos aceleram a pesquisa propria.
        if (!spy.techs[t.id]) this.tech.ownership.startResearch(spy, t);
        const h = spy.techs[t.id];
        if (h && (h.stage === 'pesquisa' || h.stage === 'importacao')) h.progress = Math.min(PREPARATION_LIMIT + 0.05, h.progress + 0.4);
        this.tech.history.espionagePartial(spy, victim, t);
      }
      return;
    }
    if (sim.rng.chance(0.5)) {
      sim.diplomacy.addRelation(spy.id, victim.id, -25);
      this.tech.history.espionageFailed(spy, victim, t);
    }
  }
}
