// Base dos paineis (laterais e modais): cabecalho, abas e corpo com atualizacao incremental
// (so reescreve o HTML quando o conteudo muda, preservando rolagem e formularios em uso).
import type { Simulation } from '../../sim/Simulation';
import { btnClass } from '../components';
import { el, on } from '../dom';
import type { GameUI } from '../game/GameUI';

export interface Panel {
  readonly node: HTMLElement;
  update(): void;
  destroy(): void;
}

export type PanelKind = 'right' | 'left' | 'modal' | 'modal narrow';

const SIDE = 'parchment absolute top-[66px] bottom-[74px] flex flex-col';
const BODY = 'select-text overflow-y-auto font-sans text-[13px] leading-[1.4]';

// Moldura, cabecalho, abas e corpo de cada tipo de painel.
const FRAMES: Record<PanelKind, { box: string; head: string; tabs: string; body: string }> = {
  right: {
    box: `${SIDE} right-2 w-[min(420px,calc(100vw-16px))]`,
    head: 'flex items-start gap-2.5 px-3 pt-3 pb-1.5',
    tabs: 'flex flex-wrap gap-[3px] px-2.5 pb-1.5',
    body: `${BODY} flex-1 px-3 pt-1 pb-3`,
  },
  left: {
    box: `${SIDE} left-16 w-[min(440px,calc(100vw-80px))] max-[760px]:left-2 max-[760px]:w-[calc(100vw-16px)]`,
    head: 'flex items-start gap-2.5 px-3 pt-3 pb-1.5',
    tabs: 'flex flex-wrap gap-[3px] px-2.5 pb-1.5',
    body: `${BODY} flex-1 px-3 pt-1 pb-3`,
  },
  modal: {
    box: 'parchment flex max-h-[calc(100vh-24px)] w-[min(1100px,calc(100vw-24px))] flex-col',
    head: 'flex items-center gap-2.5 px-3.5 pt-3 pb-1.5',
    tabs: 'flex flex-wrap gap-[3px] px-3.5 pb-1.5',
    body: `${BODY} px-3.5 pt-1.5 pb-3.5`,
  },
  'modal narrow': {
    box: 'parchment flex max-h-[calc(100vh-24px)] w-[min(560px,calc(100vw-24px))] flex-col',
    head: 'flex items-center gap-2.5 px-3.5 pt-3 pb-1.5',
    tabs: 'flex flex-wrap gap-[3px] px-3.5 pb-1.5',
    body: `${BODY} px-3.5 pt-1.5 pb-3.5`,
  },
};

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
    const frame = FRAMES[kind];
    if (kind === 'right' || kind === 'left') {
      this.node = el('div', frame.box);
      this.box = this.node;
    } else {
      this.node = el('div', 'absolute inset-0 flex items-center justify-center bg-[rgb(12_8_4/0.55)]');
      this.box = el('div', frame.box);
      this.node.appendChild(this.box);
      this.node.addEventListener('pointerdown', (ev) => {
        if (ev.target === this.node) this.close();
      });
    }
    this.node.dataset.panel = kind;
    this.headEl = el('div', frame.head);
    this.tabsEl = el('div', frame.tabs);
    this.bodyEl = el('div', frame.body);
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
    const tabsHtml = tabs.map(([id, label]) => `<button class="${btnClass('default', 'tab')}" aria-pressed="${id === this.tab}" data-tab="${id}">${label}</button>`).join('');
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
