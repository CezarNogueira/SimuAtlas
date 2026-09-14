// Tela de novo jogo: escolha entre os 6 mapas, era inicial, semente e parametros da simulacao.
import type { App } from '../../app/App';
import { fmtInt } from '../../core/format';
import { ERAS } from '../../data/eras';
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
          <div class="section-title">${icon('book', 16)} Era inicial</div>
          <div class="era-list">
            ${ERAS.map((e) => `<button class="px-btn${e.id === this.eraId ? ' on' : ''}" data-era="${e.id}">${e.year} — ${esc(e.name)}<small>${esc(e.description)}</small></button>`).join('')}
          </div>
          <div class="section-title">${icon('gear', 16)} Parâmetros</div>
          <div class="opt-grid">
            <label>Semente do mundo
              <span style="display:flex;gap:6px"><input class="px-input" data-seed type="number" value="${Math.floor(Math.random() * 1e6)}" style="flex:1"><button class="px-btn small" data-act="dice">Sortear</button></span>
              <span class="hint">A mesma semente gera a mesma história inicial.</span>
            </label>
            <label>Agressividade das nações: <b data-out="aggression">100%</b>
              <input class="px-range" type="range" min="25" max="200" step="5" value="100" data-opt="aggression">
            </label>
            <label>Frequência de eventos: <b data-out="events">100%</b>
              <input class="px-range" type="range" min="0" max="250" step="10" value="100" data-opt="events">
            </label>
            <label>Frequência de rebeliões: <b data-out="rebellions">100%</b>
              <input class="px-range" type="range" min="0" max="250" step="10" value="100" data-opt="rebellions">
            </label>
            <label>Atividade diplomática: <b data-out="diplomacy">100%</b>
              <input class="px-range" type="range" min="25" max="250" step="5" value="100" data-opt="diplomacy">
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
    this.node.addEventListener('input', (ev) => {
      const input = ev.target as HTMLInputElement;
      const key = input.dataset.opt;
      if (!key) return;
      const out = this.node.querySelector(`[data-out="${key}"]`);
      if (out) out.textContent = `${input.value}%`;
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
      const value = (key: string) => Number(this.node.querySelector<HTMLInputElement>(`[data-opt="${key}"]`)?.value ?? 100) / 100;
      const seed = Number(this.node.querySelector<HTMLInputElement>('[data-seed]')?.value) || Math.floor(Math.random() * 1e6);
      void this.app.startNew(this.mapId, {
        eraId: this.eraId,
        seed,
        settings: {
          aggression: value('aggression'),
          eventFrequency: value('events'),
          rebellionFrequency: value('rebellions'),
          diplomacyFrequency: value('diplomacy'),
          autoPeace: !!this.node.querySelector<HTMLInputElement>('[data-autopeace]')?.checked,
        },
      });
    }
  }

  destroy(): void {
    this.node.remove();
  }
}
