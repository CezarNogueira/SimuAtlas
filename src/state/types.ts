// GAME STATE: estruturas puramente serializaveis. Nenhuma logica aqui.
import type { RngState } from '../core/rng';
import type { GovernmentId } from '../data/governments';
import type { PersonalityId } from '../data/personalities';
import type { ReligionId } from '../data/religions';
import type { CultureId } from '../data/cultures';
import type { IdeologyId } from '../data/ideologies';
import type { ResourceId } from '../data/resources';
import type { RGB } from '../data/terrain';
import type { Article } from '../data/language';

export const NONE = -1;

export interface Skills {
  adm: number; // administracao 0..10
  dip: number; // diplomacia 0..10
  mil: number; // militar 0..10
}

export interface Leader {
  id: number;
  name: string;
  house: string;
  birthDay: number;
  startDay: number;
  skills: Skills;
  traits: string[];
}

export interface General {
  id: number;
  name: string;
  birthDay: number;
  attack: number; // 0..6
  defense: number; // 0..6
  maneuver: number; // 0..6
  siege: number; // 0..6
  victories: number;
  defeats: number;
  army: number; // id do exercito comandado ou -1
}

export interface FlagDesign {
  pattern: number;
  colors: RGB[];
  emblem: number;
}

export type CountryKind = 'nation' | 'rebel';
export type RebelType = 'separatist' | 'revolution' | 'restoration' | 'civil_war';

export interface RebelInfo {
  type: RebelType;
  target: number; // pais contra o qual lutam
  claims: number[]; // provincias reivindicadas
  restore: number; // pais extinto a restaurar (-1)
  newGovernment: GovernmentId | '';
}

export interface TerritoryChange {
  day: number;
  province: number;
  from: number;
  to: number;
}

export interface Country {
  id: number;
  code: string;
  name: string;
  article: Article;
  kind: CountryKind;
  alive: boolean;
  color: RGB;
  flag: FlagDesign;
  capital: number;
  originalCapital: number;
  government: GovernmentId;
  ideology: IdeologyId;
  religion: ReligionId;
  culture: CultureId;
  personality: PersonalityId;
  ruler: Leader;
  regnalCount: Record<string, number>;
  generals: General[];
  founded: number;
  died: number;
  continent: string;
  lastElection: number;
  // Economia
  treasury: number;
  debt: number;
  inflation: number;
  unemployment: number;
  taxRate: number;
  gdp: number; // anual
  gdpLastYear: number;
  growth: number; // anual (fracao)
  income: number; // mensal
  expenses: number; // mensal
  tradeIncome: number; // mensal
  militaryBudget: number; // fracao desejada da renda
  // Sociedade
  population: number;
  stability: number; // 0..100
  corruption: number; // 0..1
  prestige: number; // 0..100
  happiness: number; // 0..100
  warExhaustion: number; // 0..100
  aggressiveExpansion: number; // 0..100
  tech: number;
  manpower: number;
  maxManpower: number;
  navy: number; // navios
  airForce: number; // esquadroes
  // Agregados recalculados
  provinceCount: number;
  area: number;
  armySize: number;
  // Registro
  traits: string[];
  modifiers: CountryModifier[];
  battlesWon: number;
  battlesLost: number;
  warsWon: number;
  warsLost: number;
  provincesConquered: number;
  provincesLost: number;
  recentChanges: TerritoryChange[];
  pastWars: number[];
  // Controle
  ai: boolean; // diplomacia autonoma
  overlord: number; // suserano (-1 se independente)
  rebel: RebelInfo | null;
  decisionDay: number;
  lastWarDay: number;
}

export interface CountryModifier {
  id: string;
  name: string;
  until: number;
  growth?: number; // somado a taxa anual de crescimento populacional
  economy?: number; // multiplicador economico (-0.2 = -20%)
  stability?: number; // alvo de estabilidade
  military?: number;
  research?: number;
}

export interface SiegeState {
  country: number;
  progress: number; // dias acumulados
  needed: number; // dias necessarios
  start: number;
}

export interface ProvinceState {
  owner: number;
  controller: number;
  cores: number[];
  population: number;
  capacity: number; // capacidade base (no nivel tecnologico inicial)
  development: number; // 1..30
  resource: ResourceId;
  unrest: number; // 0..100
  fort: number; // 0..3
  devastation: number; // 0..1
  culture: CultureId;
  religion: ReligionId;
  siege: SiegeState | null;
  lastChange: number;
  occupiedSince: number;
  epidemic: number; // dias restantes de epidemia
}

export type ArmyMission = 'idle' | 'garrison' | 'attack' | 'siege' | 'defend' | 'retreat' | 'return' | 'move';

export interface Army {
  id: number;
  owner: number;
  name: string;
  general: number;
  infantry: number;
  cavalry: number;
  artillery: number;
  morale: number; // 0..1
  experience: number; // 0..1
  supply: number; // 0..1
  location: number;
  path: number[];
  progress: number; // dias percorridos na aresta atual
  edgeDays: number; // dias totais da aresta atual
  naval: boolean;
  mission: ArmyMission;
  target: number;
  battle: number;
  thinkDay: number;
  retreatUntil: number;
  raised: number;
  player: boolean; // ordens dadas pelo jogador
}

