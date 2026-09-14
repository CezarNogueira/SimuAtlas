// Modos de mapa: definem a cor de cada provincia (politico, terreno, diplomacia, religiao, ...).
import { CULTURES } from '../data/cultures';
import { GOVERNMENTS, type GovernmentId } from '../data/governments';
import { RELIGIONS } from '../data/religions';
import type { Simulation } from '../sim/Simulation';
import { cool, diverging, heat, type RGB } from './colors';

export type MapModeId =
  | 'political'
  | 'terrain'
  | 'diplomatic'
  | 'alliances'
  | 'religion'
  | 'culture'
  | 'government'
  | 'development'
  | 'population'
  | 'unrest'
  | 'devastation'
  | 'economy'
  | 'tech';

export interface LegendItem {
  color: RGB;
  label: string;
}

export interface MapModeInfo {
  id: MapModeId;
  name: string;
  icon: string;
  key: string;
  description: string;
}

export const MAP_MODES: MapModeInfo[] = [
  { id: 'political', name: 'Político', icon: 'flag', key: 'Q', description: 'Nações e fronteiras atuais.' },
  { id: 'terrain', name: 'Terreno', icon: 'mountain', key: 'W', description: 'Relevo, biomas e rios.' },
  { id: 'diplomatic', name: 'Diplomacia', icon: 'handshake', key: 'E', description: 'Relações da nação selecionada.' },
  { id: 'alliances', name: 'Alianças', icon: 'chain', key: 'R', description: 'Blocos de alianças.' },
  { id: 'religion', name: 'Religião', icon: 'temple', key: 'T', description: 'Religião predominante.' },
  { id: 'culture', name: 'Cultura', icon: 'mask', key: 'Y', description: 'Cultura predominante.' },
  { id: 'government', name: 'Governo', icon: 'crown', key: 'U', description: 'Forma de governo.' },
  { id: 'development', name: 'Desenvolvimento', icon: 'building', key: 'I', description: 'Infraestrutura dos estados.' },
  { id: 'population', name: 'População', icon: 'people', key: 'O', description: 'Densidade populacional.' },
  { id: 'unrest', name: 'Agitação', icon: 'fire', key: 'P', description: 'Risco de revoltas.' },
  { id: 'devastation', name: 'Destruição', icon: 'skull', key: '', description: 'Infraestrutura destruída pela guerra: batalhas, cercos, saques e ocupação.' },
  { id: 'economy', name: 'Economia', icon: 'coins', key: '', description: 'PIB per capita das nações.' },
  { id: 'tech', name: 'Tecnologia', icon: 'gear', key: '', description: 'Nível tecnológico.' },
];

export const GOVERNMENT_COLORS: Record<GovernmentId, RGB> = {
  republic: [96, 150, 196],
  monarchy: [196, 150, 70],
  empire: [150, 70, 110],
  democracy: [90, 170, 120],
  dictatorship: [170, 60, 50],
  theocracy: [220, 200, 120],
  federation: [70, 110, 170],
  confederation: [140, 170, 110],
};

export interface FillContext {
  fill: (p: number) => RGB;
  bordersByOwner: boolean;
  legend: LegendItem[];
}

