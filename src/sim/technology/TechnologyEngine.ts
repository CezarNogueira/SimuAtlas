// TECHNOLOGY ENGINE: orquestra o sistema tecnologico (banco de dados, descoberta, propriedade, pesquisa, mercado,
// difusao, espionagem, efeitos e historico) e o liga ao restante da simulacao: infraestrutura e recursos exigidos,
// guerra e conquista como formas de transferir conhecimento, e as consultas usadas por economia, exercitos e interface.
// Trajetoria de cada tecnologia: ano -> possibilidade de descoberta -> descobridor -> propriedade -> producao ->
// comercio -> difusao -> desenvolvimento independente -> obsolescencia.
import { clamp } from '../../core/math';
import type { ResourceId } from '../../data/resources';
import { INFRA_TAGS, TECHNOLOGIES, type InfraTag, type TechEffects, type Technology } from '../../data/technologies';
import type { Country, TechRecord, War } from '../../state/types';
import type { Simulation } from '../Simulation';
import { TechnologyDiffusionEngine } from './TechnologyDiffusionEngine';
import { TechnologyDiscoveryEngine } from './TechnologyDiscoveryEngine';
import { TechnologyEffectsEngine } from './TechnologyEffectsEngine';
import { TechnologyEspionageEngine } from './TechnologyEspionageEngine';
import { TechnologyHistoryEngine } from './TechnologyHistoryEngine';
import { TechnologyOwnershipEngine } from './TechnologyOwnershipEngine';
import { TechnologyResearchEngine } from './TechnologyResearchEngine';
import { TechnologyTradeEngine } from './TechnologyTradeEngine';

export type TechStatus = 'dominada' | 'desenvolvimento' | 'indisponivel';

export const STATUS_LABELS: Record<TechStatus, string> = {
  dominada: 'Dominada',
  desenvolvimento: 'Em desenvolvimento',
  indisponivel: 'Não disponível',
};

// Tecnologias cuja producao (ou conhecimento, para descobertas) atende a cada infraestrutura.
const INFRA_TECH: Partial<Record<InfraTag, string>> = {
  ferrovias: 'railway',
  rede_eletrica: 'electric_grid',
  refinarias: 'kerosene_refining',
  telecomunicacoes: 'telephone',
  fabricas_de_chips: 'integrated_circuit',
  centros_de_dados: 'internet',
  centro_espacial: 'liquid_rocket',
};

export interface ProvinceTransferEvent {
  province: number;
  from: number;
  to: number;
  reason: string;
  wasCapital: boolean;
}

export class TechnologyEngine {
  readonly db = TECHNOLOGIES;
  readonly history: TechnologyHistoryEngine;
  readonly ownership: TechnologyOwnershipEngine;
  readonly effects: TechnologyEffectsEngine;
  readonly research: TechnologyResearchEngine;
  readonly discovery: TechnologyDiscoveryEngine;
  readonly trade: TechnologyTradeEngine;
  readonly diffusion: TechnologyDiffusionEngine;
  readonly espionage: TechnologyEspionageEngine;

  private devKey = -1;
  private dev = new Float64Array(0);
  private resourceKey = -1;
  private resources = new Map<number, Set<ResourceId>>();
  private nationsDay = -1;
  private nations = 0;

  constructor(private sim: Simulation) {
    this.history = new TechnologyHistoryEngine(sim, this);
    this.ownership = new TechnologyOwnershipEngine(sim, this);
    this.effects = new TechnologyEffectsEngine(sim, this);
    this.research = new TechnologyResearchEngine(sim, this);
    this.discovery = new TechnologyDiscoveryEngine(sim, this);
    this.trade = new TechnologyTradeEngine(sim, this);
    this.diffusion = new TechnologyDiffusionEngine(sim, this);
    this.espionage = new TechnologyEspionageEngine(sim, this);
    sim.bus.on('provinceTransferred', (e) => this.onProvinceTransferred(e));
    sim.bus.on('capitalOccupied', (e) => this.onCapitalOccupied(e.province, e.by, e.owner));
    sim.bus.on('countryDestroyed', (e) => this.onCountryDestroyed(e.country, e.by));
    sim.bus.on('warEnded', (w) => this.onWarEnded(w));
  }

  // ---------- Ciclos ----------

  initializeWorld(): void {
    this.discovery.initializeWorld();
    this.ownership.recount();
    this.effects.refreshAll();
    this.research.updateCapacities();
    for (const t of TECHNOLOGIES.all) {
      const rec = this.record(t.id);
      if (rec.discovered) rec.marketPrice = this.trade.marketPrice(t);
    }
    const nations = this.sim.countries.nations();
    const pop = nations.reduce((acc, c) => acc + c.population, 0);
    this.sim.state.techBaseline = pop > 0 ? nations.reduce((acc, c) => acc + c.tech * c.population, 0) / pop : this.sim.era.tech;
  }

