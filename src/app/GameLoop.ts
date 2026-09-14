// Laco principal: avanca a simulacao conforme a velocidade (com orcamento de tempo por quadro)
// e renderiza o mapa com interpolacao sub-diaria para movimentos suaves.
import type { MapRenderer } from '../render/MapRenderer';
import type { Simulation } from '../sim/Simulation';

export const SPEEDS = [1, 2, 5, 10, 25, 50, 100] as const;
export const DAYS_PER_SECOND_1X = 3;

export class GameLoop {
  speed = 1;
  paused = true;
  actualDaysPerSecond = 0;
  private running = false;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private counterDays = 0;
  private counterStart = 0;
  onFrame: ((time: number, dt: number) => void) | null = null;

  constructor(private sim: Simulation, private readonly renderer: MapRenderer) {}

  setSim(sim: Simulation): void {
    this.sim = sim;
    this.acc = 0;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.counterStart = this.last;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.paused = false;
  }

  // Avanca um dia imediatamente (usado com o jogo pausado).
  stepDay(): void {
    this.sim.step();
  }

  private tick = (t: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    if (!this.paused) {
      this.acc += dt * DAYS_PER_SECOND_1X * this.speed;
      const deadline = performance.now() + 12;
      let steps = 0;
      while (this.acc >= 1 && performance.now() < deadline) {
        this.sim.step();
        this.acc -= 1;
        steps++;
      }
      if (this.acc > 3) this.acc = 3;
      this.counterDays += steps;
    }
    if (t - this.counterStart >= 1000) {
      this.actualDaysPerSecond = (this.counterDays * 1000) / (t - this.counterStart);
      this.counterDays = 0;
      this.counterStart = t;
    }
    const frac = this.paused ? 0 : Math.min(0.999, this.acc);
    try {
      this.renderer.render(t, dt, frac);
      this.onFrame?.(t, dt);
    } catch (err) {
      console.error(err);
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
