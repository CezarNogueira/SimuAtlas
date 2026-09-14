// Tela de carregamento: lista de saves (carregar, exportar, apagar) e importacao de arquivo.
import type { App } from '../../app/App';
import { eraById } from '../../data/eras';
import type { SaveMeta } from '../../persistence/SaveManager';
import { SAVE_VERSION } from '../../sim/createWorld';
import { el, esc, icon } from '../dom';

export function renderSaveRows(saves: SaveMeta[]): string {
  if (!saves.length) return `<div class="empty">Nenhum jogo salvo ainda.</div>`;
  return saves
    .map((s) => {
      const compatible = (s.version ?? 1) === SAVE_VERSION;
      return `
      <div class="save-row">
        <div>
          <div class="name">${s.auto ? icon('gear', 16) : icon('save', 16)} ${esc(s.name)}${compatible ? '' : ' <span class="chip red" title="Criado com a divisão antiga do mapa (províncias por cidades)">versão antiga</span>'}</div>
          <div class="info">${esc(s.mapName)} · ${esc(s.dateText)} · ${s.nations} nações · início em ${eraById(s.eraId).year} · ${(s.size / 1024).toFixed(0)} KB · salvo em ${new Date(s.updatedAt).toLocaleString('pt-BR')}</div>
        </div>
        <div class="actions">
          <button class="px-btn small primary" data-load="${esc(s.id)}"${compatible ? '' : ' disabled title="Incompatível com os mapas atuais, divididos em estados"'}>${icon('play', 16)} Carregar</button>
          <button class="px-btn small" data-export="${esc(s.id)}">Exportar</button>
          <button class="px-btn small danger" data-delete="${esc(s.id)}">${icon('close', 16)}</button>
        </div>
      </div>`;
    })
    .join('');
}

export class LoadScreen {
  private node: HTMLElement;

  constructor(root: HTMLElement, private readonly app: App) {
    this.node = el('div', 'screen');
    this.node.innerHTML = `
      <div class="screen-bg" style="background-image:url('maps/world/preview.png')"></div>
      <div class="px-panel newgame" style="max-width:820px">
        <header>${icon('folder', 32)}<h1>Carregar Jogo</h1><button class="px-btn" data-act="back">${icon('close', 16)} Voltar</button></header>
        <div class="content"><div class="saves-list" data-list><div class="empty">Carregando...</div></div></div>
        <footer>
          <label class="px-btn">${icon('folder', 16)} Importar arquivo<input type="file" accept=".avsave" hidden data-import></label>
          <button class="px-btn" data-act="back">Voltar</button>
        </footer>
      </div>`;
    root.appendChild(this.node);
    this.node.addEventListener('click', (ev) => void this.onClick(ev));
    this.node.querySelector<HTMLInputElement>('[data-import]')?.addEventListener('change', (ev) => void this.onImport(ev));
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    const list = this.node.querySelector('[data-list]');
    if (!list) return;
    try {
      list.innerHTML = renderSaveRows(await this.app.saves.list());
    } catch {
      list.innerHTML = `<div class="empty">O navegador bloqueou o armazenamento local (IndexedDB).</div>`;
    }
  }

  private async onClick(ev: Event): Promise<void> {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-load],[data-export],[data-delete],[data-act]');
    if (!t) return;
    if (t.dataset.act === 'back') this.app.menu();
    else if (t.dataset.load) void this.app.startFromState(await this.app.saves.load(t.dataset.load));
    else if (t.dataset.export) await this.app.saves.exportFile(t.dataset.export);
    else if (t.dataset.delete && confirm('Apagar este save?')) {
      await this.app.saves.remove(t.dataset.delete);
      await this.refresh();
    }
  }

  private async onImport(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      void this.app.startFromState(await this.app.saves.importFile(file));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  destroy(): void {
    this.node.remove();
  }
}
