// WORLD ENGINE: orquestra todos os motores da simulacao em ciclos diarios, mensais e anuais.
// Nao conhece DOM nem renderizacao: comunica mudancas via EventBus.
import { EventBus } from '../core/EventBus';
import { Rng } from '../core/rng';
import { dateFromDay, type GameDate } from '../core/calendar';
import { eraById, type EraPreset } from '../data/eras';
import type { MapData } from '../map/MapData';
import type { Battle, Country, GameState, HistoryEntry, ProvinceState, War } from '../state/types';
import { WorldIndex } from './WorldIndex';
import { Pathfinder } from './Pathfinder';
import { HistoryEngine } from './engines/HistoryEngine';
import { ProvinceEngine } from './engines/ProvinceEngine';
import { CountryEngine } from './engines/CountryEngine';
import { CityEngine } from './engines/CityEngine';
import { PopulationEngine } from './engines/PopulationEngine';
import { EconomyEngine } from './engines/EconomyEngine';
import { DiplomacyEngine } from './engines/DiplomacyEngine';
import { WarEngine } from './engines/WarEngine';
import { BattleEngine } from './engines/BattleEngine';
import { MilitaryEngine } from './engines/MilitaryEngine';
import { AIEngine } from './engines/AIEngine';
import { ArmyAI } from './engines/ArmyAI';
import { EventEngine } from './engines/EventEngine';
import { RebellionEngine } from './engines/RebellionEngine';
import { EraEngine } from './engines/EraEngine';
import { TechnologyEngine, type ProvinceTransferEvent } from './technology/TechnologyEngine';
import { GovernmentEngine } from './engines/GovernmentEngine';
import { StatsEngine } from './engines/StatsEngine';

export interface SimEvents {
  provinceChanged: { province: number };
  countryChanged: { country: number };
  countryCreated: { country: number };
  countryDestroyed: { country: number; by: number };
  provinceTransferred: ProvinceTransferEvent;
  capitalOccupied: { province: number; by: number; owner: number };
  history: HistoryEntry;
  battleStarted: Battle;
  battleEnded: Battle;
  warStarted: War;
  warEnded: War;
  month: number;
  year: number;
}

export class Simulation {
  readonly map: MapData;
  readonly state: GameState;
  readonly rng: Rng;
  readonly era: EraPreset;
  readonly bus = new EventBus<SimEvents>();
  readonly index: WorldIndex;
  readonly pathfinder: Pathfinder;
  readonly history: HistoryEngine;
  readonly provinces: ProvinceEngine;
  readonly countries: CountryEngine;
  readonly cities: CityEngine;
  readonly population: PopulationEngine;
  readonly economy: EconomyEngine;
  readonly diplomacy: DiplomacyEngine;
  readonly wars: WarEngine;
  readonly battles: BattleEngine;
  readonly military: MilitaryEngine;
  readonly ai: AIEngine;
  readonly armyAI: ArmyAI;
  readonly events: EventEngine;
  readonly rebellion: RebellionEngine;
  readonly eras: EraEngine;
  readonly technology: TechnologyEngine;
  readonly government: GovernmentEngine;
  readonly stats: StatsEngine;

  constructor(map: MapData, state: GameState) {
    this.map = map;
    this.state = state;
    this.rng = new Rng(state.rng);
    this.era = eraById(state.eraId);
    this.index = new WorldIndex(this);
    this.pathfinder = new Pathfinder(map);
    this.history = new HistoryEngine(this);
    this.provinces = new ProvinceEngine(this);
    this.countries = new CountryEngine(this);
    this.cities = new CityEngine(this);
    this.population = new PopulationEngine(this);
    this.economy = new EconomyEngine(this);
    this.diplomacy = new DiplomacyEngine(this);
    this.wars = new WarEngine(this);
    this.battles = new BattleEngine(this);
    this.military = new MilitaryEngine(this);
    this.ai = new AIEngine(this);
    this.armyAI = new ArmyAI(this);
    this.events = new EventEngine(this);
    this.rebellion = new RebellionEngine(this);
    this.eras = new EraEngine(this);
    this.technology = new TechnologyEngine(this);
    this.government = new GovernmentEngine(this);
    this.stats = new StatsEngine(this);
    this.index.rebuild();
  }

  get day(): number {
    return this.state.day;
  }

  date(day = this.state.day): GameDate {
    return dateFromDay(day, this.state.startYear);
  }

  year(day = this.state.day): number {
    return this.state.startYear + Math.floor(day / 365);
  }

  country(id: number): Country {
    return this.state.countries[id];
  }

  province(id: number): ProvinceState {
    return this.state.provinces[id];
  }

  nextId(kind: keyof GameState['nextId']): number {
    return this.state.nextId[kind]++;
  }

  // Primeira preparacao de um mundo recem-criado.
  initialize(): void {
    this.countries.recomputeAll();
    this.economy.monthly();
    this.military.monthly();
    this.countries.recomputeAll();
    this.stats.yearly();
  }

  // Avanca um dia de simulacao.
  step(): void {
    const s = this.state;
    s.day++;
    const d = dateFromDay(s.day, s.startYear);
    this.military.dailyMovement();
    this.battles.daily();
    this.military.dailySieges();
    this.armyAI.daily();
    if (d.day === 1) {
      this.economy.monthly();
      this.population.monthly();
      this.provinces.monthly();
      this.countries.monthly();
      this.military.monthly();
      this.diplomacy.monthly();
      this.wars.monthly();
      this.ai.monthly();
      this.rebellion.monthly();
      this.events.monthly();
      this.technology.monthly();
      this.bus.emit('month', s.day);
    }
    this.ai.daily(d);
    if (d.dayOfYear === 0) {
      this.eras.yearly();
      this.technology.yearly();
      this.government.yearly();
      this.provinces.yearly();
      this.diplomacy.yearly();
      this.stats.yearly();
      this.bus.emit('year', d.year);
    }
  }

  // Sincroniza caches de runtime no estado antes de salvar.
  snapshot(): GameState {
    this.state.rng = this.rng.state;
    this.state.relations = this.diplomacy.serializeRelations();
    return this.state;
  }
}
