// Barra inferior: controle de tempo (pausa, play, avancar e velocidades) e atalhos dos paineis.
import { DAYS_PER_SECOND_1X, SPEEDS } from '../../app/GameLoop';
import { el, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

export class BottomBar {
  readonly node: HTMLElement;
  private lastReal = '';

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'px-panel bottombar');
    this.node.innerHTML = `
      <div class="group">
        <button class="px-btn square" data-act="pause" title="Pausar (Espaço)">${icon('pause', 20)}</button>
        <button class="px-btn square" data-act="play" title="Continuar">${icon('play', 20)}</button>
        <button class="px-btn square" data-act="ff" title="Acelerar">${icon('ff', 20)}</button>
      </div>
      <span class="sep"></span>
      <div class="group">
        ${SPEEDS.map((s, i) => `<button class="px-btn speed-btn" data-speed="${s}" title="Tecla ${i + 1} · ${s * DAYS_PER_SECOND_1X} dias por segundo">${s}x</button>`).join('')}
      </div>
      <span class="real-speed" data-real></span>
      <span class="grow"></span>
      <div class="group">
        <button class="px-btn" data-act="history" title="Histórico (H)">${icon('book', 18)} Histórico</button>
        <button class="px-btn" data-act="wars" title="Guerras (G)">${icon('swords', 18)} Guerras</button>
        <button class="px-btn" data-act="stats" title="Estatísticas (E)">${icon('chart', 18)} Estatísticas</button>
        <button class="px-btn" data-act="settings">${icon('gear', 18)} Configurações</button>
        <button class="px-btn" data-act="save" title="Salvar (Ctrl+S)">${icon('save', 18)} Salvar</button>
        <button class="px-btn" data-act="load">${icon('folder', 18)} Carregar</button>
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
    this.node.querySelector('[data-act="pause"]')?.classList.toggle('on', loop.paused);
    this.node.querySelector('[data-act="play"]')?.classList.toggle('on', !loop.paused);
    this.node.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('on', !loop.paused && Number(b.dataset.speed) === loop.speed));
    const real = loop.paused ? 'pausado' : `≈ ${Math.round(loop.actualDaysPerSecond)} dias/s`;
    if (real !== this.lastReal) {
      this.lastReal = real;
      const node = this.node.querySelector('[data-real]');
      if (node) node.textContent = real;
    }
  }
}
