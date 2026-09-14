// Texto em pixel art: renderiza com a fonte pixelada, aplica limiar de alfa (sem antialias)
// e contorno de 1px; o resultado e cacheado e desenhado com escala "nearest neighbor".
export interface PixelTextStyle {
  font: string;
  size: number;
  color: string;
  outline: string;
}

export const LABEL_STYLE: PixelTextStyle = { font: '600 16px "Pixelify Sans", monospace', size: 16, color: '#2b1d12', outline: '#f1e4c2' };
export const CITY_STYLE: PixelTextStyle = { font: '500 12px "Pixelify Sans", monospace', size: 12, color: '#20160e', outline: '#efe2c0' };
export const SEA_STYLE: PixelTextStyle = { font: '500 13px "Pixelify Sans", monospace', size: 13, color: '#dbe7f2', outline: '#2a4a73' };
export const FEATURE_STYLE: PixelTextStyle = { font: '500 12px "Pixelify Sans", monospace', size: 12, color: '#5a3b20', outline: '#e8d8b0' };
export const PLATE_STYLE: PixelTextStyle = { font: '600 12px "Pixelify Sans", monospace', size: 12, color: '#fff6de', outline: '#1a120b' };
// Estados: caixa-alta discreta (estilo atlas), para nao confundir com os nomes das cidades.
export const STATE_STYLE: PixelTextStyle = { font: '500 11px "Pixelify Sans", monospace', size: 11, color: '#5a4128', outline: '#efe3c4' };

export class PixelTextCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private readonly measure: CanvasRenderingContext2D;

  constructor() {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    this.measure = ctx;
  }

  get(text: string, style: PixelTextStyle): HTMLCanvasElement {
    const key = `${style.font}|${style.color}|${style.outline}|${text}`;
    let canvas = this.cache.get(key);
    if (canvas) return canvas;
    this.measure.font = style.font;
    const w = Math.ceil(this.measure.measureText(text).width) + 6;
    const h = style.size + 8;
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, w);
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.font = style.font;
    ctx.textBaseline = 'middle';
    const y = h / 2 + 1;
    ctx.fillStyle = style.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) ctx.fillText(text, 3 + dx, y + dy);
    ctx.fillStyle = style.color;
    ctx.fillText(text, 3, y);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let o = 0; o < d.length; o += 4) d[o + 3] = d[o + 3] > 110 ? 255 : 0;
    ctx.putImageData(img, 0, 0);
    if (this.cache.size > 8000) this.cache.clear();
    this.cache.set(key, canvas);
    return canvas;
  }

  clear(): void {
    this.cache.clear();
  }
}