export function buildFill(mode: MapModeId, sim: Simulation, selected: number): FillContext {
  const s = sim.state;
  const provs = s.provinces;
  const country = (id: number) => s.countries[id];
  switch (mode) {
    case 'diplomatic': {
      if (selected < 0 || !country(selected)?.alive) break;
      const allies = new Set(sim.diplomacy.partners(selected, 'alliance'));
      const legend: LegendItem[] = [
        { color: [236, 196, 70], label: 'Nação selecionada' },
        { color: [70, 120, 206], label: 'Aliado' },
        { color: [196, 56, 44], label: 'Em guerra' },
        { color: [130, 96, 196], label: 'Vassalo/suserano' },
        { color: [62, 140, 76], label: 'Amigável' },
        { color: [186, 58, 44], label: 'Hostil' },
      ];
      return {
        bordersByOwner: true,
        legend,
        fill: (p) => {
          const o = provs[p].owner;
          if (o === selected) return [236, 196, 70];
          if (sim.index.atWar(o, selected)) return [196, 56, 44];
          if (allies.has(o)) return [70, 120, 206];
          if (country(o).overlord === selected || country(selected).overlord === o) return [130, 96, 196];
          return diverging(sim.diplomacy.relation(selected, o) / 80);
        },
      };
    }
    case 'alliances': {
      const bloc = new Map<number, RGB>();
      for (const c of s.countries) {
        if (!c.alive) continue;
        const partners = sim.diplomacy.partners(c.id, 'alliance');
        if (!partners.length) continue;
        const group = [c.id, ...partners];
        const leader = group.reduce((a, b) => (country(b).provinceCount > country(a).provinceCount ? b : a), c.id);
        bloc.set(c.id, country(leader).color);
      }
      return { bordersByOwner: true, legend: [{ color: [176, 170, 150], label: 'Sem aliança' }], fill: (p) => bloc.get(provs[p].owner) ?? [176, 170, 150] };
    }
    case 'religion':
      return {
        bordersByOwner: true,
        legend: Object.values(RELIGIONS).map((r) => ({ color: r.color, label: r.name })),
        fill: (p) => RELIGIONS[provs[p].religion].color,
      };
    case 'culture':
      return { bordersByOwner: true, legend: [], fill: (p) => CULTURES[provs[p].culture].color };
    case 'government':
      return {
        bordersByOwner: true,
        legend: (Object.keys(GOVERNMENT_COLORS) as GovernmentId[]).map((g) => ({ color: GOVERNMENT_COLORS[g], label: GOVERNMENTS[g].name })),
        fill: (p) => GOVERNMENT_COLORS[country(provs[p].owner).government],
      };
    case 'development':
      return { bordersByOwner: true, legend: [{ color: cool(0), label: 'Baixo' }, { color: cool(1), label: 'Alto' }], fill: (p) => cool(provs[p].development / 22) };
    case 'population':
      return {
        bordersByOwner: true,
        legend: [{ color: cool(0), label: 'Esparsa' }, { color: cool(1), label: 'Densa' }],
        fill: (p) => cool(Math.log10(provs[p].population / Math.max(1, sim.map.provinces[p].area) + 1) / 2.6),
      };
    case 'unrest':
      return { bordersByOwner: true, legend: [{ color: heat(0), label: 'Calma' }, { color: heat(1), label: 'Revolta iminente' }], fill: (p) => heat(provs[p].unrest / 70) };
    case 'devastation':
      return {
        bordersByOwner: true,
        legend: [{ color: heat(0), label: 'Intacto' }, { color: heat(1), label: 'Arrasado pela guerra' }],
        fill: (p) => heat(provs[p].devastation / 0.6),
      };
    case 'economy': {
      let max = 1;
      for (const c of s.countries) if (c.alive && c.population > 0) max = Math.max(max, c.gdp / c.population);
      return {
        bordersByOwner: true,
        legend: [{ color: cool(0), label: 'Pobre' }, { color: cool(1), label: 'Rico' }],
        fill: (p) => {
          const c = country(provs[p].owner);
          return cool(c.population > 0 ? c.gdp / c.population / max : 0);
        },
      };
    }
    case 'tech': {
      let min = Infinity;
      let max = -Infinity;
      for (const c of s.countries) {
        if (!c.alive || c.kind !== 'nation') continue;
        min = Math.min(min, c.tech);
        max = Math.max(max, c.tech);
      }
      const span = Math.max(0.5, max - min);
      return { bordersByOwner: true, legend: [{ color: cool(0), label: 'Atrasado' }, { color: cool(1), label: 'Avançado' }], fill: (p) => cool((country(provs[p].owner).tech - min) / span) };
    }
    default:
      break;
  }
  return { bordersByOwner: false, legend: [], fill: (p) => country(provs[p].controller)?.color ?? [150, 150, 150] };
}
