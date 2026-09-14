// GOVERNMENT ENGINE: governantes (envelhecimento, morte, sucessao), eleicoes,
// mudancas de forma de governo e ideologia.
import { GOVERNMENTS, type GovernmentId } from '../../data/governments';
import { IDEOLOGIES, IDEOLOGY_IDS } from '../../data/ideologies';
import type { Country } from '../../state/types';
import { agePt, newLeader } from '../names';
import type { Simulation } from '../Simulation';

export class GovernmentEngine {
  constructor(private sim: Simulation) {}

  private mapArea = 0;

  rulerTitle(c: Country): string {
    return GOVERNMENTS[c.government].rulerTitle;
  }

  // Grande potencia: ao menos 6% da area do mapa ou uma fatia grande dos estados.
  isGreatPower(c: Country): boolean {
    const map = this.sim.map;
    if (!this.mapArea) this.mapArea = map.provinces.reduce((acc, p) => acc + p.area, 0);
    return c.area >= this.mapArea * 0.06 || c.provinceCount >= Math.max(12, map.provinceCount * 0.05);
  }

  yearly(): void {
    const sim = this.sim;
    const rng = sim.rng;
    for (const c of sim.countries.nations()) {
      const gov = GOVERNMENTS[c.government];
      const age = agePt(c.ruler.birthDay, sim.day);
      const death = age < 40 ? 0.008 : age < 55 ? 0.02 : age < 65 ? 0.045 : age < 75 ? 0.09 : 0.18;
      if (rng.chance(death)) {
        this.succession(c, 'death');
      } else if (gov.electionYears > 0 && sim.day - c.lastElection >= gov.electionYears * 365) {
        this.election(c);
      }

      if (c.government === 'monarchy' && this.isGreatPower(c) && c.prestige >= 40 && rng.chance(0.08)) {
        const old = sim.countries.formalName(c.id);
        this.changeGovernment(c, 'empire', `${old} proclamou-se ${GOVERNMENTS.empire.name}: nasce o ${sim.countries.formalName(c.id)}.`, 3, false);
      } else if (c.tech >= 15 && ['monarchy', 'republic', 'empire'].includes(c.government) && c.happiness > 55 && c.stability > 55 && rng.chance(0.02)) {
        this.changeGovernment(c, 'democracy', `Reformas liberais transformaram ${sim.countries.formalName(c.id)} em uma democracia.`, 2, false);
      } else if (['republic', 'democracy'].includes(c.government) && c.provinceCount >= 15 && rng.chance(0.015)) {
        this.changeGovernment(c, 'federation', `${c.name} adotou uma constituição federal.`, 2, false);
      }

      if (rng.chance(0.03)) {
        const options = IDEOLOGY_IDS.filter((id) => IDEOLOGIES[id].minTech <= c.tech && id !== c.ideology);
        if (options.length) {
          const pick = rng.weighted(options, (id) => 1 + IDEOLOGIES[id].minTech / 5) ?? options[0];
          c.ideology = pick;
          sim.history.add('government', `${c.name} passou a seguir o ${IDEOLOGIES[pick].name}.`, { countries: [c.id], importance: 1 });
        }
      }

      c.generals = c.generals.filter((g) => agePt(g.birthDay, sim.day) < 72 || g.army >= 0);
    }
  }

  succession(c: Country, reason: 'death' | 'assassination' | 'coup' | 'abdication'): void {
    const sim = this.sim;
    const old = c.ruler;
    const gov = GOVERNMENTS[c.government];
    const hereditary = gov.electionYears === 0;
    const keepHouse = hereditary && reason !== 'coup' && sim.rng.chance(0.85);
    c.ruler = newLeader(sim.rng, c.culture, sim.day, sim.nextId('person'), c.regnalCount, keepHouse ? old.house : undefined);
    const title = gov.rulerTitle;
    const verb = reason === 'assassination' ? 'foi assassinado' : reason === 'coup' ? 'foi deposto' : reason === 'abdication' ? 'abdicou' : 'morreu';
    sim.history.add('ruler', `${title} ${old.name} ${sim.countries.de(c.id)} ${verb}. ${c.ruler.name} (casa ${c.ruler.house}) assume o poder.`, {
      countries: [c.id],
      importance: reason === 'death' ? 1 : 2,
    });
    if (hereditary && !keepHouse) {
      c.stability = Math.max(0, c.stability - 12);
      if (c.stability < 25 && c.provinceCount >= 4 && sim.rng.chance(0.15)) sim.rebellion.startCivilWar(c, 'a crise de sucessão');
    }
  }

  election(c: Country): void {
    const sim = this.sim;
    c.lastElection = sim.day;
    c.ruler = newLeader(sim.rng, c.culture, sim.day, sim.nextId('person'));
    c.stability = Math.min(100, c.stability + sim.rng.float(-3, 5));
    sim.history.add('ruler', `Eleições ${sim.countries.in(c.id)}: ${c.ruler.name} torna-se ${GOVERNMENTS[c.government].rulerTitle}.`, {
      countries: [c.id],
      importance: 1,
    });
  }

  changeGovernment(c: Country, gov: GovernmentId, text: string, importance: 1 | 2 | 3, newRuler: boolean): void {
    const sim = this.sim;
    if (c.government === gov) return;
    c.government = gov;
    c.corruption = (c.corruption + GOVERNMENTS[gov].corruption) / 2;
    c.lastElection = sim.day;
    if (newRuler) c.ruler = newLeader(sim.rng, c.culture, sim.day, sim.nextId('person'));
    if (text) sim.history.add('government', text, { countries: [c.id], importance });
    sim.bus.emit('countryChanged', { country: c.id });
  }
}
