// TECHNOLOGY HISTORY ENGINE: trajetoria de cada tecnologia (descoberta, aquisicoes, producao, politicas, espionagem,
// fim do monopolio e obsolescencia) e os registros no historico geral do mundo. O registro de cada tecnologia guarda
// apenas dados compactos; os textos sao gerados sob demanda.
import { TECHNOLOGIES, type Technology } from '../../data/technologies';
import { withName } from '../../data/language';
import type { Country, TechAcquisition, TechLogEntry, TechLogType, TechPolicy } from '../../state/types';
import type { Simulation } from '../Simulation';
import type { TechnologyEngine } from './TechnologyEngine';

const MAX_LOG = 80;
const KEEP_FIRST = 20;
export const POLICIES: TechPolicy[] = ['aberta', 'licencia', 'exporta', 'segredo'];

export const POLICY_LABELS: Record<TechPolicy, string> = {
  aberta: 'Vende a tecnologia',
  licencia: 'Licencia com royalties',
  exporta: 'Só exporta produtos',
  segredo: 'Segredo',
};

export const ACQUISITION_LABELS: Record<TechAcquisition, string> = {
  descoberta: 'Descoberta',
  pre_existente: 'Conhecida antes do início',
  heranca: 'Herança do país de origem',
  compra: 'Compra',
  tratado: 'Tratado',
  licenciamento: 'Licenciamento',
  investimento: 'Investimento estrangeiro',
  espionagem: 'Espionagem',
  roubo: 'Roubo de tecnologia',
  guerra: 'Guerra',
  conquista: 'Conquista territorial',
  transferencia: 'Transferência científica',
  intercambio: 'Intercâmbio',
  universidades: 'Universidades',
  migracao: 'Migração de cientistas',
  pesquisa: 'Pesquisa própria',
  independente: 'Desenvolvimento independente',
  observador: 'Intervenção do observador',
};

const DIFFUSION_SOURCES = new Set<TechAcquisition>(['intercambio', 'universidades', 'migracao', 'transferencia', 'pesquisa', 'independente']);

export class TechnologyHistoryEngine {
  // Ligado durante a criacao do mundo: o conhecimento anterior ao inicio vira um unico resumo por tecnologia.
  muted = false;

  constructor(private sim: Simulation, private tech: TechnologyEngine) {}

  log(techId: string, type: TechLogType, country: number, other: number, source: TechAcquisition | null): void {
    const rec = this.sim.state.technologies[techId];
    if (!rec || this.muted) return;
    rec.log.push({ day: this.sim.day, type, country, other, source });
    if (rec.log.length > MAX_LOG) rec.log.splice(KEEP_FIRST, 1);
  }

  private S(id: number): string {
    return this.sim.countries.subject(id);
  }

  private v(id: number, singular: string, plural: string): string {
    return this.sim.countries.verb(id, singular, plural);
  }

  private with(id: number): string {
    const c = this.sim.country(id);
    return withName(c.name, c.article);
  }

  private para(id: number): string {
    const c = this.sim.country(id);
    return c.article ? `para ${c.article} ${c.name}` : `para ${c.name}`;
  }

  discovered(c: Country, t: Technology): void {
    const phrase = TECHNOLOGIES.phrase(t);
    const exclusive = t.importavel
      ? `${this.S(c.id)} agora ${this.v(c.id, 'possui', 'possuem')} a capacidade exclusiva de produzir essa tecnologia.`
      : `Por ora, só ${this.S(c.id)} ${this.v(c.id, 'domina', 'dominam')} esse conhecimento.`;
    const text = `Nova tecnologia: ${this.S(c.id)} ${this.v(c.id, 'desenvolveu', 'desenvolveram')} ${phrase}. ${exclusive}`;
    this.sim.history.add('tech', text, { countries: [c.id], importance: t.valorEstrategico >= 8 ? 3 : 2 });
  }

  acquired(c: Country, t: Technology, source: TechAcquisition, from: number, announce: boolean): void {
    const type: TechLogType = source === 'descoberta' ? 'descoberta' : source === 'pre_existente' ? 'pre_existente' : 'aquisicao';
    this.log(t.id, type, c.id, from, source);
    if (!announce || c.kind !== 'nation' || source === 'descoberta' || source === 'pre_existente' || source === 'heranca') return;
    const rec = this.sim.state.technologies[t.id];
    if (DIFFUSION_SOURCES.has(source)) {
      const age = this.sim.year() - rec.discoveryYear;
      if (t.valorEstrategico < 6 || age > 40 || c.provinceCount < 3) return;
    }
    const importance: 1 | 2 = source === 'roubo' || source === 'guerra' || source === 'conquista' || (t.valorEstrategico >= 9 && rec.holders <= 3) ? 2 : 1;
    this.sim.history.add(source === 'roubo' ? 'espionage' : 'tech', this.acquisitionText(c.id, t, source, from), {
      countries: from >= 0 ? [c.id, from] : [c.id],
      importance,
    });
  }

