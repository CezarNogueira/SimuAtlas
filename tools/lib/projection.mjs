// Projecoes cartograficas (esfericas) e transformacao para a grade de pixels do mapa.
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clampLat = (lat) => Math.max(-85, Math.min(85, lat));

export function createProjection(p) {
  if (p.type === 'miller') {
    const lon0 = p.lon0 ?? 0;
    return {
      forward: (lon, lat) => [(lon - lon0) * D2R, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * clampLat(lat) * D2R))],
      inverse: (x, y) => [x * R2D + lon0, ((Math.atan(Math.exp(y / 1.25)) - Math.PI / 4) / 0.4) * R2D],
    };
  }
  if (p.type === 'equirect') {
    const lon0 = p.lon0 ?? 0;
    const k = Math.cos((p.lat1 ?? 0) * D2R);
    return {
      forward: (lon, lat) => [(lon - lon0) * D2R * k, clampLat(lat) * D2R],
      inverse: (x, y) => [(x / k) * R2D + lon0, y * R2D],
    };
  }
  if (p.type === 'lcc') {
    // Lambert conica conforme com dois paralelos padrao.
    const f1 = p.lat1 * D2R;
    const f2 = p.lat2 * D2R;
    const f0 = p.lat0 * D2R;
    const l0 = p.lon0 * D2R;
    const t = (f) => Math.tan(Math.PI / 4 + f / 2);
    const n = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(t(f2) / t(f1));
    const F = (Math.cos(f1) * Math.pow(t(f1), n)) / n;
    const rho0 = F / Math.pow(t(f0), n);
    return {
      forward: (lon, lat) => {
        const rho = F / Math.pow(t(clampLat(lat) * D2R), n);
        const theta = n * (lon * D2R - l0);
        return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
      },
      inverse: (x, y) => {
        const rho = Math.sign(n) * Math.hypot(x, rho0 - y);
        const theta = Math.atan2(x * Math.sign(n), (rho0 - y) * Math.sign(n));
        const lon = (theta / n + l0) * R2D;
        const lat = (2 * Math.atan(Math.pow(F / rho, 1 / n)) - Math.PI / 2) * R2D;
        return [lon, lat];
      },
    };
  }
  throw new Error(`Projecao desconhecida: ${p.type}`);
}

// Cria a grade retangular que cobre o recorte geografico projetado.
export function createGrid(def) {
  const proj = createProjection(def.projection);
  const { lonMin, lonMax, latMin, latMax } = def.bounds;
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  const S = 96;
  const acc = (lon, lat) => {
    const [x, y] = proj.forward(lon, lat);
    if (x < xmin) xmin = x;
    if (x > xmax) xmax = x;
    if (y < ymin) ymin = y;
    if (y > ymax) ymax = y;
  };
  for (let i = 0; i <= S; i++) {
    const lon = lonMin + ((lonMax - lonMin) * i) / S;
    const lat = latMin + ((latMax - latMin) * i) / S;
    acc(lon, latMin);
    acc(lon, latMax);
    acc(lonMin, lat);
    acc(lonMax, lat);
  }
  const width = def.width;
  const scale = width / (xmax - xmin);
  const height = Math.round((ymax - ymin) * scale);
  return {
    width,
    height,
    scale,
    xmin,
    ymax,
    proj,
    toGrid(lon, lat) {
      const [x, y] = proj.forward(lon, lat);
      return [(x - xmin) * scale, (ymax - y) * scale];
    },
    toLonLat(gx, gy) {
      return proj.inverse(gx / scale + xmin, ymax - gy / scale);
    },
  };
}

export const normalizeLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
