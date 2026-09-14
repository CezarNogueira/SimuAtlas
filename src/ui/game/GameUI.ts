// UI do jogo: HUD, paineis laterais, modais, dicas flutuantes, notificacoes e navegacao entre entidades.
import { fmtCompact, fmtInt } from '../../core/format';
import { terrainInfo } from '../../data/terrain';
import { DEFAULT_RENDER, type PickResult, type RenderSettings } from '../../render/MapRenderer';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { PlayerActions } from '../../sim/PlayerActions';
import type { HistoryEntry } from '../../state/types';
import { el, esc, flagInline, on } from '../dom';
import { BottomBar } from '../hud/BottomBar';
import { MapModeBar } from '../hud/MapModeBar';
import { Toasts } from '../hud/Toasts';
import { TopBar } from '../hud/TopBar';
import { ArmyPanel } from '../panels/ArmyPanel';
import { BattlePanel } from '../panels/BattlePanel';
import { armyStatus } from '../panels/common';
import { EscMenu } from '../panels/EscMenu';
import { HelpModal } from '../panels/HelpModal';
import { HistoryPanel } from '../panels/HistoryPanel';
import { NationPanel } from '../panels/NationPanel';
import type { Panel } from '../panels/Panel';
import { ProvincePanel } from '../panels/ProvincePanel';
import { SaveModal } from '../panels/SaveModal';
import { SettingsModal } from '../panels/SettingsModal';
import { StatsModal } from '../panels/StatsModal';
import { TechnologiesPanel } from '../panels/TechnologiesPanel';
import { TechPanel } from '../panels/TechPanel';
import { WarPanel } from '../panels/WarPanel';
import { WarsPanel } from '../panels/WarsPanel';
import type { GameScreen } from './GameScreen';

export interface UIPrefs {
  toastImportance: 1 | 2 | 3;
  autosaveYears: number;
  pauseOnSelectedWar: boolean;
}

export type ModalKind = 'stats' | 'settings' | 'save' | 'load' | 'menu' | 'help';
export type LeftKind = 'history' | 'wars' | 'techs';

const PREFS_KEY = 'atlas-vivo:prefs';
const RENDER_KEY = 'atlas-vivo:render';

function loadJson<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Armazenamento local indisponivel: preferencias valem apenas nesta sessao.
  }
}

export class GameUI {
  readonly layer: HTMLElement;
  readonly actions: PlayerActions;
  prefs: UIPrefs;
  readonly toasts: Toasts;
  private readonly topbar: TopBar;
  private readonly bottombar: BottomBar;
  private readonly modes: MapModeBar;
  private readonly tooltip: HTMLElement;
  private right: Panel | null = null;
  private left: Panel | null = null;
  private modal: Panel | null = null;
  private leftKind: LeftKind | null = null;
  private lastHud = 0;
  private lastPanels = 0;
  private offs: (() => void)[] = [];

  constructor(readonly screen: GameScreen) {
    this.layer = el('div', 'ui-layer');
    screen.node.appendChild(this.layer);
    this.actions = new PlayerActions(screen.sim);
    this.prefs = loadJson<UIPrefs>(PREFS_KEY, { toastImportance: 3, autosaveYears: 10, pauseOnSelectedWar: false });
    screen.renderer.settings = { ...DEFAULT_RENDER, ...loadJson<Partial<RenderSettings>>(RENDER_KEY, {}) };
    this.topbar = new TopBar(this);
    this.bottombar = new BottomBar(this);
    this.modes = new MapModeBar(this);
    this.toasts = new Toasts(this);
    this.tooltip = el('div', 'tooltip');
    this.tooltip.hidden = true;
    this.layer.appendChild(this.tooltip);
    const num = (t: HTMLElement, key: string) => Number(t.dataset[key]);
    this.offs.push(
      on(this.layer, 'click', '[data-country]', (t) => this.selectCountry(num(t, 'country'), t.dataset.focus !== undefined)),
      on(this.layer, 'click', '[data-province]', (t) => this.selectProvince(num(t, 'province'), true)),
      on(this.layer, 'click', '[data-army]', (t) => this.selectArmy(num(t, 'army'), true)),
      on(this.layer, 'click', '[data-battle]', (t) => this.openBattle(num(t, 'battle'), true)),
      on(this.layer, 'click', '[data-war]', (t) => this.openWar(num(t, 'war'))),
      on(this.layer, 'click', '[data-tech]', (t) => this.openTech(t.dataset.tech ?? '')),
      screen.sim.bus.on('history', (e) => this.onHistory(e)),
    );
  }

