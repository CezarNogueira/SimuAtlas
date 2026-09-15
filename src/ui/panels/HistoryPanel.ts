// Historico cronologico com filtros por categoria, importancia, nacao selecionada, busca
// e navegacao por ano. Clique em um registro para ir ate o acontecimento.
import type { HistoryEntry, HistoryType } from '../../state/types';
import { actions, btnClass, button, CHECK, closeButton, FIELD, FIELD_GROW, headTitles, mutedBlock } from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { historyList } from './common';
import { BasePanel } from './Panel';

const CATEGORIES: { id: string; label: string; icon: string; types: HistoryType[] }[] = [
  { id: 'war', label: 'Guerras', icon: 'swords', types: ['war_declared', 'war_joined', 'war_ended', 'peace'] },
  { id: 'battle', label: 'Batalhas', icon: 'sword', types: ['battle'] },
  { id: 'conquest', label: 'Conquistas', icon: 'flag', types: ['conquest', 'capital_fall', 'annexation'] },
  { id: 'diplomacy', label: 'Diplomacia', icon: 'scroll', types: ['alliance', 'alliance_broken', 'treaty', 'diplomacy'] },
  { id: 'politics', label: 'Política', icon: 'crown', types: ['government', 'ruler', 'coup', 'revolution', 'civil_war'] },
  { id: 'nations', label: 'Nações', icon: 'globe', types: ['rebellion', 'independence', 'founded', 'destroyed', 'collapse', 'start'] },
  { id: 'world', label: 'Economia e eventos', icon: 'coins', types: ['economy', 'event', 'disaster'] },
  { id: 'tech', label: 'Tecnologia', icon: 'gear', types: ['tech', 'espionage', 'era'] },
];

const LIMIT = 300;

export class HistoryPanel extends BasePanel {
  private enabled = new Set(CATEGORIES.map((c) => c.id));
  private minImportance = 2;
  private onlySelected = false;
  private search = '';
  private year: number | null = null;

  constructor(ui: GameUI) {
    super(ui, 'left');
  }

  protected close(): void {
    this.ui.closeLeft();
  }

  protected renderHead(): string {
    const total = this.sim.state.history.length;
    return `${icon('book', 36)}${headTitles('Histórico', [`${total.toLocaleString('pt-BR')} registros · ${this.sim.year()}`])}${closeButton()}`;
  }

  private filtered(): HistoryEntry[] {
    const sim = this.sim;
    const types = new Set<HistoryType>();
    for (const c of CATEGORIES) if (this.enabled.has(c.id)) for (const t of c.types) types.add(t);
    const sel = this.ui.renderer.selectedCountry;
    const search = this.search.trim().toLowerCase();
    const out: HistoryEntry[] = [];
    const h = sim.state.history;
    for (let i = h.length - 1; i >= 0 && out.length < LIMIT; i--) {
      const e = h[i];
      if (!types.has(e.type) || e.importance < this.minImportance) continue;
      if (this.year !== null && sim.year(e.day) > this.year) continue;
      if (this.onlySelected && (sel < 0 || !e.countries.includes(sel))) continue;
      if (search && !e.text.toLowerCase().includes(search)) continue;
      out.push(e);
    }
    return out;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const sel = this.ui.renderer.selectedCountry;
    const cats = CATEGORIES.map((c) => button(esc(c.label), { size: 'xs', icon: c.icon, iconSize: 14, pressed: this.enabled.has(c.id), attrs: `data-action="cat" data-cat="${c.id}"` })).join('');
    const importance = `<select class="${FIELD_GROW}" data-change="imp">
        <option value="1"${this.minImportance === 1 ? ' selected' : ''}>Todos os registros</option>
        <option value="2"${this.minImportance === 2 ? ' selected' : ''}>Acontecimentos importantes</option>
        <option value="3"${this.minImportance === 3 ? ' selected' : ''}>Marcos históricos</option>
      </select>`;
    const only = `<label class="${btnClass('default', 'sm')}"><input class="${CHECK}" type="checkbox" data-change="only"${this.onlySelected ? ' checked' : ''}>${sel >= 0 ? `Só ${esc(sim.country(sel).name)}` : 'Só nação selecionada'}</label>`;
    const nav =
      `<input class="${FIELD_GROW}" data-change="search" placeholder="Buscar (Enter)" value="${esc(this.search)}">` +
      button('«', { size: 'sm', title: 'Voltar 10 anos', attrs: 'data-action="year-prev"' }) +
      `<input class="${FIELD} w-[84px]" type="number" data-change="year" placeholder="Ano" value="${this.year ?? ''}">` +
      button('»', { size: 'sm', title: 'Avançar 10 anos', attrs: 'data-action="year-next"' }) +
      button('Hoje', { size: 'sm', attrs: 'data-action="year-now"' });
    const controls = `<div class="mb-1.5 flex flex-wrap gap-[3px]">${cats}</div>${actions(importance + only, 'mb-1')}${actions(nav, 'mb-1.5')}`;
    const entries = this.filtered();
    const note = entries.length >= LIMIT ? mutedBlock(`Mostrando os ${LIMIT} registros mais recentes${this.year !== null ? ` até ${this.year}` : ''}. Use o filtro de ano para navegar pelo passado.`) : '';
    return controls + note + historyList(sim, entries);
  }

  protected action(name: string, t: HTMLElement): void {
    const sim = this.sim;
    const current = this.year ?? sim.year();
    switch (name) {
      case 'cat': {
        const id = t.dataset.cat ?? '';
        if (this.enabled.has(id)) this.enabled.delete(id);
        else this.enabled.add(id);
        break;
      }
      case 'imp': this.minImportance = Number((t as HTMLSelectElement).value) || 1; break;
      case 'only': this.onlySelected = (t as HTMLInputElement).checked; break;
      case 'search': this.search = (t as HTMLInputElement).value; break;
      case 'year': {
        const v = Number((t as HTMLInputElement).value);
        this.year = (t as HTMLInputElement).value && Number.isFinite(v) ? v : null;
        break;
      }
      case 'year-prev': this.year = Math.max(sim.state.startYear, current - 10); break;
      case 'year-next': {
        const next = current + 10;
        this.year = next >= sim.year() ? null : next;
        break;
      }
      case 'year-now': this.year = null; break;
      default: return;
    }
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.refresh();
    if (name.startsWith('year')) this.bodyEl.scrollTop = 0;
  }
}
