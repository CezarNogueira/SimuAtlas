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
const hardships = { escassez: 0, divida: 0, moratoria: 0 };
sim.bus.on('history', (e) => {
  if (e.text.startsWith('Escassez')) hardships.escassez++;
  else if (e.text.includes('afunda em dívidas')) hardships.divida++;
  else if (e.text.includes('moratória')) hardships.moratoria++;
});

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
  // Nenhuma tecnologia pode existir antes da sua data historica.
  const year = sim.year();
  for (const c of s.countries) {
    if (!c.alive) continue;
    for (const id in c.techs) {
      const t = sim.technology.db.get(id);
      const h = c.techs[id];
      if (!t) problems.push(`${c.name} possui tecnologia inexistente ${id}`);
      else if ((h.stage === 'conhecimento' || h.stage === 'producao') && t.anoDescoberta > year) problems.push(`${c.name} domina ${t.nome} (${t.anoDescoberta}) em ${year}`);
    }
  }
  for (const t of sim.technology.db.all) {
    const rec = s.technologies[t.id];
    if (rec.discovered && !rec.preStart && rec.discoveryYear < t.anoDescoberta) problems.push(`${t.nome} descoberta em ${rec.discoveryYear}, antes de ${t.anoDescoberta}`);
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
const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const warring = sim.countries.nations().filter((c) => sim.index.isAtWar(c.id));
const peaceful = sim.countries.nations().filter((c) => !sim.index.isAtWar(c.id));
const describe = (list: typeof warring) =>
  `${list.length} (inflação ${pct(avg(list.map((c) => c.inflation)))}, dívida ${pct(avg(list.map((c) => c.debt / Math.max(1, c.gdp))))} do PIB` +
  ` [máx ${pct(Math.max(0, ...list.map((c) => c.debt / Math.max(1, c.gdp))))}], destruição ${pct(avg(list.map((c) => sim.economy.warEconomy(c).devastation)))})`;
console.log(
  `Economia: em guerra ${describe(warring)} | em paz ${describe(peaceful)} | estados arrasados: ${sim.state.provinces.filter((p) => p.devastation >= 0.4).length} | ` +
    `avisos: escassez ${hardships.escassez}, dívida de guerra ${hardships.divida}, moratórias ${hardships.moratoria}`,
);
const tech = sim.countries.nations().reduce((acc, c) => Math.max(acc, c.tech), 0);
const db = sim.technology.db;
const records = sim.state.technologies;
const reached = db.countUntil(sim.year());
const discovered = db.all.filter((t) => records[t.id].discovered);
const inSim = discovered.filter((t) => !records[t.id].preStart);
const delays = inSim.map((t) => records[t.id].discoveryYear - Math.max(t.anoDescoberta, sim.state.startYear));
const pending = db.all.slice(0, reached).filter((t) => !records[t.id].discovered);
console.log(`\nEra: ${sim.eras.current().name} | nível tecnológico máximo ${tech.toFixed(1)}`);
console.log(`Tecnologias: ${discovered.length} descobertas (${inSim.length} durante a simulação) de ${reached} com data alcançada; ${pending.length} por descobrir${pending.length ? ` (mais antiga: ${pending[0].nome}, ${pending[0].anoDescoberta})` : ''}`);
if (delays.length) console.log(`  atraso em relação à data histórica: médio ${(delays.reduce((a, b) => a + b, 0) / delays.length).toFixed(1)} anos, máximo ${Math.max(...delays)} anos`);
const sources = new Map<string, number>();
let failedSpies = 0;
for (const t of db.all) {
  for (const e of records[t.id].log) {
    if (e.type === 'espionagem_fracassada') failedSpies++;
    else if (e.source && e.type !== 'pre_existente') sources.set(e.source, (sources.get(e.source) ?? 0) + 1);
  }
}
console.log(`  aquisições por forma: ${JSON.stringify(Object.fromEntries([...sources.entries()].sort((a, b) => b[1] - a[1])))} | espionagens fracassadas: ${failedSpies} | contratos ativos: ${sim.state.techContracts.length}`);
const leaders = [...sim.countries.nations()].sort((a, b) => b.tech - a.tech).slice(0, 5);
console.log(`  mais avançados: ${leaders.map((c) => `${c.name} ${c.tech.toFixed(1)} (capacidade ${c.science.capacity.toFixed(2)}, educação ${Math.round(c.science.education * 100)}%, ${c.science.universities} universidades)`).join(' | ')}`);
for (const t of [...inSim].sort((a, b) => b.valorEstrategico - a.valorEstrategico || b.anoDescoberta - a.anoDescoberta).slice(0, 3)) {
  const rec = records[t.id];
  console.log(`  ${t.nome} (data histórica ${t.anoDescoberta}): descoberta em ${rec.discoveryYear} por ${sim.country(rec.discoverer).name}; ${rec.holders} dominam, ${rec.producers} produzem, ${rec.importers} importam`);
  for (const e of rec.log.slice(0, 8)) console.log(`    ${sim.year(e.day)} ${sim.technology.history.describe(t, e)}`);
}
console.log('\nÚltimos acontecimentos importantes:');
for (const e of sim.history.recent(25, 2).reverse()) console.log(`  ${sim.year(e.day)} - ${e.text}`);
