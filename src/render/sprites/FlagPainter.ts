// Pintor de bandeiras em pixel art (grade 32x20): faixas, cruzes, triangulos, discos, crescentes, estrelas,
// Union Jack e pequenos brasoes desenhados por mapas de caracteres. Independente de DOM.
import type { PixelArt, RGBA } from './PixelArt';

export const FLAG_W = 32;
export const FLAG_H = 20;

const parsed = new Map<string, RGBA>();
function rgba(hex: string): RGBA {
  let c = parsed.get(hex);
  if (!c) {
    const n = Number.parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    parsed.set(hex, c);
  }
  return c;
}

// Estrelas de 5 pontas por tamanho (1 = um pixel).
const STARS: Record<number, string[]> = {
  2: ['.X.', 'XXX', 'X.X'],
  3: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.'],
  4: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', '.X...X.'],
};

type Dir = 'up' | 'down';

// Altura da diagonal na coluna x: 'up' vai do canto inferior esquerdo ao superior direito; 'down' do superior
// esquerdo ao inferior direito.
const diagY = (x: number, dir: Dir) => (dir === 'down' ? (x * FLAG_H) / FLAG_W : FLAG_H - (x * FLAG_H) / FLAG_W);

export class FlagPainter {
  constructor(private readonly art: PixelArt) {}

  px(x: number, y: number, c: string): this {
    const xx = Math.floor(x);
    const yy = Math.floor(y);
    if (xx >= 0 && yy >= 0 && xx < FLAG_W && yy < FLAG_H) this.art.set(xx, yy, rgba(c));
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(FLAG_W, Math.round(x + w));
    const y1 = Math.min(FLAG_H, Math.round(y + h));
    const col = rgba(c);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.art.set(xx, yy, col);
    return this;
  }

  fill(c: string): this {
    return this.rect(0, 0, FLAG_W, FLAG_H, c);
  }