export type WarGoalType =
  | 'conquest'
  | 'annex'
  | 'subjugate'
  | 'reconquest'
  | 'unification'
  | 'holy_war'
  | 'coalition'
  | 'independence'
  | 'revolution'
  | 'restoration'
  | 'civil_war';

export interface WarGoal {
  type: WarGoalType;
  provinces: number[];
  description: string;
}

export interface WarResult {
  winner: 'attackers' | 'defenders' | 'white';
  ceded: { province: number; from: number; to: number }[];
  annexed: number[];
  vassals: number[];
  reparations: number;
  treaty: number;
  summary: string;
}

export interface WarLogEntry {
  day: number;
  text: string;
}

export interface War {
  id: number;
  name: string;
  goal: WarGoal;
  attackers: number[];
  defenders: number[];
  attackerLeader: number;
  defenderLeader: number;
  start: number;
  end: number;
  active: boolean;
  warscore: number; // -100..100 (positivo favorece atacantes)
  exhaustion: [number, number];
  casualties: [number, number];
  battlesWon: [number, number];
  battles: number[];
  occupied: [number, number];
  goalHeldMonths: number;
  scoreHistory: number[];
  result: WarResult | null;
  log: WarLogEntry[];
  // Dia da ultima batalha nova ou mudanca de ocupacao (ausente em saves antigos: usa o inicio da guerra).
  lastActivity?: number;
  activityKey?: string;
}

export interface UnitCounts {
  infantry: number;
  cavalry: number;
  artillery: number;
}

export interface BattleSide {
  countries: number[];
  armies: number[];
  initial: UnitCounts;
  losses: number;
  morale: number;
  general: string;
}

export interface Battle {
  id: number;
  name: string;
  war: number;
  province: number;
  x: number;
  y: number;
  start: number;
  end: number;
  attacker: BattleSide;
  defender: BattleSide;
  terrain: number;
  river: boolean;
  fort: number;
  winner: 'attacker' | 'defender' | null;
  days: number;
  log: string[];
}

export type TreatyType = 'alliance' | 'nap' | 'truce' | 'trade' | 'guarantee' | 'access' | 'sanction' | 'vassal' | 'coalition' | 'peace';

export interface Treaty {
  id: number;
  type: TreatyType;
  name: string;
  members: number[];
  target: number;
  start: number;
  end: number; // -1 = indeterminado
  active: boolean;
  war: number;
}

export type HistoryType =
  | 'start'
  | 'war_declared'
  | 'war_joined'
  | 'war_ended'
  | 'battle'
  | 'conquest'
  | 'capital_fall'
  | 'peace'
  | 'alliance'
  | 'alliance_broken'
  | 'treaty'
  | 'rebellion'
  | 'independence'
  | 'revolution'
  | 'civil_war'
  | 'coup'
  | 'government'
  | 'ruler'
  | 'event'
  | 'economy'
  | 'tech'
  | 'annexation'
  | 'collapse'
  | 'founded'
  | 'destroyed'
  | 'diplomacy'
  | 'disaster';

export interface HistoryEntry {
  id: number;
  day: number;
  type: HistoryType;
  text: string;
  countries: number[];
  province: number;
  war: number;
  battle: number;
  importance: 1 | 2 | 3;
}

export interface StatsSeries {
  years: number[];
  pop: number[];
  gdp: number[];
  army: number[];
  provinces: number[];
}

export interface StatsState {
  world: StatsSeries & { countries: number[]; wars: number[] };
  countries: Record<number, StatsSeries>;
  snapshots: { year: number; owners: number[] }[];
  techFirsts: Record<string, number>;
}

export interface SimSettings {
  aggression: number; // multiplicador global de belicosidade (0.25..2)
  eventFrequency: number; // multiplicador de eventos
  rebellionFrequency: number; // multiplicador de rebelioes
  diplomacyFrequency: number; // multiplicador de acoes diplomaticas
  // false (padrao): guerras entre nacoes so terminam por dominacao de um lado ou por decisao do jogador.
  // true: as nacoes negociam a paz sozinhas (tratados automaticos, paz branca, paz em separado).
  autoPeace: boolean;
}

export interface GameState {
  version: number;
  mapId: string;
  eraId: string;
  seed: number;
  rng: RngState;
  day: number;
  startYear: number;
  settings: SimSettings;
  countries: Country[];
  provinces: ProvinceState[];
  armies: Army[];
  wars: War[];
  battles: Battle[];
  treaties: Treaty[];
  relations: [number, number][];
  history: HistoryEntry[];
  stats: StatsState;
  nextId: { army: number; war: number; battle: number; treaty: number; history: number; person: number };
}

export const DEFAULT_SETTINGS: SimSettings = {
  aggression: 1,
  eventFrequency: 1,
  rebellionFrequency: 1,
  diplomacyFrequency: 1,
  autoPeace: false,
};
