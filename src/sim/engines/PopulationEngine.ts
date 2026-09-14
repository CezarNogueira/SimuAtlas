// POPULATION ENGINE: todo ano cada pais sorteia uma taxa natural de crescimento entre 1% e 1,5% ao ano.
// A taxa e dividida pelos meses com juros compostos e um ciclo sazonal que soma zero no ano (mais nascimentos
// e menos mortes na primavera, mais mortes no inverno; quase nada nos tropicos e na era moderna), de modo que
// doze meses nas mesmas condicoes fecham exatamente a taxa do ano. A taxa e ajustada as condicoes de cada pais
// (estabilidade, guerra, fome, escassez e inflacao descontrolada) e de cada estado (terra disponivel, ocupacao,
// destruicao e epidemias). A medicina reduz o peso das epidemias e da fome.
import { clamp } from '../../core/math';
import type { Country } from '../../state/types';
import type { Simulation } from '../Simulation';

export const POP_GROWTH_MIN = 0.01;
export const POP_GROWTH_MAX = 0.015;

// Taxa anual efetiva e o quanto cada condicao tira dela (fracoes ao ano).
export interface GrowthBreakdown {
  base: number; // taxa natural sorteada para o ano
  rate: number; // taxa efetiva
  stability: number;
  war: number;
  crowding: number; // falta de terras (populacao perto ou acima da capacidade)
  occupation: number;
  devastation: number;
  epidemic: number;
  hardship: number; // fome, escassez e inflacao descontrolada
}

interface NationalGrowth {
  base: number;
  stability: number; // multiplicador
  war: number; // multiplicador
  hardship: number; // fracao ao ano
  resilience: number; // parte do impacto de epidemias e fome que resta apos a medicina
}

export class PopulationEngine {
  constructor(private sim: Simulation) {}

  // Capacidade de sustento do estado: terra, tecnologia e desenvolvimento.
  capacity(pid: number): number {
    const sim = this.sim;
    const ps = sim.state.provinces[pid];
    const owner = ps.owner >= 0 ? sim.country(ps.owner) : null;
    const tech = owner ? owner.tech : sim.state.techBaseline;
    // Tecnicas agricolas (arados, rotacao de culturas, fertilizantes, Revolucao Verde) ampliam o sustento da terra.
    const agriculture = owner ? sim.technology.fx(owner).agriculture : 0;
    return ps.capacity * Math.pow(1.13, Math.max(-3, tech - sim.state.techBaseline)) * (0.8 + ps.development / 50) * (1 + agriculture * 0.5);
  }

  // Sorteia a taxa natural do ano (na criacao do pais e a cada virada de ano).
  drawGrowth(c: Country): void {
    c.popGrowthBase = this.sim.rng.float(POP_GROWTH_MIN, POP_GROWTH_MAX);
    c.popGrowthYear = this.sim.year();
  }

  private national(c: Country): NationalGrowth {
    const sim = this.sim;
    const resilience = 1 - Math.min(0.7, sim.technology.fx(c).medicine * 5);
    let mods = 0;
    for (const m of c.modifiers) if (m.growth && m.until > sim.day) mods += m.growth < 0 ? m.growth * resilience : m.growth;
    return {
      base: c.popGrowthBase ?? (POP_GROWTH_MIN + POP_GROWTH_MAX) / 2,
      // Instabilidade adia casamentos e desorganiza o abastecimento.
      stability: 0.75 + 0.25 * Math.min(1, c.stability / 50),
      // Homens na frente de batalha: menos nascimentos.
      war: sim.index.isAtWar(c.id) ? 0.95 : 1,
      hardship: mods - (c.inflation > 0.3 ? (c.inflation - 0.3) * 0.04 : 0),
      resilience,
    };
  }

  // Taxa anual efetiva de um estado. Com `out`, acumula as contribuicoes ponderadas pela populacao.
  private provinceRate(pid: number, n: NationalGrowth, out?: GrowthBreakdown): number {
    const ps = this.sim.state.provinces[pid];
    const crowd = ps.population / Math.max(1000, this.capacity(pid));
    // Terra disponivel: cresce livremente ate 80% da capacidade, desacelera ate parar em 130% e, alem disso, encolhe.
    const land = clamp((1.3 - crowd) / 0.5, 0, 1);
    const overcrowd = crowd > 1.3 ? -Math.min(0.01, (crowd - 1.3) * 0.02) : 0;
    const afterStability = n.base * n.stability;
    const afterWar = afterStability * n.war;
    const natural = afterWar * land;
    const withHardship = Math.min(POP_GROWTH_MAX, natural + n.hardship);
    const occupation = ps.controller !== ps.owner ? -0.006 : 0;
    const devastation = -ps.devastation * 0.008;
    const epidemic = ps.epidemic > 0 ? -0.09 * n.resilience : 0;
    const rate = clamp(withHardship + overcrowd + occupation + devastation + epidemic, -0.5, POP_GROWTH_MAX);
    if (out) {
      const w = ps.population;
      out.base += n.base * w;
      out.rate += rate * w;
      out.stability += (afterStability - n.base) * w;
      out.war += (afterWar - afterStability) * w;
      out.crowding += (natural - afterWar + overcrowd) * w;
      out.hardship += (withHardship - natural) * w;
      out.occupation += occupation * w;
      out.devastation += devastation * w;
      out.epidemic += epidemic * w;
    }
    return rate;
  }

  // Peso sazonal do mes (media 1 no ano): doze meses nas mesmas condicoes fecham exatamente a taxa anual.
  private monthWeight(pid: number, c: Country, month: number): number {
    const lat = this.sim.map.provinces[pid].lat;
    const amplitude = 0.35 * Math.min(1, Math.abs(lat) / 45) * Math.max(0.1, 1 - c.tech / 24);
    const peak = lat >= 0 ? 5 : 11; // fim da primavera em cada hemisferio
    return 1 + amplitude * Math.cos(((month - peak) * Math.PI) / 6);
  }

  // Crescimento populacional do pais agora (media dos estados ponderada pela populacao), para a interface.
  growthInfo(c: Country): GrowthBreakdown {
    const out: GrowthBreakdown = { base: 0, rate: 0, stability: 0, war: 0, crowding: 0, occupation: 0, devastation: 0, epidemic: 0, hardship: 0 };
    const n = this.national(c);
    let pop = 0;
    for (const pid of this.sim.index.ownedBy[c.id] ?? []) {
      this.provinceRate(pid, n, out);
      pop += this.sim.state.provinces[pid].population;
    }
    if (pop <= 0) return { ...out, base: n.base };
    for (const k of Object.keys(out) as (keyof GrowthBreakdown)[]) out[k] /= pop;
    return out;
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const year = sim.year();
    const month = sim.date().month;
    const nat: (NationalGrowth | undefined)[] = new Array(s.countries.length);
    for (const c of s.countries) {
      if (!c.alive) continue;
      if (c.popGrowthYear !== year) this.drawGrowth(c);
      nat[c.id] = this.national(c);
    }
    for (let pid = 0; pid < s.provinces.length; pid++) {
      const ps = s.provinces[pid];
      if (ps.owner < 0) continue;
      const n = nat[ps.owner];
      if (!n) continue;
      const rate = this.provinceRate(pid, n);
      ps.population = Math.max(500, ps.population * Math.pow(1 + rate, this.monthWeight(pid, s.countries[ps.owner], month) / 12));
    }
  }
}
