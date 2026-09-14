// Geradores de nomes: governantes, generais, exercitos, guerras, tratados e novas nacoes.
import type { Rng } from '../core/rng';
import { CULTURES, type CultureId } from '../data/cultures';
import { roman } from '../data/language';
import type { Country, General, Leader } from '../state/types';

const TRAITS = ['Ambicioso', 'Cauteloso', 'Carismático', 'Cruel', 'Justo', 'Pio', 'Corrupto', 'Brilhante', 'Covarde', 'Bravo', 'Paranoico', 'Generoso', 'Estrategista', 'Reformista', 'Tradicionalista'];

export function newLeader(rng: Rng, culture: CultureId, day: number, id: number, regnal?: Record<string, number>, house?: string): Leader {
  const info = CULTURES[culture];
  const first = rng.pick(info.names);
  let name = first;
  if (regnal) {
    const n = (regnal[first] ?? 0) + 1;
    regnal[first] = n;
    if (n > 1) name = `${first} ${roman(n)}`;
  }
  const traits: string[] = [];
  const nTraits = rng.int(1, 2);
  while (traits.length < nTraits) {
    const t = rng.pick(TRAITS);
    if (!traits.includes(t)) traits.push(t);
  }
  const age = rng.int(22, 55);
  return {
    id,
    name,
    house: house ?? rng.pick(info.houses),
    birthDay: day - age * 365,
    startDay: day,
    skills: { adm: rng.int(1, 9), dip: rng.int(1, 9), mil: rng.int(1, 9) },
    traits,
  };
}

export function newGeneral(rng: Rng, culture: CultureId, day: number, id: number, techBonus = 0): General {
  const info = CULTURES[culture];
  const bonus = Math.min(2, techBonus);
  return {
    id,
    name: `${rng.pick(info.names)} ${rng.pick(info.houses)}`,
    birthDay: day - rng.int(30, 55) * 365,
    attack: Math.min(6, rng.int(0, 4) + (rng.chance(0.2) ? 1 : 0) + (bonus > 1 ? 1 : 0)),
    defense: Math.min(6, rng.int(0, 4) + (rng.chance(0.2) ? 1 : 0)),
    maneuver: Math.min(6, rng.int(0, 4)),
    siege: Math.min(6, rng.int(0, 3)),
    victories: 0,
    defeats: 0,
    army: -1,
  };
}

const ORDINAL_WORDS = ['', 'Primeira', 'Segunda', 'Terceira', 'Quarta', 'Quinta', 'Sexta', 'Sétima', 'Oitava', 'Nona', 'Décima'];

export function battleName(place: string, count: number): string {
  if (count <= 1) return `Batalha de ${place}`;
  return `${ORDINAL_WORDS[count] ?? `${count}ª`} Batalha de ${place}`;
}

export function armyName(index: number, country: Country, deName: string): string {
  return `${index}º Exército ${deName}`.replace('  ', ' ') || country.name;
}

export const agePt = (birthDay: number, day: number) => Math.max(0, Math.floor((day - birthDay) / 365));