  monthly(): void {
    // Contagens e matriz de conhecimento sao corrigidas a cada trimestre; entre as correcoes, os motores as atualizam.
    if (this.sim.date().month % 3 === 1) this.ownership.recount();
    this.research.monthly();
    this.discovery.monthly();
    this.trade.monthly();
    this.diffusion.monthly();
    this.espionage.monthly();
    this.effects.flush();
  }

  yearly(): void {
    this.research.yearly();
    this.trade.reviewPolicies();
    this.diffusion.yearly();
    this.effects.flush();
  }

  // ---------- Consultas ----------

  record(id: string): TechRecord {
    return this.sim.state.technologies[id];
  }

  get(id: string): Technology | undefined {
    return TECHNOLOGIES.get(id);
  }

  fx(c: Country): TechEffects {
    return this.effects.of(c);
  }

  knows(c: Country, id: string): boolean {
    return this.ownership.knows(c, id);
  }

  status(c: Country, id: string): TechStatus {
    const h = c.techs[id];
    if (!h) return 'indisponivel';
    return h.stage === 'producao' ? 'dominada' : 'desenvolvimento';
  }

  nationCount(): number {
    if (this.nationsDay !== this.sim.day) {
      this.nationsDay = this.sim.day;
      this.nations = this.sim.countries.nations().length;
    }
    return this.nations;
  }

  // Contato entre paises: antes da era industrial, comercio e espionagem tecnologica so alcancam vizinhos, parceiros
  // comerciais e aliados (e, a partir de 1760, o mesmo continente); a partir de 1850 o mercado tecnologico e mundial.
  inContact(a: Country, b: Country): boolean {
    const year = this.sim.year();
    if (year >= 1850) return true;
    if (this.sim.countries.neighbors(a.id).has(b.id)) return true;
    const d = this.sim.diplomacy;
    if (d.hasTreaty(a.id, b.id, 'trade') || d.hasTreaty(a.id, b.id, 'alliance')) return true;
    return year >= 1760 && !!a.continent && a.continent === b.continent;
  }

  hasAirForce(c: Country): boolean {
    return this.effects.stageWeight(c, 'military_aviation') > 0;
  }

  hasArmor(c: Country): boolean {
    return this.effects.stageWeight(c, 'tank') > 0;
  }

  cavalryName(c: Country): string {
    return this.hasArmor(c) ? 'Blindados' : 'Cavalaria';
  }

  // Carvao so vale plenamente com a maquina a vapor ou a fundicao com coque; petroleo, com o refino e a perfuracao.
  resourceUnlocked(c: Country, r: ResourceId): boolean {
    if (r === 'coal') return this.effects.stageWeight(c, 'coke_smelting') > 0 || this.effects.stageWeight(c, 'watt_engine') > 0;
    if (r === 'oil') return this.effects.stageWeight(c, 'kerosene_refining') > 0 || this.effects.stageWeight(c, 'oil_drilling') > 0;
    return true;
  }

  // Desenvolvimento medio dos estados do pais (atualizado uma vez por mes).
  devIndex(c: Country): number {
    const key = Math.floor(this.sim.day / 30);
    const s = this.sim.state;
    if (key !== this.devKey || this.dev.length < s.countries.length) {
      this.devKey = key;
      const sum = new Float64Array(s.countries.length + 16);
      const count = new Float64Array(s.countries.length + 16);
      for (const p of s.provinces) {
        if (p.owner < 0) continue;
        sum[p.owner] += p.development;
        count[p.owner]++;
      }
      this.dev = new Float64Array(sum.length);
      for (let i = 0; i < sum.length; i++) this.dev[i] = count[i] > 0 ? sum[i] / count[i] : 0;
    }
    return this.dev[c.id] ?? 0;
  }

  resourcesOf(id: number): Set<ResourceId> {
    const key = Math.floor(this.sim.day / 30);
    if (key !== this.resourceKey) {
      this.resourceKey = key;
      this.resources.clear();
    }
    let set = this.resources.get(id);
    if (!set) {
      set = new Set();
      for (const p of this.sim.index.ownedBy[id] ?? []) set.add(this.sim.state.provinces[p].resource);
      this.resources.set(id, set);
    }
    return set;
  }

  // Acesso as materias-primas: proprias (1), de parceiros comerciais e aliados (0,7) ou do mercado mundial (0,35).
  resourceAccess(c: Country, t: Technology): number {
    if (!t.recursosNecessarios.length) return 1;
    const own = this.resourcesOf(c.id);
    const partners = [...this.sim.diplomacy.partners(c.id, 'trade'), ...this.sim.diplomacy.partners(c.id, 'alliance')];
    let factor = 1;
    for (const r of t.recursosNecessarios) {
      if (own.has(r)) continue;
      factor = Math.min(factor, partners.some((p) => this.resourcesOf(p).has(r)) ? 0.7 : 0.35);
    }
    return factor;
  }

