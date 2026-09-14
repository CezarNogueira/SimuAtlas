// Baixa os dados geograficos brutos usados pelo pipeline de mapas.
// Fontes: Natural Earth (dominio publico) e NASA Blue Marble / GEBCO (dominio publico).
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RAW_DIR = path.resolve('data-raw');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const NASA = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/';

export const SOURCES = [
  { file: 'ne_10m_admin_0_countries.geojson', url: NE + 'ne_10m_admin_0_countries.geojson' },
  { file: 'ne_10m_admin_1_states_provinces.geojson', url: NE + 'ne_10m_admin_1_states_provinces.geojson' },
  { file: 'ne_10m_populated_places.geojson', url: NE + 'ne_10m_populated_places.geojson' },
  { file: 'ne_10m_rivers_lake_centerlines.geojson', url: NE + 'ne_10m_rivers_lake_centerlines.geojson' },
  { file: 'ne_10m_lakes.geojson', url: NE + 'ne_10m_lakes.geojson' },
  { file: 'ne_10m_geography_regions_polys.geojson', url: NE + 'ne_10m_geography_regions_polys.geojson' },
  { file: 'ne_10m_geography_marine_polys.geojson', url: NE + 'ne_10m_geography_marine_polys.geojson' },
  { file: 'elev_5400x2700.jpg', url: NASA + 'topography/gebco_08_rev_elev_5400x2700.jpg' },
  { file: 'landcover_july_5400x2700.jpg', url: NASA + 'bmng-topography/july/world.topo.200407.3x5400x2700.jpg' },
];

async function exists(file) {
  try {
    const s = await stat(file);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function download(url, dest, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'atlas-vivo-data-pipeline' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      return buf.length;
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`  tentativa ${i} falhou (${err.message}), repetindo...`);
    }
  }
  return 0;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  for (const src of SOURCES) {
    const dest = path.join(RAW_DIR, src.file);
    if (await exists(dest)) {
      console.log(`= ${src.file} (ja existe)`);
      continue;
    }
    process.stdout.write(`> ${src.file} ... `);
    const bytes = await download(src.url, dest);
    console.log(`${(bytes / 1048576).toFixed(1)} MB`);
  }
  console.log('Dados brutos prontos em data-raw/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
