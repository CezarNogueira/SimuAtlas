// Utilitarios de DOM leves (sem framework): criacao de elementos, delegacao de eventos, icones e bandeiras.
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

export function icon(name: string, size = 16, title = '', extra = ''): string {
  return `<img class="pixelated inline-block shrink-0 align-middle${extra ? ` ${extra}` : ''}" src="${iconUrl(name)}" width="${size}" height="${size}" alt=""${title ? ` title="${esc(title)}"` : ''}>`;
}

export function flag(c: Country, w = 48): string {
  const h = Math.round((w * 5) / 8);
  return `<img class="pixelated block shrink-0 border-2 border-edge bg-[#999]" src="${flagUrl(c)}" width="${w}" height="${h}" alt="">`;
}

export function flagInline(c: Country, w = 20, extra = ''): string {
  const h = Math.round((w * 5) / 8);
  return `<img class="pixelated inline-block border border-edge bg-[#999] align-middle${extra ? ` ${extra}` : ''}" src="${flagUrl(c)}" width="${w}" height="${h}" alt="">`;
}

export function on<E extends Event>(root: HTMLElement, type: string, selector: string, handler: (target: HTMLElement, ev: E) => void): () => void {
  const listener = (ev: Event) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(selector);
    if (target && root.contains(target)) handler(target, ev as E);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
