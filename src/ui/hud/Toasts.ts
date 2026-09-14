// Notificacoes de eventos historicos importantes (clicaveis para navegar ate o acontecimento).
import { formatDate } from '../../core/calendar';
import type { HistoryEntry } from '../../state/types';
import { el, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { HISTORY_ICONS, navAttr } from '../panels/common';

interface ToastItem {
  node: HTMLElement;
  until: number;
  fading: boolean;
}

export class Toasts {
  readonly node: HTMLElement;
  private items: ToastItem[] = [];
  private lastPush = 0;

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'toasts');
    ui.layer.appendChild(this.node);
  }

  private add(html: string, attrs: string, ttl: number): void {
    const node = el('div', 'px-panel toast');
    node.innerHTML = html;
    const holder = el('div');
    holder.innerHTML = `<span ${attrs}></span>`;
    const src = holder.firstElementChild as HTMLElement;
    for (const { name, value } of Array.from(src.attributes)) node.setAttribute(name, value);
    this.node.prepend(node);
    this.items.unshift({ node, until: performance.now() + ttl, fading: false });
    while (this.items.length > 3) this.items.pop()?.node.remove();
  }

  push(e: HistoryEntry): void {
    const now = performance.now();
    if (now - this.lastPush < 350 && e.importance < 3) return;
    this.lastPush = now;
    const s = this.ui.sim.state;
    this.add(
      `${icon(HISTORY_ICONS[e.type] ?? 'info', 24)}<div><div class="t-date">${formatDate(e.day, s.startYear)}</div>${esc(e.text)}</div>`,
      navAttr(e),
      e.importance >= 3 ? 8000 : 6000,
    );
  }

  info(message: string): void {
    this.add(`${icon('info', 20)}<div>${esc(message)}</div>`, '', 3500);
  }

  tick(now: number): void {
    for (const item of [...this.items]) {
      if (!item.fading && now > item.until) {
        item.fading = true;
        item.node.classList.add('fade');
        setTimeout(() => {
          item.node.remove();
          this.items = this.items.filter((i) => i !== item);
        }, 450);
      }
    }
  }
}