  // Infraestrutura exigida. Para descobrir basta conhecer as tecnologias de base; para produzir, e preciso produzi-las.
  infraSatisfied(c: Country, tag: InfraTag, mode: 'discovery' | 'production'): boolean {
    const s = c.science;
    const base = INFRA_TECH[tag];
    const hasBase = (id: string) => (mode === 'production' ? this.ownership.produces(c, id) : this.ownership.knows(c, id));
    switch (tag) {
      case 'oficinas': return this.devIndex(c) >= 3;
      case 'porto': return (this.sim.index.ownedBy[c.id] ?? []).some((p) => this.sim.map.coastal[p]);
      case 'universidade': return s.universities >= 1;
      case 'fabricas': return s.industrialization >= 0.15;
      case 'laboratorios': return s.universities >= 3 && s.education >= 0.3;
      case 'centro_espacial': return hasBase('liquid_rocket') && s.universities >= 5;
      default: return base ? hasBase(base) : true;
    }
  }

  infraLabel(tag: InfraTag): string {
    return INFRA_TAGS[tag];
  }

  // ---------- Paises novos e intervencoes ----------

  inherit(child: Country, parent: Country): void {
    this.ownership.inherit(child, parent);
  }

  // Intervencao do observador: entrega a tecnologia disponivel mais antiga que o pais ainda nao domina.
  grantByObserver(c: Country): Technology | null {
    const count = TECHNOLOGIES.countUntil(this.sim.year());
    for (let i = 0; i < count; i++) {
      const t = TECHNOLOGIES.all[i];
      if (!this.record(t.id).discovered || this.ownership.knows(c, t.id) || !this.ownership.depsKnown(c, t)) continue;
      this.ownership.grantKnowledge(c, t, 'observador', -1);
      return t;
    }
    return null;
  }

  // ---------- Guerra e conquista ----------

  // O vencedor absorve conhecimentos do derrotado (cientistas, fabricas, arquivos).
  private capture(winner: Country, loser: Country, max: number, source: 'guerra' | 'conquista'): void {
    const candidates: Technology[] = [];
    for (const id in loser.techs) {
      const h = loser.techs[id];
      if (h.stage !== 'producao' && h.stage !== 'conhecimento') continue;
      const t = TECHNOLOGIES.get(id);
      if (!t || this.ownership.knows(winner, id) || !this.ownership.depsKnown(winner, t)) continue;
      candidates.push(t);
    }
    candidates.sort((a, b) => b.valorEstrategico - a.valorEstrategico || b.anoDescoberta - a.anoDescoberta);
    let taken = 0;
    for (const t of candidates) {
      if (taken >= max) break;
      if (!this.sim.rng.chance(0.7)) continue;
      if (this.ownership.grantKnowledge(winner, t, source, loser.id)) taken++;
    }
  }

  private onProvinceTransferred(e: ProvinceTransferEvent): void {
    if (e.from < 0 || e.to < 0 || !['conquest', 'peace', 'annex', 'occupation'].includes(e.reason)) return;
    const winner = this.sim.country(e.to);
    const loser = this.sim.country(e.from);
    if (!winner?.alive || winner.kind !== 'nation' || !loser || loser.kind !== 'nation') return;
    // Estados desenvolvidos (e sobretudo capitais) guardam cientistas, oficinas e arquivos.
    const dev = this.sim.state.provinces[e.province].development;
    const chance = clamp(dev / 60, 0.02, 0.25) * (e.wasCapital ? 2 : 1);
    if (this.sim.rng.chance(chance)) this.capture(winner, loser, e.wasCapital ? 2 : 1, 'conquista');
  }

  private onCapitalOccupied(province: number, by: number, owner: number): void {
    const winner = this.sim.country(by);
    const loser = this.sim.country(owner);
    if (!winner?.alive || winner.kind !== 'nation' || !loser?.alive || loser.kind !== 'nation') return;
    if (this.sim.rng.chance(0.6)) this.capture(winner, loser, 2, 'guerra');
    void province;
  }

  private onCountryDestroyed(id: number, by: number): void {
    const dead = this.sim.country(id);
    if (!dead) return;
    const winner = by >= 0 ? this.sim.country(by) : undefined;
    if (winner?.alive && winner.kind === 'nation' && dead.kind === 'nation') this.capture(winner, dead, 6, 'conquista');
    this.ownership.clear(dead);
  }

  // Acordos pos-guerra: o vencedor exige conhecimentos do derrotado.
  private onWarEnded(war: War): void {
    const result = war.result;
    if (!result || result.winner === 'white') return;
    const winner = this.sim.country(result.winner === 'attackers' ? war.attackerLeader : war.defenderLeader);
    const loser = this.sim.country(result.winner === 'attackers' ? war.defenderLeader : war.attackerLeader);
    if (!winner?.alive || winner.kind !== 'nation' || !loser?.alive || loser.kind !== 'nation') return;
    if (this.sim.rng.chance(0.5)) this.capture(winner, loser, 1, 'guerra');
  }
}
