// Grafico de linhas em canvas: um unico eixo Y, linhas de 2px, grade discreta, rotulos diretos
// (ate 4 series), cruz de leitura e dica ao passar o mouse. Texto sempre na cor de tinta.
export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

export interface LineChartOptions {
  x: number[];
  series: ChartSeries[];
  yFormat: (v: number) => string;
  xFormat?: (v: number) => string;
  yMin?: number;
  yMax?: number;
  zeroLine?: boolean;
  directLabels?: boolean;
  compact?: boolean;
}

const INK = '#2a1c10';
const INK_SOFT = '#6a4d30';
const GRID = 'rgba(59, 38, 21, 0.14)';
const FONT = '12px "Pixelify Sans", monospace';

export class LineChart {
  private hoverIndex = -1;
  private readonly onMove = (ev: MouseEvent) => this.hover(ev);
  private readonly onLeave = () => {
    this.hoverIndex = -1;
    this.draw();
  };

  constructor(private readonly canvas: HTMLCanvasElement, private opts: LineChartOptions) {
    if (!opts.compact) {
      canvas.addEventListener('mousemove', this.onMove);
      canvas.addEventListener('mouseleave', this.onLeave);
    }
    this.draw();
  }

  private layout() {
    const direct = this.opts.directLabels && this.opts.series.length > 1 && this.opts.series.length <= 4;
    const compact = !!this.opts.compact;
    return {
      left: compact ? 6 : 70,
      right: direct ? 110 : compact ? 6 : 16,
      top: compact ? 8 : 14,
      bottom: compact ? 8 : 26,
    };
  }

  private range(): [number, number] {
    let min = this.opts.yMin ?? Infinity;
    let max = this.opts.yMax ?? -Infinity;
    if (this.opts.yMin === undefined || this.opts.yMax === undefined) {
      for (const s of this.opts.series) {
        for (const v of s.values) {
          if (!Number.isFinite(v)) continue;
          if (this.opts.yMin === undefined) min = Math.min(min, v);
          if (this.opts.yMax === undefined) max = Math.max(max, v);
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (this.opts.yMin === undefined && min > 0) min = 0;
    if (max - min < 1e-9) max = min + 1;
    return [min, max];
  }

  draw(): void {
    const canvas = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { x, series, yFormat } = this.opts;
    const pad = this.layout();
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;
    if (x.length < 2 || pw < 20 || ph < 20) {
      ctx.fillStyle = INK_SOFT;
      ctx.font = FONT;
      ctx.fillText('Dados insuficientes — aguarde alguns anos.', 8, h / 2);
      return;
    }
    const [ymin, ymax] = this.range();
    const x0 = x[0];
    const x1 = x[x.length - 1];
    const sx = (v: number) => pad.left + ((v - x0) / Math.max(1e-9, x1 - x0)) * pw;
    const sy = (v: number) => pad.top + ph - ((v - ymin) / (ymax - ymin)) * ph;
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    if (!this.opts.compact) {
      for (let i = 0; i <= 4; i++) {
        const v = ymin + ((ymax - ymin) * i) / 4;
        const y = Math.round(sy(v)) + 0.5;
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + pw, y);
        ctx.stroke();
        ctx.fillStyle = INK_SOFT;
        ctx.textAlign = 'right';
        ctx.fillText(yFormat(v), pad.left - 6, y);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const ticks = Math.min(6, x.length);
      for (let i = 0; i < ticks; i++) {
        const idx = Math.round((i * (x.length - 1)) / Math.max(1, ticks - 1));
        const v = x[idx];
        ctx.fillStyle = INK_SOFT;
        ctx.fillText(this.opts.xFormat ? this.opts.xFormat(v) : String(v), sx(v), pad.top + ph + 6);
      }
    }
    if (this.opts.zeroLine && ymin < 0 && ymax > 0) {
      ctx.strokeStyle = 'rgba(59, 38, 21, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, Math.round(sy(0)) + 0.5);
      ctx.lineTo(pad.left + pw, Math.round(sy(0)) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + ph + 1);
    ctx.lineTo(pad.left + pw, pad.top + ph + 1);
    ctx.stroke();

    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v) || i >= x.length) {
          started = false;
          return;
        }
        if (!started) {
          ctx.moveTo(sx(x[i]), sy(v));
          started = true;
        } else ctx.lineTo(sx(x[i]), sy(v));
      });
      ctx.stroke();
    }

