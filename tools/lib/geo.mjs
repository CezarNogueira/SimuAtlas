// Utilitarios de GeoJSON: leitura, iteracao de geometrias, bbox, ponto-em-poligono.
import { readFileSync } from 'node:fs';

export function loadFeatures(file) {
  return JSON.parse(readFileSync(file, 'utf8')).features;
}

export function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

export function linesOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

// Mapas que ultrapassam 180 graus (ex.: Asia+Oceania) deslocam aneis do lado oeste.
export function shiftRing(ring, bounds) {
  if (bounds.lonMax <= 180) return ring;
  let sum = 0;
  for (const p of ring) sum += p[0];
  if (sum / ring.length < bounds.lonMin - 5) return ring.map(([x, y]) => [x + 360, y]);
  return ring;
}

export function shiftLon(lon, bounds) {
  return bounds.lonMax > 180 && lon < bounds.lonMin - 5 ? lon + 360 : lon;
}

export function ringBBox(ring) {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (const [x, y] of ring) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

export function bboxTouches(bb, bounds, margin) {
  return !(
    bb[2] < bounds.lonMin - margin ||
    bb[0] > bounds.lonMax + margin ||
    bb[3] < bounds.latMin - margin ||
    bb[1] > bounds.latMax + margin
  );
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(x, y, poly) {
  if (!pointInRing(x, y, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (pointInRing(x, y, poly[i])) return false;
  return true;
}

// Projeta um anel para coordenadas de grade, descartando vertices redundantes.
export function projectRing(ring, grid, bounds) {
  const src = shiftRing(ring, bounds);
  const out = [];
  let px = NaN;
  let py = NaN;
  for (const [lon, lat] of src) {
    const [x, y] = grid.toGrid(lon, lat);
    if (Math.abs(x - px) + Math.abs(y - py) < 0.3) continue;
    out.push([x, y]);
    px = x;
    py = y;
  }
  return out;
}

export function ringArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(s / 2);
}

export function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// Douglas-Peucker em lista de pontos [x,y].
export function simplifyLine(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
