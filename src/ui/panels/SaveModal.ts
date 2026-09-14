// Salvar/carregar dentro do jogo: novo save, sobrescrever, carregar, exportar, apagar e importar.
import type { SaveMeta } from '../../persistence/SaveManager';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { renderSaveRows } from '../screens/LoadScreen';
import { sec } from './common';
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
    const title = this.mode === 'save' ? 'Salvar Jogo' : 'Carregar Jogo';
    return `${icon(this.mode === 'save' ? 'save' : 'folder', 32)}<h2>${title}</h2><button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const defaultName = `${this.ui.screen.map.name} — ${sim.year()}`;
    const form = this.mode === 'save'
      ? sec('Novo save', 'save', `<div class="action"><input class="px-input" data-f="name" value="${esc(defaultName)}"><button class="px-btn primary" data-action="save-new">${icon('save', 16)} Salvar</button></div>`)
      : sec('Importar', 'folder', `<label class="px-btn">${icon('folder', 16)} Importar arquivo .avsave<input type="file" accept=".avsave" hidden data-change="import"></label>`);
    const list = this.saves === null ? '<div class="empty">Carregando...</div>' : renderSaveRows(this.saves);
    const overwrite = this.mode === 'save' && this.saves?.length
      ? `<div class="muted" style="margin-top:6px">Para sobrescrever, selecione:</div><div class="action">${this.saves.slice(0, 8).map((s) => `<button class="px-btn small" data-action="overwrite" data-id="${esc(s.id)}" data-name="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>`
      : '';
    return (this.message ? `<div class="banner gold">${icon('info', 16)} ${esc(this.message)}</div>` : '') + form + sec('Jogos salvos', 'book', `<div class="saves-list">${list}</div>${overwrite}`);
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
