// TECHNOLOGY OWNERSHIP ENGINE: quem pesquisa, importa, conhece e produz cada tecnologia. Concede conhecimento
// (com a forma de aquisicao), promove a producao em larga escala, define politicas de propriedade, transmite o
// conhecimento a paises novos e mantem as contagens e a matriz de conhecimento usadas pelos demais motores.
import { TECHNOLOGIES, type Technology } from '../../data/technologies';
import type { Country, TechAcquisition, TechHolding, TechPolicy, TechRecord } from '../../state/types';
import type { Simulation } from '../Simulation';
import type { TechnologyEngine } from './TechnologyEngine';

export interface GrantOptions {
  production?: boolean; // ja chega produzindo (descoberta, heranca de quem produzia)
  progress?: number; // adaptacao produtiva inicial (0..1)
  announce?: boolean; // registra no historico geral (padrao: sim)
  refresh?: boolean; // marca os efeitos do pais para recalculo (padrao: sim; a inicializacao recalcula em lote)
}

export class TechnologyOwnershipEngine {
  // Por tecnologia (na ordem cronologica do banco), um byte por pais: 0 nao conhece, 1 conhece mas guarda segredo,
  // 2 conhece e compartilha.
  private matrix: Uint8Array[] = [];
  // Paises que conhecem a tecnologia e aceitam compartilha-la.
  private open = new Int32Array(TECHNOLOGIES.size);

  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  record(id: string): TechRecord {
    return this.sim.state.technologies[id];
  }

  openHolders(id: string): number {
    const i = TECHNOLOGIES.indexOf(id);
    return i >= 0 ? this.open[i] : 0;
  }

  knows(c: Country, id: string): boolean {
    const s = c.techs[id]?.stage;
    return s === 'conhecimento' || s === 'producao';
  }

  produces(c: Country, id: string): boolean {
    return c.techs[id]?.stage === 'producao';
  }

  depsKnown(c: Country, t: Technology): boolean {
    for (const d of t.tecnologiasDependentes) if (!this.knows(c, d)) return false;
    return true;
  }

  private counted(c: Country): boolean {
    return c.alive && c.kind === 'nation';
  }

  // Concede o conhecimento de uma tecnologia. Nunca rebaixa quem ja conhece. Retorna true se o pais passou a conhece-la.
  grantKnowledge(c: Country, t: Technology, source: TechAcquisition, from = -1, opts: GrantOptions = {}): boolean {
    const sim = this.sim;
    const rec = this.record(t.id);
    const h = c.techs[t.id];
    if (h && (h.stage === 'conhecimento' || h.stage === 'producao')) {
      if (opts.production && h.stage === 'conhecimento') this.setProduction(c, t, opts.announce ?? true, opts.refresh ?? true);
      return false;
    }
    const counted = this.counted(c);
    if (h?.stage === 'importacao') {
      if (counted) rec.importers = Math.max(0, rec.importers - 1);
      this.tech.trade.cancelContracts(c.id, t.id, 'importacao');
    } else if (h?.stage === 'pesquisa' && counted) {
      rec.researchers = Math.max(0, rec.researchers - 1);
    }
    const holding: TechHolding = {
      stage: 'conhecimento',
      progress: Math.max(0, Math.min(0.99, opts.progress ?? 0)),
      source,
      since: sim.day,
      acquired: sim.day,
      supplier: from,
      policy: this.tech.trade.decidePolicy(c, t),
    };
    c.techs[t.id] = holding;
    if (counted) {
      rec.holders++;
      if (rec.holders === 2 && rec.discovered && rec.monopolyEnded < 0) {
        rec.monopolyEnded = sim.day;
        this.tech.history.log(t.id, 'monopolio', c.id, rec.discoverer, source);
      }
    }
    this.tech.history.acquired(c, t, source, from, opts.announce ?? true);
    if (opts.production) this.setProduction(c, t, false, opts.refresh ?? true);
    else if (opts.refresh ?? true) this.tech.effects.refresh(c);
    return true;
  }

  // Conhecimento vira producao em larga escala.
  setProduction(c: Country, t: Technology, announce = true, refresh = true): void {
    const h = c.techs[t.id];
    if (!h || h.stage !== 'conhecimento') return;
    h.stage = 'producao';
    h.progress = 1;
    h.since = this.sim.day;
    if (this.counted(c)) this.record(t.id).producers++;
    h.policy = this.tech.trade.decidePolicy(c, t);
    if (refresh) this.tech.effects.refresh(c);
    this.tech.history.production(c, t, announce);
  }

  startResearch(c: Country, t: Technology): void {
    if (c.techs[t.id]) return;
    c.techs[t.id] = { stage: 'pesquisa', progress: 0, source: null, since: this.sim.day, acquired: -1, supplier: -1, policy: 'licencia' };
    if (this.counted(c)) this.record(t.id).researchers++;
  }

