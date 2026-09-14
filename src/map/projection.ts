// Projecoes (inverso) usadas em tempo de execucao para grade de latitude/longitude e coordenadas.
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface ProjectionDef {
  type: 'miller' | 'equirect' | 'lcc';
  lon0?: number;
  lat0?: number;
  lat1?: number;
  lat2?: number;
}

export interface GridTransform {
  xmin: number;
  ymax: number;
  scale: number;
}

export function makeInverse(p: ProjectionDef, t: GridTransform): (gx: number, gy: number) => [number, number] {
  let inv: (x: number, y: number) => [number, number];
  if (p.type === 'lcc') {
    const f1 = (p.lat1 ?? 40) * D2R;
    const f2 = (p.lat2 ?? 60) * D2R;
    const f0 = (p.lat0 ?? 50) * D2R;
    const l0 = (p.lon0 ?? 0) * D2R;
    const tt = (f: number) => Math.tan(Math.PI / 4 + f / 2);
    const n = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(tt(f2) / tt(f1));
    const F = (Math.cos(f1) * Math.pow(tt(f1), n)) / n;
    const rho0 = F / Math.pow(tt(f0), n);
    inv = (x, y) => {
      const rho = Math.sign(n) * Math.hypot(x, rho0 - y);
      const theta = Math.atan2(x * Math.sign(n), (rho0 - y) * Math.sign(n));
      return [(theta / n + l0) * R2D, (2 * Math.atan(Math.pow(F / rho, 1 / n)) - Math.PI / 2) * R2D];
    };
  } else if (p.type === 'equirect') {
    const k = Math.cos((p.lat1 ?? 0) * D2R);
    inv = (x, y) => [(x / k) * R2D + (p.lon0 ?? 0), y * R2D];
  } else {
    inv = (x, y) => [x * R2D + (p.lon0 ?? 0), ((Math.atan(Math.exp(y / 1.25)) - Math.PI / 4) / 0.4) * R2D];
  }
  return (gx, gy) => inv(gx / t.scale + t.xmin, t.ymax - gy / t.scale);
}
