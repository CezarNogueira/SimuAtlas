// Tipos do banco de tecnologias: categorias, infraestrutura, efeitos e o registro completo de cada tecnologia.
import type { ResourceId } from '../resources';

export type EraId = 'medieval' | 'moderna' | 'primeira_revolucao' | 'segunda_revolucao' | 'terceira_revolucao' | 'quarta_revolucao';

export const TECH_CATEGORIES = [
  'Agricultura', 'Metalurgia', 'Medicina', 'Química', 'Engenharia', 'Energia', 'Transporte', 'Comunicação', 'Computação', 'Eletrônica',
  'Indústria', 'Militar', 'Construção', 'Física', 'Biologia', 'Materiais', 'Astronomia', 'Navegação', 'Tecnologia Espacial', 'Tecnologia Digital',
] as const;
export type TechCategory = (typeof TECH_CATEGORIES)[number];

// Infraestrutura exigida para descobrir e, principalmente, para produzir em larga escala.
export const INFRA_TAGS = {
  oficinas: 'Oficinas e artesãos',
  porto: 'Porto marítimo',
  universidade: 'Universidade',
  fabricas: 'Parque fabril',
  laboratorios: 'Laboratórios de pesquisa',
  ferrovias: 'Rede ferroviária',
  rede_eletrica: 'Rede elétrica',
  refinarias: 'Refinarias',
  telecomunicacoes: 'Rede de telecomunicações',
  fabricas_de_chips: 'Fábricas de semicondutores',
  centros_de_dados: 'Centros de dados',
  centro_espacial: 'Centro espacial',
} as const;
export type InfraTag = keyof typeof INFRA_TAGS;

// Efeitos reais aplicados pela simulacao ao pais que usa a tecnologia.
export interface TechEffects {
  military: number; // poder de combate dos exercitos
  defense: number; // defesa em batalha
  siege: number; // velocidade de cerco
  transport: number; // velocidade de marcha e renda do comercio
  naval: number; // tamanho e alcance da marinha
  economy: number; // produtividade geral
  industry: number; // producao dos estados desenvolvidos
  agriculture: number; // capacidade de sustento da populacao
  infrastructure: number; // crescimento do desenvolvimento e abastecimento
  administration: number; // arrecadacao, corrupcao e estabilidade
  research: number; // capacidade de pesquisa
  medicine: number; // resistencia a epidemias e fome
  education: number; // alfabetizacao e formacao de cientistas
}

export const EFFECT_KEYS: (keyof TechEffects)[] = [
  'military', 'defense', 'siege', 'transport', 'naval', 'economy', 'industry', 'agriculture', 'infrastructure', 'administration', 'research', 'medicine', 'education',
];

export const EFFECT_LABELS: Record<keyof TechEffects, string> = {
  military: 'Poder militar',
  defense: 'Defesa',
  siege: 'Cercos',
  transport: 'Transporte e comércio',
  naval: 'Poder naval',
  economy: 'Produtividade',
  industry: 'Produção industrial',
  agriculture: 'Capacidade agrícola',
  infrastructure: 'Infraestrutura',
  administration: 'Administração e comunicação',
  research: 'Pesquisa',
  medicine: 'Medicina',
  education: 'Educação',
};

export function emptyEffects(): TechEffects {
  return { military: 0, defense: 0, siege: 0, transport: 0, naval: 0, economy: 0, industry: 0, agriculture: 0, infrastructure: 0, administration: 0, research: 0, medicine: 0, education: 0 };
}

// Definicao autoral compacta usada nos arquivos de dados de cada era.
export interface TechDef {
  id: string;
  artigo: 'o' | 'a' | 'os' | 'as';
  nome: string;
  categoria: TechCategory;
  ano: number; // ano historico de descoberta/criacao
  origem: string; // onde e por quem foi criada na historia real
  paises?: string[]; // codigos ISO3 dos paises atuais que correspondem a origem historica
  cx: number; // complexidade 1..10
  est: number; // valor estrategico 1..10
  deps?: string[];
  rec?: ResourceId[];
  infra?: InfraTag[];
  fx: Partial<TechEffects>;
  substitui?: string[];
  desc: string;
}

// Registro completo do banco de dados.
export interface Technology {
  id: string;
  nome: string;
  artigo: 'o' | 'a' | 'os' | 'as';
  categoria: TechCategory;
  anoDescoberta: number;
  era: EraId;
  antiguidade: boolean; // anterior a 476: conhecimento herdado da Antiguidade
  paisDescobridor: string; // descobridor historico real (a simulacao sorteia o seu proprio)
  paisesOrigem: string[];
  custoBase: number; // em anos de trabalho qualificado (convertido em dinheiro conforme a epoca)
  custoAtual: number; // referencia inicial; o valor de mercado vivo fica no estado da partida
  nivelComplexidade: number;
  recursosNecessarios: ResourceId[];
  infraestruturaNecessaria: InfraTag[];
  efeitos: Partial<TechEffects>;
  tecnologiasDependentes: string[]; // pre-requisitos
  tecnologiasDesbloqueadas: string[]; // tecnologias que dependem desta
  valorEstrategico: number;
  raridade: number;
  tempoParaDominar: number; // meses de pesquisa com capacidade cientifica de referencia (1,0)
  tempoParaProduzir: number; // meses para ir do conhecimento a producao em larga escala
  substitui: string[];
  substituidaPor: string[];
  militar: boolean;
  importavel: boolean; // produtos podem ser importados de quem produz
  descricao: string;
}
