// Tela do jogo: canvas do mapa, laco de simulacao/renderizacao, entrada e interface.
import type { App } from '../../app/App';
import { GameLoop } from '../../app/GameLoop';
import { formatDate } from '../../core/calendar';
import type { MapData } from '../../map/MapData';
import { MapRenderer } from '../../render/MapRenderer';
import type { Simulation } from '../../sim/Simulation';
import { el } from '../dom';
import { GameUI } from './GameUI';
import { InputController } from './InputController';

export class GameScreen {
  readonly node: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: MapRenderer;
  readonly loop: GameLoop;
  readonly ui: GameUI;
  readonly input: InputController;
  private readonly observer: ResizeObserver;
  private readonly offYear: () => void;

  constructor(root: HTMLElement, readonly app: App, readonly map: MapData, readonly sim: Simulation) {
    this.node = el('div', 'fixed inset-0 overflow-hidden');
    this.canvas = el('canvas', 'absolute inset-0 block cursor-grab data-[dragging=true]:cursor-grabbing');
    this.canvas.dataset.ui = 'map';
    this.node.appendChild(this.canvas);
    root.appendChild(this.node);
    this.renderer = new MapRenderer(this.canvas, map, sim, map.projection, map.transform);
    this.loop = new GameLoop(sim, this.renderer);
    this.ui = new GameUI(this);
    this.input = new InputController(this);
    this.resize();
    this.renderer.camera.fit();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.node);
    this.loop.onFrame = (t, dt) => this.ui.frame(t, dt);
    this.offYear = sim.bus.on('year', (year) => {
      const every = this.ui.prefs.autosaveYears;
      if (every > 0 && year > sim.state.startYear && (year - sim.state.startYear) % every === 0) {
        void this.save('Salvamento automático', 'autosave', true).catch((err) => console.warn('Autosave falhou', err));
      }
    });
    this.loop.speed = 1;
    this.loop.paused = false;
    this.loop.start();
  }

  resize(): void {
    const r = this.node.getBoundingClientRect();
    this.renderer.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2, window.devicePixelRatio || 1));
  }

  async save(name: string, id = `save-${Date.now()}`, auto = false): Promise<void> {
    const sim = this.sim;
    const state = sim.snapshot();
    await this.app.saves.save(
      {
        id,
        name,
        mapId: this.map.id,
        mapName: this.map.name,
        eraId: state.eraId,
        year: sim.year(),
        dateText: formatDate(state.day, state.startYear),
        nations: sim.countries.nations().length,
        auto,
        version: state.version,
      },
      state,
    );
  }

  destroy(): void {
    this.loop.stop();
    this.offYear();
    this.input.destroy();
    this.ui.destroy();
    this.renderer.detach();
    this.observer.disconnect();
    this.node.remove();
  }
}
