// TECHNOLOGY EFFECTS ENGINE: soma os efeitos reais das tecnologias usadas por cada pais. A producao propria vale
// integralmente; o conhecimento ainda sem producao e a importacao de produtos valem parcialmente; uma tecnologia
// substituida por outra mais nova que o pais ja usa deixa de contar. Tambem calcula o nivel tecnologico do pais na
// escala usada pela economia, pela populacao e pelos exercitos, e o grau de industrializacao. O recalculo e feito sob
// demanda: mudancas marcam o pais, e os efeitos sao refeitos na proxima consulta ou no fim do ciclo mensal.
import { clamp } from '../../core/math';
import { levelOfYear } from '../../data/eras';
import { TECHNOLOGIES, emptyEffects, type TechEffects, type Technology } from '../../data/technologies';
import type { Country, TechStage } from '../../state/types';
import type { Simulation } from '../Simulation';
import type { TechnologyEngine } from './TechnologyEngine';

const STAGE_WEIGHT: Record<TechStage, number> = { pesquisa: 0, importacao: 0.5, conhecimento: 0.35, producao: 1 };
const LEVEL_WEIGHT: Record<TechStage, number> = { pesquisa: 0, importacao: 0.25, conhecimento: 0.85, producao: 1 };

// Calibracao: converte os valores do banco na intensidade aplicada pela simulacao (com todas as tecnologias do
// seculo XXI, o poder militar e a produtividade chegam perto do dobro dos de um pais medieval).
export const EFFECT_SCALE: TechEffects = {
  military: 0.5, defense: 0.65, siege: 1, transport: 0.7, naval: 0.8, economy: 0.55, industry: 0.5,
  agriculture: 0.5, infrastructure: 2, administration: 0.6, research: 0.5, medicine: 0.25, education: 1,
};

// Importar produtos prontos nao forma cientistas nem administradores.
const KNOWLEDGE_KEYS = new Set<keyof TechEffects>(['research', 'education', 'administration']);

interface TechFxData {
  levelIncrement: number; // avanco da curva historica desde a tecnologia anterior
  keys: (keyof TechEffects)[];
  values: number[]; // ja na escala aplicada
  knowledge: boolean[];
  successors: string[];
}

// Dados de efeito pre-processados de cada tecnologia.
const FX_DATA: Map<string, TechFxData> = (() => {
  const map = new Map<string, TechFxData>();
  let prev = 0;
  for (const t of TECHNOLOGIES.all) {
    const level = levelOfYear(t.anoDescoberta);
    const keys = Object.keys(t.efeitos) as (keyof TechEffects)[];
    map.set(t.id, {
      levelIncrement: Math.max(0, level - prev),
      keys,
      values: keys.map((k) => (t.efeitos[k] ?? 0) * EFFECT_SCALE[k]),
      knowledge: keys.map((k) => KNOWLEDGE_KEYS.has(k)),
      successors: t.substituidaPor,
    });
    prev = Math.max(prev, level);
  }
  return map;
})();

// Efeitos de uma tecnologia ja na escala aplicada pela simulacao (usado pela interface e pelo mercado).
export function scaledEffects(t: Technology): Partial<TechEffects> {
  const out: Partial<TechEffects> = {};
  for (const k in t.efeitos) {
    const key = k as keyof TechEffects;
    out[key] = (t.efeitos[key] ?? 0) * EFFECT_SCALE[key];
  }
  return out;
}

export class TechnologyEffectsEngine {
  private cache = new Map<number, TechEffects>();
  private dirty = new Set<number>();

  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  // Efeitos em vigor. Mudancas no meio do mes passam a valer no fechamento do ciclo mensal (flush).
  of(c: Country): TechEffects {
    return this.cache.get(c.id) ?? this.compute(c);
  }

  stageWeight(c: Country, id: string): number {
    const h = c.techs[id];
    return h ? STAGE_WEIGHT[h.stage] : 0;
  }

  // Marca o pais para recalculo (na proxima consulta ou no fim do ciclo mensal).
  refresh(c: Country): void {
    this.dirty.add(c.id);
  }

  // Recalcula imediatamente efeitos, nivel tecnologico e industrializacao.
  compute(c: Country): TechEffects {
    const fx = emptyEffects();
    let level = 0;
    for (const id in c.techs) {
      const data = FX_DATA.get(id);
      if (!data) continue;
      const h = c.techs[id];
      level += data.levelIncrement * LEVEL_WEIGHT[h.stage];
      const w = STAGE_WEIGHT[h.stage];
      if (w <= 0 || !data.keys.length) continue;
      let superseded = false;
      for (const s of data.successors) {
        if (this.stageWeight(c, s) >= w) {
          superseded = true;
          break;
        }
      }
      if (superseded) continue;
      const importing = h.stage === 'importacao';
      for (let i = 0; i < data.keys.length; i++) {
        fx[data.keys[i]] += data.values[i] * (importing && data.knowledge[i] ? 0.1 : w);
      }
    }
    c.tech = level;
    c.science.industrialization = clamp(fx.industry / 0.45, 0, 1) * clamp(this.tech.devIndex(c) / 10, 0.3, 1);
    this.cache.set(c.id, fx);
    this.dirty.delete(c.id);
    return fx;
  }

  flush(): void {
    for (const id of [...this.dirty]) {
      const c = this.sim.country(id);
      if (c?.alive) this.compute(c);
      else this.dirty.delete(id);
    }
  }

  refreshAll(): void {
    this.cache.clear();
    this.dirty.clear();
    for (const c of this.sim.state.countries) if (c.alive) this.compute(c);
  }

  forget(id: number): void {
    this.cache.delete(id);
    this.dirty.delete(id);
  }
}
