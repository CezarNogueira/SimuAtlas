// Pintor de pixel art: cria sprites 64x64 a partir de mapas de caracteres (16x16 x4)
// ou de primitivas desenhadas em grade 32x32 (x2), com contorno automatico e tingimento.
export type RGBA = [number, number, number, number];

export const PALETTE: Record<string, RGBA> = {
  k: [27, 20, 16, 255],
  w: [244, 236, 216, 255],
  W: [255, 255, 255, 255],
  l: [200, 196, 186, 255],
  g: [138, 134, 126, 255],
  d: [74, 70, 66, 255],
  m: [164, 176, 186, 255],
  M: [104, 116, 128, 255],
  b: [128, 80, 40, 255],
  B: [78, 48, 24, 255],
  n: [216, 184, 120, 255],
  N: [176, 140, 84, 255],
  y: [236, 188, 70, 255],
  Y: [168, 116, 30, 255],
  r: [190, 56, 44, 255],
  R: [122, 30, 24, 255],
  o: [228, 122, 40, 255],
  O: [252, 204, 92, 255],
  u: [62, 116, 184, 255],
  U: [36, 63, 112, 255],
  a: [128, 184, 226, 255],
  e: [84, 160, 64, 255],
  E: [47, 95, 36, 255],
  s: [228, 172, 124, 255],
  S: [176, 120, 80, 255],
  p: [130, 80, 160, 255],
  c: [255, 0, 255, 255],
  C: [128, 0, 128, 255],
};

const TINT_MAIN: RGBA = PALETTE.c;
const TINT_DARK: RGBA = PALETTE.C;

export class PixelArt {
  readonly data: Uint8ClampedArray;

  constructor(readonly size: number) {
    this.data = new Uint8ClampedArray(size * size * 4);
  }

  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const o = (Math.floor(y) * this.size + Math.floor(x)) * 4;
    this.data[o] = c[0];
    this.data[o + 1] = c[1];
    this.data[o + 2] = c[2];
    this.data[o + 3] = c[3];
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return 0;
    return this.data[(y * this.size + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA, width = 1): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.rect(x, y, width, width, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: RGBA): this {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c);
    return this;
  }

  triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGBA): this {
    const minY = Math.min(ay, by, cy);
    const maxY = Math.max(ay, by, cy);
    const edges: [number, number, number, number][] = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]];
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (const [x0, y0, x1, y1] of edges) {
        if ((y >= y0 && y <= y1) || (y >= y1 && y <= y0)) {
          if (y0 === y1) xs.push(x0, x1);
          else xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      if (xs.length < 2) continue;
      const lo = Math.round(Math.min(...xs));
      const hi = Math.round(Math.max(...xs));
      for (let x = lo; x <= hi; x++) this.set(x, y, c);
    }
    return this;
  }

  rows(rows: string[], ox = 0, oy = 0, scale = 1, palette: Record<string, RGBA> = PALETTE): this {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = palette[row[x]];
        if (col) this.rect(ox + x * scale, oy + y * scale, scale, scale, col);
      }
    });
    return this;
  }

  // Contorno escuro ao redor dos pixels opacos.
  outline(c: RGBA = PALETTE.k): this {
    const s = this.size;
    const mark: number[] = [];
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) mark.push(x, y);
      }
    }
    for (let i = 0; i < mark.length; i += 2) this.set(mark[i], mark[i + 1], c);
    return this;
  }

  scaled(factor: number): PixelArt {
    const out = new PixelArt(this.size * factor);
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const o = (y * this.size + x) * 4;
        if (!this.data[o + 3]) continue;
        out.rect(x * factor, y * factor, factor, factor, [this.data[o], this.data[o + 1], this.data[o + 2], this.data[o + 3]]);
      }
    }
    return out;
  }

  // Substitui as cores-marcadoras (magenta) pela cor do pais.
  tinted(main: [number, number, number]): PixelArt {
    const out = new PixelArt(this.size);
    out.data.set(this.data);
    const dark: [number, number, number] = [Math.round(main[0] * 0.62), Math.round(main[1] * 0.62), Math.round(main[2] * 0.62)];
    const d = out.data;
    for (let o = 0; o < d.length; o += 4) {
      if (d[o] === TINT_MAIN[0] && d[o + 1] === TINT_MAIN[1] && d[o + 2] === TINT_MAIN[2]) {
        d[o] = main[0];
        d[o + 1] = main[1];
        d[o + 2] = main[2];
      } else if (d[o] === TINT_DARK[0] && d[o + 1] === TINT_DARK[1] && d[o + 2] === TINT_DARK[2]) {
        d[o] = dark[0];
        d[o + 1] = dark[1];
        d[o + 2] = dark[2];
      }
    }
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.size, this.size), 0, 0);
    return canvas;
  }
}

export const col = (key: string): RGBA => PALETTE[key];
