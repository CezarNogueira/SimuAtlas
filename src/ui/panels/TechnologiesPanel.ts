// Painel de tecnologias: o banco completo por era e categoria, com a situacao de cada tecnologia no mundo e na nacao
// selecionada. Clique em uma tecnologia para ver dados, preco, difusao, paises e a trajetoria completa.
import { HISTORICAL_ERAS, eraSpan } from '../../data/eras';
import { TECH_CATEGORIES } from '../../data/technologies';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { sec, techDot, worldTechStatus } from './common';
import { BasePanel } from './Panel';

type TechFilter = 'todas' | 'descobertas' | 'pendentes' | 'futuras' | 'pais';

export class TechnologiesPanel extends BasePanel {
  private era: string;
  private category = '';
  private filter: TechFilter = 'todas';
  private search = '';

  constructor(ui: GameUI) {
    super(ui, 'left');
    this.era = ui.sim.eras.current().id;
  }

  protected close(): void {
    this.ui.closeLeft();
  }

  protected renderHead(): string {
    const sim = this.sim;
    const db = sim.technology.db;
    let discovered = 0;
    for (const t of db.all) if (sim.state.technologies[t.id].discovered) discovered++;
    return `${icon('gear', 36)}<div class="titles"><h2>Tecnologias</h2><div class="sub">${esc(sim.eras.current().name)} · ${discovered} descobertas de ${db.countUntil(sim.year())} possíveis · ${db.size} no banco</div></div>
      <button class="px-btn square" data-close title="Fechar (T)">${icon('close', 16)}</button>`;
  }

  protected action(name: string, target: HTMLElement): void {
    const value = (target as HTMLInputElement | HTMLSelectElement).value;
    if (name === 'era') this.era = value;
    else if (name === 'category') this.category = value;
    else if (name === 'filter') this.filter = value as TechFilter;
    else if (name === 'search') this.search = value.trim().toLowerCase();
    else return;
    this.refresh();
  }

  protected renderBody(): string {
    const sim = this.sim;
    const tech = sim.technology;
    const year = sim.year();
    const selected = this.ui.renderer.selectedCountry;
    const country = selected >= 0 && sim.country(selected)?.alive ? sim.country(selected) : null;
    if (this.filter === 'pais' && !country) this.filter = 'todas';
    const option = (value: string, label: string, current: string) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
    const eraOpts = option('', 'Todas as eras', this.era) + HISTORICAL_ERAS.map((e) => option(e.id, `${e.name} (${eraSpan(e)})`, this.era)).join('');
    const catOpts = option('', 'Todas as categorias', this.category) + TECH_CATEGORIES.map((c) => option(c, c, this.category)).join('');
    const filters: [TechFilter, string][] = [['todas', 'Todas'], ['descobertas', 'Já descobertas'], ['pendentes', 'Possíveis, não descobertas'], ['futuras', 'Antes da data histórica']];
    if (country) filters.push(['pais', `Dominadas por ${country.name}`]);
    const filterOpts = filters.map(([v, l]) => option(v, l, this.filter)).join('');
    const controls = `
      <div class="tech-filters">
        <select class="px-select" data-change="era">${eraOpts}</select>
        <select class="px-select" data-change="category">${catOpts}</select>
        <select class="px-select" data-change="filter">${filterOpts}</select>
        <input class="px-input" data-change="search" placeholder="Buscar tecnologia" value="${esc(this.search)}">
      </div>
      <div class="tech-legend">${techDot('dominada')} Dominada ${techDot('desenvolvimento')} Em desenvolvimento ${techDot('indisponivel')} Não disponível</div>
      <div class="muted">${country ? `1º marcador: situação no mundo · 2º marcador: situação ${esc(sim.countries.in(country.id))}.` : 'Marcador: situação no mundo. Selecione uma nação no mapa para ver também a situação dela.'}</div>`;

    const groups = new Map<string, string[]>();
    for (const t of tech.db.all) {
      if (this.era && t.era !== this.era) continue;
      if (this.category && t.categoria !== this.category) continue;
      if (this.search && !t.nome.toLowerCase().includes(this.search)) continue;
      const rec = sim.state.technologies[t.id];
      if (this.filter === 'descobertas' && !rec.discovered) continue;
      if (this.filter === 'pendentes' && (rec.discovered || t.anoDescoberta > year)) continue;
      if (this.filter === 'futuras' && t.anoDescoberta <= year) continue;
      if (this.filter === 'pais' && (!country || !tech.knows(country, t.id))) continue;
      const own = country ? techDot(tech.status(country, t.id)) : '';
      const info = rec.discovered ? `${rec.holders} ${rec.holders === 1 ? 'país' : 'países'}` : t.anoDescoberta > year ? 'futura' : 'por descobrir';
      const when = t.antiguidade ? 'Antiguidade' : String(t.anoDescoberta);
      const list = groups.get(t.era) ?? [];
      list.push(`<div class="row link" data-tech="${esc(t.id)}">${techDot(worldTechStatus(sim, t))}${own}<span class="grow">${esc(t.nome)}</span><span class="muted">${when} · ${info}</span></div>`);
      groups.set(t.era, list);
    }
    const sections = HISTORICAL_ERAS.filter((e) => groups.has(e.id))
      .map((e) => sec(`${e.name} (${groups.get(e.id)?.length ?? 0})`, 'gear', `<div class="rows">${(groups.get(e.id) ?? []).join('')}</div>`))
      .join('');
    return controls + (sections || '<div class="empty">Nenhuma tecnologia encontrada.</div>');
  }
}
