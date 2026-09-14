// Eras historicas (definidas pelo ano da simulacao) e cenarios iniciais (escala de populacao, economia e exercitos).
import type { GovernmentId } from './governments';
import type { EraId } from './technologies/types';

export interface HistoricalEra {
  id: EraId;
  name: string;
  start: number;
  end: number | null; // ultimo ano da era (null = em aberto)
  description: string;
  // Composicao do custo de uma tecnologia na economia da epoca.
  costComposition: [string, number][];
}

export const HISTORICAL_ERAS: HistoricalEra[] = [
  {
    id: 'medieval', name: 'Era Medieval', start: 476, end: 1453,
    description: 'Reinos feudais, castelos, mosteiros e rotas da seda; a pólvora, o papel e a bússola atravessam a Eurásia.',
    costComposition: [['Ouro e prata', 0.35], ['Trabalhadores e artesãos', 0.4], ['Materiais', 0.25]],
  },
  {
    id: 'moderna', name: 'Era Moderna', start: 1454, end: 1759,
    description: 'Grandes navegações, imprensa, armas de fogo e a revolução científica.',
    costComposition: [['Ouro e prata', 0.35], ['Artesãos e mestres', 0.3], ['Materiais', 0.2], ['Navios e instrumentos', 0.15]],
  },
  {
    id: 'primeira_revolucao', name: 'Primeira Revolução', start: 1760, end: 1850,
    description: 'Máquina a vapor, fábricas têxteis, carvão, ferro e ferrovias.',
    costComposition: [['Capital', 0.4], ['Máquinas', 0.25], ['Matérias-primas', 0.2], ['Infraestrutura', 0.15]],
  },
  {
    id: 'segunda_revolucao', name: 'Segunda Revolução', start: 1851, end: 1969,
    description: 'Eletricidade, petróleo, aço, química, motores, aviões, rádio e energia nuclear.',
    costComposition: [['Capital', 0.3], ['Máquinas e fábricas', 0.2], ['Matérias-primas', 0.15], ['Energia', 0.15], ['Engenheiros e cientistas', 0.2]],
  },
  {
    id: 'terceira_revolucao', name: 'Terceira Revolução', start: 1970, end: 2010,
    description: 'Microeletrônica, computadores, internet, telefonia móvel e biotecnologia.',
    costComposition: [['Dinheiro', 0.3], ['Pesquisa e desenvolvimento', 0.25], ['Semicondutores e equipamentos', 0.15], ['Energia', 0.1], ['Profissionais especializados', 0.2]],
  },
  {
    id: 'quarta_revolucao', name: 'Quarta Revolução', start: 2011, end: null,
    description: 'Inteligência artificial, robótica, energia avançada, edição genética e computação quântica.',
    costComposition: [['Dinheiro', 0.25], ['Pesquisa e desenvolvimento', 0.3], ['Dados e computação', 0.15], ['Energia', 0.1], ['Profissionais especializados', 0.2]],
  },
];

export function eraOfYear(year: number): HistoricalEra {
  for (let i = HISTORICAL_ERAS.length - 1; i >= 0; i--) if (year >= HISTORICAL_ERAS[i].start) return HISTORICAL_ERAS[i];
  return HISTORICAL_ERAS[0];
}

export function historicalEra(id: EraId): HistoricalEra {
  return HISTORICAL_ERAS.find((e) => e.id === id) ?? HISTORICAL_ERAS[0];
}

export const eraSpan = (e: HistoricalEra) => (e.end === null ? `${e.start} em diante` : `${e.start}–${e.end}`);

// Nivel tecnologico de referencia de cada ano (mesma escala usada pela economia, exercitos, governos e ideologias).
const LEVEL_CURVE: [number, number][] = [
  [-6000, 0], [476, 0.5], [1000, 1.5], [1300, 2.5], [1444, 3], [1523, 5], [1650, 7.5], [1750, 10], [1836, 13],
  [1900, 16.5], [1936, 20], [1970, 23], [2000, 26], [2025, 28.5], [2100, 32],
];

export function levelOfYear(year: number): number {
  if (year <= LEVEL_CURVE[0][0]) return LEVEL_CURVE[0][1];
  for (let i = 1; i < LEVEL_CURVE.length; i++) {
    const [y1, l1] = LEVEL_CURVE[i];
    if (year <= y1) {
      const [y0, l0] = LEVEL_CURVE[i - 1];
      return l0 + ((l1 - l0) * (year - y0)) / (y1 - y0);
    }
  }
  return LEVEL_CURVE[LEVEL_CURVE.length - 1][1];
}

