// Presets de era inicial: definem escala de populacao/economia, tecnologia e tamanho dos exercitos.
import type { GovernmentId } from './governments';

export interface EraPreset {
  id: string;
  name: string;
  year: number;
  tech: number;
  popScale: number; // fracao da populacao atual
  gdpPerCapita: number; // PIB per capita base (ducados/ano)
  mobilization: number; // fracao da populacao em armas em tempo de paz
  armyChunk: number; // tamanho maximo tipico de um exercito
  soldierCost: number; // custo anual por soldado, em multiplos do PIB per capita
  taxRate: number; // arrecadacao tipica sobre o PIB
  governments: Partial<Record<GovernmentId, number>>;
  description: string;
}

export const ERAS: EraPreset[] = [
  {
    id: 'medieval', name: 'Idade Média Tardia', year: 1444, tech: 3, popScale: 0.055, gdpPerCapita: 18, mobilization: 0.006,
    armyChunk: 25000, soldierCost: 2.2, taxRate: 0.1,
    governments: { monarchy: 6, empire: 1, theocracy: 0.8, republic: 0.5, confederation: 0.5, dictatorship: 0.2 },
    description: 'Reinos feudais, cavalaria pesada e os primeiros canhões.',
  },
  {
    id: 'renaissance', name: 'Renascimento', year: 1523, tech: 5, popScale: 0.065, gdpPerCapita: 20, mobilization: 0.007,
    armyChunk: 30000, soldierCost: 2.2, taxRate: 0.11,
    governments: { monarchy: 6, empire: 1.2, theocracy: 0.7, republic: 0.7, confederation: 0.4, dictatorship: 0.2 },
    description: 'Grandes navegações, arcabuzes e monarquias centralizadas.',
  },
  {
    id: 'enlightenment', name: 'Iluminismo', year: 1750, tech: 10, popScale: 0.1, gdpPerCapita: 28, mobilization: 0.008,
    armyChunk: 60000, soldierCost: 2.1, taxRate: 0.13,
    governments: { monarchy: 5, empire: 1.2, republic: 1.5, theocracy: 0.4, confederation: 0.5, dictatorship: 0.3 },
    description: 'Absolutismo esclarecido, exércitos de linha e revoluções no horizonte.',
  },
  {
    id: 'industrial', name: 'Era Industrial', year: 1836, tech: 13, popScale: 0.15, gdpPerCapita: 45, mobilization: 0.009,
    armyChunk: 80000, soldierCost: 1.9, taxRate: 0.15,
    governments: { monarchy: 3.5, empire: 1, republic: 2.5, federation: 0.8, dictatorship: 0.6, confederation: 0.3 },
    description: 'Ferrovias, nacionalismo e impérios industriais.',
  },
  {
    id: 'modern', name: 'Entreguerras', year: 1936, tech: 20, popScale: 0.3, gdpPerCapita: 150, mobilization: 0.012,
    armyChunk: 150000, soldierCost: 1.6, taxRate: 0.2,
    governments: { republic: 3, democracy: 2.5, dictatorship: 2.5, monarchy: 1.5, federation: 1, empire: 0.5 },
    description: 'Blindados, aviação e ideologias em choque.',
  },
  {
    id: 'contemporary', name: 'Contemporânea', year: 2000, tech: 26, popScale: 0.8, gdpPerCapita: 600, mobilization: 0.005,
    armyChunk: 200000, soldierCost: 1.4, taxRate: 0.26,
    governments: { democracy: 5, republic: 3, federation: 1.5, dictatorship: 1.2, monarchy: 0.8, theocracy: 0.3 },
    description: 'O mundo atual como ponto de partida para uma história alternativa.',
  },
];

export const eraById = (id: string) => ERAS.find((e) => e.id === id) ?? ERAS[1];
