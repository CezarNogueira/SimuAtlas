// Sprites do mapa em pixel art 64x64 (pintados em grade 32x32 e ampliados 2x):
// exercitos por era, rebeldes, navio, capital, cidade, vila, batalha (2 quadros) e cerco.
import { col, PixelArt } from './PixelArt';

const K = col('k');

function army(era: 0 | 1 | 2, rebel = false): PixelArt {
  const a = new PixelArt(32);
  const c = rebel ? col('d') : col('c');
  const C = rebel ? col('R') : col('C');
  // Estandarte
  a.rect(6, 3, 1, 26, col('B'));
  a.rect(5, 2, 3, 1, col('y'));
  a.rect(7, 4, 11, 8, c);
  a.rect(7, 9, 11, 2, C);
  a.rect(11, 5, 3, 3, rebel ? col('r') : col('w'));
  a.rect(18, 5, 1, 6, c);
  // Cabeca
  if (era === 0) {
    a.rect(14, 10, 8, 2, col('m'));
    a.rect(13, 12, 10, 1, col('M'));
    a.rect(17, 9, 2, 1, col('M'));
  } else if (era === 1) {
    a.rect(12, 11, 12, 2, col('B'));
    a.rect(15, 9, 6, 2, col('B'));
    a.rect(17, 8, 2, 1, col('y'));
  } else {
    a.rect(14, 10, 8, 3, col('E'));
    a.rect(13, 12, 10, 1, col('E'));
  }
  a.rect(15, 13, 6, 4, col('s'));
  a.set(16, 14, K);
  a.set(19, 14, K);
  // Corpo e pernas
  a.rect(13, 17, 10, 8, era === 2 ? col('E') : c);
  a.rect(17, 18, 2, 4, era === 2 ? C : C);
  a.rect(13, 22, 10, 1, col('B'));
  a.rect(14, 25, 3, 4, col('B'));
  a.rect(19, 25, 3, 4, col('B'));
  a.rect(13, 29, 4, 1, K);
  a.rect(19, 29, 4, 1, K);
  if (era === 0) {
    // Escudo e lanca
    a.rect(9, 17, 7, 9, C);
    a.rect(10, 18, 5, 7, c);
    a.rect(12, 19, 1, 5, col('y'));
    a.rect(11, 21, 3, 1, col('y'));
    a.rect(25, 3, 1, 26, col('b'));
    a.rect(24, 1, 3, 3, col('m'));
    a.set(25, 0, col('m'));
    a.rect(23, 18, 3, 2, col('s'));
  } else {
    // Mosquete/fuzil apoiado no ombro
    a.line(24, 6, 20, 27, col('B'), 2);
    a.line(25, 5, 25, 3, col('M'), 1);
    a.rect(21, 18, 4, 2, col('s'));
    a.rect(10, 18, 3, 5, era === 2 ? col('E') : c);
  }
  return a.outline().scaled(2);
}

function ship(): PixelArt {
  const a = new PixelArt(32);
  a.rect(15, 3, 1, 19, col('B'));
  a.triangle(16, 4, 16, 18, 26, 17, col('w'));
  a.rect(17, 11, 7, 2, col('c'));
  a.triangle(14, 6, 14, 17, 7, 16, col('l'));
  a.rect(15, 2, 5, 3, col('c'));
  a.rect(5, 21, 22, 3, col('b'));
  a.rect(7, 24, 18, 2, col('B'));
  a.rect(9, 26, 14, 1, col('B'));
  a.rect(3, 20, 3, 2, col('b'));
  a.rect(26, 20, 3, 2, col('b'));
  a.rect(8, 22, 2, 1, col('y'));
  a.rect(14, 22, 2, 1, col('y'));
  a.rect(20, 22, 2, 1, col('y'));
  return a.outline().scaled(2);
}

function capital(): PixelArt {
  const a = new PixelArt(32);
  const stone = col('l');
  const dark = col('g');
  a.rect(4, 11, 7, 17, stone);
  a.rect(21, 11, 7, 17, stone);
  a.rect(9, 16, 14, 12, dark);
  a.rect(11, 8, 10, 10, stone);
  for (let i = 0; i < 4; i++) {
    a.rect(4 + i * 2, 9, 1, 2, stone);
    a.rect(21 + i * 2, 9, 1, 2, stone);
  }
  for (let i = 0; i < 5; i++) a.rect(11 + i * 2, 6, 1, 2, stone);
  a.rect(13, 21, 6, 7, col('B'));
  a.rect(14, 20, 4, 1, col('B'));
  a.rect(6, 15, 2, 3, K);
  a.rect(24, 15, 2, 3, K);
  a.rect(15, 11, 2, 3, K);
  a.rect(16, 0, 1, 6, col('B'));
  a.rect(17, 1, 7, 4, col('c'));
  a.rect(17, 3, 7, 1, col('C'));
  a.rect(4, 26, 24, 2, col('g'));
  return a.outline().scaled(2);
}

