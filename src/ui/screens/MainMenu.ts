// Tela inicial: titulo, fundo com o mapa-mundi pixelado e acoes principais.
import type { App } from '../../app/App';
import { el, icon } from '../dom';

export class MainMenu {
  private node: HTMLElement;

  constructor(root: HTMLElement, app: App) {
    this.node = el('div', 'screen');
    this.node.innerHTML = `
      <div class="screen-bg" style="background-image:url('maps/world/preview.png')"></div>
      <div class="px-panel menu-box">
        <div>${icon('castle', 64)}</div>
        <div class="menu-title">SIMUATLAS</div>
        <div class="menu-sub">Simulador Geopolítico</div>
        <div class="menu-buttons">
          <button class="px-btn primary" data-act="new">${icon('globe', 24)} Novo Jogo</button>
          <button class="px-btn" data-act="load">${icon('folder', 24)} Carregar Jogo</button>
          <button class="px-btn" data-act="help">${icon('info', 24)} Como jogar</button>
        </div>
        <div class="menu-foot" data-help hidden>
          Escolha um mapa real e observe séculos de história alternativa: nações crescem, guerreiam,
          formam alianças, se rebelam e desaparecem. Clique em uma nação para ver seus dados e usar as
          <b>Ações de Estado</b>. Arraste para mover o mapa, use a roda do mouse para zoom, espaço para pausar
          e as teclas 1–7 para mudar a velocidade.
        </div>
        <div class="menu-foot">Dados geográficos: Natural Earth e NASA Blue Marble (domínio público).</div>
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