    if (this.opts.directLabels && series.length > 1 && series.length <= 4) {
      const placed: number[] = [];
      const ends = series
        .map((s) => {
          let i = s.values.length - 1;
          while (i >= 0 && !Number.isFinite(s.values[i])) i--;
          return { s, i };
        })
        .filter((e) => e.i >= 0)
        .sort((a, b) => sy(a.s.values[a.i]) - sy(b.s.values[b.i]));
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const { s, i } of ends) {
        let y = sy(s.values[i]);
        for (const p of placed) if (Math.abs(p - y) < 14) y = p + 14;
        placed.push(y);
        const xx = sx(x[Math.min(i, x.length - 1)]) + 6;
        ctx.fillStyle = s.color;
        ctx.fillRect(xx, y - 4, 8, 8);
        ctx.fillStyle = INK;
        const label = s.label.length > 14 ? `${s.label.slice(0, 13)}…` : s.label;
        ctx.fillText(label, xx + 12, y);
      }
    }

    if (this.hoverIndex >= 0 && this.hoverIndex < x.length) {
      const i = this.hoverIndex;
      const hx = Math.round(sx(x[i])) + 0.5;
      ctx.strokeStyle = 'rgba(42, 28, 16, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, pad.top + ph);
      ctx.stroke();
      const rows = series
        .map((s) => ({ s, v: s.values[i] }))
        .filter((r) => Number.isFinite(r.v))
        .sort((a, b) => b.v - a.v)
        .slice(0, 8);
      for (const r of rows) {
        ctx.fillStyle = '#faf1d6';
        ctx.beginPath();
        ctx.arc(hx, sy(r.v), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = r.s.color;
        ctx.beginPath();
        ctx.arc(hx, sy(r.v), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      const title = this.opts.xFormat ? this.opts.xFormat(x[i]) : String(x[i]);
      const lines = rows.map((r) => `${r.s.label}: ${yFormat(r.v)}`);
      const boxW = Math.max(ctx.measureText(title).width, ...lines.map((l) => ctx.measureText(l).width)) + 30;
      const boxH = 20 + lines.length * 15;
      let bx = hx + 10;
      if (bx + boxW > w - 4) bx = hx - boxW - 10;
      const by = pad.top + 4;
      ctx.fillStyle = 'rgba(42, 28, 16, 0.92)';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffe3a3';
      ctx.fillText(title, bx + 8, by + 4);
      rows.forEach((r, k) => {
        ctx.fillStyle = r.s.color;
        ctx.fillRect(bx + 8, by + 22 + k * 15, 8, 8);
        ctx.fillStyle = '#ecdcb4';
        ctx.fillText(lines[k], bx + 20, by + 19 + k * 15);
      });
    }
  }

  private hover(ev: MouseEvent): void {
    const { x } = this.opts;
    if (x.length < 2) return;
    const pad = this.layout();
    const w = this.canvas.clientWidth;
    const pw = w - pad.left - pad.right;
    const t = (ev.offsetX - pad.left) / pw;
    const target = x[0] + t * (x[x.length - 1] - x[0]);
    let best = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i] - target) < Math.abs(x[best] - target)) best = i;
    if (best !== this.hoverIndex) {
      this.hoverIndex = best;
      this.draw();
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.onMove);
    this.canvas.removeEventListener('mouseleave', this.onLeave);
  }
}

export const chartColor = (c: [number, number, number]) => `rgb(${Math.round(c[0] * 0.8)},${Math.round(c[1] * 0.8)},${Math.round(c[2] * 0.8)})`;