function city(): PixelArt {
  const a = new PixelArt(32);
  a.rect(17, 14, 10, 12, col('n'));
  a.triangle(16, 14, 22, 7, 28, 14, col('R'));
  a.rect(19, 17, 2, 2, K);
  a.rect(23, 17, 2, 2, K);
  a.rect(21, 21, 3, 5, col('B'));
  a.rect(5, 17, 11, 9, col('w'));
  a.triangle(4, 17, 10, 10, 16, 17, col('r'));
  a.rect(7, 19, 2, 2, K);
  a.rect(12, 19, 2, 2, K);
  a.rect(9, 22, 3, 4, col('B'));
  a.rect(3, 26, 26, 1, col('N'));
  return a.outline().scaled(2);
}

function town(): PixelArt {
  const a = new PixelArt(32);
  a.rect(10, 17, 12, 9, col('w'));
  a.triangle(9, 17, 16, 9, 23, 17, col('r'));
  a.rect(14, 21, 4, 5, col('B'));
  a.rect(11, 19, 2, 2, K);
  a.rect(19, 19, 2, 2, K);
  return a.outline().scaled(2);
}

function battle(frame: 0 | 1): PixelArt {
  const a = new PixelArt(32);
  a.line(6, 5, 24, 23, col('m'), 2);
  a.line(25, 5, 7, 23, col('m'), 2);
  a.line(6, 5, 12, 11, col('W'), 1);
  a.line(25, 5, 19, 11, col('W'), 1);
  a.rect(20, 20, 6, 2, col('y'));
  a.rect(6, 20, 6, 2, col('y'));
  a.line(24, 23, 27, 26, col('b'), 2);
  a.line(7, 23, 4, 26, col('b'), 2);
  const sparks = frame === 0
    ? [[15, 2], [3, 14], [28, 13], [15, 27], [10, 9], [21, 9]]
    : [[12, 4], [5, 11], [26, 16], [18, 26], [15, 13], [9, 17]];
  for (const [x, y] of sparks) {
    a.rect(x, y, 2, 2, col('O'));
    a.set(x - 1, y, col('o'));
    a.set(x + 2, y + 1, col('o'));
  }
  return a.outline().scaled(2);
}

function siege(frame: 0 | 1): PixelArt {
  const a = new PixelArt(32);
  a.rect(9, 12, 14, 16, col('l'));
  for (let i = 0; i < 4; i++) a.rect(9 + i * 4, 9, 2, 3, col('l'));
  a.rect(14, 20, 4, 8, col('B'));
  a.rect(11, 15, 2, 3, K);
  a.rect(19, 15, 2, 3, K);
  a.rect(20, 23, 3, 5, col('g'));
  const flames = frame === 0 ? [[12, 5], [16, 3], [20, 6]] : [[13, 3], [17, 5], [21, 4]];
  for (const [x, y] of flames) {
    a.rect(x, y, 3, 4, col('o'));
    a.rect(x + 1, y + 1, 1, 2, col('O'));
    a.set(x + 1, y - 1, col('o'));
  }
  return a.outline().scaled(2);
}

export interface MapSpriteSet {
  army: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  armyArt: [PixelArt, PixelArt, PixelArt];
  rebelArt: PixelArt;
  shipArt: PixelArt;
  capitalArt: PixelArt;
  city: HTMLCanvasElement;
  town: HTMLCanvasElement;
  battle: [HTMLCanvasElement, HTMLCanvasElement];
  siege: [HTMLCanvasElement, HTMLCanvasElement];
}

export function buildMapSprites(): MapSpriteSet {
  const armyArt: [PixelArt, PixelArt, PixelArt] = [army(0), army(1), army(2)];
  return {
    army: [armyArt[0].toCanvas(), armyArt[1].toCanvas(), armyArt[2].toCanvas()],
    armyArt,
    rebelArt: army(0, true),
    shipArt: ship(),
    capitalArt: capital(),
    city: city().toCanvas(),
    town: town().toCanvas(),
    battle: [battle(0).toCanvas(), battle(1).toCanvas()],
    siege: [siege(0).toCanvas(), siege(1).toCanvas()],
  };
}

// Cache de sprites tingidos por pais.
export class TintCache {
  private map = new Map<string, HTMLCanvasElement>();

  get(key: string, art: PixelArt, color: [number, number, number]): HTMLCanvasElement {
    const k = `${key}:${color.join(',')}`;
    let canvas = this.map.get(k);
    if (!canvas) {
      canvas = art.tinted(color).toCanvas();
      this.map.set(k, canvas);
      if (this.map.size > 800) this.map.clear();
    }
    return canvas;
  }
}
