export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
export const sum = (arr: readonly number[]) => arr.reduce((a, b) => a + b, 0);
// Aproxima v de target a uma taxa (0..1) por passo.
export const approach = (v: number, target: number, rate: number) => v + (target - v) * rate;
