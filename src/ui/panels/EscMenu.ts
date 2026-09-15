// Menu do jogo (Esc): pausa a simulacao enquanto aberto.
import { button, modalTitle, type Tone } from '../components';
import type { GameUI } from '../game/GameUI';
import { BasePanel } from './Panel';

export class EscMenu extends BasePanel {
  private readonly wasPaused: boolean;
  private keepPaused = false;

  constructor(ui: GameUI) {
    super(ui, 'modal narrow');
    this.wasPaused = ui.loop.paused;
    ui.loop.paused = true;
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return modalTitle('castle', 'Atlas Vivo');
  }

  protected renderBody(): string {
    const item = (action: string, label: string, iconName: string, tone: Tone = 'default') => button(label, { tone, size: 'menu', icon: iconName, iconSize: 20, attrs: `data-action="${action}"` });
    return `<div class="flex flex-col gap-2.5">
      ${item('resume', 'Continuar', 'play', 'primary')}
      ${item('save', 'Salvar jogo', 'save')}
      ${item('load', 'Carregar jogo', 'folder')}
      ${item('stats', 'Estatísticas', 'chart')}
      ${item('settings', 'Configurações', 'gear')}
      ${item('help', 'Como jogar', 'info')}
      ${item('exit', 'Sair para o menu principal', 'globe', 'danger')}
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
