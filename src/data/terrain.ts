// Tipos de terreno e seus efeitos em guerra, economia e populacao.
// Os ids batem com os valores gravados na grade do mapa (tools/lib/terrain.mjs).
export type RGB = [number, number, number];

export const TERRAIN = {
  WATER: 0,
  PLAINS: 1,
  HILLS: 2,
  MOUNTAINS: 3,
  FOREST: 4,
  JUNGLE: 5,
  DESERT: 6,
  TUNDRA: 7,
  SWAMP: 8,
  COAST: 9,
  ISLAND: 10,
} as const;

export interface TerrainInfo {
  id: number;
  key: string;
  name: string;
  defense: number; // multiplicador defensivo de quem defende a provincia
  moveCost: number; // multiplicador do tempo de marcha
  attrition: number; // perda mensal por desgaste (fracao das tropas)
  cavalry: number; // eficacia da cavalaria
  supply: number; // capacidade de suprimento/logistica
  siege: number; // dificuldade de cerco
  habitability: number; // capacidade populacional relativa
  production: number; // produtividade economica relativa
  effects: string; // resumo para o jogador
  color: RGB; // cor base no mapa (tons de pergaminho)
}

const t = (info: TerrainInfo) => info;

export const TERRAINS: TerrainInfo[] = [
  t({ id: 0, key: 'water', name: 'Água', defense: 1, moveCost: 1, attrition: 0, cavalry: 0, supply: 0, siege: 1, habitability: 0, production: 0, effects: '', color: [58, 96, 144] }),
  t({ id: 1, key: 'plains', name: 'Planície', defense: 1.0, moveCost: 1.0, attrition: 0, cavalry: 1.25, supply: 1.15, siege: 1.0, habitability: 1.0, production: 1.1, effects: '+ velocidade, + cavalaria', color: [224, 206, 152] }),
  t({ id: 2, key: 'hills', name: 'Colina', defense: 1.25, moveCost: 1.3, attrition: 0.005, cavalry: 0.9, supply: 0.95, siege: 1.25, habitability: 0.75, production: 0.9, effects: '+ defesa, - velocidade', color: [204, 180, 130] }),
  t({ id: 3, key: 'mountains', name: 'Montanha', defense: 1.6, moveCost: 1.9, attrition: 0.015, cavalry: 0.6, supply: 0.65, siege: 1.6, habitability: 0.3, production: 0.65, effects: '++ defesa, -- velocidade, - cavalaria', color: [168, 146, 116] }),
  t({ id: 4, key: 'forest', name: 'Floresta', defense: 1.3, moveCost: 1.4, attrition: 0.008, cavalry: 0.75, supply: 0.9, siege: 1.1, habitability: 0.6, production: 0.85, effects: '+ defesa, - velocidade', color: [172, 182, 120] }),
  t({ id: 5, key: 'jungle', name: 'Selva', defense: 1.4, moveCost: 1.7, attrition: 0.025, cavalry: 0.55, supply: 0.7, siege: 1.2, habitability: 0.45, production: 0.7, effects: '+ defesa, -- velocidade, + desgaste', color: [140, 162, 98] }),
  t({ id: 6, key: 'desert', name: 'Deserto', defense: 1.05, moveCost: 1.3, attrition: 0.03, cavalry: 1.0, supply: 0.45, siege: 0.9, habitability: 0.12, production: 0.45, effects: '-- logística, + desgaste', color: [238, 216, 156] }),
  t({ id: 7, key: 'tundra', name: 'Tundra', defense: 1.1, moveCost: 1.4, attrition: 0.025, cavalry: 0.8, supply: 0.5, siege: 1.0, habitability: 0.12, production: 0.45, effects: '- logística, + desgaste no inverno', color: [214, 216, 200] }),
  t({ id: 8, key: 'swamp', name: 'Pântano', defense: 1.35, moveCost: 1.8, attrition: 0.025, cavalry: 0.5, supply: 0.7, siege: 1.3, habitability: 0.35, production: 0.6, effects: '+ defesa, -- velocidade, - cavalaria', color: [162, 174, 130] }),
  t({ id: 9, key: 'coast', name: 'Costa', defense: 1.05, moveCost: 1.0, attrition: 0, cavalry: 1.1, supply: 1.2, siege: 1.0, habitability: 1.1, production: 1.2, effects: '+ comércio, + suprimento, portos', color: [226, 210, 160] }),
  t({ id: 10, key: 'island', name: 'Ilha', defense: 1.3, moveCost: 1.1, attrition: 0.005, cavalry: 0.9, supply: 0.9, siege: 1.2, habitability: 0.9, production: 1.0, effects: '+ defesa, desembarque necessário', color: [220, 204, 150] }),
];

export const terrainInfo = (id: number): TerrainInfo => TERRAINS[id] ?? TERRAINS[1];
