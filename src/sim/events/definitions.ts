// Definicoes de eventos historicos aleatorios (data-driven). Cada evento declara chance mensal,
// peso contextual e efeitos. Para adicionar um evento, basta incluir um item em EVENTS.
import type { Rng } from '../../core/rng';
import { fmtInt } from '../../core/format';
import { CULTURES } from '../../data/cultures';
import { GOVERNMENTS, type GovernmentId } from '../../data/governments';
import { PERSONALITIES } from '../../data/personalities';
import { RELIGIONS, type ReligionId } from '../../data/religions';
import { RESOURCES, type ResourceId } from '../../data/resources';
import type { Country, CountryModifier } from '../../state/types';
import { newGeneral } from '../names';
import type { Simulation } from '../Simulation';

export interface EventContext {
  sim: Simulation;
  c: Country;
  rng: Rng;
}

export type EventCategory = 'economia' | 'política' | 'social' | 'desastre' | 'descoberta' | 'militar';

export interface EventDefinition {
  id: string;
  name: string;
  category: EventCategory;
  chance: number; // probabilidade mensal base
  weight?: (ctx: EventContext) => number;
  apply: (ctx: EventContext) => void;
}

const YEAR = 365;

function modifier(ctx: EventContext, id: string, name: string, years: number, fields: Partial<CountryModifier>): void {
  ctx.c.modifiers = ctx.c.modifiers.filter((m) => m.id !== id);
  ctx.c.modifiers.push({ id, name, until: ctx.sim.day + Math.round(years * YEAR), ...fields });
}

function owned(ctx: EventContext): number[] {
  return ctx.sim.index.ownedBy[ctx.c.id] ?? [];
}

function randomProvince(ctx: EventContext, filter?: (p: number) => boolean): number {
  const list = filter ? owned(ctx).filter(filter) : owned(ctx);
  return list.length ? ctx.rng.pick(list) : -1;
}

function hottest(ctx: EventContext, filter?: (p: number) => boolean): number {
  let best = -1;
  let bv = -1;
  for (const p of owned(ctx)) {
    if (filter && !filter(p)) continue;
    const u = ctx.sim.state.provinces[p].unrest;
    if (u > bv) {
      bv = u;
      best = p;
    }
  }
  return best;
}

function avgUnrest(ctx: EventContext): number {
  const list = owned(ctx);
  if (!list.length) return 0;
  return list.reduce((acc, p) => acc + ctx.sim.state.provinces[p].unrest, 0) / list.length;
}

function nonCoreShare(ctx: EventContext): number {
  const list = owned(ctx);
  if (!list.length) return 0;
  return list.filter((p) => !ctx.sim.state.provinces[p].cores.includes(ctx.c.id)).length / list.length;
}

const imp = (c: Country): 1 | 2 => (c.provinceCount >= 6 ? 2 : 1);
const cityOf = (ctx: EventContext, p: number) => ctx.sim.provinces.cityName(p);

function history(ctx: EventContext, text: string, importance: 1 | 2 | 3, province = -1, type: 'event' | 'economy' | 'disaster' | 'coup' | 'government' | 'tech' | 'annexation' = 'event'): void {
  ctx.sim.history.add(type, text, { countries: [ctx.c.id], province, importance });
}

function diseaseName(tech: number, rng: Rng): string {
  if (tech < 10) return rng.pick(['peste negra', 'varíola', 'tifo']);
  if (tech < 16) return rng.pick(['cólera', 'varíola', 'febre amarela']);
  return rng.pick(['gripe', 'tuberculose', 'uma nova gripe']);
}

const REFORM_PATHS: Record<GovernmentId, GovernmentId[]> = {
  monarchy: ['republic', 'theocracy', 'empire'],
  empire: ['monarchy', 'federation'],
  republic: ['democracy', 'federation', 'dictatorship'],
  democracy: ['republic', 'federation'],
  dictatorship: ['republic', 'democracy'],
  theocracy: ['republic', 'monarchy'],
  federation: ['democracy', 'confederation'],
  confederation: ['federation', 'republic'],
};

