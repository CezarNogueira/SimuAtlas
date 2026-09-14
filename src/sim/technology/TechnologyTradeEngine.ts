// TECHNOLOGY TRADE ENGINE: mercado tecnologico. O preco e calculado por formula (complexidade, raridade, valor
// estrategico, idade, dificuldade de producao, oferta, demanda, difusao, monopolio, alternativas, recursos e
// infraestrutura, riqueza do vendedor, poder economico do comprador e relacoes diplomaticas) e convertido para a
// moeda da epoca pelo PIB per capita. Negocia compra de tecnologia, licenciamento com royalties, investimento
// estrangeiro, transferencia entre aliados, importacao de produtos prontos e as politicas de propriedade dos produtores.
import { clamp } from '../../core/math';
import { eraOfYear } from '../../data/eras';
import { PERSONALITIES } from '../../data/personalities';
import { TECHNOLOGIES, type EraId, type Technology } from '../../data/technologies';
import type { Country, TechContract, TechContractType, TechPolicy } from '../../state/types';
import type { Simulation } from '../Simulation';
import { EFFECT_SCALE } from './TechnologyEffectsEngine';
import type { TechnologyEngine } from './TechnologyEngine';

// Meia-vida (anos) do valor de mercado de uma tecnologia conforme a era em que surgiu.
export const MARKET_HALF_LIFE: Record<EraId, number> = {
  medieval: 150, moderna: 80, primeira_revolucao: 40, segunda_revolucao: 25, terceira_revolucao: 12, quarta_revolucao: 6,
};

// Intervalo (dias) entre negociacoes tecnologicas de um pais: raras na Idade Media, constantes hoje.
const TRADE_INTERVAL_DAYS: Record<EraId, number> = {
  medieval: 1080, moderna: 720, primeira_revolucao: 365, segunda_revolucao: 240, terceira_revolucao: 180, quarta_revolucao: 120,
};

const LICENSE_UPFRONT = 0.35;
const LICENSE_ROYALTY = 0.02; // do preco por mes
const LICENSE_MONTHS = 60;
const INVESTMENT_RETURN = 0.012;
const INVESTMENT_MONTHS = 96;
const IMPORT_MONTHLY = 0.012;

export interface PriceBreakdown {
  laborYears: number; // custo base em anos de trabalho qualificado
  moneyPerYear: number; // conversao da epoca (PIB per capita de referencia)
  factors: [string, number][];
  total: number;
}

export class TechnologyTradeEngine {
  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  breakdown(t: Technology, seller: Country | null, buyer: Country | null): PriceBreakdown {
    const sim = this.sim;
    const rec = this.tech.record(t.id);
    const nations = Math.max(1, this.tech.nationCount());
    const age = rec.discovered ? Math.max(0, sim.year() - rec.discoveryYear) : 0;
    const sellers = this.tech.ownership.openHolders(t.id);
    const factors: [string, number][] = [
      ['Complexidade', 1 + (t.nivelComplexidade - 1) * 0.25],
      ['Raridade', 0.7 + t.raridade * 0.08],
      ['Valor estratégico', 0.8 + t.valorEstrategico * 0.12],
      ['Idade da tecnologia', Math.max(0.15, Math.exp(-age / MARKET_HALF_LIFE[t.era]))],
      ['Dificuldade de produção', 1 + t.tempoParaProduzir / 120],
      ['Recursos e infraestrutura', 1 + 0.1 * t.recursosNecessarios.length + 0.08 * t.infraestruturaNecessaria.length],
      ['Monopólio', rec.holders <= 1 ? 2 : rec.holders <= 3 ? 1.4 : 1],
      ['Difusão', 1 / (1 + 4 * (rec.holders / nations))],
      ['Oferta', 1 / (1 + 0.15 * Math.max(0, sellers - 1))],
      ['Demanda', 1 + 0.6 * Math.min(1, (rec.researchers + rec.importers) / nations)],
    ];
    if (rec.obsolete || (buyer && t.substituidaPor.some((id) => this.tech.ownership.knows(buyer, id)))) factors.push(['Alternativas mais novas', 0.35]);
    const worldGdppc = this.worldGdppc();
    if (seller && buyer) {
      const sg = sim.economy.gdpPerCapita(seller);
      const bg = sim.economy.gdpPerCapita(buyer);
      factors.push(['Riqueza do vendedor', clamp(Math.pow(sg / Math.max(1e-6, bg), 0.3), 0.8, 1.5)]);
      let rel = clamp(1.3 - sim.diplomacy.relation(seller.id, buyer.id) / 250, 0.85, 1.7);
      if (sim.diplomacy.hasTreaty(seller.id, buyer.id, 'alliance')) rel *= 0.8;
      else if (sim.diplomacy.hasTreaty(seller.id, buyer.id, 'trade')) rel *= 0.9;
      factors.push(['Relações diplomáticas', rel]);
    }
    if (buyer) factors.push(['Poder econômico do comprador', clamp(Math.pow(Math.max(1, buyer.gdp) / Math.max(1, this.worldGdp()), 0.12), 0.75, 1.35)]);
    const moneyPerYear = buyer ? sim.economy.gdpPerCapita(buyer) : worldGdppc;
    const total = factors.reduce((acc, [, f]) => acc * f, t.custoBase * moneyPerYear);
    return { laborYears: t.custoBase, moneyPerYear, factors, total };
  }

