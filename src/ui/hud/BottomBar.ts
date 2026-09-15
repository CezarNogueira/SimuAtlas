// Barra inferior: controle de tempo (pausa, play, avancar e velocidades) e atalhos dos paineis.
import { DAYS_PER_SECOND_1X, SPEEDS } from '../../app/GameLoop';
import { button } from '../components';
import { el, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

const GROUP = 'flex flex-wrap items-center gap-1';

export class BottomBar {
  readonly node: HTMLElement;
  private lastReal = '';

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'parchment absolute right-2 bottom-2 left-2 flex min-h-14 flex-wrap items-center gap-1.5 px-2.5 py-1.5 font-pixel');
    this.node.dataset.ui = 'bottombar';
    const panel = (act: string, label: string, iconName: string, title?: string) => button(label, { icon: iconName, iconSize: 18, title, attrs: `data-act="${act}"` });
    this.node.innerHTML = `
      <div class="${GROUP}">
        ${button(icon('pause', 20), { size: 'icon', title: 'Pausar (Espaço)', pressed: false, attrs: 'data-act="pause"' })}
        ${button(icon('play', 20), { size: 'icon', title: 'Continuar', pressed: false, attrs: 'data-act="play"' })}
        ${button(icon('ff', 20), { size: 'icon', title: 'Acelerar', attrs: 'data-act="ff"' })}
      </div>
      <span class="mx-1 w-0.5 self-stretch bg-paper-dark"></span>
      <div class="${GROUP}">
        ${SPEEDS.map((s, i) => button(`${s}x`, { size: 'speed', title: `Tecla ${i + 1} · ${s * DAYS_PER_SECOND_1X} dias por segundo`, pressed: false, attrs: `data-speed="${s}"` })).join('')}
      </div>
      <span class="min-w-[90px] text-xs text-ink-soft" data-real></span>
      <span class="flex-1"></span>
      <div class="${GROUP}">
        ${panel('history', 'Histórico', 'book', 'Histórico (H)')}
        ${panel('wars', 'Guerras', 'swords', 'Guerras (G)')}
        ${panel('techs', 'Tecnologia', 'gear', 'Tecnologias (T)')}
        ${panel('stats', 'Estatísticas', 'chart', 'Estatísticas (E)')}
        ${panel('settings', 'Configurações', 'gear')}
        ${panel('save', 'Salvar', 'save', 'Salvar (Ctrl+S)')}
        ${panel('load', 'Carregar', 'folder')}
      </div>`;
    ui.layer.appendChild(this.node);
    this.node.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act],[data-speed]');
      if (!t) return;
      const loop = ui.loop;
      if (t.dataset.speed) {
        loop.setSpeed(Number(t.dataset.speed));
        return;
      }
      switch (t.dataset.act) {
        case 'pause': loop.paused = true; break;
        case 'play': loop.paused = false; break;
        case 'ff': {
          const idx = SPEEDS.indexOf(loop.speed as (typeof SPEEDS)[number]);
          loop.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, idx + 1)]);
          break;
        }
        case 'history': ui.toggleLeft('history'); break;
        case 'wars': ui.toggleLeft('wars'); break;
        case 'techs': ui.toggleLeft('techs'); break;
        case 'stats': ui.openModal('stats'); break;
        case 'settings': ui.openModal('settings'); break;
        case 'save': ui.openModal('save'); break;
        case 'load': ui.openModal('load'); break;
        default: break;
      }
      this.update();
    });
  }

  update(): void {
    const loop = this.ui.loop;
    this.node.querySelector('[data-act="pause"]')?.setAttribute('aria-pressed', String(loop.paused));
    this.node.querySelector('[data-act="play"]')?.setAttribute('aria-pressed', String(!loop.paused));
    this.node.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(!loop.paused && Number(b.dataset.speed) === loop.speed)));
    const real = loop.paused ? 'pausado' : `≈ ${Math.round(loop.actualDaysPerSecond)} dias/s`;
    if (real !== this.lastReal) {
      this.lastReal = real;
      const node = this.node.querySelector('[data-real]');
      if (node) node.textContent = real;
    }
  }
}
