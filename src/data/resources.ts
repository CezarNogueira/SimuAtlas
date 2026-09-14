// Recursos naturais das provincias: valor economico, bonus militar e distribuicao por terreno.
import { TERRAIN } from './terrain';

export type ResourceId =
  | 'grain' | 'livestock' | 'fish' | 'wood' | 'iron' | 'copper' | 'gold' | 'silver' | 'salt' | 'wool'
  | 'cotton' | 'wine' | 'spices' | 'silk' | 'coal' | 'oil' | 'gems' | 'horses' | 'tea' | 'coffee' | 'sugar' | 'furs' | 'ivory' | 'incense';

export interface ResourceInfo {
  id: ResourceId;
  name: string;
  value: number; // multiplicador de producao da provincia
  military: number; // bonus de recrutamento/equipamento
  needsTech?: boolean; // valor pleno so com a tecnologia de extracao (carvao: coque ou vapor; petroleo: refino)
  terrains: Partial<Record<number, number>>; // pesos de ocorrencia por terreno
  tropical?: boolean; // so em latitudes baixas
  cold?: boolean; // so em latitudes altas
}

const T = TERRAIN;

export const RESOURCES: Record<ResourceId, ResourceInfo> = {
  grain: { id: 'grain', name: 'Grãos', value: 1.05, military: 0, terrains: { [T.PLAINS]: 10, [T.COAST]: 5, [T.HILLS]: 3 } },
  livestock: { id: 'livestock', name: 'Gado', value: 1.0, military: 0, terrains: { [T.PLAINS]: 6, [T.HILLS]: 5, [T.TUNDRA]: 1 } },
  fish: { id: 'fish', name: 'Pesca', value: 1.0, military: 0, terrains: { [T.COAST]: 10, [T.ISLAND]: 10 } },
  wood: { id: 'wood', name: 'Madeira', value: 1.0, military: 0.02, terrains: { [T.FOREST]: 10, [T.JUNGLE]: 4, [T.HILLS]: 2 } },
  iron: { id: 'iron', name: 'Ferro', value: 1.15, military: 0.08, terrains: { [T.HILLS]: 5, [T.MOUNTAINS]: 6, [T.FOREST]: 1 } },
  copper: { id: 'copper', name: 'Cobre', value: 1.12, military: 0.03, terrains: { [T.MOUNTAINS]: 4, [T.HILLS]: 3, [T.DESERT]: 2 } },
  gold: { id: 'gold', name: 'Ouro', value: 1.45, military: 0, terrains: { [T.MOUNTAINS]: 3, [T.HILLS]: 2, [T.JUNGLE]: 1, [T.DESERT]: 1 } },
  silver: { id: 'silver', name: 'Prata', value: 1.3, military: 0, terrains: { [T.MOUNTAINS]: 3, [T.HILLS]: 2 } },
  salt: { id: 'salt', name: 'Sal', value: 1.1, military: 0, terrains: { [T.DESERT]: 3, [T.COAST]: 2, [T.SWAMP]: 1 } },
  wool: { id: 'wool', name: 'Lã', value: 1.05, military: 0, terrains: { [T.HILLS]: 5, [T.PLAINS]: 2 } },
  cotton: { id: 'cotton', name: 'Algodão', value: 1.1, military: 0, terrains: { [T.PLAINS]: 3, [T.COAST]: 2 }, tropical: true },
  wine: { id: 'wine', name: 'Vinho', value: 1.15, military: 0, terrains: { [T.HILLS]: 4, [T.COAST]: 2, [T.PLAINS]: 1 } },
  spices: { id: 'spices', name: 'Especiarias', value: 1.4, military: 0, terrains: { [T.JUNGLE]: 5, [T.COAST]: 3, [T.ISLAND]: 5 }, tropical: true },
  silk: { id: 'silk', name: 'Seda', value: 1.35, military: 0, terrains: { [T.PLAINS]: 2, [T.HILLS]: 2 } },
  coal: { id: 'coal', name: 'Carvão', value: 1.3, military: 0.05, needsTech: true, terrains: { [T.HILLS]: 4, [T.MOUNTAINS]: 3, [T.FOREST]: 1 } },
  oil: { id: 'oil', name: 'Petróleo', value: 1.6, military: 0.06, needsTech: true, terrains: { [T.DESERT]: 6, [T.TUNDRA]: 3, [T.SWAMP]: 2, [T.COAST]: 1 } },
  gems: { id: 'gems', name: 'Pedras Preciosas', value: 1.4, military: 0, terrains: { [T.MOUNTAINS]: 2, [T.JUNGLE]: 2, [T.HILLS]: 1 } },
  horses: { id: 'horses', name: 'Cavalos', value: 1.05, military: 0.08, terrains: { [T.PLAINS]: 5, [T.DESERT]: 1 } },
  tea: { id: 'tea', name: 'Chá', value: 1.2, military: 0, terrains: { [T.HILLS]: 4, [T.MOUNTAINS]: 1 }, tropical: true },
  coffee: { id: 'coffee', name: 'Café', value: 1.25, military: 0, terrains: { [T.HILLS]: 3, [T.JUNGLE]: 3 }, tropical: true },
  sugar: { id: 'sugar', name: 'Açúcar', value: 1.2, military: 0, terrains: { [T.COAST]: 4, [T.PLAINS]: 2, [T.ISLAND]: 4 }, tropical: true },
  furs: { id: 'furs', name: 'Peles', value: 1.15, military: 0, terrains: { [T.TUNDRA]: 8, [T.FOREST]: 4 }, cold: true },
  ivory: { id: 'ivory', name: 'Marfim', value: 1.3, military: 0, terrains: { [T.JUNGLE]: 3, [T.PLAINS]: 1 }, tropical: true },
  incense: { id: 'incense', name: 'Incenso', value: 1.3, military: 0, terrains: { [T.DESERT]: 3, [T.HILLS]: 1 }, tropical: true },
};

export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

export function resourceValue(id: ResourceId, unlocked: boolean): number {
  const r = RESOURCES[id];
  return !r.needsTech || unlocked ? r.value : 1 + (r.value - 1) * 0.2;
}