  acquisitionText(id: number, t: Technology, source: TechAcquisition, from: number): string {
    const S = this.S(id);
    const phrase = TECHNOLOGIES.phrase(t);
    const of = TECHNOLOGIES.ofPhrase(t);
    const de = (x: number) => this.sim.countries.de(x);
    const hasFrom = from >= 0 && !!this.sim.country(from);
    switch (source) {
      case 'compra':
        return hasFrom ? `${S} ${this.v(id, 'adquiriu', 'adquiriram')} a tecnologia ${of} por meio de um acordo comercial ${this.with(from)}.` : `${S} ${this.v(id, 'comprou', 'compraram')} a tecnologia ${of}.`;
      case 'tratado':
        return `${S} ${this.v(id, 'recebeu', 'receberam')} a tecnologia ${of} por um tratado de cooperação${hasFrom ? ` ${this.with(from)}` : ''}.`;
      case 'licenciamento':
        return `${S} ${this.v(id, 'licenciou', 'licenciaram')} a tecnologia ${of}${hasFrom ? ` ${de(from)}` : ''}, pagando royalties.`;
      case 'investimento':
        return hasFrom ? `Investimentos ${de(from)} levaram ${phrase} ${this.sim.countries.to(id)}.` : `${S} ${this.v(id, 'recebeu', 'receberam')} ${phrase} por meio de investimento estrangeiro.`;
      case 'roubo':
        return `${S} ${this.v(id, 'roubou', 'roubaram')} a tecnologia ${of}${hasFrom ? ` ${de(from)}` : ''}.`;
      case 'espionagem':
        return `Espiões ${de(id)} obtiveram documentos secretos sobre ${phrase}${hasFrom ? ` ${this.sim.countries.in(from)}` : ''}.`;
      case 'guerra':
        return `${S} ${this.v(id, 'capturou', 'capturaram')} cientistas e fábricas${hasFrom ? ` ${de(from)}` : ''} e ${this.v(id, 'passou', 'passaram')} a dominar ${phrase}.`;
      case 'conquista':
        return `Ao conquistar territórios${hasFrom ? ` ${de(from)}` : ''}, ${S} ${this.v(id, 'absorveu', 'absorveram')} o conhecimento ${of}.`;
      case 'transferencia':
        return `${S} ${this.v(id, 'recebeu', 'receberam')} ${phrase} por transferência científica${hasFrom ? ` ${de(from)}` : ''}.`;
      case 'intercambio':
        return hasFrom ? `O intercâmbio ${this.with(from)} levou ${phrase} ${this.sim.countries.to(id)}.` : `${S} ${this.v(id, 'assimilou', 'assimilaram')} ${phrase} pelo intercâmbio comercial.`;
      case 'universidades':
        return `Universidades ${de(id)} difundiram o conhecimento ${of}.`;
      case 'migracao':
        return `Cientistas${hasFrom ? ` ${de(from)}` : ''} emigraram ${this.para(id)} e levaram consigo o conhecimento ${of}.`;
      case 'pesquisa':
        return `${S} ${this.v(id, 'dominou', 'dominaram')} ${phrase} com pesquisa própria.`;
      case 'independente':
        return `${S} ${this.v(id, 'desenvolveu', 'desenvolveram')} ${phrase} de forma independente.`;
      case 'observador':
        return `Intervenção do observador: ${S} ${this.v(id, 'recebeu', 'receberam')} ${phrase}.`;
      case 'heranca':
        return `${S} ${this.v(id, 'herdou', 'herdaram')} o conhecimento ${of}${hasFrom ? ` ${de(from)}` : ''}.`;
      case 'pre_existente':
        return `${S} já ${this.v(id, 'conhecia', 'conheciam')} ${phrase} no início da simulação.`;
      case 'descoberta':
        return `${S} ${this.v(id, 'desenvolveu', 'desenvolveram')} ${phrase}.`;
    }
  }

  production(c: Country, t: Technology, announce: boolean): void {
    this.log(t.id, 'producao', c.id, -1, null);
    if (!announce || c.kind !== 'nation' || c.provinceCount < 2) return;
    const rec = this.sim.state.technologies[t.id];
    if (rec.producers > 5 && t.valorEstrategico < 7) return;
    const text = t.importavel
      ? `${this.S(c.id)} ${this.v(c.id, 'desenvolveu', 'desenvolveram')} sua própria capacidade de produção ${TECHNOLOGIES.ofPhrase(t)}.`
      : `${this.S(c.id)} ${this.v(c.id, 'passou', 'passaram')} a aplicar amplamente ${TECHNOLOGIES.phrase(t)}.`;
    this.sim.history.add('tech', text, {
      countries: [c.id],
      importance: 1,
    });
  }

