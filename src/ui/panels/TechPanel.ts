// Painel de uma tecnologia: dados do banco, descobridor, proprietarios, quem domina e quem importa, preco estimado
// (fatores e composicao do custo na economia da epoca), difusao, requisitos, efeitos, situacao da nacao selecionada
// e a trajetoria completa da tecnologia no mundo.
import { fmt2, fmtCompact, fmtInt, fmtMoney, fmtPct } from '../../core/format';
import { historicalEra } from '../../data/eras';
import { RESOURCES } from '../../data/resources';
import { EFFECT_LABELS, INFRA_TAGS, type TechEffects, type Technology } from '../../data/technologies';
import { scaledEffects } from '../../sim/technology/TechnologyEffectsEngine';
import { STATUS_LABELS } from '../../sim/technology/TechnologyEngine';
import { ACQUISITION_LABELS, POLICY_LABELS } from '../../sim/technology/TechnologyHistoryEngine';
import type { Country, TechHolding, TechLogType } from '../../state/types';
import {
  banner,
  barRow,
  closeButton,
  COLORS,
  empty,
  grow,
  headTitles,
  hint,
  kv,
  kvGrid,
  kvItems,
  kvList,
  muted,
  mutedBlock,
  num,
  row,
  ROWS,
  rows,
  section,
  sub,
  table,
  td,
} from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, techDot, techLink, timelineEntry, TIMELINE, worldTechStatus } from './common';
import { BasePanel } from './Panel';

const STAGE_LABELS: Record<TechHolding['stage'], string> = {
  pesquisa: 'Em pesquisa',
  importacao: 'Importa produtos prontos',
  conhecimento: 'Conhece e adapta a produção',
  producao: 'Produz em larga escala',
};

const LOG_ICONS: Record<TechLogType, string> = {
  descoberta: 'trophy',
  pre_existente: 'book',
  aquisicao: 'scroll',
  producao: 'building',
  importacao: 'coins',
  politica: 'shield',
  espionagem_fracassada: 'target',
  monopolio: 'crown',
  obsoleta: 'skull',
};

const yearLabel = (year: number) => (year < 0 ? `${-year} a.C.` : String(year));

export class TechPanel extends BasePanel {
  constructor(ui: GameUI, readonly techId: string) {
    super(ui, 'right');
    this.tab = 'dados';
  }

  private get t(): Technology {
    return this.sim.technology.db.get(this.techId) as Technology;
  }

  protected alive(): boolean {
    return !!this.sim.technology.db.get(this.techId);
  }

  protected close(): void {
    this.ui.closeRight();
  }

  protected tabs(): [string, string][] {
    return [['dados', 'Dados'], ['paises', 'Países'], ['historico', 'Histórico']];
  }

  protected renderHead(): string {
    const t = this.t;
    const subs = [`${esc(t.categoria)} · ${esc(historicalEra(t.era).name)}`, t.antiguidade ? `Herdada da Antiguidade (${yearLabel(t.anoDescoberta)})` : `Data histórica: ${t.anoDescoberta}`];
    return `${icon('gear', 48)}${headTitles(esc(t.nome), subs)}${closeButton('Fechar (Esc)')}`;
  }

  protected renderBody(): string {
    switch (this.tab) {
      case 'paises': return this.paises();
      case 'historico': return this.historico();
      default: return this.dados();
    }
  }

  // Ate `max` nacoes como links, e um aviso de quantas faltam.
  private links(list: Country[], max = 6): string[] {
    const shown = list.slice(0, max).map((c) => cLink(this.sim, c.id));
    if (list.length > max) shown.push(muted(`e mais ${list.length - max}`));
    return shown;
  }

  private selectedCountry(): Country | null {
    const id = this.ui.renderer.selectedCountry;
    const c = id >= 0 ? this.sim.country(id) : undefined;
    return c?.alive ? c : null;
  }

