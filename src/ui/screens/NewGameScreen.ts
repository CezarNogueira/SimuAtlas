// Tela de novo jogo: escolha entre os 6 mapas, era inicial, semente e parametros da simulacao.
import type { App } from '../../app/App';
import { fmtInt } from '../../core/format';
import { ERAS, eraOfYear } from '../../data/eras';
import { CONFLICT_LEVEL_IDS, CONFLICT_LEVELS, DEFAULT_SETTINGS, type ConflictLevel } from '../../state/types';
import { btnClass, button, CHECK, FIELD, SCREEN, SCREEN_SECTION, screenBg } from '../components';
import { el, esc, icon } from '../dom';

const MAP_ORDER = ['world', 'americas', 'europe', 'asia-oceania', 'eurasia', 'africa'];

const MAP_CARD =
  'cursor-pointer border-[3px] border-edge bg-paper-2 p-1.5 text-left shadow-drop-sm hover:bg-hover aria-pressed:bg-[#f5d98e] aria-pressed:outline-[3px] aria-pressed:outline-offset-[-8px] aria-pressed:outline-red';
const ERA_LAYOUT = 'flex flex-col items-start gap-0.5 whitespace-normal text-left leading-tight';
const OPTION = 'flex flex-col gap-1 text-sm';
const HINT = 'text-xs text-ink-soft';

export class NewGameScreen {
  private node: HTMLElement;
  private mapId = 'world';
  private eraId = 'renaissance';

  constructor(root: HTMLElement, private readonly app: App) {
    const maps = [...app.maps].sort((a, b) => MAP_ORDER.indexOf(a.id) - MAP_ORDER.indexOf(b.id));
    if (maps.length && !maps.some((m) => m.id === this.mapId)) this.mapId = maps[0].id;
    const mapCards = maps
      .map(
        (m, i) => `
        <button class="${MAP_CARD}" aria-pressed="${m.id === this.mapId}" data-map="${esc(m.id)}">
          <img class="block aspect-[16/10] w-full border-2 border-edge bg-[#2f4f7a] object-cover" src="maps/${esc(m.id)}/preview.png" alt="">
          <h3 class="mx-0.5 mt-1.5 mb-0.5 font-pixel text-[17px]">${i + 1}. ${esc(m.name)}</h3>
          <p class="mx-0.5 mb-1 text-[12.5px] leading-[1.3] text-ink-soft">${esc(m.description)}</p>
          <div class="mx-0.5 flex gap-2.5 text-xs"><span>${icon('flag', 16)} ${fmtInt(m.nations)} nações</span><span>${icon('pin', 16)} ${fmtInt(m.provinces)} estados</span></div>
        </button>`,
      )
      .join('');
    const eraCards = ERAS.map(
      (e) =>
        `<button class="${btnClass('default', 'card', ERA_LAYOUT)}" aria-pressed="${e.id === this.eraId}" data-era="${e.id}">${e.year} — ${esc(e.name)} · ${esc(eraOfYear(e.year).name)}<small class="block font-sans text-[11px] font-normal leading-[1.2] text-ink-soft">${esc(e.description)}</small></button>`,
    ).join('');
    const check = (attr: string, label: string, checked: boolean) => `<span class="flex items-center gap-2"><input class="${CHECK}" type="checkbox" ${attr}${checked ? ' checked' : ''}>${label}</span>`;
    this.node = el('div', SCREEN);
    this.node.innerHTML = `
      ${screenBg('maps/world/preview.png')}
      <div class="parchment relative flex max-h-[calc(100vh-24px)] w-[min(1180px,calc(100vw-24px))] flex-col">
        <header class="flex items-center gap-3 px-[18px] pt-3.5 pb-2">
          ${icon('globe', 32)}<h1 class="flex-1 font-pixel text-[28px]">Novo Jogo</h1>
          ${button('Voltar', { icon: 'close', attrs: 'data-act="back"' })}
        </header>
        <div class="overflow-y-auto px-[18px] pt-1 pb-3.5" data-ui="newgame-content">
          <div class="${SCREEN_SECTION}">${icon('pin', 16)} Escolha o mapa</div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">${mapCards}</div>
          <div class="${SCREEN_SECTION}">${icon('book', 16)} Ano inicial</div>
          <div class="mt-2 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">${eraCards}</div>
          <div class="mt-1 ${HINT}">A era é definida pelo ano da simulação. As tecnologias surgem uma a uma, nas suas datas históricas, e cada país precisa descobri-las, comprá-las, licenciá-las, roubá-las ou desenvolvê-las.</div>
          <div class="${SCREEN_SECTION}">${icon('gear', 16)} Parâmetros</div>
          <div class="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            <label class="${OPTION}">Semente do mundo
              <span class="flex gap-1.5"><input class="${FIELD} flex-1" data-seed type="number" value="${Math.floor(Math.random() * 1e6)}">${button('Sortear', { size: 'sm', attrs: 'data-act="dice"' })}</span>
              <span class="${HINT}">A mesma semente gera a mesma história inicial.</span>
            </label>
            <label class="${OPTION}">Agressividade das nações
              <select class="${FIELD}" data-aggression>
                ${CONFLICT_LEVEL_IDS.map((id) => `<option value="${id}"${id === DEFAULT_SETTINGS.aggression ? ' selected' : ''}>${esc(CONFLICT_LEVELS[id].name)}</option>`).join('')}
              </select>
              <span class="${HINT}" data-out="aggression">${esc(CONFLICT_LEVELS[DEFAULT_SETTINGS.aggression].description)}</span>
            </label>
            <label class="${OPTION}">Rebeliões
              ${check('data-rebellions', 'Ligadas', true)}
              <span class="${HINT}">Revoltas, revoluções, guerras civis e lutas de vassalos pela independência.</span>
            </label>
            <label class="${OPTION}">Atividade diplomática
              ${check('data-diplomacy', 'Ligada', true)}
              <span class="${HINT}">As nações formam alianças, pactos, comércio, garantias, sanções e coalizões por conta própria.</span>
            </label>
            <label class="${OPTION}">Eventos
              <span class="${HINT}">50% de chance de acontecer um evento no mundo a cada mês.</span>
            </label>
            <label class="${OPTION}">Fim das guerras
              ${check('data-autopeace', 'Nações fazem as pazes sozinhas', false)}
              <span class="${HINT}">Desligado (padrão): a guerra só termina quando um lado domina o outro ou quando você decide a paz.</span>
            </label>
          </div>
        </div>
        <footer class="flex justify-end gap-2.5 border-t-2 border-dashed border-paper-dark px-[18px] pt-2.5 pb-4">
          ${button('Cancelar', { attrs: 'data-act="back"' })}
          ${button('Iniciar simulação', { tone: 'primary', icon: 'play', iconSize: 20, attrs: 'data-act="start"' })}
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
      this.node.querySelectorAll<HTMLElement>('[data-map]').forEach((n) => n.setAttribute('aria-pressed', String(n.dataset.map === this.mapId)));
    } else if (target.dataset.era) {
      this.eraId = target.dataset.era;
      this.node.querySelectorAll<HTMLElement>('[data-era]').forEach((n) => n.setAttribute('aria-pressed', String(n.dataset.era === this.eraId)));
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
