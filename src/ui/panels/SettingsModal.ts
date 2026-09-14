// Configuracoes: exibicao do mapa, parametros da simulacao e preferencias da interface.
import type { RenderSettings } from '../../render/MapRenderer';
import type { SimSettings } from '../../state/types';
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

type NumericSimKey = Exclude<keyof SimSettings, 'autoPeace'>;

const SIM_SLIDERS: [NumericSimKey, string, number, number][] = [
  ['aggression', 'Agressividade das nações', 25, 200],
  ['eventFrequency', 'Frequência de eventos', 0, 250],
  ['rebellionFrequency', 'Frequência de rebeliões', 0, 250],
  ['diplomacyFrequency', 'Atividade diplomática', 25, 250],
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
    const sliders = SIM_SLIDERS.map(([key, label, min, max]) => `<label class="col">${esc(label)}: <b data-out="${key}">${Math.round(s[key] * 100)}%</b>
      <input class="px-range" type="range" min="${min}" max="${max}" step="5" value="${Math.round(s[key] * 100)}" data-change="sim" data-key="${key}"></label>`).join('');
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
      sec('Simulação', 'gear', `<div class="settings-grid">${sliders}</div>
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
      case 'sim': {
        const key = t.dataset.key as NumericSimKey;
        this.sim.state.settings[key] = Number(input.value) / 100;
        const out = this.box.querySelector(`[data-out="${key}"]`);
        if (out) out.textContent = `${input.value}%`;
        break;
      }
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
