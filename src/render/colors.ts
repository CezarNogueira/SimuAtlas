// Utilitarios de cor para renderizacao.
export type RGB = [number, number, number];

export const rgb = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

export const hexToRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

export const scale = (c: RGB, k: number): RGB => [
  Math.max(0, Math.min(255, Math.round(c[0] * k))),
  Math.max(0, Math.min(255, Math.round(c[1] * k))),
  Math.max(0, Math.min(255, Math.round(c[2] * k))),
];

export const luminance = (c: RGB) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

// Escala sequencial (verde -> amarelo -> vermelho) para mapas de calor.
const HEAT: RGB[] = [[74, 132, 84], [168, 186, 96], [232, 206, 110], [222, 142, 74], [176, 62, 48]];
export function heat(t: number): RGB {
  const v = Math.max(0, Math.min(1, t)) * (HEAT.length - 1);
  const i = Math.min(HEAT.length - 2, Math.floor(v));
  return mix(HEAT[i], HEAT[i + 1], v - i);
}

// Escala sequencial fria (claro -> azul escuro), usada para densidade/desenvolvimento.
const COOL: RGB[] = [[236, 228, 196], [170, 196, 170], [96, 150, 160], [50, 90, 140], [30, 44, 96]];
export function cool(t: number): RGB {
  const v = Math.max(0, Math.min(1, t)) * (COOL.length - 1);
  const i = Math.min(COOL.length - 2, Math.floor(v));
  return mix(COOL[i], COOL[i + 1], v - i);
}

// Divergente: -1 hostil (vermelho) .. 0 neutro (bege) .. 1 amigavel (verde).
export function diverging(t: number): RGB {
  const v = Math.max(-1, Math.min(1, t));
  return v < 0 ? mix([230, 220, 190], [186, 58, 44], -v) : mix([230, 220, 190], [62, 140, 76], v);
}

export function hash01(x: number, y: number): number {
  let h = Math.imul(x ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(y ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Ruido de valor 2D suave (para textura de agua e pergaminho).
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(xi, yi);
  const b = hash01(xi + 1, yi);
  const c = hash01(xi, yi + 1);
  const d = hash01(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