  get sim() {
    return this.screen.sim;
  }

  get renderer() {
    return this.screen.renderer;
  }

  get loop() {
    return this.screen.loop;
  }

  get modalOpen(): boolean {
    return this.modal !== null;
  }

  frame(t: number, dt: number): void {
    this.screen.input.update(dt);
    if (t - this.lastHud > 200) {
      this.lastHud = t;
      this.topbar.update();
      this.bottombar.update();
      this.modes.update();
    }
    if (t - this.lastPanels > 500) {
      this.lastPanels = t;
      this.right?.update();
      this.left?.update();
      this.modal?.update();
    }
    this.toasts.tick(t);
  }

  private setRight(panel: Panel | null): void {
    this.right?.destroy();
    this.right = panel;
    if (panel) {
      this.layer.appendChild(panel.node);
      panel.update();
    }
  }

  selectCountry(id: number, focus = false): void {
    const c = this.sim.country(id);
    if (!c) return;
    this.renderer.selectedCountry = id;
    this.renderer.selectedArmy = -1;
    if (this.right instanceof NationPanel && this.right.id === id) this.right.update();
    else this.setRight(new NationPanel(this, id));
    if (focus) this.renderer.focusCountry(id);
  }

  selectProvince(id: number, focus = false): void {
    if (!this.sim.map.provinces[id]) return;
    this.renderer.selectedProvince = id;
    this.renderer.selectedCountry = this.sim.province(id).owner;
    this.renderer.selectedArmy = -1;
    this.setRight(new ProvincePanel(this, id));
    if (focus) this.renderer.focusProvince(id);
  }

  selectArmy(id: number, focus = false): void {
    const a = this.sim.index.armyById.get(id);
    if (!a) return;
    this.renderer.selectedArmy = id;
    this.renderer.selectedCountry = a.owner;
    this.setRight(new ArmyPanel(this, id));
    if (focus) this.renderer.focusProvince(a.location);
  }

  openBattle(id: number, focus = false): void {
    const b = this.sim.index.battleById.get(id);
    if (!b) {
      this.toasts.info('Os registros desta batalha já foram arquivados.');
      return;
    }
    this.setRight(new BattlePanel(this, id));
    if (focus) this.renderer.focusProvince(b.province);
  }

  openWar(id: number): void {
    if (!this.sim.index.warById.get(id)) return;
    this.setRight(new WarPanel(this, id));
  }

  openTech(id: string): void {
    if (!this.sim.technology.db.get(id)) return;
    if (this.right instanceof TechPanel && this.right.techId === id) return;
    this.setRight(new TechPanel(this, id));
  }

  closeRight(): void {
    this.setRight(null);
    this.renderer.selectedCountry = -1;
    this.renderer.selectedArmy = -1;
    this.renderer.selectedProvince = -1;
  }

  toggleLeft(kind: LeftKind): void {
    const same = this.leftKind === kind;
    this.left?.destroy();
    this.left = null;
    this.leftKind = null;
    if (same) return;
    this.left = kind === 'history' ? new HistoryPanel(this) : kind === 'techs' ? new TechnologiesPanel(this) : new WarsPanel(this);
    this.leftKind = kind;
    this.layer.appendChild(this.left.node);
    this.left.update();
  }

  closeLeft(): void {
    this.left?.destroy();
    this.left = null;
    this.leftKind = null;
  }

  openModal(kind: ModalKind): void {
    this.closeModal();
    switch (kind) {
      case 'stats': this.modal = new StatsModal(this); break;
      case 'settings': this.modal = new SettingsModal(this); break;
      case 'save': this.modal = new SaveModal(this, 'save'); break;
      case 'load': this.modal = new SaveModal(this, 'load'); break;
      case 'help': this.modal = new HelpModal(this); break;
      default: this.modal = new EscMenu(this); break;
    }
    this.layer.appendChild(this.modal.node);
    this.modal.update();
  }

  closeModal(): void {
    this.modal?.destroy();
    this.modal = null;
  }

  escape(): void {
    if (this.modal) this.closeModal();
    else if (this.right) this.closeRight();
    else if (this.left) this.closeLeft();
    else this.openModal('menu');
  }

