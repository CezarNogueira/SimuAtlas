// Configuracoes: exibicao do mapa, parametros da simulacao e preferencias da interface.
import type { RenderSettings } from '../../render/MapRenderer';
import { CONFLICT_LEVEL_IDS, CONFLICT_LEVELS, type ConflictLevel } from '../../state/types';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { sec } from './common';
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

export class SettingsModal extends BasePanel {
  constructor(ui: GameUI) {
    super(ui, 'modal narrow');
  }

  protected isStatic(): boolean {
    return true;
  }

  protected renderHead(): string {
    return `${icon('gear', 32)}<h2>Configurações</h2><button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    const r = this.ui.renderer.settings;
    const s = this.sim.state.settings;
    const p = this.ui.prefs;
    const toggles = RENDER_TOGGLES.map(([key, label]) => `<label><input class="px-check" type="checkbox" data-change="render" data-key="${key}"${r[key] ? ' checked' : ''}> ${esc(label)}</label>`).join('');
    const armies = `<label class="col">Exércitos visíveis
      <select class="px-select" data-change="armies">
        <option value="war"${r.showArmies === 'war' ? ' selected' : ''}>Apenas nações em guerra</option>
        <option value="all"${r.showArmies === 'all' ? ' selected' : ''}>Todos</option>
        <option value="none"${r.showArmies === 'none' ? ' selected' : ''}>Nenhum (só a nação selecionada)</option>
      </select></label>`;
    const simOpts = `
      <label class="col">Agressividade das nações
        <select class="px-select" data-change="aggression">
          ${CONFLICT_LEVEL_IDS.map((id) => `<option value="${id}"${s.aggression === id ? ' selected' : ''}>${esc(CONFLICT_LEVELS[id].name)}</option>`).join('')}
        </select>
        <span class="muted" data-out="aggression">${esc(CONFLICT_LEVELS[s.aggression].description)}</span></label>
      <label><input class="px-check" type="checkbox" data-change="rebellions"${s.rebellions ? ' checked' : ''}> Rebeliões</label>
      <label><input class="px-check" type="checkbox" data-change="diplomacy"${s.diplomacy ? ' checked' : ''}> Atividade diplomática</label>
      <div class="muted">Eventos: 50% de chance de acontecer um evento no mundo a cada mês.</div>`;
    const ui = `
      <label class="col">Notificações na tela
        <select class="px-select" data-change="toasts">
          <option value="3"${p.toastImportance === 3 ? ' selected' : ''}>Apenas marcos históricos</option>
          <option value="2"${p.toastImportance === 2 ? ' selected' : ''}>Acontecimentos importantes</option>
          <option value="1"${p.toastImportance === 1 ? ' selected' : ''}>Todos (muito frequente)</option>
        </select></label>
      <label class="col">Salvamento automático
        <select class="px-select" data-change="autosave">
          ${[0, 5, 10, 25, 50].map((v) => `<option value="${v}"${p.autosaveYears === v ? ' selected' : ''}>${v === 0 ? 'Desligado' : `A cada ${v} anos`}</option>`).join('')}
        </select></label>
      <label><input class="px-check" type="checkbox" data-change="pausewar"${p.pauseOnSelectedWar ? ' checked' : ''}> Pausar quando a nação selecionada entrar em guerra</label>`;
    return (
      sec('Mapa', 'globe', `<div class="settings-grid">${toggles}${armies}</div>`) +
      sec('Simulação', 'gear', `<div class="settings-grid">${simOpts}</div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input class="px-check" type="checkbox" data-change="autopeace"${s.autoPeace ? ' checked' : ''}> Nações fazem as pazes sozinhas (tratados automáticos)</label>
        <div class="muted">Desligado: cada guerra continua até um lado dominar o outro ou até você decidir a paz no painel da guerra. As mudanças valem imediatamente para este mundo.</div>`) +
      sec('Interface', 'info', `<div class="settings-grid">${ui}</div>`) +
      `<div class="action"><button class="px-btn" data-action="fit">${icon('target', 16)} Enquadrar mapa</button><button class="px-btn" data-close>Fechar</button></div>`
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
