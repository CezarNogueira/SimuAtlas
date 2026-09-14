// Camera 2D do mapa: centro em coordenadas de celula, zoom em pixels de tela por celula.
// O zoom navega por degraus (inteiros a partir de 2x) para manter os pixels nitidos.
export const ZOOM_STEPS = [0.3, 0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  targetZoom = 1;
  viewW = 800;
  viewH = 600;
  private anchor: { sx: number; sy: number; mx: number; my: number } | null = null;
  private flyTo: { x: number; y: number } | null = null;

  constructor(readonly mapW: number, readonly mapH: number) {
    this.x = mapW / 2;
    this.y = mapH / 2;
  }

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.clamp();
  }

  fitZoom(): number {
    return Math.min(this.viewW / this.mapW, this.viewH / this.mapH) * 0.98;
  }

  fit(): void {
    const z = this.fitZoom();
    const snapped = [...ZOOM_STEPS].reverse().find((s) => s <= z) ?? z;
    this.zoom = this.targetZoom = Math.max(snapped, z * 0.9);
    this.x = this.mapW / 2;
    this.y = this.mapH / 2;
    this.anchor = null;
    this.flyTo = null;
  }

  minZoom(): number {
    return Math.min(ZOOM_STEPS[0], this.fitZoom() * 0.8);
  }

  screenToMap(sx: number, sy: number): [number, number] {
    return [(sx - this.viewW / 2) / this.zoom + this.x, (sy - this.viewH / 2) / this.zoom + this.y];
  }

  mapToScreen(mx: number, my: number): [number, number] {
    return [(mx - this.x) * this.zoom + this.viewW / 2, (my - this.y) * this.zoom + this.viewH / 2];
  }

  zoomBy(steps: number, sx = this.viewW / 2, sy = this.viewH / 2): void {
    const current = this.targetZoom;
    let idx = ZOOM_STEPS.findIndex((s) => s >= current - 1e-6);
    if (idx < 0) idx = ZOOM_STEPS.length - 1;
    if (ZOOM_STEPS[idx] > current + 1e-6 && steps > 0) idx--;
    idx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + steps));
    const next = Math.max(this.minZoom(), ZOOM_STEPS[idx]);
    const [mx, my] = this.screenToMap(sx, sy);
    this.anchor = { sx, sy, mx, my };
    this.targetZoom = next;
    this.flyTo = null;
  }

  pan(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.anchor = null;
    this.flyTo = null;
    this.clamp();
  }

  focus(mx: number, my: number, zoom?: number): void {
    this.flyTo = { x: mx, y: my };
    this.anchor = null;
    if (zoom !== undefined) this.targetZoom = zoom;
  }

  update(dt: number): boolean {
    let moving = false;
    const k = Math.min(1, dt * 14);
    if (Math.abs(this.targetZoom - this.zoom) > 1e-4) {
      this.zoom += (this.targetZoom - this.zoom) * k;
      if (Math.abs(this.targetZoom - this.zoom) < 1e-3) this.zoom = this.targetZoom;
      if (this.anchor) {
        this.x = this.anchor.mx - (this.anchor.sx - this.viewW / 2) / this.zoom;
        this.y = this.anchor.my - (this.anchor.sy - this.viewH / 2) / this.zoom;
      }
      moving = true;
    } else {
      this.anchor = null;
    }
    if (this.flyTo) {
      const f = Math.min(1, dt * 6);
      this.x += (this.flyTo.x - this.x) * f;
      this.y += (this.flyTo.y - this.y) * f;
      if (Math.hypot(this.flyTo.x - this.x, this.flyTo.y - this.y) < 0.3) this.flyTo = null;
      moving = true;
    }
    this.clamp();
    return moving;
  }

  clamp(): void {
    const marginX = this.viewW / this.zoom / 2;
    const marginY = this.viewH / this.zoom / 2;
    const minX = Math.min(this.mapW / 2, marginX * 0.6);
    const maxX = Math.max(this.mapW / 2, this.mapW - marginX * 0.6);
    const minY = Math.min(this.mapH / 2, marginY * 0.6);
    const maxY = Math.max(this.mapH / 2, this.mapH - marginY * 0.6);
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
  }
}