  importStarted(c: Country, t: Technology, supplier: number): void {
    this.log(t.id, 'importacao', c.id, supplier, null);
  }

  policy(c: Country, t: Technology, policy: TechPolicy, announce: boolean): void {
    this.log(t.id, 'politica', c.id, POLICIES.indexOf(policy), null);
    if (!announce || c.kind !== 'nation') return;
    this.sim.history.add('tech', this.policyText(c.id, t, policy), { countries: [c.id], importance: 1 });
  }

  policyText(id: number, t: Technology, policy: TechPolicy): string {
    const S = this.S(id);
    const phrase = TECHNOLOGIES.phrase(t);
    switch (policy) {
      case 'segredo': return `${S} ${this.v(id, 'decidiu', 'decidiram')} manter ${phrase} em segredo.`;
      case 'aberta': return `${S} ${this.v(id, 'abriu', 'abriram')} a tecnologia ${TECHNOLOGIES.ofPhrase(t)} ao mercado internacional.`;
      case 'licencia': return `${S} ${this.v(id, 'passou', 'passaram')} a licenciar ${phrase} a outros países.`;
      case 'exporta': return `${S} ${this.v(id, 'passou', 'passaram')} a exportar produtos ${TECHNOLOGIES.ofPhrase(t)}, sem vender a tecnologia.`;
    }
  }

  espionagePartial(spy: Country, victim: Country, t: Technology): void {
    this.log(t.id, 'aquisicao', spy.id, victim.id, 'espionagem');
    this.sim.history.add('espionage', this.acquisitionText(spy.id, t, 'espionagem', victim.id), { countries: [spy.id, victim.id], importance: 1 });
  }

  espionageFailed(spy: Country, victim: Country, t: Technology): void {
    this.log(t.id, 'espionagem_fracassada', spy.id, victim.id, null);
    this.sim.history.add('espionage', `Espiões ${this.sim.countries.de(spy.id)} foram presos ${this.sim.countries.in(victim.id)} tentando roubar a tecnologia ${TECHNOLOGIES.ofPhrase(t)}.`, {
      countries: [spy.id, victim.id],
      importance: 2,
    });
  }

  // Texto de um registro da trajetoria de uma tecnologia (painel de tecnologia).
  describe(t: Technology, e: TechLogEntry): string {
    const phrase = TECHNOLOGIES.phrase(t);
    const valid = (id: number) => id >= 0 && !!this.sim.country(id);
    switch (e.type) {
      case 'descoberta':
        return valid(e.country) ? `${this.S(e.country)} ${this.v(e.country, 'desenvolveu', 'desenvolveram')} ${phrase} e ${this.v(e.country, 'passou', 'passaram')} a deter o monopólio.` : `${phrase} foi desenvolvida.`;
      case 'pre_existente':
        return `Já conhecida por ${e.other} ${e.other === 1 ? 'país' : 'países'} no início da simulação${valid(e.country) ? `; a origem foi atribuída ${this.sim.countries.to(e.country)}` : ''}.`;
      case 'aquisicao':
        return valid(e.country) && e.source ? this.acquisitionText(e.country, t, e.source, e.other) : 'Aquisição da tecnologia.';
      case 'producao':
        if (!valid(e.country)) return t.importavel ? 'Produção iniciada.' : 'Aplicação ampliada.';
        return t.importavel
          ? `${this.S(e.country)} ${this.v(e.country, 'iniciou', 'iniciaram')} a produção em larga escala.`
          : `${this.S(e.country)} ${this.v(e.country, 'passou', 'passaram')} a aplicar amplamente esse conhecimento.`;
      case 'importacao':
        return valid(e.country) ? `${this.S(e.country)} ${this.v(e.country, 'passou', 'passaram')} a importar produtos${valid(e.other) ? ` ${this.sim.countries.de(e.other)}` : ''}.` : 'Importação iniciada.';
      case 'politica':
        return valid(e.country) ? this.policyText(e.country, t, POLICIES[e.other] ?? 'licencia') : 'Mudança de política.';
      case 'espionagem_fracassada':
        return valid(e.country) ? `Espiões ${this.sim.countries.de(e.country)} foram presos${valid(e.other) ? ` ${this.sim.countries.in(e.other)}` : ''} tentando roubar a tecnologia.` : 'Tentativa de espionagem fracassada.';
      case 'monopolio':
        return valid(e.country) ? `Fim do monopólio: ${this.S(e.country)} ${this.v(e.country, 'tornou-se', 'tornaram-se')} o segundo país a dominar ${phrase}.` : 'Fim do monopólio.';
      case 'obsoleta':
        return `${t.nome} tornou-se obsoleta, substituída por tecnologias mais novas.`;
    }
  }
}
