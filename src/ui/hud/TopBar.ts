// Barra superior: data, era, velocidade e indicadores globais do mundo.
import { formatDate } from '../../core/calendar';
import { fmtCompact } from '../../core/format';
import { isRebelGoal } from '../../sim/engines/WarEngine';
import { el, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

export class TopBar {
  readonly node: HTMLElement;
  private cache = new Map<string, string>();

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'px-panel topbar');
    this.node.innerHTML = `
      <span class="brand">SimuAtlas</span>
      <span class="date lnk" data-part="date" title="Pausar / continuar (Espaço)"></span>
      <span class="era" data-part="era"></span>
      <span class="speed-tag" data-part="speed"></span>
      <span class="spacer"></span>
      <span class="stat hide-sm" data-part="nations" title="Nações existentes"></span>
      <span class="stat lnk" data-part="wars" title="Guerras em andamento (G)"></span>
      <span class="stat hide-sm" data-part="rebels" title="Rebeliões ativas"></span>
      <span class="stat hide-sm" data-part="battles" title="Batalhas em andamento"></span>
      <span class="stat hide-sm" data-part="pop" title="População mundial"></span>
      <span class="mapname">${esc(ui.screen.map.name)}</span>
      <button class="px-btn square" data-part="menu" title="Menu (Esc)">${icon('globe', 20)}</button>`;
    ui.layer.appendChild(this.node);
    this.node.addEventListener('click', (ev) => {
      const part = (ev.target as HTMLElement).closest<HTMLElement>('[data-part]')?.dataset.part;
      if (part === 'date') ui.loop.togglePause();
      else if (part === 'menu') ui.openModal('menu');
      else if (part === 'wars') ui.toggleLeft('wars');
    });
  }

  private set(part: string, html: string): void {
    if (this.cache.get(part) === html) return;
    this.cache.set(part, html);
    const target = this.node.querySelector<HTMLElement>(`[data-part="${part}"]`);
    if (target) target.innerHTML = html;
  }

  update(): void {
    const ui = this.ui;
    const sim = ui.sim;
    const s = sim.state;
    this.set('date', formatDate(s.day, s.startYear));
    let pop = 0;
    let nations = 0;
    for (const c of s.countries) {
      if (!c.alive || c.kind !== 'nation') continue;
      nations++;
      pop += c.population;
    }
    // A era e definida pelo ano da simulacao.
    this.set('era', esc(sim.eras.current().name));
    const loop = ui.loop;
    const tag = this.node.querySelector<HTMLElement>('[data-part="speed"]');
    tag?.classList.toggle('paused', loop.paused);
    this.set('speed', loop.paused ? 'PAUSADO' : `${loop.speed}x`);
    let wars = 0;
    let rebels = 0;
    for (const w of sim.index.activeWars) {
      if (isRebelGoal(w.goal.type)) rebels++;
      else wars++;
    }
    this.set('nations', `${icon('flag', 16)} ${nations}`);
    this.set('wars', `${icon('swords', 16)} ${wars}`);
    this.set('rebels', `${icon('fire', 16)} ${rebels}`);
    this.set('battles', `${icon('sword', 16)} ${sim.battles.ongoing.length}`);
    this.set('pop', `${icon('people', 16)} ${fmtCompact(pop)}`);
  }
}
