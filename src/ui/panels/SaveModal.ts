// Salvar/carregar dentro do jogo: novo save, sobrescrever, carregar, exportar, apagar e importar.
import type { SaveMeta } from '../../persistence/SaveManager';
import { actions, banner, btnClass, button, empty, FIELD_GROW, modalTitle, mutedBlock, section } from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { renderSaveRows } from '../screens/LoadScreen';
import { BasePanel } from './Panel';

export class SaveModal extends BasePanel {
  private saves: SaveMeta[] | null = null;
  private message = '';

  constructor(ui: GameUI, private readonly mode: 'save' | 'load') {
    super(ui, 'modal narrow');
    void this.reload();
  }

  private async reload(): Promise<void> {
    try {
      this.saves = await this.ui.screen.app.saves.list();
    } catch {
      this.saves = [];
      this.message = 'O navegador bloqueou o armazenamento local (IndexedDB).';
    }
    this.refresh();
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return modalTitle(this.mode === 'save' ? 'save' : 'folder', this.mode === 'save' ? 'Salvar Jogo' : 'Carregar Jogo');
  }

  protected renderBody(): string {
    const sim = this.sim;
    const defaultName = `${this.ui.screen.map.name} — ${sim.year()}`;
    const form =
      this.mode === 'save'
        ? section('Novo save', 'save', actions(`<input class="${FIELD_GROW}" data-f="name" value="${esc(defaultName)}">${button('Salvar', { tone: 'primary', icon: 'save', attrs: 'data-action="save-new"' })}`))
        : section('Importar', 'folder', `<label class="${btnClass()}">${icon('folder', 16)}Importar arquivo .avsave<input type="file" accept=".avsave" hidden data-change="import"></label>`);
    const list = this.saves === null ? empty('Carregando...') : renderSaveRows(this.saves);
    const overwrite =
      this.mode === 'save' && this.saves?.length
        ? mutedBlock('Para sobrescrever, selecione:', 'mt-1.5 mb-1') +
          actions(this.saves.slice(0, 8).map((s) => button(esc(s.name), { size: 'sm', attrs: `data-action="overwrite" data-id="${esc(s.id)}" data-name="${esc(s.name)}"` })).join(''))
        : '';
    return (this.message ? banner(`${icon('info', 16)} ${esc(this.message)}`, 'gold') : '') + form + section('Jogos salvos', 'book', `<div class="flex flex-col gap-2">${list}</div>${overwrite}`);
  }

  protected action(name: string, t: HTMLElement): void {
    void this.run(name, t);
  }

  private async run(name: string, t: HTMLElement): Promise<void> {
    const ui = this.ui;
    const saves = ui.screen.app.saves;
    try {
      if (name === 'save-new') {
        await ui.screen.save(this.field('[data-f="name"]') || 'Jogo salvo');
        this.message = 'Jogo salvo com sucesso.';
        await this.reload();
      } else if (name === 'overwrite' && t.dataset.id) {
        await ui.screen.save(t.dataset.name ?? 'Jogo salvo', t.dataset.id);
        this.message = 'Save sobrescrito.';
        await this.reload();
      } else if (name === 'import') {
        const file = (t as HTMLInputElement).files?.[0];
        if (file) void ui.screen.app.startFromState(await saves.importFile(file));
      }
    } catch (err) {
      this.message = (err as Error).message || 'Falha na operação.';
      this.refresh();
    }
  }

  update(): void {
    super.update();
    if (!this.box.dataset.bound) {
      this.box.dataset.bound = '1';
      this.box.addEventListener('click', (ev) => void this.onRowClick(ev));
    }
  }

  private async onRowClick(ev: Event): Promise<void> {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-load],[data-export],[data-delete]');
    if (!t) return;
    const app = this.ui.screen.app;
    try {
      if (t.dataset.load) {
        const state = await app.saves.load(t.dataset.load);
        void app.startFromState(state);
      } else if (t.dataset.export) {
        await app.saves.exportFile(t.dataset.export);
      } else if (t.dataset.delete && confirm('Apagar este save?')) {
        await app.saves.remove(t.dataset.delete);
        await this.reload();
      }
    } catch (err) {
      this.message = (err as Error).message;
      this.refresh();
    }
  }
}