  dropResearch(c: Country, id: string): void {
    const h = c.techs[id];
    if (h?.stage !== 'pesquisa') return;
    delete c.techs[id];
    if (this.counted(c)) this.record(id).researchers = Math.max(0, this.record(id).researchers - 1);
  }

  // Passa a importar produtos prontos (mantem o progresso de pesquisa propria, se houver).
  startImport(c: Country, t: Technology, supplier: number): boolean {
    const h = c.techs[t.id];
    if (h && h.stage !== 'pesquisa') return false;
    const rec = this.record(t.id);
    if (h && this.counted(c)) rec.researchers = Math.max(0, rec.researchers - 1);
    c.techs[t.id] = { stage: 'importacao', progress: h?.progress ?? 0, source: null, since: this.sim.day, acquired: -1, supplier, policy: 'licencia' };
    if (this.counted(c)) rec.importers++;
    this.tech.effects.refresh(c);
    return true;
  }

  stopImport(c: Country, id: string): void {
    const h = c.techs[id];
    if (h?.stage !== 'importacao') return;
    const rec = this.record(id);
    if (this.counted(c)) rec.importers = Math.max(0, rec.importers - 1);
    if (h.progress > 0) {
      c.techs[id] = { ...h, stage: 'pesquisa', supplier: -1, since: this.sim.day };
      if (this.counted(c)) rec.researchers++;
    } else {
      delete c.techs[id];
    }
    this.tech.effects.refresh(c);
  }

  setPolicy(c: Country, t: Technology, policy: TechPolicy, announce: boolean): void {
    const h = c.techs[t.id];
    if (!h || h.stage !== 'producao' || h.policy === policy) return;
    h.policy = policy;
    this.tech.history.policy(c, t, policy, announce);
  }

  // Um pais novo (independencia, rebeliao, guerra civil) leva consigo o conhecimento do pais de origem.
  inherit(child: Country, parent: Country): void {
    const day = this.sim.day;
    for (const id in parent.techs) {
      const h = parent.techs[id];
      if (h.stage !== 'conhecimento' && h.stage !== 'producao') continue;
      child.techs[id] = { stage: h.stage, progress: h.progress, source: 'heranca', since: day, acquired: day, supplier: parent.id, policy: h.policy };
    }
    child.science.education = parent.science.education;
    child.science.intelligence = parent.science.intelligence * 0.7;
    child.science.security = parent.science.security * 0.7;
    const share = parent.population + child.population > 0 ? child.population / (parent.population + child.population) : 0.1;
    const moved = Math.floor(parent.science.universities * share);
    child.science.universities = moved;
    parent.science.universities -= moved;
    this.tech.effects.compute(child);
  }

  // Pais extinto: seu conhecimento deixa de circular.
  clear(c: Country): void {
    c.techs = {};
    this.tech.effects.forget(c.id);
    this.tech.trade.cancelAll(c.id);
  }

  // Contagens e matriz de conhecimento (autoritativas; corrigidas periodicamente, e atualizadas pelos motores entre
  // uma correcao e outra).
  recount(): void {
    const s = this.sim.state;
    const n = s.countries.length;
    const records = TECHNOLOGIES.all.map((t) => s.technologies[t.id]);
    this.open.fill(0);
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      rec.holders = 0;
      rec.producers = 0;
      rec.importers = 0;
      rec.researchers = 0;
      const m = this.matrix[i];
      if (!m || m.length < n) this.matrix[i] = new Uint8Array(n + 32);
      else m.fill(0);
    }
    for (const c of s.countries) {
      if (!this.counted(c)) continue;
      for (const id in c.techs) {
        const i = TECHNOLOGIES.indexOf(id);
        if (i < 0) continue;
        const rec = records[i];
        const h = c.techs[id];
        if (h.stage === 'pesquisa') {
          rec.researchers++;
        } else if (h.stage === 'importacao') {
          rec.importers++;
        } else {
          rec.holders++;
          if (h.stage === 'producao') rec.producers++;
          const shares = h.policy !== 'segredo';
          this.matrix[i][c.id] = shares ? 2 : 1;
          if (shares) this.open[i]++;
        }
      }
    }
  }

  matrixOf(id: string): Uint8Array | undefined {
    const i = TECHNOLOGIES.indexOf(id);
    return i >= 0 ? this.matrix[i] : undefined;
  }

  countriesWith(id: string, stages: TechHolding['stage'][]): Country[] {
    const out: Country[] = [];
    for (const c of this.sim.state.countries) {
      if (!this.counted(c)) continue;
      const h = c.techs[id];
      if (h && stages.includes(h.stage)) out.push(c);
    }
    return out;
  }
}
