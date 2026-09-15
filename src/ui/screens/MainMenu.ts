// Tela inicial: titulo, fundo com o mapa-mundi pixelado e acoes principais.
import type { App } from '../../app/App';
import { button, SCREEN, screenBg } from '../components';
import { el, icon } from '../dom';

export class MainMenu {
  private node: HTMLElement;

  constructor(root: HTMLElement, app: App) {
    this.node = el('div', SCREEN);
    this.node.innerHTML = `
      ${screenBg('maps/world/preview.png')}
      <div class="parchment relative w-[min(520px,calc(100vw-32px))] px-[30px] pt-7 pb-6 text-center">
        <div>${icon('castle', 64)}</div>
        <div class="mt-1 mb-1.5 font-pixel text-[clamp(48px,10vw,80px)] leading-[0.9] text-red [text-shadow:3px_3px_0_var(--color-edge)]">SIMUATLAS</div>
        <div class="mb-5 font-pixel text-lg uppercase tracking-[3px] text-ink-soft">Simulador Geopolítico</div>
        <div class="flex flex-col gap-2.5">
          ${button('Novo Jogo', { tone: 'primary', size: 'lg', icon: 'globe', iconSize: 24, attrs: 'data-act="new"' })}
          ${button('Carregar Jogo', { size: 'lg', icon: 'folder', iconSize: 24, attrs: 'data-act="load"' })}
          ${button('Como jogar', { size: 'lg', icon: 'info', iconSize: 24, attrs: 'data-act="help"' })}
        </div>
        <div class="mt-4 text-xs leading-normal text-ink-soft" data-help hidden>
          Escolha um mapa real e observe séculos de história alternativa: nações crescem, guerreiam,
          formam alianças, se rebelam e desaparecem. Clique em uma nação para ver seus dados e usar as
          <b>Ações de Estado</b>. Arraste para mover o mapa, use a roda do mouse para zoom, espaço para pausar
          e as teclas 1–7 para mudar a velocidade.
        </div>
        <div class="mt-4 text-xs leading-normal text-ink-soft">Dados geográficos: Natural Earth e NASA Blue Marble (domínio público).</div>
      </div>`;
    root.appendChild(this.node);
    this.node.querySelector('[data-act="new"]')?.addEventListener('click', () => app.newGame());
    this.node.querySelector('[data-act="load"]')?.addEventListener('click', () => app.loadGame());
    this.node.querySelector('[data-act="help"]')?.addEventListener('click', () => {
      const help = this.node.querySelector<HTMLElement>('[data-help]');
      if (help) help.hidden = !help.hidden;
    });
  }

  destroy(): void {
    this.node.remove();
  }
}
