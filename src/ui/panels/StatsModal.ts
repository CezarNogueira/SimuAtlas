// Estatisticas: rankings (populacao, PIB, exercito, territorio...), evolucao mundial,
// comparacao entre as maiores nacoes e evolucao territorial (mapa a cada decada).
import { fmtArea, fmtCompact, fmtInt, fmtMoney } from '../../core/format';
import { RANK_LABELS, type RankMetric } from '../../sim/engines/StatsEngine';
import type { StatsSeries } from '../../state/types';
import { chartColor, LineChart } from '../charts/LineChart';
import { esc, flagInline, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { sec } from './common';
import { BasePanel } from './Panel';

const RANKS: { metric: RankMetric; icon: string; fmt: (v: number) => string }[] = [
  { metric: 'population', icon: 'people', fmt: fmtCompact },
  { metric: 'gdp', icon: 'chart', fmt: fmtMoney },
  { metric: 'army', icon: 'sword', fmt: fmtCompact },
  { metric: 'area', icon: 'pin', fmt: fmtArea },
  { metric: 'provinces', icon: 'flag', fmt: fmtInt },
  { metric: 'gdpPerCapita', icon: 'coins', fmt: fmtMoney },
  { metric: 'tech', icon: 'gear', fmt: (v) => v.toFixed(1) },
  { metric: 'prestige', icon: 'crown', fmt: (v) => String(Math.round(v)) },
];

type CompareKey = 'pop' | 'gdp' | 'army' | 'provinces';
const COMPARE: { key: CompareKey; label: string; fmt: (v: number) => string; rank: RankMetric }[] = [
  { key: 'pop', label: 'População', fmt: fmtCompact, rank: 'population' },
  { key: 'gdp', label: 'PIB', fmt: fmtMoney, rank: 'gdp' },
  { key: 'army', label: 'Exército', fmt: fmtCompact, rank: 'army' },
  { key: 'provinces', label: 'Estados', fmt: fmtInt, rank: 'provinces' },
];

export class StatsModal extends BasePanel {
  private charts: LineChart[] = [];
  private compare: CompareKey = 'gdp';
  private frame = -1;
  private timer = 0;
  private evoCache = new Map<number, HTMLCanvasElement>();

  constructor(ui: GameUI) {
    super(ui, 'modal');
    this.tab = 'rankings';
  }

  protected tabs(): [string, string][] {
    return [['rankings', 'Rankings'], ['mundo', 'Mundo'], ['comparar', 'Comparar nações'], ['evolucao', 'Evolução territorial']];
  }

  protected isStatic(): boolean {
    return this.tab !== 'rankings';
  }

  protected renderHead(): string {
    return `${icon('chart', 32)}<h2>Estatísticas — ${this.sim.year()}</h2><button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    if (this.tab !== 'evolucao') this.stopPlay();
    if (this.tab === 'mundo') return this.world();
    if (this.tab === 'comparar') return this.comparison();
    if (this.tab === 'evolucao') return this.evolution();
    return this.rankings();
  }

  private rankings(): string {
    const sim = this.sim;
    const cards = RANKS.map(({ metric, icon: ic, fmt }) => {
      const list = sim.stats.ranking(metric, 10);
      return `<div class="rank-card"><h4>${icon(ic, 16)} ${esc(RANK_LABELS[metric])}</h4><ol>${list
        .map((r) => `<li data-country="${r.country.id}">${flagInline(r.country, 16)} ${esc(r.country.name)}<span>${fmt(r.value)}</span></li>`)
        .join('')}</ol></div>`;
    }).join('');
    const counts = new Map<string, number>();
    for (const e of sim.state.history) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    const nations = sim.countries.nations();
    const facts = `<div class="kv2">
      <div>${icon('flag', 16)} Nações existentes: <b>${nations.length}</b></div>
      <div>${icon('swords', 16)} Guerras declaradas: <b>${counts.get('war_declared') ?? 0}</b></div>
      <div>${icon('sword', 16)} Batalhas registradas: <b>${counts.get('battle') ?? 0}</b></div>
      <div>${icon('skull', 16)} Nações extintas: <b>${sim.state.countries.filter((c) => !c.alive && c.kind === 'nation').length}</b></div>
      <div>${icon('flag', 16)} Independências: <b>${counts.get('independence') ?? 0}</b></div>
      <div>${icon('fire', 16)} Rebeliões: <b>${counts.get('rebellion') ?? 0}</b></div>
      <div>${icon('crown', 16)} Golpes e revoluções: <b>${(counts.get('coup') ?? 0) + (counts.get('revolution') ?? 0)}</b></div>
      <div>${icon('dove', 16)} Tratados de paz: <b>${counts.get('peace') ?? 0}</b></div>
    </div>`;
    return sec('Rankings', 'trophy', `<div class="rank-grid">${cards}</div>`) + sec('Números da história', 'book', facts);
  }

  private world(): string {
    const block = (key: string, title: string, iconName: string) => `<div class="chart-title">${icon(iconName, 16)} ${esc(title)}</div><div class="chart-wrap"><canvas data-world="${key}" style="height:200px"></canvas></div>`;
    return sec('Evolução mundial', 'globe', block('pop', 'População mundial', 'people') + block('gdp', 'PIB mundial', 'chart') + block('countries', 'Nações existentes', 'flag') + block('wars', 'Guerras em andamento', 'swords'));
  }

  private comparison(): string {
    const buttons = COMPARE.map((c) => `<button class="px-btn small${c.key === this.compare ? ' on' : ''}" data-action="compare" data-key="${c.key}">${esc(c.label)}</button>`).join('');
    return sec('Maiores nações', 'chart', `<div class="action">${buttons}</div><div class="chart-wrap"><canvas data-compare style="height:320px"></canvas><div class="chart-legend" data-legend></div></div><div class="muted">As 8 maiores nações atuais pelo critério escolhido. Passe o mouse sobre o gráfico para ler os valores.</div>`);
  }

  private frames(): { year: number; owners: number[] }[] {
    const s = this.sim.state;
    return [...s.stats.snapshots, { year: this.sim.year(), owners: s.provinces.map((p) => p.owner) }];
  }

  private evolution(): string {
    const frames = this.frames();
    if (this.frame < 0 || this.frame >= frames.length) this.frame = frames.length - 1;
    return sec('Evolução territorial', 'globe', `
      <div class="action">
        <button class="px-btn small" data-action="evo-prev">«</button>
        <input class="px-range" type="range" min="0" max="${frames.length - 1}" value="${this.frame}" data-evo-range style="flex:1">
        <button class="px-btn small" data-action="evo-next">»</button>
        <b data-evo-year style="min-width:52px;text-align:right">${frames[this.frame].year}</b>
        <button class="px-btn small" data-action="evo-play">${icon(this.timer ? 'pause' : 'play', 14)} ${this.timer ? 'Pausar' : 'Reproduzir'}</button>
      </div>
      <div class="chart-wrap"><canvas data-evo style="height:440px"></canvas></div>
      <div class="muted">Retratos das fronteiras a cada década desde ${this.sim.state.startYear}. Nações extintas mantêm suas cores originais.</div>`);
  }

  private evoImage(index: number): HTMLCanvasElement {
    const cached = this.evoCache.get(index);
    if (cached) return cached;
    const sim = this.sim;
    const m = sim.map;
    const frame = this.frames()[index];
    const W = m.width;
    const H = m.height;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const img = ctx.createImageData(W, H);
    const d = img.data;
    d.set(this.ui.renderer.terrain.base);
    const owners = frame.owners;
    const P = m.provinceCount;
    for (let p = 0; p < P; p++) {
      const owner = sim.state.countries[owners[p]];
      const col = owner?.color ?? [150, 150, 150];
      for (let k = m.cellStart[p]; k < m.cellStart[p + 1]; k++) {
        const i = m.cellList[k];
        const x = i % W;
        const right = x < W - 1 ? m.cells[i + 1] : p;
        const down = i + W < m.cells.length ? m.cells[i + W] : p;
        const border = (right < P && owners[right] !== owners[p]) || (down < P && owners[down] !== owners[p]);
        const k2 = border ? 0.45 : 0.92;
        const o = i * 4;
        d[o] = col[0] * k2 * 0.85 + d[o] * 0.15;
        d[o + 1] = col[1] * k2 * 0.85 + d[o + 1] * 0.15;
        d[o + 2] = col[2] * k2 * 0.85 + d[o + 2] * 0.15;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (index < this.frames().length - 1) this.evoCache.set(index, canvas);
    return canvas;
  }

  private drawEvolution(): void {
    const canvas = this.bodyEl.querySelector<HTMLCanvasElement>('canvas[data-evo]');
    if (!canvas) return;
    const frames = this.frames();
    const index = Math.max(0, Math.min(frames.length - 1, this.frame));
    const src = this.evoImage(index);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 440;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#243a5a';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / src.width, h / src.height);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(src, (w - src.width * scale) / 2, (h - src.height * scale) / 2, src.width * scale, src.height * scale);
    const year = this.bodyEl.querySelector('[data-evo-year]');
    if (year) year.textContent = String(frames[index].year);
    const range = this.bodyEl.querySelector<HTMLInputElement>('[data-evo-range]');
    if (range && Number(range.value) !== index) range.value = String(index);
  }

  private stopPlay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  protected afterRender(): void {
    for (const ch of this.charts) ch.destroy();
    this.charts = [];
    const sim = this.sim;
    const w = sim.state.stats.world;
    this.bodyEl.querySelectorAll<HTMLCanvasElement>('canvas[data-world]').forEach((canvas) => {
      const key = canvas.dataset.world as 'pop' | 'gdp' | 'countries' | 'wars';
      const values = key === 'countries' ? w.countries : key === 'wars' ? w.wars : w[key];
      const fmt = key === 'gdp' ? fmtMoney : key === 'pop' ? fmtCompact : fmtInt;
      this.charts.push(new LineChart(canvas, { x: w.years.slice(0, values.length), series: [{ label: key, color: '#2f5a8a', values }], yFormat: fmt, xFormat: String }));
    });
    const canvas = this.bodyEl.querySelector<HTMLCanvasElement>('canvas[data-compare]');
    if (canvas) {
      const def = COMPARE.find((c) => c.key === this.compare) ?? COMPARE[1];
      const top = sim.stats.ranking(def.rank, 8);
      const years = w.years;
      const series = top.map(({ country }) => {
        const s: StatsSeries | undefined = sim.state.stats.countries[country.id];
        const byYear = new Map<number, number>();
        if (s) s.years.forEach((y, i) => byYear.set(y, s[def.key][i]));
        return { label: country.name, color: chartColor(country.color), values: years.map((y) => byYear.get(y) ?? Number.NaN) };
      });
      this.charts.push(new LineChart(canvas, { x: years, series, yFormat: def.fmt, xFormat: String, directLabels: true }));
      const legend = this.bodyEl.querySelector('[data-legend]');
      if (legend) legend.innerHTML = series.map((s, i) => `<span data-country="${top[i].country.id}" class="lnk"><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('');
    }
    const range = this.bodyEl.querySelector<HTMLInputElement>('[data-evo-range]');
    if (range) {
      range.addEventListener('input', () => {
        this.frame = Number(range.value);
        this.drawEvolution();
      });
      this.drawEvolution();
    }
  }

  protected action(name: string, t: HTMLElement): void {
    const total = this.frames().length;
    switch (name) {
      case 'compare':
        this.compare = (t.dataset.key as CompareKey) ?? 'gdp';
        this.refresh();
        break;
      case 'evo-prev':
        this.frame = Math.max(0, this.frame - 1);
        this.drawEvolution();
        break;
      case 'evo-next':
        this.frame = Math.min(total - 1, this.frame + 1);
        this.drawEvolution();
        break;
      case 'evo-play':
        if (this.timer) this.stopPlay();
        else {
          if (this.frame >= total - 1) this.frame = 0;
          this.timer = window.setInterval(() => {
            const count = this.frames().length;
            this.frame++;
            if (this.frame >= count - 1) {
              this.frame = count - 1;
              this.stopPlay();
              this.refresh();
            }
            this.drawEvolution();
          }, 700);
        }
        this.refresh();
        break;
      default:
        break;
    }
  }

  destroy(): void {
    this.stopPlay();
    for (const ch of this.charts) ch.destroy();
    super.destroy();
  }
}
