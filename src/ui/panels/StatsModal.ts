// Estatisticas: rankings (populacao, PIB, exercito, territorio...), evolucao mundial,
// comparacao entre as maiores nacoes e evolucao territorial (mapa a cada decada).
import { fmtArea, fmtCompact, fmtInt, fmtMoney } from '../../core/format';
import { RANK_LABELS, type RankMetric } from '../../sim/engines/StatsEngine';
import type { StatsSeries } from '../../state/types';
import { chartColor, LineChart } from '../charts/LineChart';
import { actions, button, CHART_WRAP, chartTitle, LINK, modalTitle, mutedBlock, section } from '../components';
import { esc, flagInline, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
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
    return modalTitle('chart', `Estatísticas — ${this.sim.year()}`);
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
      const items = list
        .map((r) => `<li class="cursor-pointer py-px hover:underline" data-country="${r.country.id}">${flagInline(r.country, 16)} ${esc(r.country.name)}<span class="float-right font-semibold">${fmt(r.value)}</span></li>`)
        .join('');
      return `<div class="border-2 border-edge bg-paper-2 px-2 py-1.5" data-ui="rank-card"><h4 class="mb-1 flex items-center gap-1.5 font-pixel text-sm">${icon(ic, 16)}${esc(RANK_LABELS[metric])}</h4><ol class="list-decimal pl-[22px] text-[12.5px]">${items}</ol></div>`;
    }).join('');
    const counts = new Map<string, number>();
    for (const e of sim.state.history) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    const nations = sim.countries.nations();
    const fact = (iconName: string, label: string, value: number) => `<div>${icon(iconName, 16)} ${label}: <b>${value}</b></div>`;
    const facts = `<div class="grid grid-cols-2 gap-x-3.5 gap-y-0.5">
      ${fact('flag', 'Nações existentes', nations.length)}
      ${fact('swords', 'Guerras declaradas', counts.get('war_declared') ?? 0)}
      ${fact('sword', 'Batalhas registradas', counts.get('battle') ?? 0)}
      ${fact('skull', 'Nações extintas', sim.state.countries.filter((c) => !c.alive && c.kind === 'nation').length)}
      ${fact('flag', 'Independências', counts.get('independence') ?? 0)}
      ${fact('fire', 'Rebeliões', counts.get('rebellion') ?? 0)}
      ${fact('crown', 'Golpes e revoluções', (counts.get('coup') ?? 0) + (counts.get('revolution') ?? 0))}
      ${fact('dove', 'Tratados de paz', counts.get('peace') ?? 0)}
    </div>`;
    return section('Rankings', 'trophy', `<div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">${cards}</div>`) + section('Números da história', 'book', facts);
  }

  private world(): string {
    const block = (key: string, title: string, iconName: string) => `${chartTitle(iconName, title)}<div class="${CHART_WRAP}"><canvas class="block w-full" data-world="${key}" style="height:200px"></canvas></div>`;
    return section('Evolução mundial', 'globe', block('pop', 'População mundial', 'people') + block('gdp', 'PIB mundial', 'chart') + block('countries', 'Nações existentes', 'flag') + block('wars', 'Guerras em andamento', 'swords'));
  }

  private comparison(): string {
    const buttons = COMPARE.map((c) => button(esc(c.label), { size: 'sm', pressed: c.key === this.compare, attrs: `data-action="compare" data-key="${c.key}"` })).join('');
    return section(
      'Maiores nações',
      'chart',
      `${actions(buttons)}<div class="${CHART_WRAP}"><canvas class="block w-full" data-compare style="height:320px"></canvas><div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" data-legend></div></div>` +
        mutedBlock('As 8 maiores nações atuais pelo critério escolhido. Passe o mouse sobre o gráfico para ler os valores.', 'mt-1'),
    );
  }

  private frames(): { year: number; owners: number[] }[] {
    const s = this.sim.state;
    return [...s.stats.snapshots, { year: this.sim.year(), owners: s.provinces.map((p) => p.owner) }];
  }

  private evolution(): string {
    const frames = this.frames();
    if (this.frame < 0 || this.frame >= frames.length) this.frame = frames.length - 1;
    const controls = actions(
      button('«', { size: 'sm', attrs: 'data-action="evo-prev"' }) +
        `<input class="min-w-0 flex-1 accent-red" type="range" min="0" max="${frames.length - 1}" value="${this.frame}" data-evo-range>` +
        button('»', { size: 'sm', attrs: 'data-action="evo-next"' }) +
        `<b class="min-w-[52px] text-right" data-evo-year>${frames[this.frame].year}</b>` +
        button(this.timer ? 'Pausar' : 'Reproduzir', { size: 'sm', icon: this.timer ? 'pause' : 'play', iconSize: 14, attrs: 'data-action="evo-play"' }),
    );
    return section(
      'Evolução territorial',
      'globe',
      `${controls}<div class="${CHART_WRAP}"><canvas class="block w-full" data-evo style="height:440px"></canvas></div>` +
        mutedBlock(`Retratos das fronteiras a cada década desde ${this.sim.state.startYear}. Nações extintas mantêm suas cores originais.`, 'mt-1'),
    );
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
      if (legend) {
        legend.innerHTML = series
          .map((s, i) => `<span data-country="${top[i].country.id}" class="${LINK} inline-flex items-center gap-1"><i class="inline-block h-1 w-3.5" style="background:${s.color}"></i>${esc(s.label)}</span>`)
          .join('');
      }
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