  private dados(): string {
    const sim = this.sim;
    const tech = sim.technology;
    const t = this.t;
    const rec = tech.record(t.id);
    const year = sim.year();
    const nations = Math.max(1, tech.nationCount());
    const own = tech.ownership;
    const producers = own.countriesWith(t.id, ['producao']);
    const importers = own.countriesWith(t.id, ['importacao']);
    const researchers = own.countriesWith(t.id, ['pesquisa']);

    const status = rec.discovered
      ? banner(`${techDot('dominada')} ${rec.preStart ? 'Já conhecida no início da simulação' : `Descoberta em ${rec.discoveryYear}`} · descobridor: ${cLink(sim, rec.discoverer)}`, 'green')
      : t.anoDescoberta <= year
        ? banner(`${techDot('desenvolvimento')} Já pode ser descoberta, mas nenhum país reúne ainda as condições`, 'gold')
        : banner(`${techDot('indisponivel')} Não disponível antes de ${t.anoDescoberta}`, 'red');

    const diffusion = rec.holders / nations;
    const monopoly = !rec.discovered ? '—' : rec.holders <= 1 ? `Sim${sub(`só ${esc(sim.country(rec.discoverer)?.name ?? '—')} domina`)}` : rec.monopolyEnded >= 0 ? `Terminou em ${sim.year(rec.monopolyEnded)}` : 'Não';
    const price = rec.discovered ? tech.trade.breakdown(t, null, null) : null;

    const dados = kvGrid([
      kv('gear', 'Nome', esc(t.nome)),
      kv('book', 'Era', esc(historicalEra(t.era).name)),
      kv('scroll', 'Ano de descoberta', t.antiguidade ? `Antiguidade${sub(yearLabel(t.anoDescoberta))}` : String(t.anoDescoberta)),
      kv('flag', 'Descobridor', rec.discovered ? `${cLink(sim, rec.discoverer)}${sub(`em ${rec.discoveryYear}`)}` : muted('ainda não descoberta')),
      kv('info', 'Origem na história real', esc(t.paisDescobridor)),
      kv('crown', 'Proprietários atuais', fmtInt(producers.length)) + (producers.length ? kvItems(this.links(producers)) : ''),
      kv('people', 'Países que dominam', `${fmtInt(rec.holders)}${sub(`${fmtInt(rec.producers)} produzem`)}`),
      kv('coins', 'Países que importam', fmtInt(importers.length)) + (importers.length ? kvItems(this.links(importers)) : ''),
      kv('gear', 'Países pesquisando', fmtInt(researchers.length)),
      kv('chest', 'Preço estimado', price ? fmtMoney(price.total) : '—'),
      kv('globe', 'Nível de difusão', fmtPct(diffusion, 0)),
      barRow(diffusion, COLORS.blue),
      kv('chart', 'Complexidade', `${t.nivelComplexidade}/10`),
      kv('target', 'Raridade', `${t.raridade}/10`),
      kv('trophy', 'Valor estratégico', `${t.valorEstrategico}/10`),
      kv('book', 'Tempo para dominar', `${t.tempoParaDominar} meses de pesquisa`),
      kv('building', 'Tempo para produzir', `${t.tempoParaProduzir} meses`),
      kv('shield', 'Monopólio', monopoly),
      kv('info', 'Situação', rec.obsolete ? 'Obsoleta' : rec.discovered ? 'Em uso' : '—'),
    ]);

    const requisitos = kvGrid([
      kvList('mountain', 'Recursos necessários', t.recursosNecessarios.map((r) => esc(RESOURCES[r].name))),
      kvList('building', 'Infraestrutura necessária', t.infraestruturaNecessaria.map((i) => esc(INFRA_TAGS[i])), muted('nenhuma')),
    ]);

    const country = this.selectedCountry();
    const dot = (id: string) => {
      const other = tech.db.get(id);
      if (!other) return '';
      return country ? techDot(tech.status(country, id)) : techDot(worldTechStatus(sim, other));
    };
    const list = (ids: string[]) => (ids.length ? rows(ids.map((id) => row(`${dot(id)}${techLink(sim, id)}`)).join('')) : mutedBlock('Nenhuma.'));

    const fx = Object.entries(scaledEffects(t));
    const efeitos = fx.length
      ? rows(fx.map(([k, v]) => row(`${grow(esc(EFFECT_LABELS[k as keyof TechEffects]))}${num(`+${fmtPct(v ?? 0, 1)}`, 'text-pos')}`)).join(''))
      : mutedBlock('Sem efeitos diretos: vale pelo que desbloqueia.');

    const preco = price
      ? kvGrid([kv('chest', 'Preço de referência', fmtMoney(price.total)), kv('people', 'Custo base', `${fmtCompact(price.laborYears)} anos de trabalho`), kv('coins', 'Valor de um ano de trabalho', fmtMoney(price.moneyPerYear))]) +
        `<div class="${ROWS} mt-1">${price.factors.map(([label, f]) => row(`${grow(esc(label))}${num(`×${fmt2(f)}`)}`)).join('')}</div>` +
        mutedBlock(`Composição do custo na economia da ${esc(sim.eras.current().name)}:`, 'mt-1.5 mb-0.5') +
        rows(sim.eras.costBreakdown(price.total).map((p) => row(`${grow(esc(p.label))}${num(fmtMoney(p.value))}`)).join(''))
      : mutedBlock('O preço só se forma depois da descoberta.');

    let nacao = '';
    if (country) {
      const h = country.techs[t.id];
      const st = tech.status(country, t.id);
      const items = [
        kv('flag', 'Nação', cLink(sim, country.id)),
        kv('info', 'Situação', `${techDot(st)} ${esc(h ? (h.stage === 'producao' && !t.importavel ? 'Aplica amplamente' : STAGE_LABELS[h.stage]) : STATUS_LABELS[st])}`),
      ];
      if (h && h.stage !== 'producao') {
        items.push(kv('chart', h.stage === 'conhecimento' ? 'Adaptação produtiva' : 'Pesquisa própria', fmtPct(h.progress, 0)), barRow(h.progress, COLORS.gold));
      }
      if (h?.source) items.push(kv('scroll', 'Como obteve', esc(ACQUISITION_LABELS[h.source])));
      if (h && h.supplier >= 0 && sim.country(h.supplier)) items.push(kv('coins', h.stage === 'importacao' ? 'Fornecedor' : 'Origem', cLink(sim, h.supplier)));
      if (h?.stage === 'producao') items.push(kv('shield', 'Política', esc(POLICY_LABELS[h.policy])));
      if (rec.discovered && !tech.knows(country, t.id)) {
        const sellers = tech.trade.sellers(t, country, ['aberta', 'licencia']);
        items.push(kv('chest', 'Preço para esta nação', sellers.length ? fmtMoney(Math.min(...sellers.map((s) => tech.trade.price(t, s, country)))) : 'ninguém vende'));
      }
      const missing = t.tecnologiasDependentes.filter((id) => !tech.knows(country, id));
      if (missing.length && !tech.knows(country, t.id)) items.push(kvList('info', 'Falta dominar', missing.map((id) => techLink(sim, id))));
      nacao = section(`Situação ${sim.countries.de(country.id)}`, 'flag', kvGrid(items));
    }

    return (
      status +
      hint(esc(t.descricao)) +
      nacao +
      section('Tecnologia', 'gear', dados) +
      section('Preço', 'chest', preco) +
      section('Efeitos no país que a usa', 'chart', efeitos) +
      section('Requisitos para produzir', 'building', requisitos) +
      section('Depende de', 'book', list(t.tecnologiasDependentes)) +
      section('Desbloqueia', 'book', list(t.tecnologiasDesbloqueadas)) +
      (t.substitui.length ? section('Substitui', 'skull', list(t.substitui)) : '') +
      (t.substituidaPor.length ? section('Substituída por', 'skull', list(t.substituidaPor)) : '')
    );
  }

