// Geracao procedural do desenho das bandeiras (apenas dados; o desenho em pixels fica no render).
import type { Rng } from '../core/rng';
import type { RGB } from '../data/terrain';
import type { FlagDesign } from '../state/types';

export const FLAG_PATTERNS = 12;
export const FLAG_EMBLEMS = 7;

const HERALDIC: RGB[] = [
  [178, 34, 34], [240, 236, 220], [30, 60, 140], [20, 110, 60], [232, 190, 40], [30, 30, 30],
  [120, 30, 90], [220, 110, 30], [60, 140, 200],
];

function darken(c: RGB, k: number): RGB {
  return c.map((v) => Math.round(v * k)) as RGB;
}

export function newFlag(rng: Rng, base: RGB): FlagDesign {
  const main = darken(base, 0.85);
  const others = rng.shuffle(HERALDIC.slice());
  return {
    pattern: rng.int(0, FLAG_PATTERNS - 1),
    colors: [main, others[0], others[1]],
    emblem: rng.chance(0.55) ? rng.int(1, FLAG_EMBLEMS - 1) : 0,
  };
}

// Variacao de bandeira para faccoes rebeldes/revolucionarias.
export function rebelFlag(rng: Rng, base: RGB): FlagDesign {
  return { pattern: rng.pick([2, 5, 8]), colors: [[30, 30, 30], darken(base, 0.8), [178, 34, 34]], emblem: rng.int(1, FLAG_EMBLEMS - 1) };
}
