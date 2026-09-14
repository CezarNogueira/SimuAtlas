// HISTORY ENGINE: cronologia de todos os acontecimentos do mundo.
import type { HistoryEntry, HistoryType } from '../../state/types';
import type { Simulation } from '../Simulation';

const MAX_ENTRIES = 40000;

export interface HistoryOptions {
  countries?: number[];
  province?: number;
  war?: number;
  battle?: number;
  importance?: 1 | 2 | 3;
}

export const HISTORY_TYPE_NAMES: Record<HistoryType, string> = {
  start: 'Início',
  war_declared: 'Declaração de guerra',
  war_joined: 'Entrada em guerra',
  war_ended: 'Fim de guerra',
  battle: 'Batalha',
  conquest: 'Conquista',
  capital_fall: 'Queda de capital',
  peace: 'Tratado de paz',
  alliance: 'Aliança',
  alliance_broken: 'Aliança rompida',
  treaty: 'Tratado',
  rebellion: 'Rebelião',
  independence: 'Independência',
  revolution: 'Revolução',
  civil_war: 'Guerra civil',
  coup: 'Golpe',
  government: 'Governo',
  ruler: 'Governante',
  event: 'Evento',
  economy: 'Economia',
  tech: 'Tecnologia',
  annexation: 'Anexação',
  collapse: 'Colapso',
  founded: 'Fundação',
  destroyed: 'Extinção',
  diplomacy: 'Diplomacia',
  disaster: 'Desastre',
};

export class HistoryEngine {
  constructor(private sim: Simulation) {}

  add(type: HistoryType, text: string, opts: HistoryOptions = {}): HistoryEntry {
    const s = this.sim.state;
    const entry: HistoryEntry = {
      id: this.sim.nextId('history'),
      day: s.day,
      type,
      text,
      countries: opts.countries ?? [],
      province: opts.province ?? -1,
      war: opts.war ?? -1,
      battle: opts.battle ?? -1,
      importance: opts.importance ?? 1,
    };
    s.history.push(entry);
    if (s.history.length > MAX_ENTRIES) {
      // Descarta primeiro os registros menos importantes mais antigos.
      const cut = s.history.slice(0, 8000).filter((e) => e.importance >= 2);
      s.history.splice(0, 8000, ...cut);
    }
    this.sim.bus.emit('history', entry);
    return entry;
  }

  forCountry(id: number, limit = 60): HistoryEntry[] {
    const out: HistoryEntry[] = [];
    const h = this.sim.state.history;
    for (let i = h.length - 1; i >= 0 && out.length < limit; i--) {
      if (h[i].countries.includes(id)) out.push(h[i]);
    }
    return out;
  }

  recent(limit = 100, minImportance = 1): HistoryEntry[] {
    const out: HistoryEntry[] = [];
    const h = this.sim.state.history;
    for (let i = h.length - 1; i >= 0 && out.length < limit; i--) {
      if (h[i].importance >= minImportance) out.push(h[i]);
    }
    return out;
  }
}