  price(t: Technology, seller: Country | null, buyer: Country | null): number {
    return this.breakdown(t, seller, buyer).total;
  }

  marketPrice(t: Technology): number {
    return this.price(t, null, null);
  }

  private worldDay = -1;
  private avgGdppc = 1;
  private avgGdp = 1;

  // Medias mundiais de PIB e PIB per capita (calculadas uma vez por dia).
  private refreshWorld(): void {
    if (this.worldDay === this.sim.day) return;
    this.worldDay = this.sim.day;
    const nations = this.sim.countries.nations();
    this.avgGdppc = nations.length ? nations.reduce((acc, c) => acc + this.sim.economy.gdpPerCapita(c), 0) / nations.length : this.sim.era.gdpPerCapita;
    this.avgGdp = nations.length ? Math.max(1, nations.reduce((acc, c) => acc + c.gdp, 0) / nations.length) : 1;
  }

  worldGdppc(): number {
    this.refreshWorld();
    return this.avgGdppc;
  }

  worldGdp(): number {
    this.refreshWorld();
    return this.avgGdp;
  }

  // Valor esperado da tecnologia para o pais em dez anos (em moeda da epoca).
  value(c: Country, t: Technology): number {
    const fx = t.efeitos;
    const S = EFFECT_SCALE;
    const econ =
      (fx.economy ?? 0) * S.economy + (fx.industry ?? 0) * S.industry * 0.8 + (fx.agriculture ?? 0) * S.agriculture * 0.6 +
      (fx.infrastructure ?? 0) * S.infrastructure * 0.3 + (fx.administration ?? 0) * S.administration * 0.5 + (fx.transport ?? 0) * S.transport * 0.5 +
      (fx.education ?? 0) * S.education * 0.4 + (fx.research ?? 0) * S.research * 0.4 + (fx.medicine ?? 0) * S.medicine * 4;
    const mil =
      ((fx.military ?? 0) * S.military + (fx.defense ?? 0) * S.defense + (fx.siege ?? 0) * S.siege * 0.5 + (fx.naval ?? 0) * S.naval * 0.3) *
      (this.sim.index.isAtWar(c.id) ? 2 : 1) * (0.6 + PERSONALITIES[c.personality].militaryBudget * 2);
    return Math.max(0, c.gdp) * 10 * (econ * 0.3 + mil * 0.2) + t.tecnologiasDesbloqueadas.length * Math.max(0, c.gdp) * 0.004;
  }

  // Politica de propriedade de um produtor: tecnologias raras, militares e estrategicas tendem ao segredo; com a
  // difusao e a idade, a tendencia e vender, licenciar e exportar.
  decidePolicy(c: Country, t: Technology): TechPolicy {
    const current = c.techs[t.id]?.policy;
    if (!c.ai && current) return current;
    const rec = this.tech.record(t.id);
    const age = rec.discovered ? this.sim.year() - rec.discoveryYear : 0;
    let level: number;
    // Armas decisivas (nucleares, misseis, furtividade) ficam em segredo ate estarem espalhadas pelo mundo.
    if (t.militar && t.valorEstrategico >= 9) level = rec.holders < this.tech.nationCount() * 0.3 ? 3 : 2;
    else if (t.militar || t.valorEstrategico >= 8) level = rec.holders <= 2 ? 3 : 2;
    else if (t.valorEstrategico >= 6) level = rec.holders <= 2 ? 2 : 1;
    else level = 1;
    if (c.personality === 'commercial') level -= 1;
    else if (c.personality === 'isolationist') level += 1;
    if (age > MARKET_HALF_LIFE[t.era] * 1.5) level -= 2;
    if (rec.obsolete || rec.holders >= Math.max(6, this.tech.nationCount() * 0.3)) level = Math.min(level, 0);
    if (!t.importavel && level === 2) level = 1;
    const policies: TechPolicy[] = ['aberta', 'licencia', 'exporta', 'segredo'];
    return policies[clamp(level, 0, 3)];
  }

