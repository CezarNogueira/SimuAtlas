// Ideologias predominantes por era tecnologica, com efeitos leves.
export type IdeologyId =
  | 'traditionalism'
  | 'absolutism'
  | 'mercantilism'
  | 'liberalism'
  | 'conservatism'
  | 'nationalism'
  | 'socialism'
  | 'developmentalism';

export interface IdeologyInfo {
  id: IdeologyId;
  name: string;
  minTech: number;
  stability: number;
  growth: number;
  aggression: number;
  trade: number;
}

export const IDEOLOGIES: Record<IdeologyId, IdeologyInfo> = {
  traditionalism: { id: 'traditionalism', name: 'Tradicionalismo', minTech: 0, stability: 4, growth: 0.98, aggression: 0, trade: 0.95 },
  absolutism: { id: 'absolutism', name: 'Absolutismo', minTech: 4, stability: 2, growth: 1.0, aggression: 0.08, trade: 1.0 },
  mercantilism: { id: 'mercantilism', name: 'Mercantilismo', minTech: 5, stability: 0, growth: 1.03, aggression: 0.04, trade: 1.15 },
  liberalism: { id: 'liberalism', name: 'Liberalismo', minTech: 11, stability: 1, growth: 1.05, aggression: -0.05, trade: 1.2 },
  conservatism: { id: 'conservatism', name: 'Conservadorismo', minTech: 11, stability: 3, growth: 1.0, aggression: 0, trade: 1.0 },
  nationalism: { id: 'nationalism', name: 'Nacionalismo', minTech: 13, stability: 2, growth: 1.0, aggression: 0.12, trade: 0.95 },
  socialism: { id: 'socialism', name: 'Socialismo', minTech: 16, stability: -1, growth: 1.02, aggression: 0.02, trade: 0.9 },
  developmentalism: { id: 'developmentalism', name: 'Desenvolvimentismo', minTech: 20, stability: 1, growth: 1.06, aggression: -0.04, trade: 1.1 },
};

export const IDEOLOGY_IDS = Object.keys(IDEOLOGIES) as IdeologyId[];
