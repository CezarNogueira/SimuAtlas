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
import { bar, esc, icon, kv } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, kvGrid, sec, techDot, techLink, worldTechStatus } from './common';
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
    return `${icon('gear', 48)}
      <div class="titles">
        <h2>${esc(t.nome)}</h2>
        <div class="sub">${esc(t.categoria)} · ${esc(historicalEra(t.era).name)}</div>
        <div class="sub">${t.antiguidade ? `Herdada da Antiguidade (${yearLabel(t.anoDescoberta)})` : `Data histórica: ${t.anoDescoberta}`}</div>
      </div>
      <button class="px-btn square" data-close title="Fechar (Esc)">${icon('close', 16)}</button>`;
  }

  protected renderBody(): string {
    switch (this.tab) {
      case 'paises': return this.paises();
      case 'historico': return this.historico();
      default: return this.dados();
    }
  }

  private links(list: Country[], max = 6): string {
    if (!list.length) return '<span class="muted">nenhum</span>';
    const shown = list.slice(0, max).map((c) => cLink(this.sim, c.id)).join(', ');
    return list.length > max ? `${shown} <span class="muted">e mais ${list.length - max}</span>` : shown;
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

    const banner = rec.discovered
      ? `<div class="banner green">${techDot('dominada')} ${rec.preStart ? 'Já conhecida no início da simulação' : `Descoberta em ${rec.discoveryYear}`} · descobridor: ${cLink(sim, rec.discoverer)}</div>`
      : t.anoDescoberta <= year
        ? `<div class="banner gold">${techDot('desenvolvimento')} Já pode ser descoberta, mas nenhum país reúne ainda as condições</div>`
        : `<div class="banner red">${techDot('indisponivel')} Não disponível antes de ${t.anoDescoberta}</div>`;

    const diffusion = rec.holders / nations;
    const monopoly = !rec.discovered ? '—' : rec.holders <= 1 ? `Sim: só ${esc(sim.country(rec.discoverer)?.name ?? '—')} domina` : rec.monopolyEnded >= 0 ? `Terminou em ${sim.year(rec.monopolyEnded)}` : 'Não';
    const price = rec.discovered ? tech.trade.breakdown(t, null, null) : null;

    const dados = kvGrid([
      kv('gear', 'Nome', esc(t.nome)),
      kv('book', 'Era', esc(historicalEra(t.era).name)),
      kv('scroll', 'Ano de descoberta', t.antiguidade ? `Antiguidade (${yearLabel(t.anoDescoberta)})` : String(t.anoDescoberta)),
      kv('flag', 'Descobridor', rec.discovered ? `${cLink(sim, rec.discoverer)} <span class="muted">(${rec.discoveryYear})</span>` : '<span class="muted">ainda não descoberta</span>'),
      kv('info', 'Origem na história real', esc(t.paisDescobridor)),
      kv('crown', 'Proprietários atuais', fmtInt(producers.length)) + `<span></span><span class="list">${this.links(producers)}</span>`,
      kv('people', 'Países que dominam', `${fmtInt(rec.holders)} <span class="muted">(${fmtInt(rec.producers)} produzem)</span>`),
      kv('coins', 'Países que importam', fmtInt(importers.length)) + (importers.length ? `<span></span><span class="list">${this.links(importers)}</span>` : ''),
      kv('gear', 'Países pesquisando', fmtInt(researchers.length)),
      kv('chest', 'Preço estimado', price ? `${fmtMoney(price.total)}` : '—'),
      kv('globe', 'Nível de difusão', fmtPct(diffusion, 0)),
      `<span></span><div class="full">${bar(diffusion, 'var(--blue)')}</div>`,
      kv('chart', 'Complexidade', `${t.nivelComplexidade}/10`),
      kv('target', 'Raridade', `${t.raridade}/10`),
      kv('trophy', 'Valor estratégico', `${t.valorEstrategico}/10`),
      kv('book', 'Tempo para dominar', `${t.tempoParaDominar} meses de pesquisa`),
      kv('building', 'Tempo para produzir', `${t.tempoParaProduzir} meses`),
      kv('shield', 'Monopólio', monopoly),
      kv('info', 'Situação', rec.obsolete ? 'Obsoleta' : rec.discovered ? 'Em uso' : '—'),
    ]);

    const requisitos = kvGrid([
      kv('mountain', 'Recursos necessários', t.recursosNecessarios.length ? t.recursosNecessarios.map((r) => esc(RESOURCES[r].name)).join(', ') : 'nenhum'),
      kv('building', 'Infraestrutura necessária', t.infraestruturaNecessaria.length ? t.infraestruturaNecessaria.map((i) => esc(INFRA_TAGS[i])).join(', ') : 'nenhuma'),
    ]);

    const country = this.selectedCountry();
    const dot = (id: string) => {
      const other = tech.db.get(id);
      if (!other) return '';
      return country ? techDot(tech.status(country, id)) : techDot(worldTechStatus(sim, other));
    };
    const list = (ids: string[]) => (ids.length ? `<div class="rows">${ids.map((id) => `<div class="row">${dot(id)}${techLink(sim, id)}</div>`).join('')}</div>` : '<div class="muted">Nenhuma.</div>');

    const fx = Object.entries(scaledEffects(t));
    const efeitos = fx.length
      ? `<div class="rows">${fx.map(([k, v]) => `<div class="row"><span class="grow">${esc(EFFECT_LABELS[k as keyof TechEffects])}</span><span class="num pos">+${fmtPct(v ?? 0, 1)}</span></div>`).join('')}</div>`
      : '<div class="muted">Sem efeitos diretos: vale pelo que desbloqueia.</div>';

    const preco = price
      ? `<div class="kv">${kv('chest', 'Preço de referência', fmtMoney(price.total))}${kv('people', 'Custo base', `${fmtCompact(price.laborYears)} anos de trabalho`)}${kv('coins', 'Valor de um ano de trabalho', fmtMoney(price.moneyPerYear))}</div>
        <div class="rows" style="margin-top:4px">${price.factors.map(([label, f]) => `<div class="row"><span class="grow">${esc(label)}</span><span class="num">×${fmt2(f)}</span></div>`).join('')}</div>
        <div class="muted" style="margin:6px 0 2px">Composição do custo na economia da ${esc(sim.eras.current().name)}:</div>
        <div class="rows">${sim.eras.costBreakdown(price.total).map((p) => `<div class="row"><span class="grow">${esc(p.label)}</span><span class="num">${fmtMoney(p.value)}</span></div>`).join('')}</div>`
      : '<div class="muted">O preço só se forma depois da descoberta.</div>';

    let nacao = '';
    if (country) {
      const h = country.techs[t.id];
      const status = tech.status(country, t.id);
      const rows = [
        kv('flag', 'Nação', cLink(sim, country.id)),
        kv('info', 'Situação', `${techDot(status)} ${esc(h ? (h.stage === 'producao' && !t.importavel ? 'Aplica amplamente' : STAGE_LABELS[h.stage]) : STATUS_LABELS[status])}`),
      ];
      if (h && h.stage !== 'producao') {
        rows.push(kv('chart', h.stage === 'conhecimento' ? 'Adaptação produtiva' : 'Pesquisa própria', fmtPct(h.progress, 0)), `<span></span><div class="full">${bar(h.progress, 'var(--gold)')}</div>`);
      }
      if (h?.source) rows.push(kv('scroll', 'Como obteve', esc(ACQUISITION_LABELS[h.source])));
      if (h && h.supplier >= 0 && sim.country(h.supplier)) rows.push(kv('coins', h.stage === 'importacao' ? 'Fornecedor' : 'Origem', cLink(sim, h.supplier)));
      if (h?.stage === 'producao') rows.push(kv('shield', 'Política', esc(POLICY_LABELS[h.policy])));
      if (rec.discovered && !tech.knows(country, t.id)) {
        const sellers = tech.trade.sellers(t, country, ['aberta', 'licencia']);
        rows.push(kv('chest', 'Preço para esta nação', sellers.length ? fmtMoney(Math.min(...sellers.map((s) => tech.trade.price(t, s, country)))) : 'ninguém vende'));
      }
      const missing = t.tecnologiasDependentes.filter((id) => !tech.knows(country, id));
      if (missing.length && !tech.knows(country, t.id)) rows.push(kv('info', 'Falta dominar', missing.map((id) => techLink(sim, id)).join(', ')));
      nacao = sec(`Situação ${sim.countries.de(country.id)}`, 'flag', kvGrid(rows));
    }

    return (
      banner +
      `<div class="hint-box">${esc(t.descricao)}</div>` +
      nacao +
      sec('Tecnologia', 'gear', dados) +
      sec('Preço', 'chest', preco) +
      sec('Efeitos no país que a usa', 'chart', efeitos) +
      sec('Requisitos para produzir', 'building', requisitos) +
      sec('Depende de', 'book', list(t.tecnologiasDependentes)) +
      sec('Desbloqueia', 'book', list(t.tecnologiasDesbloqueadas)) +
      (t.substitui.length ? sec('Substitui', 'skull', list(t.substitui)) : '') +
      (t.substituidaPor.length ? sec('Substituída por', 'skull', list(t.substituidaPor)) : '')
    );
  }

  private paises(): string {
    const sim = this.sim;
    const own = sim.technology.ownership;
    const t = this.t;
    const table = (title: string, iconName: string, list: Country[], extra: (c: Country) => string) =>
      sec(
        `${title} (${list.length})`,
        iconName,
        list.length
          ? `<table class="mini-table"><tbody>${list.map((c) => `<tr><td>${cLink(sim, c.id)}</td><td class="num">${extra(c)}</td></tr>`).join('')}</tbody></table>`
          : '<div class="muted">Nenhum.</div>',
      );
    const bySince = (list: Country[]) => list.sort((a, b) => a.techs[t.id].since - b.techs[t.id].since);
    const since = (c: Country) => sim.year(Math.max(0, c.techs[t.id].since));
    return (
      table(t.importavel ? 'Produzem' : 'Aplicam amplamente', 'building', bySince(own.countriesWith(t.id, ['producao'])), (c) => `${esc(POLICY_LABELS[c.techs[t.id].policy])} · desde ${since(c)}`) +
      table('Conhecem e adaptam a produção', 'gear', bySince(own.countriesWith(t.id, ['conhecimento'])), (c) => `${fmtPct(c.techs[t.id].progress, 0)} · ${esc(ACQUISITION_LABELS[c.techs[t.id].source ?? 'pesquisa'])}`) +
      table('Importam', 'coins', bySince(own.countriesWith(t.id, ['importacao'])), (c) => `de ${esc(sim.country(c.techs[t.id].supplier)?.name ?? '—')}`) +
      table('Pesquisam', 'book', own.countriesWith(t.id, ['pesquisa']).sort((a, b) => b.techs[t.id].progress - a.techs[t.id].progress), (c) => fmtPct(c.techs[t.id].progress, 0))
    );
  }

  private historico(): string {
    const sim = this.sim;
    const t = this.t;
    const rec = sim.technology.record(t.id);
    if (!rec.log.length) return `<div class="empty">${rec.discovered ? 'Nenhum acontecimento registrado.' : `Esta tecnologia ainda não foi desenvolvida por nenhum país${t.anoDescoberta > sim.year() ? ` (não pode surgir antes de ${t.anoDescoberta})` : ''}.`}</div>`;
    const entries = [...rec.log].reverse();
    const rows = entries
      .map((e) => {
        const importance = e.type === 'descoberta' || e.type === 'monopolio' ? 3 : e.type === 'aquisicao' || e.type === 'producao' ? 2 : 1;
        const nav = e.country >= 0 && sim.country(e.country) ? `data-country="${e.country}"` : '';
        return `<div class="history-entry imp${importance}" ${nav}>${icon(LOG_ICONS[e.type], 16)}<span class="when">${sim.year(e.day)}</span><span>${esc(sim.technology.history.describe(t, e))}</span></div>`;
      })
      .join('');
    const condensed = rec.log.length >= 80 ? ' Os registros intermediários mais antigos foram condensados.' : '';
    return `<div class="muted" style="margin-bottom:4px">Trajetória completa, do registro mais recente ao mais antigo.${condensed}</div><div class="history-list">${rows}</div>`;
  }
}
