// Aplicacao: fluxo de telas (menu -> novo jogo/carregar -> jogo) e carregamento de mapas.
import { browserMapSource, loadMap, loadMapIndex, type MapData, type MapSummary } from '../map/MapData';
import { SaveManager } from '../persistence/SaveManager';
import { iconUrl } from '../render/sprites/icons';
import { createWorld, normalizeSettings, SAVE_VERSION, type NewGameOptions } from '../sim/createWorld';
import { Simulation } from '../sim/Simulation';
import type { GameState } from '../state/types';
import { el, esc, icon, nextFrame } from '../ui/dom';
import { GameScreen } from '../ui/game/GameScreen';
import { LoadScreen } from '../ui/screens/LoadScreen';
import { MainMenu } from '../ui/screens/MainMenu';
import { NewGameScreen } from '../ui/screens/NewGameScreen';

export interface Screen {
  destroy(): void;
}

export class App {
  readonly saves = new SaveManager();
  readonly source = browserMapSource('maps');
  maps: MapSummary[] = [];
  private screen: Screen | null = null;
  private mapCache = new Map<string, MapData>();

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
    this.loading('Preparando o atlas...');
    const favicon = document.getElementById('favicon') as HTMLLinkElement | null;
    if (favicon) favicon.href = iconUrl('castle');
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "Pixelify Sans"'),
        document.fonts.load('600 16px "Pixelify Sans"'),
        document.fonts.load('40px "Jacquarda Bastarda 9"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).catch(() => undefined);
    try {
      this.maps = await loadMapIndex(this.source);
    } catch (err) {
      this.error('Não foi possível carregar a lista de mapas. Rode "npm run build-maps" antes de iniciar.', err);
      return;
    }
    this.menu();
  }

  private swap(screen: Screen | null, node?: HTMLElement): void {
    this.screen?.destroy();
    this.root.innerHTML = '';
    this.screen = screen;
    if (node) this.root.appendChild(node);
  }

  loading(message: string): void {
    const node = el('div', 'screen loading', `<img class="spinner px-icon" src="${iconUrl('castle')}" alt=""><div class="msg">${esc(message)}</div>`);
    this.swap(null, node);
  }

  error(message: string, err?: unknown): void {
    console.error(err);
    const node = el('div', 'screen');
    node.innerHTML = `<div class="px-panel menu-box"><h2>${icon('skull', 32)} Ops!</h2><p>${esc(message)}</p><button class="px-btn" data-back>Voltar ao menu</button></div>`;
    node.querySelector('[data-back]')?.addEventListener('click', () => this.menu());
    this.swap(null, node);
  }

  menu(): void {
    this.swap(null);
    this.screen = new MainMenu(this.root, this);
  }

  newGame(): void {
    this.swap(null);
    this.screen = new NewGameScreen(this.root, this);
  }

  loadGame(): void {
    this.swap(null);
    this.screen = new LoadScreen(this.root, this);
  }

  async getMap(id: string): Promise<MapData> {
    let map = this.mapCache.get(id);
    if (!map) {
      map = await loadMap(id, this.source);
      this.mapCache.clear();
      this.mapCache.set(id, map);
    }
    return map;
  }

  async startNew(mapId: string, opts: NewGameOptions): Promise<void> {
    try {
      this.loading('Carregando mapa geográfico...');
      const map = await this.getMap(mapId);
      this.loading('Gerando nações, estados e exércitos...');
      await nextFrame();
      await nextFrame();
      const sim = createWorld(map, opts);
      this.loading('Pintando o mapa...');
      await nextFrame();
      this.play(map, sim);
    } catch (err) {
      this.error('Falha ao iniciar a simulação.', err);
    }
  }

  async startFromState(state: GameState): Promise<void> {
    try {
      this.loading('Carregando mapa do save...');
      const map = await this.getMap(state.mapId);
      if (state.version !== SAVE_VERSION || state.provinces.length !== map.provinceCount) {
        this.error('Este save foi criado com a divisão antiga do mapa (províncias geradas por cidades) e não é compatível com os mapas atuais, divididos em estados. Inicie um novo jogo.');
        return;
      }
      this.loading('Restaurando o mundo...');
      await nextFrame();
      // Saves antigos guardavam os parametros como porcentagens.
      state.settings = normalizeSettings(state.settings);
      const sim = new Simulation(map, state);
      await nextFrame();
      this.play(map, sim);
    } catch (err) {
      this.error('Falha ao carregar o save.', err);
    }
  }

  private play(map: MapData, sim: Simulation): void {
    this.swap(null);
    this.screen = new GameScreen(this.root, this, map, sim);
  }
}
