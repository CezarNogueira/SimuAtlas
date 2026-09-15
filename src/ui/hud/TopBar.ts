// Barra superior: data, era, velocidade e indicadores globais do mundo.
import { formatDate } from '../../core/calendar';
import { fmtCompact } from '../../core/format';
import { isRebelGoal } from '../../sim/engines/WarEngine';
import { button, LINK } from '../components';
import { el, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

const STAT = 'flex items-center gap-1 whitespace-nowrap text-sm';

export class TopBar {
  readonly node: HTMLElement;
  private cache = new Map<string, string>();

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'parchment absolute top-2 right-2 left-2 flex h-12 items-center gap-2.5 px-2.5 font-pixel');
    this.node.dataset.ui = 'topbar';
    this.node.innerHTML = `
      <span class="text-[30px] leading-none text-red [text-shadow:2px_2px_0_var(--color-edge)] max-[760px]:hidden">SimuAtlas</span>
      <span class="${LINK} min-w-[128px] text-[22px] font-bold tracking-[1px]" data-part="date" title="Pausar / continuar (Espaço)"></span>
      <span class="text-[13px] text-ink-soft" data-part="era"></span>
      <span class="border-2 border-edge bg-paper-2 px-2 py-0.5 font-bold data-[paused=true]:bg-danger data-[paused=true]:text-red" data-part="speed"></span>
      <span class="flex-1"></span>
      <span class="${STAT} max-[760px]:hidden" data-part="nations" title="Nações existentes"></span>
      <span class="${STAT} ${LINK}" data-part="wars" title="Guerras em andamento (G)"></span>
      <span class="${STAT} max-[760px]:hidden" data-part="rebels" title="Rebeliões ativas"></span>
      <span class="${STAT} max-[760px]:hidden" data-part="battles" title="Batalhas em andamento"></span>
      <span class="${STAT} max-[760px]:hidden" data-part="pop" title="População mundial"></span>
      <span class="whitespace-nowrap text-[13px] text-ink-soft max-[760px]:hidden">${esc(ui.screen.map.name)}</span>
      ${button(icon('globe', 20), { size: 'icon', title: 'Menu (Esc)', attrs: 'data-part="menu"' })}`;
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
    if (tag) tag.dataset.paused = String(loop.paused);
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
