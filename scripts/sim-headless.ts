// Executa a simulacao sem interface (Node) para validar dinamica, integridade e desempenho.
// Uso: npm run sim -- <mapa> <anos> <era> <semente>
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { MapData, type MapJson } from '../src/map/MapData';
import { createWorld } from '../src/sim/createWorld';
import type { HistoryType } from '../src/state/types';
import { fmtCompact } from '../src/core/format';

const mapId = process.argv[2] ?? 'europe';
const years = Number(process.argv[3] ?? 50);
const eraId = process.argv[4] ?? 'renaissance';
const seed = Number(process.argv[5] ?? 12345);

const json = JSON.parse(readFileSync(`public/maps/${mapId}/map.json`, 'utf8')) as MapJson;
const gz = gunzipSync(readFileSync(`public/maps/${mapId}/grid.dat`));
const map = new MapData(json, gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer);

let t0 = performance.now();
// AUTOPEACE=1 simula com a paz automatica entre IAs (padrao: guerras so terminam por dominacao).
const sim = createWorld(map, { eraId, seed, settings: { autoPeace: process.env.AUTOPEACE === '1' } });
if (sim.state.settings.autoPeace) console.log('Modo: nações fazem as pazes sozinhas.');
console.log(`Mundo "${map.name}" criado em ${(performance.now() - t0).toFixed(0)} ms: ${sim.state.countries.length} países, ${map.provinceCount} províncias, ${sim.state.armies.length} exércitos.`);

const counts = new Map<HistoryType, number>();
sim.bus.on('history', (e) => counts.set(e.type, (counts.get(e.type) ?? 0) + 1));
let battles = 0;
sim.bus.on('battleEnded', () => battles++);

function integrity(): string[] {
  const s = sim.state;
  const problems: string[] = [];
  s.provinces.forEach((p, i) => {
    if (p.owner < 0 || !s.countries[p.owner]) problems.push(`província ${i} sem dono válido`);
    else if (!s.countries[p.owner].alive) problems.push(`província ${i} pertence a país extinto ${s.countries[p.owner].name}`);
    if (!s.countries[p.controller]?.alive) problems.push(`província ${i} controlada por país extinto`);
    if (!Number.isFinite(p.population)) problems.push(`província ${i} com população inválida`);
  });
  for (const c of s.countries) {
    if (!c.alive) continue;
    for (const k of ['population', 'treasury', 'gdp', 'stability', 'tech', 'debt', 'manpower'] as const) {
      if (!Number.isFinite(c[k])) problems.push(`${c.name}.${k} inválido (${c[k]})`);
    }
  }
  for (const a of s.armies) {
    if (!s.countries[a.owner]?.alive) problems.push(`exército ${a.id} de país extinto`);
    if (!Number.isFinite(a.infantry + a.cavalry + a.artillery)) problems.push(`exército ${a.id} com tropas inválidas`);
  }
  return problems.slice(0, 10);
}

t0 = performance.now();
let tYear = performance.now();
for (let y = 1; y <= years; y++) {
  for (let d = 0; d < 365; d++) sim.step();
  if (y % 10 === 0 || y === years) {
    const s = sim.state;
    const alive = s.countries.filter((c) => c.alive && c.kind === 'nation');
    const rebels = s.countries.filter((c) => c.alive && c.kind === 'rebel').length;
    const soldiers = s.armies.reduce((acc, a) => acc + a.infantry + a.cavalry + a.artillery, 0);
    const pop = alive.reduce((acc, c) => acc + c.population, 0);
    const gdp = alive.reduce((acc, c) => acc + c.gdp, 0);
    const top = [...alive].sort((a, b) => b.provinceCount - a.provinceCount).slice(0, 5).map((c) => `${c.name}(${c.provinceCount})`).join(', ');
    const ms = (performance.now() - tYear) / 10;
    console.log(`Ano ${sim.year()}: ${alive.length} nações, ${rebels} rebeldes, ${sim.index.activeWars.length} guerras, ${s.armies.length} exércitos (${fmtCompact(soldiers)}), pop ${fmtCompact(pop)}, PIB ${fmtCompact(gdp)} | ${ms.toFixed(0)} ms/ano | ${top}`);
    const issues = integrity();
    if (issues.length) console.log('  PROBLEMAS:', issues.join(' | '));
    tYear = performance.now();
  }
}
const total = (performance.now() - t0) / 1000;
console.log(`\n${years} anos simulados em ${total.toFixed(1)} s (${((total * 1000) / (years * 365)).toFixed(2)} ms/dia).`);
console.log(`Batalhas: ${battles}. Eventos por tipo:`, Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])));
const ended = sim.state.wars.filter((w) => !w.active && w.result);
const byEnd = new Map<string, number>();
for (const w of ended) {
  const key = !w.result ? '?' : w.result.treaty >= 0 ? 'tratado' : w.result.annexed.length ? 'dominação' : w.result.winner === 'white' ? 'sem vencedor' : 'rebelião';
  byEnd.set(key, (byEnd.get(key) ?? 0) + 1);
}
const active = sim.index.activeWars;
const ages = active.map((w) => (sim.day - w.start) / 365).sort((a, b) => b - a);
console.log(`Guerras encerradas por tipo:`, Object.fromEntries(byEnd), `| ativas: ${active.length}, mais longas: ${ages.slice(0, 5).map((a) => `${a.toFixed(0)}a`).join(', ') || '—'}`);
for (const w of [...active].sort((a, b) => a.start - b.start).slice(0, 6)) {
  const lastBattle = w.battles.length ? sim.index.battleById.get(w.battles[w.battles.length - 1])?.start ?? -1 : -1;
  const names = (ids: number[]) => ids.map((id) => `${sim.country(id).name}${sim.country(id).alive ? '' : '†'}(${sim.country(id).provinceCount})`).join(', ');
  console.log(
    `  ${w.name} [${((sim.day - w.start) / 365).toFixed(0)}a, ${w.goal.type}] A: ${names(w.attackers)} | D: ${names(w.defenders)} | ` +
      `ultima batalha: ${lastBattle >= 0 ? `${((sim.day - lastBattle) / 365).toFixed(1)}a atras` : 'nenhuma'} | ocupados ${w.occupied.join('/')} | exaustao ${w.exhaustion.map((e) => e.toFixed(0)).join('/')}`,
  );
}
const tech = sim.countries.nations().reduce((acc, c) => Math.max(acc, c.tech), 0);
console.log(`Tecnologia máxima: ${tech.toFixed(1)}`);
console.log('\nÚltimos acontecimentos importantes:');
for (const e of sim.history.recent(25, 2).reverse()) console.log(`  ${sim.year(e.day)} - ${e.text}`);
