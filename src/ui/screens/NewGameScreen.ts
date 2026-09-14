// Tela de novo jogo: escolha entre os 6 mapas, era inicial, semente e parametros da simulacao.
import type { App } from '../../app/App';
import { fmtInt } from '../../core/format';
import { ERAS, eraOfYear } from '../../data/eras';
import { CONFLICT_LEVEL_IDS, CONFLICT_LEVELS, DEFAULT_SETTINGS, type ConflictLevel } from '../../state/types';
import { el, esc, icon } from '../dom';

const MAP_ORDER = ['world', 'americas', 'europe', 'asia-oceania', 'eurasia', 'africa'];

export class NewGameScreen {
  private node: HTMLElement;
  private mapId = 'world';
  private eraId = 'renaissance';

  constructor(root: HTMLElement, private readonly app: App) {
    const maps = [...app.maps].sort((a, b) => MAP_ORDER.indexOf(a.id) - MAP_ORDER.indexOf(b.id));
    if (maps.length && !maps.some((m) => m.id === this.mapId)) this.mapId = maps[0].id;
    this.node = el('div', 'screen');
    this.node.innerHTML = `
      <div class="screen-bg" style="background-image:url('maps/world/preview.png')"></div>
      <div class="px-panel newgame">
        <header>
          ${icon('globe', 32)}<h1>Novo Jogo</h1>
          <button class="px-btn" data-act="back">${icon('close', 16)} Voltar</button>
        </header>
        <div class="content">
          <div class="section-title">${icon('pin', 16)} Escolha o mapa</div>
          <div class="map-grid">
            ${maps.map((m, i) => `
              <button class="map-card${m.id === this.mapId ? ' on' : ''}" data-map="${esc(m.id)}">
                <img src="maps/${esc(m.id)}/preview.png" alt="">
                <h3>${i + 1}. ${esc(m.name)}</h3>
                <p>${esc(m.description)}</p>
                <div class="meta"><span>${icon('flag', 16)} ${fmtInt(m.nations)} nações</span><span>${icon('pin', 16)} ${fmtInt(m.provinces)} estados</span></div>
              </button>`).join('')}
          </div>
          <div class="section-title">${icon('book', 16)} Ano inicial</div>
          <div class="era-list">
            ${ERAS.map((e) => `<button class="px-btn${e.id === this.eraId ? ' on' : ''}" data-era="${e.id}">${e.year} — ${esc(e.name)} · ${esc(eraOfYear(e.year).name)}<small>${esc(e.description)}</small></button>`).join('')}
          </div>
          <div class="hint">A era é definida pelo ano da simulação. As tecnologias surgem uma a uma, nas suas datas históricas, e cada país precisa descobri-las, comprá-las, licenciá-las, roubá-las ou desenvolvê-las.</div>
          <div class="section-title">${icon('gear', 16)} Parâmetros</div>
          <div class="opt-grid">
            <label>Semente do mundo
              <span style="display:flex;gap:6px"><input class="px-input" data-seed type="number" value="${Math.floor(Math.random() * 1e6)}" style="flex:1"><button class="px-btn small" data-act="dice">Sortear</button></span>
              <span class="hint">A mesma semente gera a mesma história inicial.</span>
            </label>
            <label>Agressividade das nações
              <select class="px-select" data-aggression>
                ${CONFLICT_LEVEL_IDS.map((id) => `<option value="${id}"${id === DEFAULT_SETTINGS.aggression ? ' selected' : ''}>${esc(CONFLICT_LEVELS[id].name)}</option>`).join('')}
              </select>
              <span class="hint" data-out="aggression">${esc(CONFLICT_LEVELS[DEFAULT_SETTINGS.aggression].description)}</span>
            </label>
            <label>Rebeliões
              <span style="display:flex;gap:8px;align-items:center"><input class="px-check" type="checkbox" data-rebellions checked> Ligadas</span>
              <span class="hint">Revoltas, revoluções, guerras civis e lutas de vassalos pela independência.</span>
            </label>
            <label>Atividade diplomática
              <span style="display:flex;gap:8px;align-items:center"><input class="px-check" type="checkbox" data-diplomacy checked> Ligada</span>
              <span class="hint">As nações formam alianças, pactos, comércio, garantias, sanções e coalizões por conta própria.</span>
            </label>
            <label>Eventos
              <span class="hint">50% de chance de acontecer um evento no mundo a cada mês.</span>
            </label>
            <label>Fim das guerras
              <span style="display:flex;gap:8px;align-items:center"><input class="px-check" type="checkbox" data-autopeace> Nações fazem as pazes sozinhas</span>
              <span class="hint">Desligado (padrão): a guerra só termina quando um lado domina o outro ou quando você decide a paz.</span>
            </label>
          </div>
        </div>
        <footer>
          <button class="px-btn" data-act="back">Cancelar</button>
          <button class="px-btn primary" data-act="start">${icon('play', 20)} Iniciar simulação</button>
        </footer>
      </div>`;
    root.appendChild(this.node);
    this.node.addEventListener('click', (ev) => this.onClick(ev));
    this.node.addEventListener('change', (ev) => {
      const select = ev.target as HTMLSelectElement;
      if (!select.matches('[data-aggression]')) return;
      const out = this.node.querySelector('[data-out="aggression"]');
      if (out) out.textContent = CONFLICT_LEVELS[select.value as ConflictLevel].description;
    });
  }

  private onClick(ev: Event): void {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-map],[data-era],[data-act]');
    if (!target) return;
    if (target.dataset.map) {
      this.mapId = target.dataset.map;
      this.node.querySelectorAll('[data-map]').forEach((n) => n.classList.toggle('on', (n as HTMLElement).dataset.map === this.mapId));
    } else if (target.dataset.era) {
      this.eraId = target.dataset.era;
      this.node.querySelectorAll('[data-era]').forEach((n) => n.classList.toggle('on', (n as HTMLElement).dataset.era === this.eraId));
    } else if (target.dataset.act === 'back') {
      this.app.menu();
    } else if (target.dataset.act === 'dice') {
      const seed = this.node.querySelector<HTMLInputElement>('[data-seed]');
      if (seed) seed.value = String(Math.floor(Math.random() * 1e6));
    } else if (target.dataset.act === 'start') {
      const checked = (sel: string, fallback: boolean) => this.node.querySelector<HTMLInputElement>(sel)?.checked ?? fallback;
      const seed = Number(this.node.querySelector<HTMLInputElement>('[data-seed]')?.value) || Math.floor(Math.random() * 1e6);
      void this.app.startNew(this.mapId, {
        eraId: this.eraId,
        seed,
        settings: {
          aggression: (this.node.querySelector<HTMLSelectElement>('[data-aggression]')?.value ?? DEFAULT_SETTINGS.aggression) as ConflictLevel,
          rebellions: checked('[data-rebellions]', true),
          diplomacy: checked('[data-diplomacy]', true),
          autoPeace: checked('[data-autopeace]', false),
        },
      });
    }
  }

  destroy(): void {
    this.node.remove();
  }
}
