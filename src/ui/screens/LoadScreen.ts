// Tela de carregamento: lista de saves (carregar, exportar, apagar) e importacao de arquivo.
import type { App } from '../../app/App';
import { eraById } from '../../data/eras';
import type { SaveMeta } from '../../persistence/SaveManager';
import { SAVE_VERSION } from '../../sim/createWorld';
import { btnClass, button, chip, empty, SCREEN, screenBg } from '../components';
import { el, esc, icon } from '../dom';

export function renderSaveRows(saves: SaveMeta[]): string {
  if (!saves.length) return empty('Nenhum jogo salvo ainda.');
  return saves
    .map((s) => {
      const compatible = (s.version ?? 1) === SAVE_VERSION;
      const oldVersion = compatible ? '' : ` ${chip('versão antiga', 'red', 'title="Criado com a divisão antiga do mapa (províncias por cidades)"')}`;
      const info = `${esc(s.mapName)} · ${esc(s.dateText)} · ${s.nations} nações · início em ${eraById(s.eraId).year} · ${(s.size / 1024).toFixed(0)} KB · salvo em ${new Date(s.updatedAt).toLocaleString('pt-BR')}`;
      return `
      <div class="grid grid-cols-[1fr_auto] items-center gap-2 border-2 border-edge bg-paper-2 px-2.5 py-2" data-ui="save-row">
        <div class="min-w-0">
          <div class="font-pixel text-base font-bold">${s.auto ? icon('gear', 16) : icon('save', 16)} ${esc(s.name)}${oldVersion}</div>
          <div class="text-xs text-ink-soft">${info}</div>
        </div>
        <div class="flex flex-wrap justify-end gap-1.5">
          ${button('Carregar', { tone: 'primary', size: 'sm', icon: 'play', attrs: `data-load="${esc(s.id)}"${compatible ? '' : ' disabled title="Incompatível com os mapas atuais, divididos em estados"'}` })}
          ${button('Exportar', { size: 'sm', attrs: `data-export="${esc(s.id)}"` })}
          ${button(icon('close', 16), { size: 'sm', tone: 'danger', title: 'Apagar', attrs: `data-delete="${esc(s.id)}"` })}
        </div>
      </div>`;
    })
    .join('');
}

export class LoadScreen {
  private node: HTMLElement;

  constructor(root: HTMLElement, private readonly app: App) {
    this.node = el('div', SCREEN);
    this.node.innerHTML = `
      ${screenBg('maps/world/preview.png')}
      <div class="parchment relative flex max-h-[calc(100vh-24px)] w-[min(820px,calc(100vw-24px))] flex-col">
        <header class="flex items-center gap-3 px-[18px] pt-3.5 pb-2">${icon('folder', 32)}<h1 class="flex-1 font-pixel text-[28px]">Carregar Jogo</h1>${button('Voltar', { icon: 'close', attrs: 'data-act="back"' })}</header>
        <div class="overflow-y-auto px-[18px] pt-1 pb-3.5"><div class="flex flex-col gap-2" data-list>${empty('Carregando...')}</div></div>
        <footer class="flex justify-end gap-2.5 border-t-2 border-dashed border-paper-dark px-[18px] pt-2.5 pb-4">
          <label class="${btnClass()}">${icon('folder', 16)}Importar arquivo<input type="file" accept=".avsave" hidden data-import></label>
          ${button('Voltar', { attrs: 'data-act="back"' })}
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
      list.innerHTML = empty('O navegador bloqueou o armazenamento local (IndexedDB).');
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