export const EVENTS: EventDefinition[] = [
  {
    id: 'economic_crisis', name: 'Crise econômica', category: 'economia', chance: 0.0025,
    weight: ({ c }) => 1 + Math.min(3, (c.debt / Math.max(1, c.gdp)) * 2) + (c.inflation > 0.15 ? 1 : 0),
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      modifier(ctx, 'crisis', 'Crise econômica', 4, { economy: -0.15, stability: -6 });
      c.unemployment = Math.min(0.5, c.unemployment + 0.05);
      c.stability = Math.max(0, c.stability - 8);
      history(ctx, `Crise econômica ${sim.countries.in(c.id)}: o PIB despenca e o desemprego dispara.`, imp(c), -1, 'economy');
      for (const partner of sim.diplomacy.partners(c.id, 'trade')) {
        const p = sim.country(partner);
        if (p.alive && rng.chance(0.3)) {
          p.modifiers.push({ id: 'crisis_contagion', name: 'Contágio da crise', until: sim.day + 2 * YEAR, economy: -0.07 });
          sim.history.add('economy', `A crise ${sim.countries.de(c.id)} contagiou a economia ${sim.countries.de(partner)}.`, { countries: [partner, c.id], importance: 1 });
        }
      }
    },
  },
  {
    id: 'economic_boom', name: 'Grande crescimento econômico', category: 'economia', chance: 0.002,
    weight: ({ sim, c }) => (c.stability / 50) * (1 + sim.diplomacy.partners(c.id, 'trade').length * 0.2) * (sim.index.isAtWar(c.id) ? 0.3 : 1),
    apply: (ctx) => {
      const { c, sim } = ctx;
      modifier(ctx, 'boom', 'Prosperidade', 5, { economy: 0.12 });
      c.happiness = Math.min(100, c.happiness + 8);
      history(ctx, `Era de prosperidade ${sim.countries.in(c.id)}: comércio e produção crescem como nunca.`, imp(c), -1, 'economy');
    },
  },
  {
    id: 'popular_revolt', name: 'Revolta popular', category: 'social', chance: 0.003,
    weight: (ctx) => Math.pow(avgUnrest(ctx) / 30, 2) * (1 - ctx.c.stability / 100),
    apply: (ctx) => {
      const p = hottest(ctx, (q) => ctx.sim.state.provinces[q].controller === ctx.c.id);
      if (p < 0) return;
      history(ctx, `Revolta popular eclode em ${cityOf(ctx, p)} contra o governo ${ctx.sim.countries.de(ctx.c.id)}.`, 1, p);
      ctx.sim.rebellion.spawnRevolt(ctx.c, p);
    },
  },
  {
    id: 'separatist_revolt', name: 'Revolta separatista', category: 'política', chance: 0.002,
    weight: (ctx) => nonCoreShare(ctx) * 3 + (avgUnrest(ctx) > 40 ? 0.5 : 0),
    apply: (ctx) => {
      const p = hottest(ctx, (q) => !ctx.sim.state.provinces[q].cores.includes(ctx.c.id) && ctx.sim.state.provinces[q].controller === ctx.c.id);
      if (p < 0) return;
      ctx.sim.rebellion.spawnRevolt(ctx.c, p, 'separatist');
    },
  },
  {
    id: 'coup', name: 'Golpe de Estado', category: 'política', chance: 0.0012,
    weight: ({ c }) => (c.stability < 40 ? (40 - c.stability) / 20 : 0) * (c.government === 'democracy' ? 0.5 : c.government === 'dictatorship' ? 1.5 : 1),
    apply: (ctx) => {
      const { c, sim } = ctx;
      const old = GOVERNMENTS[c.government].name;
      sim.government.changeGovernment(c, 'dictatorship', '', 3, true);
      c.stability = Math.max(20, c.stability + 10);
      c.corruption = Math.min(1, c.corruption + 0.08);
      history(ctx, `Golpe de Estado ${sim.countries.in(c.id)}: militares derrubam a ${old.toLowerCase()} e ${c.ruler.name} assume como ditador.`, 3, -1, 'coup');
    },
  },
  {
    id: 'revolution', name: 'Revolução', category: 'política', chance: 0.0008,
    weight: ({ c }) => (c.stability < 30 && c.happiness < 40 ? 2 : 0) * (c.government === 'monarchy' || c.government === 'empire' ? 1.5 : 1),
    apply: (ctx) => {
      const p = ctx.c.capital >= 0 && ctx.sim.state.provinces[ctx.c.capital].owner === ctx.c.id ? ctx.c.capital : hottest(ctx);
      if (p < 0) return;
      history(ctx, `Revolução ${ctx.sim.countries.in(ctx.c.id)}! Multidões tomam as ruas de ${cityOf(ctx, p)}.`, 2, p);
      ctx.sim.rebellion.spawnRevolt(ctx.c, p, 'revolution');
    },
  },
  {
    id: 'civil_war', name: 'Guerra civil', category: 'política', chance: 0.0006,
    weight: ({ c }) => (c.stability < 20 && c.provinceCount >= 4 ? 1.5 : 0),
    apply: (ctx) => ctx.sim.rebellion.startCivilWar(ctx.c, 'a disputa política interna'),
  },
  {
    id: 'famine', name: 'Fome', category: 'desastre', chance: 0.001,
    weight: ({ c }) => (c.tech < 16 ? 1 : 0.3) * (c.stability < 30 ? 2 : 1) * (1 + c.inflation * 2),
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      let dead = 0;
      for (const p of owned(ctx)) {
        if (!rng.chance(0.3)) continue;
        const ps = sim.state.provinces[p];
        const loss = ps.population * rng.float(0.02, 0.05);
        ps.population -= loss;
        dead += loss;
      }
      modifier(ctx, 'famine', 'Fome', 2, { growth: -0.02, stability: -5 });
      c.stability = Math.max(0, c.stability - 6);
      history(ctx, `A fome devasta ${c.name}: cerca de ${fmtInt(dead)} pessoas morrem.`, imp(c), -1, 'disaster');
    },
  },
  {
    id: 'epidemic', name: 'Epidemia', category: 'desastre', chance: 0.0006,
    weight: ({ c }) => (c.tech < 16 ? 1.2 : 0.4),
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      let origin = -1;
      let bp = -1;
      for (const p of owned(ctx)) {
        const pop = sim.state.provinces[p].population * rng.float(0.5, 1.5);
        if (pop > bp) {
          bp = pop;
          origin = p;
        }
      }
      if (origin < 0) return;
      const disease = diseaseName(c.tech, rng);
      const m = sim.map;
      const affected = new Set([origin]);
      let frontier = [origin];
      for (let hop = 0; hop < 3 && affected.size < 8; hop++) {
        const next: number[] = [];
        for (const p of frontier) {
          for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) {
            const q = m.edgeTo[e];
            if (!affected.has(q) && rng.chance(0.45)) {
              affected.add(q);
              next.push(q);
            }
          }
        }
        frontier = next;
      }
      const countries = new Set<number>();
      let dead = 0;
      for (const p of affected) {
        const ps = sim.state.provinces[p];
        if (ps.owner < 0) continue;
        const mitigation = sim.country(ps.owner).tech >= 16 ? 0.3 : 1;
        const loss = ps.population * rng.float(0.04, 0.14) * mitigation;
        ps.population -= loss;
        dead += loss;
        ps.epidemic = YEAR;
        countries.add(ps.owner);
      }
      for (const id of countries) sim.country(id).stability = Math.max(0, sim.country(id).stability - 4);
      sim.history.add('disaster', `Epidemia de ${disease} irrompe em ${cityOf(ctx, origin)} e se espalha por ${affected.size === 1 ? '1 estado' : `${affected.size} estados`} (${fmtInt(dead)} mortos).`, {
        countries: [...countries], province: origin, importance: 2,
      });
    },
  },
  {
    id: 'tech_discovery', name: 'Avanço científico', category: 'descoberta', chance: 0.001,
    weight: ({ c }) => 0.5 + c.stability / 100,
    apply: (ctx) => {
      const { c, sim } = ctx;
      // Acelera o projeto de pesquisa mais adiantado (sem antecipar nenhuma tecnologia antes da sua data historica).
      const t = sim.technology.research.breakthrough(c);
      c.prestige = Math.min(100, c.prestige + 5);
      const text = t
        ? `Cientistas ${sim.countries.de(c.id)} alcançam um grande avanço nas pesquisas sobre ${sim.technology.db.phrase(t)}.`
        : `Cientistas ${sim.countries.de(c.id)} alcançam um grande avanço científico.`;
      history(ctx, text, imp(c), -1, 'tech');
    },
  },
  {
    id: 'resource_discovery', name: 'Descoberta de recursos', category: 'descoberta', chance: 0.002,
    apply: (ctx) => {
      const { c, rng, sim } = ctx;
      const p = randomProvince(ctx);
      if (p < 0) return;
      const options: ResourceId[] = ['gold', 'silver', 'gems', 'copper', 'iron'];
      if (sim.technology.resourceUnlocked(c, 'coal')) options.push('coal');
      if (sim.technology.resourceUnlocked(c, 'oil')) options.push('oil', 'oil');
      const r = rng.pick(options);
      const ps = sim.state.provinces[p];
      ps.resource = r;
      ps.development = Math.min(30, ps.development + 1);
      history(ctx, `Descoberta de ${RESOURCES[r].name.toLowerCase()} em ${cityOf(ctx, p)} (${c.name}) atrai colonos e riqueza.`, imp(c), p, 'economy');
    },
  },
  {
    id: 'assassination', name: 'Assassinato do líder', category: 'política', chance: 0.0008,
    weight: ({ c }) => (c.stability < 50 ? 1.5 : 0.6),
    apply: (ctx) => {
      ctx.c.stability = Math.max(0, ctx.c.stability - 10);
      ctx.sim.government.succession(ctx.c, 'assassination');
    },
  },
  {
    id: 'government_reform', name: 'Mudança de governo', category: 'política', chance: 0.0008,
    weight: ({ c }) => (c.stability > 40 ? 1 : 0.5),
    apply: (ctx) => {
      const { c, rng, sim } = ctx;
      const muslim = c.religion === 'sunni' || c.religion === 'shia';
      const options = REFORM_PATHS[c.government].filter(
        (g) =>
          (g !== 'democracy' || c.tech >= 12) &&
          (g !== 'empire' || sim.government.isGreatPower(c)) &&
          (g !== 'theocracy' || (c.tech < 13 && (muslim || c.provinceCount <= 4))),
      );
      if (!options.length) return;
      const gov = rng.pick(options);
      const before = sim.countries.formalName(c.id);
      sim.government.changeGovernment(c, gov, '', 2, gov === 'dictatorship' || gov === 'republic');
      history(ctx, `Reformas constitucionais: ${before} torna-se ${sim.countries.formalName(c.id)} (${GOVERNMENTS[gov].name}).`, 2, -1, 'government');
    },
  },
  {
    id: 'annexation', name: 'Anexação diplomática', category: 'política', chance: 0.0012,
    weight: ({ sim, c }) => (sim.state.countries.some((v) => v.alive && v.overlord === c.id && sim.diplomacy.relation(v.id, c.id) >= 40) ? 1.5 : 0),
    apply: (ctx) => {
      const { c, sim } = ctx;
      const v = sim.state.countries.find((x) => x.alive && x.overlord === c.id && sim.diplomacy.relation(x.id, c.id) >= 40);
      if (!v) return;
      const name = v.name;
      for (const p of [...sim.index.ownedBy[v.id]]) sim.provinces.transfer(p, c.id, 'annex');
      if (v.alive) sim.countries.destroy(v.id, c.id);
      history(ctx, `${c.name} anexou diplomaticamente seu vassalo, ${name}.`, 3, -1, 'annexation');
    },
  },
  {
    id: 'union', name: 'União de nações', category: 'política', chance: 0.0006,
    weight: ({ sim, c }) =>
      sim.diplomacy.partners(c.id, 'alliance').some((a) => {
        const o = sim.country(a);
        return o.alive && o.culture === c.culture && o.provinceCount <= c.provinceCount && c.provinceCount <= 6 && sim.diplomacy.relation(a, c.id) >= 60 && !sim.index.isAtWar(a) && !sim.index.isAtWar(c.id);
      }) ? 1 : 0,
    apply: (ctx) => {
      const { c, sim } = ctx;
      const partner = sim.diplomacy.partners(c.id, 'alliance').map((a) => sim.country(a)).find((o) => o.alive && o.culture === c.culture && o.provinceCount <= c.provinceCount && sim.diplomacy.relation(o.id, c.id) >= 60);
      if (!partner) return;
      const partnerName = partner.name;
      for (const p of [...sim.index.ownedBy[partner.id]]) sim.provinces.transfer(p, c.id, 'union');
      if (partner.alive) sim.countries.destroy(partner.id, c.id);
      if (c.provinceCount <= 8 && (c.government === 'republic' || c.government === 'democracy')) sim.government.changeGovernment(c, 'confederation', '', 2, false);
      c.prestige = Math.min(100, c.prestige + 10);
      history(ctx, `União pacífica: ${c.name} e ${partnerName} unem-se sob ${sim.countries.formalName(c.id)}.`, 3, -1, 'annexation');
    },
  },
  {
    id: 'corruption_scandal', name: 'Escândalo de corrupção', category: 'política', chance: 0.002,
    weight: ({ c }) => c.corruption * 3,
    apply: (ctx) => {
      const { c, sim } = ctx;
      c.stability = Math.max(0, c.stability - 6);
      c.treasury *= 0.95;
      history(ctx, `Escândalo de corrupção abala o governo ${sim.countries.de(c.id)}.`, 1);
    },
  },
  {
    id: 'administrative_reform', name: 'Reforma administrativa', category: 'política', chance: 0.0015,
    weight: ({ c }) => (c.ruler.skills.adm >= 6 ? 1.5 : 0.3),
    apply: (ctx) => {
      const { c, sim } = ctx;
      c.corruption = Math.max(0, c.corruption - 0.08);
      c.stability = Math.min(100, c.stability + 4);
      history(ctx, `${c.ruler.name} promove uma reforma administrativa ${sim.countries.in(c.id)}, reduzindo a corrupção.`, 1, -1, 'government');
    },
  },
  {
    id: 'golden_age', name: 'Era de ouro', category: 'social', chance: 0.0008,
    weight: ({ c }) => (c.stability > 60 && c.prestige > 30 ? 1.5 : 0),
    apply: (ctx) => {
      const { c, sim } = ctx;
      c.prestige = Math.min(100, c.prestige + 15);
      c.stability = Math.min(100, c.stability + 5);
      modifier(ctx, 'golden_age', 'Era de ouro', 10, { research: 0.2, stability: 3 });
      history(ctx, `Começa a era de ouro ${sim.countries.de(c.id)}: artes, ciências e prestígio florescem.`, 2);
    },
  },
  {
    id: 'natural_disaster', name: 'Desastre natural', category: 'desastre', chance: 0.0015,
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      const p = randomProvince(ctx);
      if (p < 0) return;
      const mp = sim.map.provinces[p];
      const kind = mp.terrain === 3 || mp.terrain === 2 ? 'um terremoto' : mp.river > 0 ? 'uma grande enchente' : mp.coast > 0 && Math.abs(mp.lat) < 30 ? 'um furacão' : mp.terrain === 6 ? 'uma seca severa' : 'um grande incêndio';
      const ps = sim.state.provinces[p];
      ps.devastation = Math.min(1, ps.devastation + 0.35);
      ps.population *= rng.float(0.94, 0.98);
      ps.development = Math.max(1, ps.development - 0.8);
      history(ctx, `${kind.charAt(0).toUpperCase() + kind.slice(1)} devasta ${cityOf(ctx, p)} (${c.name}).`, sim.provinces.isCapital(p) ? 2 : 1, p, 'disaster');
    },
  },
  {
    id: 'migration', name: 'Onda migratória', category: 'social', chance: 0.001,
    weight: ({ c }) => (c.happiness > 55 ? 1.2 : 0.3),
    apply: (ctx) => {
      const { c, sim } = ctx;
      if (c.capital < 0 || sim.state.provinces[c.capital].owner !== c.id) return;
      const ps = sim.state.provinces[c.capital];
      const arrivals = ps.population * 0.03;
      ps.population += arrivals;
      history(ctx, `Uma onda de ${fmtInt(arrivals)} imigrantes chega a ${cityOf(ctx, c.capital)}.`, 1, c.capital);
    },
  },
  {
    id: 'religious_schism', name: 'Cisma religioso', category: 'social', chance: 0.0004,
    weight: ({ c }) => (c.religion === 'catholic' && c.tech >= 5 && c.tech <= 12 ? 1.5 : c.religion === 'sunni' || c.religion === 'shia' ? 0.3 : 0),
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      const swap: Partial<Record<ReligionId, ReligionId>> = { catholic: 'protestant', protestant: 'catholic', sunni: 'shia', shia: 'sunni' };
      const to = swap[c.religion];
      if (!to) return;
      c.religion = to;
      for (const p of owned(ctx)) if (rng.chance(0.5)) sim.state.provinces[p].religion = to;
      c.stability = Math.max(0, c.stability - 12);
      history(ctx, `Cisma religioso: ${c.name} converte-se ao ${RELIGIONS[to].name}, dividindo a população.`, 2);
    },
  },
  {
    id: 'military_reform', name: 'Reforma militar', category: 'militar', chance: 0.0012,
    weight: ({ c }) => (PERSONALITIES[c.personality].militaryBudget > 0.22 ? 2 : 1),
    apply: (ctx) => {
      const { c, sim } = ctx;
      modifier(ctx, 'military_reform', 'Reforma militar', 10, { military: 0.15 });
      for (const a of sim.military.armiesOf(c.id)) a.morale = Math.min(1, a.morale + 0.1);
      history(ctx, `${c.name} moderniza suas forças armadas com uma ampla reforma militar.`, 1);
    },
  },
  {
    id: 'great_general', name: 'Grande general', category: 'militar', chance: 0.002,
    weight: ({ sim, c }) => (sim.index.isAtWar(c.id) ? 1 : 0),
    apply: (ctx) => {
      const { c, sim, rng } = ctx;
      const g = newGeneral(rng, c.culture, sim.day, sim.nextId('person'), 3);
      g.attack = rng.int(4, 6);
      g.defense = rng.int(4, 6);
      g.maneuver = rng.int(3, 6);
      c.generals.push(g);
      const army = sim.military.armiesOf(c.id).sort((a, b) => b.infantry - a.infantry)[0];
      if (army) {
        const old = c.generals.find((x) => x.id === army.general);
        if (old) old.army = -1;
        army.general = g.id;
        g.army = army.id;
      }
      history(ctx, `O general ${g.name} desponta como um grande estrategista ${sim.countries.de(c.id)}.`, 1);
    },
  },
  {
    id: 'cultural_awakening', name: 'Despertar nacional', category: 'social', chance: 0.0008,
    weight: (ctx) => (nonCoreShare(ctx) < 0.1 && ctx.c.tech >= 11 ? 1 : 0),
    apply: (ctx) => {
      const { c, sim } = ctx;
      c.stability = Math.min(100, c.stability + 6);
      modifier(ctx, 'nationalism', 'Despertar nacional', 8, { military: 0.08, stability: 4 });
      history(ctx, `Um despertar nacional une o povo ${CULTURES[c.culture].name.toLowerCase()} em torno ${sim.countries.de(c.id)}.`, 1);
    },
  },
];
