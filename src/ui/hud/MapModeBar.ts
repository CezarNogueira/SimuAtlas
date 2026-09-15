// Barra de modos de mapa (politico, terreno, diplomacia...) e legenda do modo atual.
import { rgb } from '../../render/colors';
import { MAP_MODES } from '../../render/mapModes';
import { button, mutedBlock } from '../components';
import { el, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

export class MapModeBar {
  readonly node: HTMLElement;
  readonly legend: HTMLElement;
  private lastLegend = '';

  constructor(private readonly ui: GameUI) {
    this.node = el(
      'div',
      'parchment absolute top-[66px] left-2 flex flex-col gap-1 p-1.5 max-[760px]:top-auto max-[760px]:bottom-[126px] max-[760px]:max-w-[calc(100vw-16px)] max-[760px]:flex-row max-[760px]:flex-wrap',
    );
    this.node.innerHTML = MAP_MODES.map((m) => button(icon(m.icon, 24), { size: 'mode', title: `${m.name} — ${m.description}`, pressed: false, attrs: `data-mode="${m.id}"` })).join('');
    this.legend = el('div', 'parchment absolute bottom-[76px] left-[70px] max-w-[260px] px-2.5 py-2 text-[12.5px] max-[760px]:hidden');
    this.legend.hidden = true;
    ui.layer.append(this.node, this.legend);
    this.node.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-mode]');
      if (!t?.dataset.mode) return;
      ui.renderer.settings.mapMode = t.dataset.mode as (typeof MAP_MODES)[number]['id'];
      ui.saveRenderSettings();
      this.update();
    });
  }

  update(): void {
    const r = this.ui.renderer;
    const mode = r.settings.mapMode;
    this.node.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const info = MAP_MODES.find((m) => m.id === mode);
    let html = '';
    if (info && mode !== 'political') {
      const needsSelection = mode === 'diplomatic' && r.selectedCountry < 0;
      html = `<h4 class="mb-1 flex items-center gap-1.5 font-pixel text-sm">${icon(info.icon, 16)}${esc(info.name)}</h4>${mutedBlock(esc(needsSelection ? 'Selecione uma nação para ver suas relações.' : info.description), 'mb-0.5')}`;
      if (!needsSelection) {
        html += r.legend
          .slice(0, 12)
          .map((l) => `<div class="flex items-center gap-1.5"><span class="size-3.5 shrink-0 border-2 border-edge" style="background:${rgb(l.color)}"></span>${esc(l.label)}</div>`)
          .join('');
      }
    }
    if (html !== this.lastLegend) {
      this.lastLegend = html;
      this.legend.innerHTML = html;
      this.legend.hidden = !html;
    }
  }
}