  reviewPolicies(): void {
    for (const c of this.sim.countries.nations()) {
      if (!c.ai) continue;
      for (const id in c.techs) {
        const h = c.techs[id];
        if (h.stage !== 'producao') continue;
        const t = TECHNOLOGIES.get(id);
        if (!t) continue;
        const policy = this.decidePolicy(c, t);
        if (policy === h.policy) continue;
        const rec = this.tech.record(id);
        const announce = rec.discoverer === c.id && t.valorEstrategico >= 7 && this.sim.year() - rec.discoveryYear <= 40;
        this.tech.ownership.setPolicy(c, t, policy, announce);
      }
    }
  }

  monthly(): void {
    const sim = this.sim;
    for (const c of sim.state.countries) {
      if (!c.alive) continue;
      c.science.techIncome = 0;
      c.science.techCosts = 0;
    }
    this.processContracts();
    const count = TECHNOLOGIES.countUntil(sim.year());
    for (let i = 0; i < count; i++) {
      const t = TECHNOLOGIES.all[i];
      const rec = this.tech.record(t.id);
      if (rec.discovered) rec.marketPrice = this.marketPrice(t);
    }
    for (const c of sim.countries.nations()) {
      if (!c.ai || c.science.nextTrade > sim.day) continue;
      c.science.nextTrade = sim.day + Math.round(TRADE_INTERVAL_DAYS[eraOfYear(sim.year()).id] * sim.rng.float(0.8, 1.2));
      if (c.treasury > 0) this.evaluate(c);
    }
  }

  private pay(from: Country, to: Country, amount: number): void {
    if (amount <= 0) return;
    from.treasury -= amount;
    to.treasury += amount;
    from.science.techCosts += amount;
    to.science.techIncome += amount;
  }

  private addContract(type: TechContractType, t: Technology, buyer: Country, seller: Country, monthly: number, months: number): void {
    const s = this.sim.state;
    s.techContracts.push({ id: s.nextId.contract++, type, tech: t.id, buyer: buyer.id, seller: seller.id, start: this.sim.day, end: months > 0 ? this.sim.day + months * 30 : -1, monthly });
  }

  contractsOf(countryId: number): TechContract[] {
    return this.sim.state.techContracts.filter((k) => k.buyer === countryId || k.seller === countryId);
  }

  cancelContracts(buyer: number, techId: string, type: TechContractType): void {
    const s = this.sim.state;
    s.techContracts = s.techContracts.filter((k) => !(k.buyer === buyer && k.tech === techId && k.type === type));
  }

  cancelAll(countryId: number): void {
    const s = this.sim.state;
    const ended = s.techContracts.filter((k) => k.buyer === countryId || k.seller === countryId);
    s.techContracts = s.techContracts.filter((k) => k.buyer !== countryId && k.seller !== countryId);
    for (const k of ended) {
      if (k.type === 'importacao' && k.seller === countryId) {
        const buyer = this.sim.country(k.buyer);
        if (buyer?.alive) this.tech.ownership.stopImport(buyer, k.tech);
      }
    }
  }

  private processContracts(): void {
    const sim = this.sim;
    const keep: TechContract[] = [];
    for (const k of sim.state.techContracts) {
      const buyer = sim.country(k.buyer);
      const seller = sim.country(k.seller);
      const t = TECHNOLOGIES.get(k.tech);
      if (!buyer?.alive || !seller?.alive || !t) continue;
      const atWar = sim.index.atWar(k.buyer, k.seller);
      if (k.type === 'importacao') {
        const sh = seller.techs[k.tech];
        const stillSupplies = sh?.stage === 'producao' && sh.policy !== 'segredo';
        if (atWar || !stillSupplies || buyer.techs[k.tech]?.stage !== 'importacao') {
          if (buyer.techs[k.tech]?.stage === 'importacao') this.tech.ownership.stopImport(buyer, k.tech);
          continue;
        }
      } else if ((k.end >= 0 && sim.day >= k.end) || atWar) {
        continue;
      }
      this.pay(buyer, seller, Math.min(k.monthly, Math.max(0, buyer.treasury)));
      keep.push(k);
    }
    sim.state.techContracts = keep;
  }

  // Vendedores dispostos a negociar a tecnologia com o comprador.
  sellers(t: Technology, buyer: Country, policies: TechPolicy[]): Country[] {
    const sim = this.sim;
    const minRelation = t.valorEstrategico >= 7 ? 10 : -25;
    const out: Country[] = [];
    for (const c of sim.countries.nations()) {
      if (c.id === buyer.id) continue;
      const h = c.techs[t.id];
      if (h?.stage !== 'producao' || !policies.includes(h.policy)) continue;
      if (sim.index.atWar(c.id, buyer.id) || sim.diplomacy.relation(c.id, buyer.id) < minRelation) continue;
      if (!this.tech.inContact(buyer, c)) continue;
      out.push(c);
    }
    return out;
  }

