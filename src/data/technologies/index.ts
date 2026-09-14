// TECHNOLOGY DATABASE: banco centralizado e expansivel de descobertas e invencoes. Os arquivos de cada era trazem
// as definicoes autorais (data historica, origem, complexidade, dependencias, recursos e efeitos); aqui sao
// derivados os demais campos (era, raridade, custos, tempos, desbloqueios e substituicoes).
import { eraOfYear } from '../eras';
import { ANTIQUITY_TECHS, MEDIEVAL_TECHS } from './medieval';
import { MODERNA_TECHS } from './moderna';
import { PRIMEIRA_TECHS } from './primeira';
import { SEGUNDA_TECHS } from './segunda';
import { QUARTA_TECHS, TERCEIRA_TECHS } from './contemporanea';
import type { EraId, TechCategory, TechDef, Technology } from './types';

export * from './types';

// Ritmo da ciencia em cada era: pesquisas medievais levam muito mais tempo que as modernas.
const ERA_PACE: Record<EraId, number> = {
  medieval: 2.2, moderna: 1.6, primeira_revolucao: 1.2, segunda_revolucao: 1, terceira_revolucao: 0.8, quarta_revolucao: 0.6,
};

// Categorias cujo resultado nao e um produto comercializavel (so o conhecimento circula).
const NOT_IMPORTABLE = new Set<TechCategory>(['Física', 'Astronomia', 'Biologia', 'Construção', 'Tecnologia Espacial']);

// Nomes proprios que nao devem ir para minusculas no meio de frases.
const PROPER_NAMES = new Set(['Encyclopédie', 'World Wide Web', 'Revolução Verde', 'Cânone da Medicina']);

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

function build(def: TechDef): Technology {
  const era = eraOfYear(Math.max(476, def.ano)).id;
  const rec = def.rec ?? [];
  const infra = def.infra ?? [];
  const custoBase = Math.round(def.cx * def.cx * def.est * 600 * (1 + 0.15 * rec.length + 0.1 * infra.length));
  return {
    id: def.id,
    nome: def.nome,
    artigo: def.artigo,
    categoria: def.categoria,
    anoDescoberta: def.ano,
    era,
    antiguidade: def.ano < 476,
    paisDescobridor: def.origem,
    paisesOrigem: def.paises ?? [],
    custoBase,
    custoAtual: custoBase,
    nivelComplexidade: def.cx,
    recursosNecessarios: rec,
    infraestruturaNecessaria: infra,
    efeitos: def.fx,
    tecnologiasDependentes: def.deps ?? [],
    tecnologiasDesbloqueadas: [],
    valorEstrategico: def.est,
    raridade: clampInt(def.cx * 0.55 + def.est * 0.25 + rec.length * 0.8 + infra.length * 0.5, 1, 10),
    tempoParaDominar: Math.round((4 + def.cx * 3) * ERA_PACE[era]),
    tempoParaProduzir: Math.round((4 + def.cx * 3 + rec.length * 3 + infra.length * 3) * ERA_PACE[era]),
    substitui: def.substitui ?? [],
    substituidaPor: [],
    militar: def.categoria === 'Militar' || def.est >= 9,
    importavel: !NOT_IMPORTABLE.has(def.categoria),
    descricao: def.desc,
  };
}

export class TechnologyDatabase {
  readonly all: Technology[];
  private readonly byId = new Map<string, Technology>();
  private readonly order = new Map<string, number>();

  constructor(defs: TechDef[]) {
    this.all = defs.map(build).sort((a, b) => a.anoDescoberta - b.anoDescoberta || a.id.localeCompare(b.id));
    this.all.forEach((t, i) => {
      this.byId.set(t.id, t);
      this.order.set(t.id, i);
    });
    for (const t of this.all) {
      for (const d of t.tecnologiasDependentes) this.byId.get(d)?.tecnologiasDesbloqueadas.push(t.id);
      for (const s of t.substitui) this.byId.get(s)?.substituidaPor.push(t.id);
    }
  }

  get size(): number {
    return this.all.length;
  }

  get(id: string): Technology | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  // Posicao na ordem cronologica (usada como indice compacto).
  indexOf(id: string): number {
    return this.order.get(id) ?? -1;
  }

  byEra(era: EraId): Technology[] {
    return this.all.filter((t) => t.era === era);
  }

  byCategory(category: TechCategory): Technology[] {
    return this.all.filter((t) => t.categoria === category);
  }

  // Quantidade de tecnologias com data historica ate o ano informado (lista ordenada por ano).
  countUntil(year: number): number {
    let lo = 0;
    let hi = this.all.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.all[mid].anoDescoberta <= year) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Nome para uso no meio de frases, com artigo: "o plástico", "a máquina a vapor de Watt".
  phrase(t: Technology): string {
    return `${t.artigo} ${this.inline(t)}`;
  }

  // Nome precedido de "de": "do plástico", "da ferrovia".
  ofPhrase(t: Technology): string {
    return `${({ o: 'do', a: 'da', os: 'dos', as: 'das' } as const)[t.artigo]} ${this.inline(t)}`;
  }

  inline(t: Technology): string {
    const first = t.nome.split(' ')[0];
    if (PROPER_NAMES.has(t.nome) || (first.length > 1 && first === first.toUpperCase())) return t.nome;
    return t.nome.charAt(0).toLowerCase() + t.nome.slice(1);
  }
}

export const TECHNOLOGIES = new TechnologyDatabase([
  ...ANTIQUITY_TECHS,
  ...MEDIEVAL_TECHS,
  ...MODERNA_TECHS,
  ...PRIMEIRA_TECHS,
  ...SEGUNDA_TECHS,
  ...TERCEIRA_TECHS,
  ...QUARTA_TECHS,
]);

export const ALL_TECH_DEFS: TechDef[] = [
  ...ANTIQUITY_TECHS, ...MEDIEVAL_TECHS, ...MODERNA_TECHS, ...PRIMEIRA_TECHS, ...SEGUNDA_TECHS, ...TERCEIRA_TECHS, ...QUARTA_TECHS,
];