// Cenarios de inicio de partida.
export interface EraPreset {
  id: string;
  name: string;
  year: number;
  tech: number; // nivel tecnologico de referencia do ano inicial
  popScale: number; // fracao da populacao atual
  gdpPerCapita: number; // PIB per capita base (ducados/ano)
  mobilization: number; // fracao da populacao em armas em tempo de paz
  armyChunk: number; // tamanho maximo tipico de um exercito
  soldierCost: number; // custo anual por soldado, em multiplos do PIB per capita
  taxRate: number; // arrecadacao tipica sobre o PIB
  governments: Partial<Record<GovernmentId, number>>;
  description: string;
}

const preset = (p: Omit<EraPreset, 'tech'>): EraPreset => ({ ...p, tech: levelOfYear(p.year) });

export const ERAS: EraPreset[] = [
  preset({
    id: 'late_antiquity', name: 'Queda de Roma', year: 476, popScale: 0.025, gdpPerCapita: 15, mobilization: 0.005,
    armyChunk: 15000, soldierCost: 2.3, taxRate: 0.08,
    governments: { monarchy: 6, empire: 1.5, confederation: 0.8, theocracy: 0.5, republic: 0.2 },
    description: 'O Império Romano do Ocidente cai e reinos sucessores disputam suas terras.',
  }),
  preset({
    id: 'medieval', name: 'Fim da Idade Média', year: 1444, popScale: 0.055, gdpPerCapita: 18, mobilization: 0.006,
    armyChunk: 25000, soldierCost: 2.2, taxRate: 0.1,
    governments: { monarchy: 6, empire: 1, theocracy: 0.8, republic: 0.5, confederation: 0.5, dictatorship: 0.2 },
    description: 'Reinos feudais, cavalaria pesada e os primeiros canhões.',
  }),
  preset({
    id: 'renaissance', name: 'Grandes Navegações', year: 1523, popScale: 0.065, gdpPerCapita: 20, mobilization: 0.007,
    armyChunk: 30000, soldierCost: 2.2, taxRate: 0.11,
    governments: { monarchy: 6, empire: 1.2, theocracy: 0.7, republic: 0.7, confederation: 0.4, dictatorship: 0.2 },
    description: 'Navegações oceânicas, arcabuzes e monarquias centralizadas.',
  }),
  preset({
    id: 'enlightenment', name: 'Iluminismo', year: 1750, popScale: 0.1, gdpPerCapita: 28, mobilization: 0.008,
    armyChunk: 60000, soldierCost: 2.1, taxRate: 0.13,
    governments: { monarchy: 5, empire: 1.2, republic: 1.5, theocracy: 0.4, confederation: 0.5, dictatorship: 0.3 },
    description: 'Absolutismo esclarecido, exércitos de linha e revoluções no horizonte.',
  }),
  preset({
    id: 'industrial', name: 'Era das Ferrovias', year: 1836, popScale: 0.15, gdpPerCapita: 45, mobilization: 0.009,
    armyChunk: 80000, soldierCost: 1.9, taxRate: 0.15,
    governments: { monarchy: 3.5, empire: 1, republic: 2.5, federation: 0.8, dictatorship: 0.6, confederation: 0.3 },
    description: 'Ferrovias, nacionalismo e impérios industriais.',
  }),
  preset({
    id: 'modern', name: 'Entreguerras', year: 1936, popScale: 0.3, gdpPerCapita: 150, mobilization: 0.012,
    armyChunk: 150000, soldierCost: 1.6, taxRate: 0.2,
    governments: { republic: 3, democracy: 2.5, dictatorship: 2.5, monarchy: 1.5, federation: 1, empire: 0.5 },
    description: 'Blindados, aviação e ideologias em choque.',
  }),
  preset({
    id: 'contemporary', name: 'Virada do Milênio', year: 2000, popScale: 0.8, gdpPerCapita: 600, mobilization: 0.005,
    armyChunk: 200000, soldierCost: 1.4, taxRate: 0.26,
    governments: { democracy: 5, republic: 3, federation: 1.5, dictatorship: 1.2, monarchy: 0.8, theocracy: 0.3 },
    description: 'O mundo atual como ponto de partida para uma história alternativa.',
  }),
  preset({
    id: 'digital', name: 'Era Digital', year: 2015, popScale: 0.95, gdpPerCapita: 750, mobilization: 0.0045,
    armyChunk: 200000, soldierCost: 1.35, taxRate: 0.27,
    governments: { democracy: 5, republic: 3, federation: 1.5, dictatorship: 1.2, monarchy: 0.8, theocracy: 0.3 },
    description: 'Smartphones, nuvem e as primeiras inteligências artificiais profundas.',
  }),
];

export const eraById = (id: string) => ERAS.find((e) => e.id === id) ?? ERAS[2];
