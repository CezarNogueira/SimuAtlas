// Personalidades da IA: pesos que orientam decisoes de guerra, diplomacia e economia.
export type PersonalityId =
  | 'expansionist'
  | 'defensive'
  | 'militarist'
  | 'pacifist'
  | 'imperialist'
  | 'commercial'
  | 'isolationist'
  | 'diplomatic'
  | 'opportunist';

export interface PersonalityInfo {
  id: PersonalityId;
  name: string;
  description: string;
  aggression: number; // propensao a declarar guerra
  militaryBudget: number; // fracao da renda destinada ao exercito
  allianceSeek: number; // busca por aliancas
  tradeSeek: number; // busca por acordos comerciais
  opportunism: number; // ataca vizinhos enfraquecidos
  peaceWillingness: number; // aceita paz com facilidade
  coalitionJoin: number; // entra em coalizoes contra agressores
  annexation: number; // prefere anexar/subjugar
  isolation: number; // evita tratados
}

export const PERSONALITIES: Record<PersonalityId, PersonalityInfo> = {
  expansionist: { id: 'expansionist', name: 'Expansionista', description: 'Busca novos territórios e declara guerras com frequência.', aggression: 0.75, militaryBudget: 0.24, allianceSeek: 0.35, tradeSeek: 0.3, opportunism: 0.5, peaceWillingness: 0.35, coalitionJoin: 0.3, annexation: 0.5, isolation: 0.1 },
  defensive: { id: 'defensive', name: 'Defensivo', description: 'Protege suas fronteiras e busca garantias mútuas.', aggression: 0.18, militaryBudget: 0.2, allianceSeek: 0.65, tradeSeek: 0.4, opportunism: 0.15, peaceWillingness: 0.7, coalitionJoin: 0.75, annexation: 0.2, isolation: 0.3 },
  militarist: { id: 'militarist', name: 'Militarista', description: 'Mantém exércitos enormes e responde com dureza a ameaças, mas não inicia conquistas.', aggression: 0.62, militaryBudget: 0.34, allianceSeek: 0.4, tradeSeek: 0.2, opportunism: 0.45, peaceWillingness: 0.3, coalitionJoin: 0.4, annexation: 0.4, isolation: 0.2 },
  pacifist: { id: 'pacifist', name: 'Pacifista', description: 'Evita guerras a todo custo e investe na economia.', aggression: 0.04, militaryBudget: 0.08, allianceSeek: 0.5, tradeSeek: 0.65, opportunism: 0.05, peaceWillingness: 0.95, coalitionJoin: 0.5, annexation: 0.1, isolation: 0.3 },
  imperialist: { id: 'imperialist', name: 'Imperialista', description: 'Deseja subjugar e anexar nações inteiras.', aggression: 0.7, militaryBudget: 0.26, allianceSeek: 0.3, tradeSeek: 0.35, opportunism: 0.45, peaceWillingness: 0.3, coalitionJoin: 0.2, annexation: 0.85, isolation: 0.05 },
  commercial: { id: 'commercial', name: 'Comercial', description: 'Prioriza rotas comerciais, riqueza e estabilidade.', aggression: 0.22, militaryBudget: 0.12, allianceSeek: 0.5, tradeSeek: 0.95, opportunism: 0.3, peaceWillingness: 0.75, coalitionJoin: 0.5, annexation: 0.2, isolation: 0.05 },
  isolationist: { id: 'isolationist', name: 'Isolacionista', description: 'Fecha-se ao mundo e raramente se envolve em tratados.', aggression: 0.14, militaryBudget: 0.16, allianceSeek: 0.1, tradeSeek: 0.15, opportunism: 0.1, peaceWillingness: 0.8, coalitionJoin: 0.2, annexation: 0.2, isolation: 0.9 },
  diplomatic: { id: 'diplomatic', name: 'Diplomático', description: 'Negocia, forma alianças e evita conflitos.', aggression: 0.1, militaryBudget: 0.12, allianceSeek: 0.9, tradeSeek: 0.6, opportunism: 0.15, peaceWillingness: 0.9, coalitionJoin: 0.65, annexation: 0.15, isolation: 0 },
  opportunist: { id: 'opportunist', name: 'Oportunista', description: 'Explora crises alheias na diplomacia e entra nas guerras dos aliados, sem iniciar conquistas.', aggression: 0.42, militaryBudget: 0.18, allianceSeek: 0.45, tradeSeek: 0.45, opportunism: 0.95, peaceWillingness: 0.5, coalitionJoin: 0.55, annexation: 0.35, isolation: 0.2 },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];

// Unicas personalidades que iniciam guerras de conquista (as demais so lutam para se defender ou ao lado de aliados).
export const EXPANSIONIST_PERSONALITIES = new Set<PersonalityId>(['expansionist', 'imperialist']);
