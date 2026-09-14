// ERA ENGINE: a era historica e definida pelo ano da simulacao. A mudanca de era so muda o contexto historico
// (nome, descricao e composicao dos custos); nenhuma tecnologia e liberada por ela.
import { eraOfYear, eraSpan, historicalEra, type HistoricalEra } from '../../data/eras';
import type { EraId } from '../../data/technologies';
import type { Simulation } from '../Simulation';

export class EraEngine {
  constructor(private sim: Simulation) {}

  current(): HistoricalEra {
    return eraOfYear(this.sim.year());
  }

  ofYear(year: number): HistoricalEra {
    return eraOfYear(year);
  }

  initialize(): void {
    this.sim.state.era = eraOfYear(this.sim.state.startYear).id;
  }

  yearly(): void {
    const sim = this.sim;
    const era = eraOfYear(sim.year());
    if (sim.state.era === era.id) return;
    const previous = sim.state.era ? historicalEra(sim.state.era as EraId) : null;
    sim.state.era = era.id;
    const from = previous ? ` Fica para trás a ${previous.name}.` : '';
    sim.history.add('era', `O mundo entra na ${era.name} (${eraSpan(era)}): ${era.description}${from}`, { importance: 3 });
  }

  // Composicao do custo de uma tecnologia na economia da epoca (ouro e trabalhadores, capital e maquinas, P&D...).
  costBreakdown(value: number, year = this.sim.year()): { label: string; value: number }[] {
    return eraOfYear(year).costComposition.map(([label, share]) => ({ label, value: value * share }));
  }
}