  // Pinta cada pixel da regiao com a cor devolvida (coordenadas do centro do pixel); null mantem o pixel.
  each(fn: (x: number, y: number) => string | null, x0 = 0, y0 = 0, w = FLAG_W, h = FLAG_H): this {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const c = fn(x + 0.5, y + 0.5);
        if (c) this.px(x, y, c);
      }
    }
    return this;
  }

  // Faixas horizontais proporcionais aos pesos, dentro da regiao.
  h(colors: string[], weights: number[] = colors.map(() => 1), x = 0, y = 0, w = FLAG_W, h = FLAG_H): this {
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    colors.forEach((c, i) => {
      const a = Math.round(y + (acc / total) * h);
      acc += weights[i];
      this.rect(x, a, w, Math.round(y + (acc / total) * h) - a, c);
    });
    return this;
  }

  // Faixas verticais proporcionais aos pesos, dentro da regiao.
  v(colors: string[], weights: number[] = colors.map(() => 1), x = 0, y = 0, w = FLAG_W, h = FLAG_H): this {
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    colors.forEach((c, i) => {
      const a = Math.round(x + (acc / total) * w);
      acc += weights[i];
      this.rect(a, y, Math.round(x + (acc / total) * w) - a, h, c);
    });
    return this;
  }

  // Listras alternadas de mesma altura.
  stripes(count: number, a: string, b: string): this {
    return this.h(Array.from({ length: count }, (_, i) => (i % 2 ? b : a)));
  }

  // Cruz nordica (deslocada para a haste), com filete interno opcional.
  nordic(bg: string, cross: string, inner?: string): this {
    this.fill(bg);
    if (!inner) return this.rect(9, 0, 4, FLAG_H, cross).rect(0, 8, FLAG_W, 4, cross);
    return this.rect(8, 0, 6, FLAG_H, cross).rect(0, 7, FLAG_W, 6, cross).rect(10, 0, 2, FLAG_H, inner).rect(0, 9, FLAG_W, 2, inner);
  }

  // Cruz centrada de espessura t.
  cross(c: string, t = 4): this {
    return this.rect(FLAG_W / 2 - t / 2, 0, t, FLAG_H, c).rect(0, FLAG_H / 2 - t / 2, FLAG_W, t, c);
  }

  // Triangulo apoiado na haste, com ponta em `depth`; top/bottom limitam a base.
  triangle(c: string, depth: number, top = 0, bottom = FLAG_H): this {
    const mid = (top + bottom) / 2;
    const half = (bottom - top) / 2;
    return this.each((x, y) => (Math.abs(y - mid) <= half && x <= depth * (1 - Math.abs(y - mid) / half) ? c : null));
  }

  // Faixa diagonal de espessura vertical t, deslocada de `offset` pixels.
  band(c: string, t: number, dir: Dir, offset = 0): this {
    return this.each((x, y) => (Math.abs(y - diagY(x, dir) - offset) < t / 2 ? c : null));
  }

  // Divisao diagonal: `a` acima da linha e `b` abaixo.
  diagonal(a: string, b: string, dir: Dir): this {
    return this.each((x, y) => (y < diagY(x, dir) ? a : b));
  }

  saltire(c: string, t: number): this {
    return this.band(c, t, 'up').band(c, t, 'down');
  }

  // Quatro triangulos pelas diagonais: `tb` em cima e embaixo, `sides` na haste e na ponta.
  quarters(tb: string, sides: string): this {
    return this.each((x, y) => (Math.abs(y - FLAG_H / 2) * FLAG_W > Math.abs(x - FLAG_W / 2) * FLAG_H ? tb : sides));
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    return this.each((x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? c : null));
  }

  ring(cx: number, cy: number, r: number, t: number, c: string): this {
    return this.each((x, y) => {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      return d <= r * r && d > (r - t) ** 2 ? c : null;
    });
  }

  // Crescente: disco menos um disco interno deslocado (a abertura fica para o lado do deslocamento).
  crescent(cx: number, cy: number, r: number, c: string, dx = r * 0.4, dy = 0, inner = r * 0.8): this {
    return this.each((x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (x - cx - dx) ** 2 + (y - cy - dy) ** 2 > inner * inner ? c : null));
  }

  star(cx: number, cy: number, size: number, c: string): this {
    if (size <= 1) return this.px(cx, cy, c);
    const rows = STARS[Math.min(4, size)];
    const off = Math.floor(rows[0].length / 2);
    return this.sprite(rows, Math.floor(cx) - off, Math.floor(cy) - off, { X: c });
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
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

  // Desenho por mapa de caracteres: cada letra com cor na paleta; '.' fica transparente.
  sprite(rows: string[], x: number, y: number, palette: Record<string, string>): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = palette[row[i]];
        if (c) this.px(x + i, y + j, c);
      }
    });
    return this;
  }

  border(c: string, t = 1): this {
    return this.rect(0, 0, FLAG_W, t, c).rect(0, FLAG_H - t, FLAG_W, t, c).rect(0, 0, t, FLAG_H, c).rect(FLAG_W - t, 0, t, FLAG_H, c);
  }

  // Faixa junto a haste com borda serrilhada (Bahrein, Catar).
  serrated(c: string, base: number, depth: number, points: number): this {
    const period = FLAG_H / points;
    return this.each((x, y) => (x < base + depth * (1 - Math.abs((y % period) / period - 0.5) * 2) ? c : null));
  }

  // Forquilha em Y deitado (Africa do Sul, Vanuatu): `outer` e a borda e `inner` a faixa central.
  pall(outer: string, inner: string, tOuter: number, tInner: number, forkX: number): this {
    const mid = FLAG_H / 2;
    const len = Math.hypot(forkX, mid);
    return this.each((x, y) => {
      const d = x >= forkX ? Math.abs(y - mid) : Math.min(Math.abs(mid * x - forkX * y), Math.abs(mid * x - forkX * (FLAG_H - y))) / len;
      return d < tInner / 2 ? inner : d < tOuter / 2 ? outer : null;
    });
  }

  // Union Jack na regiao: bandeira britanica inteira ou cantao das bandeiras ligadas ao Reino Unido.
  unionJack(x0 = 0, y0 = 0, w = 16, h = 10): this {
    const diag = Math.hypot(w, h);
    return this.each(
      (x, y) => {
        const u = x - x0;
        const v = y - y0;
        const dv = Math.abs(u - w / 2);
        const dh = Math.abs(v - h / 2);
        if (dv < h / 10 || dh < h / 10) return '#c8102e';
        if (dv < h / 6 || dh < h / 6) return '#ffffff';
        const d = Math.min(Math.abs(u * h - v * w), Math.abs((w - u) * h - v * w)) / diag;
        if (d < Math.max(0.5, h / 30)) return '#c8102e';
        if (d < h / 10) return '#ffffff';
        return '#012169';
      },
      x0,
      y0,
      w,
      h,
    );
  }
}
