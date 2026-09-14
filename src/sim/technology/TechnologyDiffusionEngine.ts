// TECHNOLOGY DIFFUSION ENGINE: espalhamento gradual do conhecimento. Aliados transferem, parceiros comerciais e
// vizinhos trocam experiencias, universidades absorvem publicacoes e cientistas emigram de paises em guerra ou
// instaveis. A chance cresce com a idade da tecnologia, a proximidade de quem a domina, a educacao e as
// universidades de quem aprende, e cai quando os detentores guardam segredo. Tambem marca tecnologias obsoletas.
import { eraOfYear } from '../../data/eras';
import { TECHNOLOGIES, type EraId } from '../../data/technologies';
import type { Country, TechAcquisition } from '../../state/types';
import type { Simulation } from '../Simulation';
import { MARKET_HALF_LIFE } from './TechnologyTradeEngine';
import type { TechnologyEngine } from './TechnologyEngine';

const BASE_CHANCE = 0.006; // por trimestre, por unidade de exposicao
// O conhecimento viajava devagar na Idade Media (copistas, caravanas) e quase instantaneamente no seculo XXI.
const ERA_SPEED: Record<EraId, number> = {
  medieval: 0.25, moderna: 0.4, primeira_revolucao: 0.7, segunda_revolucao: 1, terceira_revolucao: 1.4, quarta_revolucao: 2,
};
const MAX_GRANTS_PER_CHECK = 2;

export class TechnologyDiffusionEngine {
  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  monthly(): void {
    const sim = this.sim;
    const month = sim.date().month;
    const year = sim.year();
    const count = TECHNOLOGIES.countUntil(year);
    const nations = Math.max(1, this.tech.nationCount());
    for (const c of sim.countries.nations()) {
      if ((c.id + month) % 3 !== 0) continue;
      this.diffuseTo(c, year, count, nations);
    }
  }

  private diffuseTo(c: Country, year: number, count: number, nations: number): void {
    const sim = this.sim;
    const s = c.science;
    const neighbors = sim.countries.neighbors(c.id);
    const allies = sim.diplomacy.partners(c.id, 'alliance');
    const traders = sim.diplomacy.partners(c.id, 'trade');
    const absorption = (0.2 + s.education) * (1 + Math.sqrt(s.universities) * 0.15) * (0.5 + c.stability / 200) * ERA_SPEED[eraOfYear(year).id];
    // Alcance do conhecimento que circula pelo mundo (livros, viajantes, imprensa) alem de vizinhos e parceiros.
    const reach = year >= 1850 ? 1 : year >= 1760 ? 0.6 : 0.25;
    let grants = 0;
    for (let i = 0; i < count && grants < MAX_GRANTS_PER_CHECK; i++) {
      const t = TECHNOLOGIES.all[i];
      const rec = this.tech.record(t.id);
      if (!rec.discovered || rec.holders === 0 || this.tech.ownership.knows(c, t.id)) continue;
      const m = this.tech.ownership.matrixOf(t.id);
      if (!m) continue;
      let near = 0;
      let from = -1;
      let channel: TechAcquisition = 'intercambio';
      for (const n of allies) {
        if (m[n] === 2) {
          near += 1;
          if (from < 0) {
            from = n;
            channel = 'transferencia';
          }
        } else if (m[n] === 1) near += 0.1;
      }
      for (const n of traders) {
        if (m[n] === 2) {
          near += 0.8;
          if (from < 0) from = n;
        } else if (m[n] === 1) near += 0.08;
      }
      for (const n of neighbors) {
        if (m[n] === 2) {
          near += 0.5;
          if (from < 0) {
            from = n;
            const origin = sim.country(n);
            if (sim.index.isAtWar(n) || origin.stability < 30) channel = 'migracao';
          }
        } else if (m[n] === 1) near += 0.05;
      }
      const share = rec.holders / nations;
      if (near === 0 && share * reach < 0.25) continue;
      if (!this.tech.ownership.depsKnown(c, t)) continue;
      const age = Math.max(0, year - rec.discoveryYear);
      const ageFactor = Math.min(1.5, 0.15 + age / MARKET_HALF_LIFE[t.era]);
      const secrecy = this.tech.ownership.openHolders(t.id) === 0 ? 0.25 : 1;
      const chance = Math.min(0.25, BASE_CHANCE * (near + share * 2 * reach) * absorption * ageFactor * secrecy);
      if (!sim.rng.chance(chance)) continue;
      if (from < 0) channel = s.universities >= 3 && s.education >= 0.35 ? 'universidades' : 'intercambio';
      else if (channel === 'intercambio' && s.universities >= 5 && sim.rng.chance(0.3)) channel = 'universidades';
      if (this.tech.ownership.grantKnowledge(c, t, channel, channel === 'universidades' ? -1 : from)) grants++;
    }
  }

  // Uma tecnologia fica obsoleta quando a que a substitui ja e produzida por boa parte do mundo.
  yearly(): void {
    const nations = this.tech.nationCount();
    for (const t of TECHNOLOGIES.all) {
      if (!t.substitui.length) continue;
      const rec = this.tech.record(t.id);
      if (rec.producers < Math.max(3, nations * 0.25)) continue;
      for (const old of t.substitui) {
        const oldRec = this.tech.record(old);
        if (!oldRec || oldRec.obsolete) continue;
        oldRec.obsolete = true;
        this.tech.history.log(old, 'obsoleta', rec.discoverer, -1, null);
      }
    }
  }
}
