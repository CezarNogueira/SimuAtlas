// Desenho das bandeiras em pixel art (32x20 ampliado 2x): bandeiras reais dos paises do mapa e bandeiras
// procedurais das nacoes criadas durante a simulacao.
import { hasRealFlag, REAL_FLAGS } from '../data/realFlags';
import type { RGB } from '../data/terrain';
import { FlagPainter } from '../render/sprites/FlagPainter';
import { PixelArt, type RGBA } from '../render/sprites/PixelArt';
import type { Country, FlagDesign } from '../state/types';

const cache = new Map<string, string>();
const W = 32;
const H = 20;

const rgba = (c: RGB): RGBA => [c[0], c[1], c[2], 255];

function emblem(a: PixelArt, kind: number, cx: number, cy: number, color: RGBA): void {
  switch (kind) {
    case 1: // estrela
      a.rect(cx - 1, cy - 3, 2, 7, color);
      a.rect(cx - 3, cy - 1, 6, 2, color);
      a.rect(cx - 2, cy - 2, 4, 4, color);
      break;
    case 2: // sol
      a.circle(cx - 1, cy - 1, 3, color);
      break;
    case 3: // crescente
      a.circle(cx - 1, cy - 1, 3, color);
      a.circle(cx, cy - 2, 3, [0, 0, 0, 0]);
      break;
    case 4: // coroa
      a.rect(cx - 3, cy, 6, 2, color);
      a.rect(cx - 3, cy - 2, 1, 2, color);
      a.rect(cx - 1, cy - 3, 2, 3, color);
      a.rect(cx + 2, cy - 2, 1, 2, color);
      break;
    case 5: // losango
      for (let i = 0; i < 4; i++) a.rect(cx - i, cy - 3 + i, i * 2 + 1, 1, color);
      for (let i = 0; i < 3; i++) a.rect(cx - 2 + i, cy + 1 + i, 5 - i * 2, 1, color);
      break;
    case 6: // cruz pequena
      a.rect(cx - 1, cy - 3, 2, 7, color);
      a.rect(cx - 3, cy - 1, 6, 2, color);
      break;
    default:
      break;
  }
}

export function drawFlag(design: FlagDesign): PixelArt {
  const a = new PixelArt(W);
  const real = design.real ? REAL_FLAGS[design.real] : undefined;
  if (real) {
    real(new FlagPainter(a));
    return a;
  }
  const [c0, c1, c2] = design.colors.map(rgba);
  const fill = (x: number, y: number, w: number, h: number, c: RGBA) => a.rect(x, y, w, h, c);
  switch (design.pattern) {
    case 0: fill(0, 0, W, 7, c0); fill(0, 7, W, 6, c1); fill(0, 13, W, 7, c2); break;
    case 1: fill(0, 0, 11, H, c0); fill(11, 0, 10, H, c1); fill(21, 0, 11, H, c2); break;
    case 2: fill(0, 0, W, 10, c0); fill(0, 10, W, 10, c1); break;
    case 3: fill(0, 0, 16, H, c0); fill(16, 0, 16, H, c1); break;
    case 4: fill(0, 0, W, H, c0); fill(9, 0, 4, H, c1); fill(0, 8, W, 4, c1); fill(10, 0, 2, H, c2); fill(0, 9, W, 2, c2); break;
    case 5: fill(0, 0, W, H, c0); fill(13, 3, 6, 14, c1); fill(8, 7, 16, 6, c1); break;
    case 6: fill(0, 0, W, H, c0); for (let x = 0; x < W; x++) fill(x, Math.round((x * H) / W) - 2, 1, 5, c1); break;
    case 7: fill(0, 0, W, H, c0); fill(0, 0, 14, 10, c1); break;
    case 8: fill(0, 0, W, H, c1); fill(3, 3, W - 6, H - 6, c0); break;
    case 9: for (let i = 0; i < 5; i++) fill(0, i * 4, W, 4, i % 2 ? c1 : c0); break;
    case 10: fill(0, 0, W, H, c0); fill(0, 10, W, 10, c2); for (let x = 0; x < 12; x++) fill(x, Math.round(x * 0.83), 1, H - Math.round(x * 1.66), c1); break;
    default: fill(0, 0, W, H, c0); for (let x = 0; x < W; x++) { fill(x, Math.round((x * H) / W) - 1, 1, 3, c1); fill(x, H - Math.round((x * H) / W) - 2, 1, 3, c1); } break;
  }
  if (design.emblem) {
    const pos = design.pattern === 7 ? [7, 5] : design.pattern === 10 ? [5, 10] : [16, 10];
    const ec = design.pattern === 7 ? c0 : [255, 244, 214, 255] as RGBA;
    emblem(a, design.emblem, pos[0], pos[1], ec);
  }
  return a;
}

function toUrl(art: PixelArt): string {
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const src = art.toCanvas();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, W, H, 0, 0, W * 2, H * 2);
  return canvas.toDataURL();
}

export function flagUrl(c: Country): string {
  // Saves anteriores nao marcavam a bandeira real: nacoes do mapa com codigo conhecido usam a bandeira verdadeira.
  const design = !c.flag.real && c.kind === 'nation' && hasRealFlag(c.code) ? { ...c.flag, real: c.code } : c.flag;
  const key = design.real ? `real:${design.real}` : JSON.stringify(design);
  let url = cache.get(key);
  if (!url) {
    url = toUrl(drawFlag(design));
    cache.set(key, url);
  }
  return url;
}
