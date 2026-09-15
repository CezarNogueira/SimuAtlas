// Configuracoes: exibicao do mapa, parametros da simulacao e preferencias da interface.
import type { RenderSettings } from '../../render/MapRenderer';
import { CONFLICT_LEVEL_IDS, CONFLICT_LEVELS, type ConflictLevel } from '../../state/types';
import { actions, button, CHECK, CHECK_LABEL, FIELD, FIELD_LABEL, modalTitle, MUTED, mutedBlock, section } from '../components';
import { esc } from '../dom';
import type { GameUI } from '../game/GameUI';
import { BasePanel } from './Panel';

const RENDER_TOGGLES: [keyof RenderSettings, string][] = [
  ['provinceBorders', 'Fronteiras dos estados'],
  ['showLabels', 'Nomes das nações'],
  ['showStateLabels', 'Nomes dos estados (com zoom)'],
  ['formalNames', 'Nomes formais (Reino de...)'],
  ['showCities', 'Cidades e capitais'],
  ['showGeoLabels', 'Mares, cordilheiras e desertos'],
  ['showSeaRoutes', 'Rotas marítimas'],
  ['showArrows', 'Setas de ofensiva'],
  ['showBattles', 'Marcadores de batalha'],
];

const GRID = 'grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-[18px] gap-y-1.5';

const checkbox = (change: string, label: string, checked: boolean, attrs = '') =>
  `<label class="${CHECK_LABEL}"><input class="${CHECK}" type="checkbox" data-change="${change}"${attrs ? ` ${attrs}` : ''}${checked ? ' checked' : ''}>${esc(label)}</label>`;
const option = (value: string, label: string, selected: boolean) => `<option value="${value}"${selected ? ' selected' : ''}>${esc(label)}</option>`;

export class SettingsModal extends BasePanel {
  constructor(ui: GameUI) {
    super(ui, 'modal narrow');
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return modalTitle('gear', 'Configurações');
  }

  protected renderBody(): string {
    const r = this.ui.renderer.settings;
    const s = this.sim.state.settings;
    const p = this.ui.prefs;
    const toggles = RENDER_TOGGLES.map(([key, label]) => checkbox('render', label, !!r[key], `data-key="${key}"`)).join('');
    const armies = `<label class="${FIELD_LABEL}">Exércitos visíveis
      <select class="${FIELD}" data-change="armies">
        ${option('war', 'Apenas nações em guerra', r.showArmies === 'war')}
        ${option('all', 'Todos', r.showArmies === 'all')}
        ${option('none', 'Nenhum (só a nação selecionada)', r.showArmies === 'none')}
      </select></label>`;
    const simOpts = `
      <label class="${FIELD_LABEL}">Agressividade das nações
        <select class="${FIELD}" data-change="aggression">
          ${CONFLICT_LEVEL_IDS.map((id) => option(id, CONFLICT_LEVELS[id].name, s.aggression === id)).join('')}
        </select>
        <span class="${MUTED}" data-out="aggression">${esc(CONFLICT_LEVELS[s.aggression].description)}</span></label>
      ${checkbox('rebellions', 'Rebeliões', s.rebellions)}
      ${checkbox('diplomacy', 'Atividade diplomática', s.diplomacy)}
      ${mutedBlock('Eventos: 50% de chance de acontecer um evento no mundo a cada mês.', 'self-center')}`;
    const uiOpts = `
      <label class="${FIELD_LABEL}">Notificações na tela
        <select class="${FIELD}" data-change="toasts">
          ${option('3', 'Apenas marcos históricos', p.toastImportance === 3)}
          ${option('2', 'Acontecimentos importantes', p.toastImportance === 2)}
          ${option('1', 'Todos (muito frequente)', p.toastImportance === 1)}
        </select></label>
      <label class="${FIELD_LABEL}">Salvamento automático
        <select class="${FIELD}" data-change="autosave">
          ${[0, 5, 10, 25, 50].map((v) => option(String(v), v === 0 ? 'Desligado' : `A cada ${v} anos`, p.autosaveYears === v)).join('')}
        </select></label>
      ${checkbox('pausewar', 'Pausar quando a nação selecionada entrar em guerra', p.pauseOnSelectedWar)}`;
    return (
      section('Mapa', 'globe', `<div class="${GRID}">${toggles}${armies}</div>`) +
      section(
        'Simulação',
        'gear',
        `<div class="${GRID}">${simOpts}</div><div class="mt-2">${checkbox('autopeace', 'Nações fazem as pazes sozinhas (tratados automáticos)', s.autoPeace)}</div>` +
          mutedBlock('Desligado: cada guerra continua até um lado dominar o outro ou até você decidir a paz no painel da guerra. As mudanças valem imediatamente para este mundo.'),
      ) +
      section('Interface', 'info', `<div class="${GRID}">${uiOpts}</div>`) +
      actions(button('Enquadrar mapa', { icon: 'target', attrs: 'data-action="fit"' }) + button('Fechar', { attrs: 'data-close' }))
    );
  }

  protected action(name: string, t: HTMLElement): void {
    const ui = this.ui;
    const input = t as HTMLInputElement;
    switch (name) {
      case 'render': {
        const key = t.dataset.key as keyof RenderSettings;
        (ui.renderer.settings as unknown as Record<string, unknown>)[key] = input.checked;
        ui.renderer.political.invalidateAll();
        ui.saveRenderSettings();
        break;
      }
      case 'armies':
        ui.renderer.settings.showArmies = input.value as RenderSettings['showArmies'];
        ui.saveRenderSettings();
        break;
      case 'aggression': {
        const level = input.value as ConflictLevel;
        if (!CONFLICT_LEVELS[level]) break;
        this.sim.state.settings.aggression = level;
        const out = this.box.querySelector('[data-out="aggression"]');
        if (out) out.textContent = CONFLICT_LEVELS[level].description;
        break;
      }
      case 'rebellions':
        this.sim.state.settings.rebellions = input.checked;
        break;
      case 'diplomacy':
        this.sim.state.settings.diplomacy = input.checked;
        break;
      case 'autopeace':
        this.sim.state.settings.autoPeace = input.checked;
        break;
      case 'toasts':
        ui.prefs.toastImportance = Number(input.value) as 1 | 2 | 3;
        ui.savePrefs();
        break;
      case 'autosave':
        ui.prefs.autosaveYears = Number(input.value);
        ui.savePrefs();
        break;
      case 'pausewar':
        ui.prefs.pauseOnSelectedWar = input.checked;
        ui.savePrefs();
        break;
      case 'fit':
        ui.renderer.camera.fit();
        break;
      default:
        break;
    }
  }
}
