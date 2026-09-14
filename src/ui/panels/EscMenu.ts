// Menu do jogo (Esc): pausa a simulacao enquanto aberto.
import { icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { BasePanel } from './Panel';

export class EscMenu extends BasePanel {
  private readonly wasPaused: boolean;
  private keepPaused = false;

  constructor(ui: GameUI) {
    super(ui, 'modal narrow');
    this.wasPaused = ui.loop.paused;
    ui.loop.paused = true;
    this.box.classList.add('escmenu');
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return `${icon('castle', 32)}<h2>Atlas Vivo</h2><button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    return `<div class="menu-buttons">
      <button class="px-btn primary" data-action="resume">${icon('play', 20)} Continuar</button>
      <button class="px-btn" data-action="save">${icon('save', 20)} Salvar jogo</button>
      <button class="px-btn" data-action="load">${icon('folder', 20)} Carregar jogo</button>
      <button class="px-btn" data-action="stats">${icon('chart', 20)} Estatísticas</button>
      <button class="px-btn" data-action="settings">${icon('gear', 20)} Configurações</button>
      <button class="px-btn" data-action="help">${icon('info', 20)} Como jogar</button>
      <button class="px-btn danger" data-action="exit">${icon('globe', 20)} Sair para o menu principal</button>
    </div>`;
  }

  protected action(name: string): void {
    const ui = this.ui;
    switch (name) {
      case 'resume':
        ui.closeModal();
        break;
      case 'exit':
        if (confirm('Sair para o menu principal? O progresso não salvo será perdido.')) {
          this.keepPaused = true;
          ui.screen.app.menu();
        }
        break;
      case 'save':
      case 'load':
      case 'stats':
      case 'settings':
      case 'help':
        this.keepPaused = true;
        ui.openModal(name);
        break;
      default:
        break;
    }
  }

  destroy(): void {
    if (!this.keepPaused) this.ui.loop.paused = this.wasPaused;
    super.destroy();
  }
}
