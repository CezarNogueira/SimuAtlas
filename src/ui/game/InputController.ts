// Entrada: arrastar para mover, roda/pinca para zoom, clique para selecionar,
// botao direito para ordenar marcha e atalhos de teclado.
import { SPEEDS } from '../../app/GameLoop';
import type { GameScreen } from './GameScreen';

const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [1, 0], arrowleft: [1, 0], d: [-1, 0], arrowright: [-1, 0],
};

export class InputController {
  private down: { x: number; y: number; button: number } | null = null;
  private dragging = false;
  private last = { x: 0, y: 0 };
  private keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private lastHover = 0;
  private offs: (() => void)[] = [];

  constructor(private readonly screen: GameScreen) {
    const c = screen.canvas;
    const listen = (target: EventTarget, type: string, fn: (ev: Event) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.offs.push(() => target.removeEventListener(type, fn, opts));
    };
    listen(c, 'pointerdown', (ev) => this.onDown(ev as PointerEvent));
    listen(c, 'pointermove', (ev) => this.onMove(ev as PointerEvent));
    listen(c, 'pointerup', (ev) => this.onUp(ev as PointerEvent));
    listen(c, 'pointercancel', (ev) => this.onUp(ev as PointerEvent));
    listen(c, 'pointerleave', () => {
      screen.renderer.hoverProvince = -1;
      screen.ui.hideTooltip();
    });
    listen(c, 'wheel', (ev) => this.onWheel(ev as WheelEvent), { passive: false });
    listen(c, 'dblclick', (ev) => {
      const e = ev as MouseEvent;
      screen.renderer.camera.zoomBy(2, e.offsetX, e.offsetY);
    });
    listen(c, 'contextmenu', (ev) => ev.preventDefault());
    listen(window, 'keydown', (ev) => this.onKey(ev as KeyboardEvent));
    listen(window, 'keyup', (ev) => this.keys.delete((ev as KeyboardEvent).key.toLowerCase()));
    listen(window, 'blur', () => this.keys.clear());
  }

  private onDown(ev: PointerEvent): void {
    this.pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
    if (this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      this.down = null;
      return;
    }
    this.down = { x: ev.offsetX, y: ev.offsetY, button: ev.button };
    this.last = { x: ev.offsetX, y: ev.offsetY };
    this.dragging = false;
    this.screen.canvas.setPointerCapture(ev.pointerId);
  }

  private onMove(ev: PointerEvent): void {
    const x = ev.offsetX;
    const y = ev.offsetY;
    if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, { x, y });
    const cam = this.screen.renderer.camera;
    if (this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (this.pinchDist > 0 && (dist / this.pinchDist > 1.25 || dist / this.pinchDist < 0.8)) {
        cam.zoomBy(dist > this.pinchDist ? 1 : -1, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        this.pinchDist = dist;
      }
      return;
    }
    if (this.down) {
      if (!this.dragging && Math.hypot(x - this.down.x, y - this.down.y) > 4) {
        this.dragging = true;
        this.screen.canvas.dataset.dragging = 'true';
        this.screen.ui.hideTooltip();
      }
      if (this.dragging) {
        cam.pan(x - this.last.x, y - this.last.y);
        this.last = { x, y };
        return;
      }
    }
    const now = performance.now();
    if (now - this.lastHover < 50) return;
    this.lastHover = now;
    const pick = this.screen.renderer.pick(x, y);
    this.screen.renderer.hoverProvince = pick.army >= 0 || pick.battle >= 0 ? -1 : pick.province;
    this.screen.ui.hover(pick, x, y);
  }

  private onUp(ev: PointerEvent): void {
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.down && !this.dragging && ev.type === 'pointerup') {
      const pick = this.screen.renderer.pick(ev.offsetX, ev.offsetY);
      if (this.down.button === 2) this.screen.ui.handleRightClick(pick);
      else if (this.down.button === 0) this.screen.ui.handleClick(pick, ev.shiftKey);
    }
    this.down = null;
    this.dragging = false;
    this.screen.canvas.dataset.dragging = 'false';
  }

  private onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    if (Math.abs(ev.deltaY) < 1) return;
    this.screen.renderer.camera.zoomBy(ev.deltaY < 0 ? 1 : -1, ev.offsetX, ev.offsetY);
  }

  private onKey(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const key = ev.key.toLowerCase();
    const { loop, ui, renderer } = this.screen;
    if ((ev.ctrlKey || ev.metaKey) && key === 's') {
      ev.preventDefault();
      void ui.quickSave();
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    // Com uma janela modal aberta (menu, estatisticas, saves...), so o Esc age sobre o jogo.
    if (ui.modalOpen && key !== 'escape') return;
    if (PAN_KEYS[key]) {
      this.keys.add(key);
      ev.preventDefault();
      return;
    }
    if (key === ' ') {
      ev.preventDefault();
      loop.togglePause();
    } else if (/^[1-7]$/.test(key)) {
      loop.setSpeed(SPEEDS[Number(key) - 1]);
    } else if (key === '+' || key === '=') {
      renderer.camera.zoomBy(1);
    } else if (key === '-' || key === '_') {
      renderer.camera.zoomBy(-1);
    } else if (key === 'escape') {
      ui.escape();
    } else if (key === 'h') {
      ui.toggleLeft('history');
    } else if (key === 'g') {
      ui.toggleLeft('wars');
    } else if (key === 't') {
      ui.toggleLeft('techs');
    } else if (key === 'e') {
      ui.openModal('stats');
    } else if (key === 'f') {
      ui.focusSelection();
    } else if (key === '.') {
      if (loop.paused) loop.stepDay();
    }
  }

  update(dt: number): void {
    if (!this.keys.size) return;
    let dx = 0;
    let dy = 0;
    for (const k of this.keys) {
      const v = PAN_KEYS[k];
      if (v) {
        dx += v[0];
        dy += v[1];
      }
    }
    if (dx || dy) this.screen.renderer.camera.pan(dx * 700 * dt, dy * 700 * dt);
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }
}
