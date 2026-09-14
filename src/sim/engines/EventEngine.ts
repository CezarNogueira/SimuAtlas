// EVENT ENGINE: sorteia eventos historicos aleatorios para cada nacao a cada mes.
import { EVENTS, type EventContext } from '../events/definitions';
import type { Simulation } from '../Simulation';

export class EventEngine {
  constructor(private sim: Simulation) {}

  monthly(): void {
    const sim = this.sim;
    const freq = sim.state.settings.eventFrequency;
    if (freq <= 0) return;
    for (const c of [...sim.state.countries]) {
      if (!c.alive || c.kind !== 'nation' || c.provinceCount === 0) continue;
      const ctx: EventContext = { sim, c, rng: sim.rng };
      for (const def of EVENTS) {
        const w = def.weight ? def.weight(ctx) : 1;
        if (w <= 0) continue;
        if (sim.rng.chance(def.chance * w * freq)) {
          def.apply(ctx);
          break;
        }
      }
    }
  }

  // Dispara um evento especifico (usado pelo painel de acoes do jogador).
  trigger(eventId: string, countryId: number): boolean {
    const def = EVENTS.find((e) => e.id === eventId);
    const c = this.sim.country(countryId);
    if (!def || !c?.alive || c.kind !== 'nation') return false;
    def.apply({ sim: this.sim, c, rng: this.sim.rng });
    return true;
  }
}
