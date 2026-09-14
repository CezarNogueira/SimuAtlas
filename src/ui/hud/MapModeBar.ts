// Barra de modos de mapa (politico, terreno, diplomacia...) e legenda do modo atual.
import { rgb } from '../../render/colors';
import { MAP_MODES } from '../../render/mapModes';
import { el, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';

export class MapModeBar {
  readonly node: HTMLElement;
  readonly legend: HTMLElement;
  private lastLegend = '';

  constructor(private readonly ui: GameUI) {
    this.node = el('div', 'px-panel mapmodes');
    this.node.innerHTML = MAP_MODES.map((m) => `<button class="px-btn" data-mode="${m.id}" title="${esc(`${m.name} — ${m.description}`)}">${icon(m.icon, 24)}</button>`).join('');
    this.legend = el('div', 'px-panel legend');
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
    this.node.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    const info = MAP_MODES.find((m) => m.id === mode);
    let html = '';
    if (info && mode !== 'political') {
      const needsSelection = mode === 'diplomatic' && r.selectedCountry < 0;
      html = `<h4>${icon(info.icon, 16)} ${esc(info.name)}</h4><div class="muted">${esc(needsSelection ? 'Selecione uma nação para ver suas relações.' : info.description)}</div>`;
      if (!needsSelection) html += r.legend.slice(0, 12).map((l) => `<div class="item"><span class="sw" style="background:${rgb(l.color)}"></span>${esc(l.label)}</div>`).join('');
    }
    if (html !== this.lastLegend) {
      this.lastLegend = html;
      this.legend.innerHTML = html;
      this.legend.hidden = !html;
    }
  }
}
