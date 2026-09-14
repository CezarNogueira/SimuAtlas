// Escrita dos artefatos de mapa: grade binaria compactada (gzip) e miniatura PNG.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { PNG } from 'pngjs';
import { F } from './terrain.mjs';

export const CELL = { OCEAN: 0xffff, LAKE: 0xfffe, FOREIGN: 0xfffd };

// Formato: "AVMG" | u16 versao | u16 largura | u16 altura | u16 reservado |
// Uint16[N] provincia | Uint8[N] terreno | Uint8[N] elevacao | Uint8[N] flags
export function writeGrid(file, { W, H, owner, prov, terrain, elev, flags }) {
  const N = W * H;
  const header = 12;
  const buf = Buffer.alloc(header + N * 5);
  buf.write('AVMG', 0, 'ascii');
  buf.writeUInt16LE(1, 4);
  buf.writeUInt16LE(W, 6);
  buf.writeUInt16LE(H, 8);
  buf.writeUInt16LE(0, 10);
  const ids = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    if (prov[i] >= 0) ids[i] = prov[i];
    else if (owner[i] === -2) ids[i] = CELL.FOREIGN;
    else if (flags[i] & F.LAKE) ids[i] = CELL.LAKE;
    else ids[i] = CELL.OCEAN;
  }
  Buffer.from(ids.buffer).copy(buf, header);
  let o = header + N * 2;
  Buffer.from(terrain.buffer, terrain.byteOffset, N).copy(buf, o);
  o += N;
  Buffer.from(elev.buffer, elev.byteOffset, N).copy(buf, o);
  o += N;
  Buffer.from(flags.buffer, flags.byteOffset, N).copy(buf, o);
  const gz = gzipSync(buf, { level: 9 });
  writeFileSync(file, gz);
  return gz.length;
}

function hash(n) {
  let h = Math.imul(n + 0x51ed27, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

export function writePreview(file, { W, H, owner, elev }, maxW = 480) {
  const f = Math.max(1, W / maxW);
  const w = Math.round(W / f);
  const h = Math.round(H / f);
  const png = new PNG({ width: w, height: h });
  const at = (px, py) => {
    const x = Math.min(W - 1, Math.floor((px + 0.5) * f));
    const y = Math.min(H - 1, Math.floor((py + 0.5) * f));
    return y * W + x;
  };
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = at(px, py);
      const n = owner[i];
      let c;
      if (n === -1) c = [52, 86, 132];
      else if (n === -2) c = [190, 180, 152];
      else c = hsl(hash(n) * 360, 0.5, 0.62);
      if (n !== -1) {
        const shade = 1 - Math.min(0.25, elev[i] / 700);
        c = c.map((v) => v * shade);
        const nbs = [px > 0 ? at(px - 1, py) : i, px < w - 1 ? at(px + 1, py) : i, py > 0 ? at(px, py - 1) : i, py < h - 1 ? at(px, py + 1) : i];
        if (nbs.some((j) => owner[j] !== n)) c = c.map((v) => v * 0.55);
      }
      const o = (py * w + px) * 4;
      png.data[o] = c[0];
      png.data[o + 1] = c[1];
      png.data[o + 2] = c[2];
      png.data[o + 3] = 255;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}
