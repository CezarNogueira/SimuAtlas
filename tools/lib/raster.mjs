// Rasterizacao em grade: preenchimento de poligonos (par-impar), linhas e amostragem de imagens.
import { readFileSync } from 'node:fs';
import jpeg from 'jpeg-js';

// Preenche aneis (externo + buracos) por scanline; set(cellIndex) para cada celula cujo centro esta dentro.
export function fillRings(rings, W, H, set) {
  const edges = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    const n = ring.length;
    if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      if (a[1] === b[1]) continue;
      const up = a[1] < b[1];
      const x0 = up ? a[0] : b[0];
      const y0 = up ? a[1] : b[1];
      const x1 = up ? b[0] : a[0];
      const y1 = up ? b[1] : a[1];
      edges.push({ x0, y0, y1, slope: (x1 - x0) / (y1 - y0) });
      if (y0 < minY) minY = y0;
      if (y1 > maxY) maxY = y1;
    }
  }
  if (!edges.length || maxY < 0 || minY > H) return 0;
  edges.sort((p, q) => p.y0 - q.y0);
  const rowStart = Math.max(0, Math.floor(minY));
  const rowEnd = Math.min(H - 1, Math.ceil(maxY));
  let ei = 0;
  let active = [];
  const xs = [];
  let count = 0;
  for (let y = rowStart; y <= rowEnd; y++) {
    const cy = y + 0.5;
    while (ei < edges.length && edges[ei].y0 <= cy) active.push(edges[ei++]);
    active = active.filter((e) => e.y1 > cy);
    xs.length = 0;
    for (const e of active) xs.push(e.x0 + (cy - e.y0) * e.slope);
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let xa = Math.ceil(xs[i] - 0.5);
      let xb = Math.floor(xs[i + 1] - 0.5);
      if (xa < 0) xa = 0;
      if (xb > W - 1) xb = W - 1;
      for (let x = xa; x <= xb; x++) {
        set(y * W + x);
        count++;
      }
    }
  }
  return count;
}

// Linha 4-conectada (sem "furos" diagonais), util para rios.
export function drawLine4(x0, y0, x1, y1, W, H, set) {
  let x = Math.floor(x0);
  let y = Math.floor(y0);
  const tx = Math.floor(x1);
  const ty = Math.floor(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 200000; guard++) {
    if (x >= 0 && y >= 0 && x < W && y < H) set(y * W + x);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 - dy > dx - e2) {
      err += dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
  }
}

export function loadJpeg(file) {
  return jpeg.decode(readFileSync(file), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 4096 });
}

// Amostrador de imagem global equirretangular (lon -180..180, lat 90..-90).
export function makeSampler(img) {
  const { width: w, height: h, data } = img;
  const idx = (lon, lat) => {
    const l = (((lon + 180) % 360) + 360) % 360;
    const x = Math.min(w - 1, Math.floor((l / 360) * w));
    const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
    return (y * w + x) * 4;
  };
  return { idx, data, red: (lon, lat) => data[idx(lon, lat)] };
}
