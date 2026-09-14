// Renderiza um PNG de depuracao em resolucao total de um mapa gerado:
// terreno, fronteiras de nacoes/provincias, rios, rotas maritimas e cidades.
// Uso: node tools/debug-render.mjs <idDoMapa> <saida.png> [x0 y0 x1 y1] [escala]
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { PNG } from 'pngjs';

const [id, outFile, ...rest] = process.argv.slice(2);
const dir = path.resolve('public/maps', id);
const meta = JSON.parse(readFileSync(path.join(dir, 'map.json'), 'utf8'));
const buf = gunzipSync(readFileSync(path.join(dir, 'grid.dat')));
const W = buf.readUInt16LE(6);
const H = buf.readUInt16LE(8);
const N = W * H;
const ids = new Uint16Array(buf.buffer.slice(buf.byteOffset + 12, buf.byteOffset + 12 + N * 2));
const terrain = buf.subarray(12 + N * 2, 12 + N * 3);
const elev = buf.subarray(12 + N * 3, 12 + N * 4);
const flags = buf.subarray(12 + N * 4, 12 + N * 5);
const [x0, y0, x1, y1] = rest.length >= 4 ? rest.slice(0, 4).map(Number) : [0, 0, W, H];
const S = Number(rest[4] || 1);

const TERRAIN_RGB = [
  [60, 90, 140], [196, 200, 140], [176, 160, 112], [140, 120, 100], [90, 140, 80], [50, 120, 60],
  [230, 205, 140], [190, 200, 200], [110, 140, 120],
];
const provNation = meta.provinces.map((p) => p.nation);
const w = (x1 - x0) * S;
const h = (y1 - y0) * S;
const png = new PNG({ width: w, height: h });
const put = (px, py, c) => {
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  const o = (py * w + px) * 4;
  png.data[o] = c[0];
  png.data[o + 1] = c[1];
  png.data[o + 2] = c[2];
  png.data[o + 3] = 255;
};
for (let y = y0; y < y1; y++) {
  for (let x = x0; x < x1; x++) {
    const i = y * W + x;
    const v = ids[i];
    let c;
    if (v === 0xffff) c = [52, 86, 132];
    else if (v === 0xfffe) c = [70, 110, 160];
    else {
      c = TERRAIN_RGB[terrain[i]].slice();
      if (v === 0xfffd) c = c.map((k) => k * 0.6 + 60);
      if (flags[i] & 1) c = [60, 120, 170];
      if (flags[i] & 2) c = [240, 240, 245];
      if (v < 0xfff0) {
        const right = x < W - 1 ? ids[i + 1] : v;
        const down = y < H - 1 ? ids[i + W] : v;
        const nb = [right, down];
        if (nb.some((u) => u < 0xfff0 && provNation[u] !== provNation[v])) c = [20, 20, 20];
        else if (nb.some((u) => u !== v && u < 0xfff0)) c = c.map((k) => k * 0.7);
      }
    }
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) put((x - x0) * S + sx, (y - y0) * S + sy, c);
  }
}
const line = (ax, ay, bx, by, c) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * S));
  for (let k = 0; k <= steps; k++) {
    if (k % 6 > 3) continue;
    put(Math.round((ax + ((bx - ax) * k) / steps - x0) * S), Math.round((ay + ((by - ay) * k) / steps - y0) * S), c);
  }
};
for (const r of meta.seaRoutes) {
  for (let k = 0; k + 3 < r.pts.length; k += 2) line(r.pts[k], r.pts[k + 1], r.pts[k + 2], r.pts[k + 3], [235, 220, 170]);
}
for (const c of meta.cities) {
  const col = c.cap === 2 ? [220, 30, 30] : c.synthetic ? [120, 120, 120] : [30, 30, 30];
  const r = c.cap === 2 ? 2 : 1;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) put(Math.round((c.x - x0) * S) + dx, Math.round((c.y - y0) * S) + dy, col);
}
writeFileSync(outFile, PNG.sync.write(png));
console.log(`ok ${w}x${h} -> ${outFile}`);
