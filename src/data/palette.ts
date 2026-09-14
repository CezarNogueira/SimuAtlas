// Paleta de cores das nacoes (tons suaves de atlas) e utilitarios de escolha de cor distinta.
import type { RGB } from './terrain';

const HEX = [
  '#d9a066', '#e0c060', '#c96f5a', '#8fb3a0', '#b7c46a', '#d98c8c', '#9aa7d6', '#c9a0c9',
  '#7fb069', '#e39b52', '#a3c4bc', '#b88c6b', '#8e9dc2', '#cf7f9b', '#6fa39a', '#c2b24d',
  '#a86f6f', '#94b85b', '#7d8fb0', '#e0a3a3', '#b3905a', '#8cc2c9', '#b46a4c', '#a0a86a',
  '#c78dd6', '#6c9e6c', '#d9774b', '#9e7fb8', '#e8b86a', '#72a8c7', '#ba5c5c', '#5f9e84',
  '#c7c46a', '#a6746a', '#8aa1e0', '#df8f6f', '#79b89a', '#b8a0d6', '#d6a1b5', '#88a36a',
  '#c29a78', '#6f93c9', '#e2cf7a', '#9c6b8e', '#7bc0a8', '#cf8a3e', '#8f8fbf', '#b5c98f',
];

export const NATION_PALETTE: RGB[] = HEX.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

// Distancia perceptual aproximada ("redmean").
export function colorDistance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

// Escolhe a cor da paleta mais distante das cores vizinhas (com leve variacao aleatoria).
export function pickDistinctColor(neighbors: RGB[], secondary: RGB[], random: () => number): RGB {
  let best = NATION_PALETTE[0];
  let bestScore = -Infinity;
  for (const cand of NATION_PALETTE) {
    let minN = 1e9;
    for (const n of neighbors) minN = Math.min(minN, colorDistance(cand, n));
    let minS = 1e9;
    for (const s of secondary) minS = Math.min(minS, colorDistance(cand, s));
    const score = Math.min(minN, 400) * 1.0 + Math.min(minS, 400) * 0.25 + random() * 60;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return jitterColor(best, random);
}

export function jitterColor(c: RGB, random: () => number, amount = 14): RGB {
  return c.map((v) => Math.max(40, Math.min(240, Math.round(v + (random() - 0.5) * amount)))) as RGB;
}
