// EVENT ENGINE: a cada mes ha uma chance fixa de acontecer um evento historico aleatorio no mundo.
import { EVENT_MONTHLY_CHANCE, type Country } from '../../state/types';
import { EVENTS, type EventDefinition } from '../events/definitions';
import type { Simulation } from '../Simulation';

export class EventEngine {
  constructor(private sim: Simulation) {}

  // O evento do mes e sorteado entre todas as nacoes, na proporcao da chance base de cada definicao e do seu
  // peso no contexto do pais (uma crise economica e mais provavel num pais endividado, uma revolta num instavel).
  monthly(): void {
    const sim = this.sim;
    if (!sim.rng.chance(EVENT_MONTHLY_CHANCE)) return;
    const pool: { c: Country; def: EventDefinition; w: number }[] = [];
    let total = 0;
    for (const c of sim.state.countries) {
      if (!c.alive || c.kind !== 'nation' || c.provinceCount === 0) continue;
      const ctx = { sim, c, rng: sim.rng };
      for (const def of EVENTS) {
        const w = def.chance * (def.weight ? def.weight(ctx) : 1);
        if (!(w > 0)) continue;
        pool.push({ c, def, w });
        total += w;
      }
    }
    if (!pool.length) return;
    let r = sim.rng.next() * total;
    let i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
    pool[i].def.apply({ sim, c: pool[i].c, rng: sim.rng });
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