  focusSelection(): void {
    const r = this.renderer;
    const army = r.selectedArmy >= 0 ? this.sim.index.armyById.get(r.selectedArmy) : undefined;
    if (army) r.focusProvince(army.location);
    else if (r.selectedProvince >= 0) r.focusProvince(r.selectedProvince);
    else if (r.selectedCountry >= 0) r.focusCountry(r.selectedCountry);
    else r.camera.fit();
  }

  async quickSave(): Promise<void> {
    try {
      await this.screen.save(`${this.screen.map.name} — ${this.sim.year()}`);
      this.toasts.info('Jogo salvo.');
    } catch (err) {
      console.error(err);
      this.toasts.info('Não foi possível salvar (armazenamento indisponível).');
    }
  }

  handleClick(pick: PickResult, shift: boolean): void {
    if (pick.battle >= 0) {
      this.openBattle(pick.battle);
      return;
    }
    if (pick.army >= 0) {
      this.selectArmy(pick.army);
      return;
    }
    if (pick.province >= 0) {
      if (shift) {
        this.selectProvince(pick.province);
        return;
      }
      this.renderer.selectedProvince = pick.province;
      this.selectCountry(this.sim.province(pick.province).owner);
      return;
    }
    this.closeRight();
  }

  handleRightClick(pick: PickResult): void {
    const armyId = this.renderer.selectedArmy;
    if (armyId < 0 || pick.province < 0) return;
    const result = this.actions.orderArmy(armyId, pick.province);
    this.toasts.info(result.message);
    this.right?.update();
  }

  hover(pick: PickResult, x: number, y: number): void {
    const sim = this.sim;
    let html = '';
    if (pick.army >= 0) {
      const a = sim.index.armyById.get(pick.army);
      if (a) html = `<b>${esc(a.name)}</b><br>${fmtInt(soldiersOf(a))} soldados · moral ${Math.round(a.morale * 100)}%<br><span class="muted">${esc(armyStatus(sim, a))}</span>`;
    } else if (pick.battle >= 0) {
      const b = sim.index.battleById.get(pick.battle);
      if (b) {
        const att = sim.country(b.attacker.countries[0]);
        const def = sim.country(b.defender.countries[0]);
        html = `<b>${esc(b.name)}</b><br>${esc(att.name)} x ${esc(def.name)}<br><span class="muted">${b.end < 0 ? `Dia ${b.days} de combate` : 'Encerrada'} — clique para detalhes</span>`;
      }
    } else if (pick.province >= 0) {
      const mp = sim.map.provinces[pick.province];
      const ps = sim.state.provinces[pick.province];
      const owner = sim.country(ps.owner);
      html = `<b>${esc(mp.name)}</b> <span class="muted">${esc(terrainInfo(mp.terrain).name)}</span><br>${flagInline(owner, 16)} ${esc(owner.name)}`;
      if (ps.controller !== ps.owner) html += `<br><span class="muted">Ocupada por ${esc(sim.country(ps.controller).name)}</span>`;
      html += `<br>População ${fmtCompact(ps.population)} · Agitação ${Math.round(ps.unrest)}%`;
      if (ps.siege) html += `<br>Cerco: ${Math.min(100, Math.round((ps.siege.progress / ps.siege.needed) * 100))}%`;
    }
    if (!html) {
      this.hideTooltip();
      return;
    }
    this.tooltip.innerHTML = html;
    this.tooltip.hidden = false;
    const w = this.tooltip.offsetWidth;
    const h = this.tooltip.offsetHeight;
    const left = Math.min(x + 16, this.layer.clientWidth - w - 6);
    const top = Math.min(y + 18, this.layer.clientHeight - h - 6);
    this.tooltip.style.left = `${Math.max(4, left)}px`;
    this.tooltip.style.top = `${Math.max(4, top)}px`;
  }

  hideTooltip(): void {
    this.tooltip.hidden = true;
  }

  saveRenderSettings(): void {
    saveJson(RENDER_KEY, this.renderer.settings);
  }

  savePrefs(): void {
    saveJson(PREFS_KEY, this.prefs);
  }

  private onHistory(e: HistoryEntry): void {
    const sel = this.renderer.selectedCountry;
    const involved = sel >= 0 && e.countries.includes(sel);
    if (e.importance >= this.prefs.toastImportance || (involved && e.importance >= 2)) this.toasts.push(e);
    if (this.prefs.pauseOnSelectedWar && involved && (e.type === 'war_declared' || e.type === 'capital_fall')) this.loop.paused = true;
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.right?.destroy();
    this.left?.destroy();
    this.modal?.destroy();
    this.layer.remove();
  }
}
