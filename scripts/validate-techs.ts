// Valida o banco de tecnologias: ids unicos, dependencias existentes e historicamente anteriores, ausencia de ciclos,
// era coerente com a data, categorias, recursos e infraestrutura validos. Mostra totais por era e efeitos acumulados.
// Uso: npm run techs
import { ERAS, HISTORICAL_ERAS, eraOfYear } from '../src/data/eras';
import { RESOURCE_IDS } from '../src/data/resources';
import { ALL_TECH_DEFS, EFFECT_KEYS, INFRA_TAGS, TECH_CATEGORIES, TECHNOLOGIES, type TechEffects } from '../src/data/technologies';

const errors: string[] = [];
const ids = new Set<string>();
for (const d of ALL_TECH_DEFS) {
  if (ids.has(d.id)) errors.push(`id duplicado: ${d.id}`);
  ids.add(d.id);
}

for (const t of TECHNOLOGIES.all) {
  const where = `${t.id} (${t.anoDescoberta})`;
  if (!TECH_CATEGORIES.includes(t.categoria)) errors.push(`${where}: categoria inválida ${t.categoria}`);
  if (!t.nome || !t.descricao || !t.paisDescobridor) errors.push(`${where}: nome, descrição ou origem ausente`);
  if (t.nivelComplexidade < 1 || t.nivelComplexidade > 10 || t.valorEstrategico < 1 || t.valorEstrategico > 10) errors.push(`${where}: complexidade/estratégia fora de 1..10`);
  if (t.anoDescoberta >= 476 && eraOfYear(t.anoDescoberta).id !== t.era) errors.push(`${where}: era ${t.era} incoerente com o ano`);
  for (const dep of t.tecnologiasDependentes) {
    const d = TECHNOLOGIES.get(dep);
    if (!d) errors.push(`${where}: dependência inexistente ${dep}`);
    else if (d.anoDescoberta > t.anoDescoberta) errors.push(`${where}: depende de ${dep} (${d.anoDescoberta}), posterior a ela`);
  }
  for (const s of t.substitui) {
    const o = TECHNOLOGIES.get(s);
    if (!o) errors.push(`${where}: substitui tecnologia inexistente ${s}`);
    else if (o.anoDescoberta > t.anoDescoberta) errors.push(`${where}: substitui ${s}, que é mais nova`);
  }
  for (const r of t.recursosNecessarios) if (!RESOURCE_IDS.includes(r)) errors.push(`${where}: recurso inválido ${r}`);
  for (const i of t.infraestruturaNecessaria) if (!(i in INFRA_TAGS)) errors.push(`${where}: infraestrutura inválida ${i}`);
  for (const [k, v] of Object.entries(t.efeitos)) {
    if (!EFFECT_KEYS.includes(k as keyof TechEffects)) errors.push(`${where}: efeito inválido ${k}`);
    if (typeof v !== 'number' || v < 0) errors.push(`${where}: valor de efeito inválido ${k}=${v}`);
  }
  for (const code of t.paisesOrigem) if (!/^[A-Z]{3}$/.test(code)) errors.push(`${where}: código de país inválido ${code}`);
}

// Ciclos de dependencia.
const state = new Map<string, 0 | 1 | 2>();
const visit = (id: string, path: string[]): void => {
  const s = state.get(id) ?? 0;
  if (s === 2) return;
  if (s === 1) {
    errors.push(`ciclo de dependências: ${[...path, id].join(' -> ')}`);
    return;
  }
  state.set(id, 1);
  for (const dep of TECHNOLOGIES.get(id)?.tecnologiasDependentes ?? []) visit(dep, [...path, id]);
  state.set(id, 2);
};
for (const t of TECHNOLOGIES.all) visit(t.id, []);

console.log(`${TECHNOLOGIES.size} tecnologias no banco.`);
for (const era of HISTORICAL_ERAS) {
  const list = TECHNOLOGIES.byEra(era.id);
  const ancient = list.filter((t) => t.antiguidade).length;
  console.log(`  ${era.name} (${era.start}–${era.end ?? '...'}): ${list.length}${ancient ? ` (${ancient} herdadas da Antiguidade)` : ''}`);
}
const byCat = new Map<string, number>();
for (const t of TECHNOLOGIES.all) byCat.set(t.categoria, (byCat.get(t.categoria) ?? 0) + 1);
console.log('Por categoria:', Object.fromEntries([...byCat.entries()].sort((a, b) => b[1] - a[1])));

console.log('\nEfeitos acumulados por cenário inicial (todas as tecnologias até o ano):');
for (const e of ERAS) {
  const totals: Record<string, number> = {};
  for (const t of TECHNOLOGIES.all) {
    if (t.anoDescoberta > e.year) break;
    for (const [k, v] of Object.entries(t.efeitos)) totals[k] = (totals[k] ?? 0) + (v as number);
  }
  console.log(`  ${e.year} (${TECHNOLOGIES.countUntil(e.year)} tecnologias): ${EFFECT_KEYS.map((k) => `${k} ${(totals[k] ?? 0).toFixed(2)}`).join(' | ')}`);
}
const all: Record<string, number> = {};
for (const t of TECHNOLOGIES.all) for (const [k, v] of Object.entries(t.efeitos)) all[k] = (all[k] ?? 0) + (v as number);
console.log(`  Todas: ${EFFECT_KEYS.map((k) => `${k} ${(all[k] ?? 0).toFixed(2)}`).join(' | ')}`);

if (errors.length) {
  console.log(`\n${errors.length} erro(s):\n  ${errors.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('\nBanco válido.');
}