  private paises(): string {
    const sim = this.sim;
    const own = sim.technology.ownership;
    const t = this.t;
    const listTable = (title: string, iconName: string, list: Country[], extra: (c: Country) => string) =>
      section(
        `${title} (${list.length})`,
        iconName,
        list.length ? table([], list.map((c) => `<tr>${td(cLink(sim, c.id))}${td(extra(c), false, 'text-right text-ink-soft')}</tr>`).join('')) : mutedBlock('Nenhum.'),
      );
    const bySince = (list: Country[]) => list.sort((a, b) => a.techs[t.id].since - b.techs[t.id].since);
    const since = (c: Country) => sim.year(Math.max(0, c.techs[t.id].since));
    return (
      listTable(t.importavel ? 'Produzem' : 'Aplicam amplamente', 'building', bySince(own.countriesWith(t.id, ['producao'])), (c) => `${esc(POLICY_LABELS[c.techs[t.id].policy])} · desde ${since(c)}`) +
      listTable('Conhecem e adaptam a produção', 'gear', bySince(own.countriesWith(t.id, ['conhecimento'])), (c) => `${fmtPct(c.techs[t.id].progress, 0)} · ${esc(ACQUISITION_LABELS[c.techs[t.id].source ?? 'pesquisa'])}`) +
      listTable('Importam', 'coins', bySince(own.countriesWith(t.id, ['importacao'])), (c) => `de ${esc(sim.country(c.techs[t.id].supplier)?.name ?? '—')}`) +
      listTable('Pesquisam', 'book', own.countriesWith(t.id, ['pesquisa']).sort((a, b) => b.techs[t.id].progress - a.techs[t.id].progress), (c) => fmtPct(c.techs[t.id].progress, 0))
    );
  }

  private historico(): string {
    const sim = this.sim;
    const t = this.t;
    const rec = sim.technology.record(t.id);
    if (!rec.log.length) {
      return empty(rec.discovered ? 'Nenhum acontecimento registrado.' : `Esta tecnologia ainda não foi desenvolvida por nenhum país${t.anoDescoberta > sim.year() ? ` (não pode surgir antes de ${t.anoDescoberta})` : ''}.`);
    }
    const entries = [...rec.log].reverse();
    const lines = entries
      .map((e) => {
        const importance = e.type === 'descoberta' || e.type === 'monopolio' ? 3 : e.type === 'aquisicao' || e.type === 'producao' ? 2 : 1;
        const nav = e.country >= 0 && sim.country(e.country) ? `data-country="${e.country}"` : '';
        return timelineEntry(LOG_ICONS[e.type], String(sim.year(e.day)), esc(sim.technology.history.describe(t, e)), importance, nav);
      })
      .join('');
    const condensed = rec.log.length >= 80 ? ' Os registros intermediários mais antigos foram condensados.' : '';
    return mutedBlock(`Trajetória completa, do registro mais recente ao mais antigo.${condensed}`, 'mb-1') + `<div class="${TIMELINE}">${lines}</div>`;
  }
}
