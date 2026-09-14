// Utilitarios de DOM leves (sem framework): criacao de elementos, delegacao de eventos e trechos HTML.
import { escapeHtml } from '../core/format';
import { iconUrl } from '../render/sprites/icons';
import type { Country } from '../state/types';
import { flagUrl } from './flagRender';

export const esc = escapeHtml;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

export function icon(name: string, size = 16, title = ''): string {
  return `<img class="px-icon" src="${iconUrl(name)}" width="${size}" height="${size}" alt=""${title ? ` title="${esc(title)}"` : ''}>`;
}

export function flag(c: Country, w = 48): string {
  const h = Math.round((w * 5) / 8);
  return `<img class="flag" src="${flagUrl(c)}" width="${w}" height="${h}" alt="">`;
}

export function flagInline(c: Country, w = 20): string {
  const h = Math.round((w * 5) / 8);
  return `<img class="flag inline" src="${flagUrl(c)}" width="${w}" height="${h}" alt="">`;
}

export function bar(value: number, color = 'var(--green)'): string {
  const pct = Math.max(0, Math.min(100, value * 100));
  return `<div class="bar"><i style="width:${pct.toFixed(1)}%;background:${color}"></i></div>`;
}

// Barra centrada (-1..1).
export function centerBar(value: number): string {
  const v = Math.max(-1, Math.min(1, value));
  const w = Math.abs(v) * 50;
  const left = v < 0 ? 50 - w : 50;
  const color = v < 0 ? 'var(--red-2)' : 'var(--green)';
  return `<div class="bar"><i style="left:${left}%;width:${w}%;background:${color}"></i><span class="tick"></span></div>`;
}

export function on<E extends Event>(root: HTMLElement, type: string, selector: string, handler: (target: HTMLElement, ev: E) => void): () => void {
  const listener = (ev: Event) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (target && root.contains(target)) handler(target, ev as E);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

export function kv(iconName: string, label: string, value: string): string {
  return `${iconName ? icon(iconName, 16) : '<span></span>'}<span class="k">${esc(label)}</span><span class="v">${value}</span>`;
}

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