  // Avaliacao periodica de um pais: comprar, licenciar, receber investimento ou importar produtos.
  private evaluate(buyer: Country): void {
    const sim = this.sim;
    const budget = buyer.treasury * 0.5;
    const count = TECHNOLOGIES.countUntil(sim.year());
    const wanted: { t: Technology; value: number }[] = [];
    const importable: { t: Technology; value: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = TECHNOLOGIES.all[i];
      const rec = this.tech.record(t.id);
      if (!rec.discovered || rec.producers === 0) continue;
      const h = buyer.techs[t.id];
      if (h && (h.stage === 'conhecimento' || h.stage === 'producao')) continue;
      const value = this.value(buyer, t);
      if (value <= 0) continue;
      if (this.tech.ownership.depsKnown(buyer, t)) wanted.push({ t, value });
      else if (t.importavel && (!h || h.stage === 'pesquisa')) importable.push({ t, value });
    }
    wanted.sort((a, b) => b.value - a.value);
    for (const { t, value } of wanted.slice(0, 6)) {
      const sellers = this.sellers(t, buyer, ['aberta', 'licencia']);
      if (!sellers.length) {
        if (t.importavel && buyer.techs[t.id]?.stage !== 'importacao') importable.push({ t, value });
        continue;
      }
      let seller = sellers[0];
      let price = this.price(t, seller, buyer);
      for (const s of sellers.slice(1)) {
        const p = this.price(t, s, buyer);
        if (p < price) {
          seller = s;
          price = p;
        }
      }
      const policy = seller.techs[t.id].policy;
      const ally = sim.diplomacy.hasTreaty(buyer.id, seller.id, 'alliance');
      if (ally && policy === 'aberta' && t.valorEstrategico < 8 && sim.rng.chance(0.25)) {
        this.tech.ownership.grantKnowledge(buyer, t, 'transferencia', seller.id);
        return;
      }
      if (value < price * 1.1) continue;
      if (policy === 'aberta' && price * (ally ? 0.6 : 1) <= budget) {
        this.pay(buyer, seller, price * (ally ? 0.6 : 1));
        this.tech.ownership.grantKnowledge(buyer, t, ally ? 'tratado' : 'compra', seller.id);
        return;
      }
      if (price * LICENSE_UPFRONT <= budget) {
        this.pay(buyer, seller, price * LICENSE_UPFRONT);
        this.addContract('licenciamento', t, buyer, seller, price * LICENSE_ROYALTY, LICENSE_MONTHS);
        this.tech.ownership.grantKnowledge(buyer, t, 'licenciamento', seller.id);
        return;
      }
      const richer = sim.economy.gdpPerCapita(seller) >= sim.economy.gdpPerCapita(buyer) * 1.5;
      if (richer && sim.diplomacy.hasTreaty(buyer.id, seller.id, 'trade') && seller.treasury > price * 0.6) {
        // O vendedor instala fabricas no comprador e recebe dividendos por anos.
        seller.treasury -= price * 0.3;
        seller.science.techCosts += price * 0.3;
        this.addContract('investimento', t, buyer, seller, price * INVESTMENT_RETURN, INVESTMENT_MONTHS);
        this.tech.ownership.grantKnowledge(buyer, t, 'investimento', seller.id, { progress: 0.4 });
        return;
      }
    }
    // Sem acordo de tecnologia: importa produtos prontos de quem produz e aceita exportar.
    importable.sort((a, b) => b.value - a.value);
    for (const { t, value } of importable.slice(0, 4)) {
      const h = buyer.techs[t.id];
      if (h && h.stage !== 'pesquisa') continue;
      const suppliers = this.sellers(t, buyer, ['aberta', 'licencia', 'exporta']);
      if (!suppliers.length) continue;
      let supplier = suppliers[0];
      let cheapest = this.price(t, supplier, buyer);
      for (const s of suppliers.slice(1)) {
        const p = this.price(t, s, buyer);
        if (p < cheapest) {
          supplier = s;
          cheapest = p;
        }
      }
      const monthly = cheapest * IMPORT_MONTHLY;
      if (value / 120 < monthly || monthly * 6 > budget) continue;
      if (!this.tech.ownership.startImport(buyer, t, supplier.id)) continue;
      this.addContract('importacao', t, buyer, supplier, monthly, -1);
      this.tech.history.importStarted(buyer, t, supplier.id);
      return;
    }
  }
}
