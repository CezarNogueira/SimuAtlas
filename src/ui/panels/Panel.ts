// Base dos paineis (laterais e modais): cabecalho, abas e corpo com atualizacao incremental
// (so reescreve o HTML quando o conteudo muda, preservando rolagem e formularios em uso).
import type { Simulation } from '../../sim/Simulation';
import { el, on } from '../dom';
import type { GameUI } from '../game/GameUI';

export interface Panel {
  readonly node: HTMLElement;
  update(): void;
  destroy(): void;
}

export type PanelKind = 'right' | 'left' | 'modal' | 'modal narrow';

export abstract class BasePanel implements Panel {
  readonly node: HTMLElement;
  protected readonly box: HTMLElement;
  protected readonly headEl: HTMLElement;
  protected readonly tabsEl: HTMLElement;
  protected readonly bodyEl: HTMLElement;
  protected tab = '';
  private lastHead = '';
  private lastTabs = '';
  private lastBody = '';
  private offs: (() => void)[] = [];

  constructor(protected readonly ui: GameUI, kind: PanelKind) {
    if (kind === 'right' || kind === 'left') {
      this.node = el('div', `px-panel side ${kind}`);
      this.box = this.node;
    } else {
      this.node = el('div', 'modal-backdrop');
      this.box = el('div', `px-panel ${kind}`);
      this.node.appendChild(this.box);
      this.node.addEventListener('pointerdown', (ev) => {
        if (ev.target === this.node) this.close();
      });
    }
    this.headEl = el('div', 'head');
    this.tabsEl = el('div', 'tabs');
    this.bodyEl = el('div', 'body');
    this.box.append(this.headEl, this.tabsEl, this.bodyEl);
    this.offs.push(
      on(this.box, 'click', '[data-tab]', (t) => {
        this.tab = t.dataset.tab ?? '';
        this.lastBody = '';
        this.update();
        this.bodyEl.scrollTop = 0;
      }),
      on(this.box, 'click', '[data-close]', () => this.close()),
      on(this.box, 'click', '[data-action]', (t, ev) => {
        this.action(t.dataset.action ?? '', t, ev);
      }),
      on(this.box, 'change', '[data-change]', (t, ev) => {
        this.action(t.dataset.change ?? '', t, ev);
      }),
    );
  }

  protected get sim(): Simulation {
    return this.ui.sim;
  }

  protected abstract renderHead(): string;
  protected abstract renderBody(): string;

  protected tabs(): [string, string][] {
    return [];
  }

  protected alive(): boolean {
    return true;
  }

  // Abas estaticas (ex.: formularios de acoes) nao sao reescritas a cada atualizacao.
  protected isStatic(): boolean {
    return false;
  }

  protected action(_name: string, _target: HTMLElement, _ev: Event): void {
    // Implementado pelos paineis concretos.
  }

  protected close(): void {
    this.destroy();
  }

  protected field(selector: string): string {
    return this.box.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value ?? '';
  }

  private formFocused(): boolean {
    const a = document.activeElement as HTMLElement | null;
    return !!a && this.box.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA');
  }

  refresh(): void {
    this.lastBody = '';
    this.update();
  }

  update(): void {
    if (!this.alive()) {
      this.close();
      return;
    }
    const head = this.renderHead();
    if (head !== this.lastHead) {
      this.headEl.innerHTML = head;
      this.lastHead = head;
    }
    const tabs = this.tabs();
    const tabsHtml = tabs.map(([id, label]) => `<button class="px-btn${id === this.tab ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('');
    if (tabsHtml !== this.lastTabs) {
      this.tabsEl.innerHTML = tabsHtml;
      this.tabsEl.hidden = !tabs.length;
      this.lastTabs = tabsHtml;
    }
    if (this.lastBody && (this.formFocused() || this.isStatic())) return;
    const body = this.renderBody();
    if (body !== this.lastBody) {
      const scroll = this.bodyEl.scrollTop;
      this.bodyEl.innerHTML = body;
      this.bodyEl.scrollTop = scroll;
      this.lastBody = body;
      this.afterRender();
    }
  }

  protected afterRender(): void {
    // Gancho para desenhar graficos em canvas apos atualizar o HTML.
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.node.remove();
  }
}
