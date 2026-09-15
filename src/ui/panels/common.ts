// Trechos de interface reutilizados pelos paineis: links de entidades, historico, tecnologias e exercitos.
import { formatDate } from '../../core/calendar';
import type { Technology } from '../../data/technologies';
import type { Simulation } from '../../sim/Simulation';
import { STATUS_LABELS, type TechStatus } from '../../sim/technology/TechnologyEngine';
import type { Army, HistoryEntry, HistoryType, War } from '../../state/types';
import { empty, LINK } from '../components';
import { esc, flagInline, icon } from '../dom';

export const HISTORY_ICONS: Record<HistoryType, string> = {
  start: 'globe',
  war_declared: 'swords',
  war_joined: 'swords',
  war_ended: 'dove',
  battle: 'sword',
  conquest: 'flag',
  capital_fall: 'castle',
  peace: 'dove',
  alliance: 'shield',
  alliance_broken: 'shield',
  treaty: 'scroll',
  rebellion: 'fire',
  independence: 'flag',
  revolution: 'fire',
  civil_war: 'fire',
  coup: 'helmet',
  government: 'crown',
  ruler: 'crown',
  event: 'info',
  economy: 'coins',
  tech: 'gear',
  annexation: 'flag',
  collapse: 'skull',
  founded: 'flag',
  destroyed: 'skull',
  diplomacy: 'scroll',
  disaster: 'fire',
  era: 'globe',
  espionage: 'target',
};

export function cLink(sim: Simulation, id: number): string {
  const c = sim.country(id);
  if (!c) return '—';
  return `<span class="${LINK}" data-country="${id}">${flagInline(c, 18, 'mr-1')}${esc(c.name)}</span>`;
}

export function pLink(sim: Simulation, pid: number): string {
  const mp = sim.map.provinces[pid];
  return mp ? `<span class="${LINK}" data-province="${pid}">${esc(mp.name)}</span>` : '—';
}

export function warLink(w: War): string {
  return `<span class="${LINK}" data-war="${w.id}">${esc(w.name)}</span>`;
}

export function techLink(sim: Simulation, id: string): string {
  const t = sim.technology.db.get(id);
  return t ? `<span class="${LINK}" data-tech="${esc(id)}">${esc(t.nome)}</span>` : esc(id);
}

// Marcador de situacao: verde = dominada, amarelo = em desenvolvimento, vermelho = nao disponivel.
export function techDot(status: TechStatus): string {
  const color = status === 'dominada' ? 'bg-[#5aa33f]' : status === 'desenvolvimento' ? 'bg-[#e0b12e]' : 'bg-[#c2452f]';
  return `<i class="mr-0.5 inline-block size-2.5 shrink-0 border-2 border-edge align-middle ${color}" title="${STATUS_LABELS[status]}"></i>`;
}

// Situacao da tecnologia no mundo: descoberta, possivel mas ainda nao descoberta, ou antes da data historica.
export function worldTechStatus(sim: Simulation, t: Technology): TechStatus {
  if (sim.state.technologies[t.id]?.discovered) return 'dominada';
  return t.anoDescoberta <= sim.year() ? 'desenvolvimento' : 'indisponivel';
}

export const dateOf = (sim: Simulation, day: number) => formatDate(day, sim.state.startYear);

export function navAttr(e: HistoryEntry): string {
  if (e.battle >= 0) return `data-battle="${e.battle}"`;
  if (e.war >= 0) return `data-war="${e.war}"`;
  if (e.province >= 0) return `data-province="${e.province}"`;
  if (e.countries.length) return `data-country="${e.countries[0]}"`;
  return '';
}

// Registro de uma linha do tempo (historico do mundo, da nacao ou de uma tecnologia).
export function timelineEntry(iconName: string, when: string, text: string, importance: number, nav = ''): string {
  return `<div class="grid cursor-pointer grid-cols-[20px_44px_1fr] gap-1.5 border-b border-dashed border-paper-dark px-0.5 py-1 text-[12.5px] leading-[1.3] hover:bg-paper-2${importance >= 3 ? ' font-bold' : ''}" ${nav}>${icon(iconName, 16)}<span class="text-ink-soft">${when}</span><span>${text}</span></div>`;
}

export const TIMELINE = 'flex flex-col';

export function historyRow(sim: Simulation, e: HistoryEntry): string {
  return timelineEntry(HISTORY_ICONS[e.type] ?? 'info', dateOf(sim, e.day).slice(0, 5), esc(e.text), e.importance, navAttr(e));
}

export function historyList(sim: Simulation, entries: HistoryEntry[]): string {
  if (!entries.length) return empty('Nenhum acontecimento registrado.');
  let year = -1;
  let html = '';
  for (const e of entries) {
    const y = sim.year(e.day);
    if (y !== year) {
      year = y;
      html += `<div class="sticky -top-1 z-[1] mt-1.5 border-2 border-edge bg-paper-3 px-2 py-px font-pixel font-bold">${y}</div>`;
    }
    html += historyRow(sim, e);
  }
  return `<div class="${TIMELINE}">${html}</div>`;
}

export function armyStatus(sim: Simulation, a: Army): string {
  if (a.battle >= 0) {
    const b = sim.index.battleById.get(a.battle);
    return b ? `Em combate: ${b.name}` : 'Em combate';
  }
  const ps = sim.state.provinces[a.location];
  if (!a.path.length) {
    if (ps.siege && ps.siege.country === a.owner) return `Cercando ${sim.provinces.placeName(a.location)} · ${Math.min(100, Math.round((ps.siege.progress / ps.siege.needed) * 100))}%`;
    return `Aguardando em ${sim.provinces.placeName(a.location)}`;
  }
  const dest = sim.provinces.placeName(a.path[a.path.length - 1]);
  switch (a.mission) {
    case 'retreat': return `Recuando para ${dest}`;
    case 'return': return `Retornando para ${dest}`;
    case 'attack': return `Atacando em direção a ${dest}`;
    case 'garrison': return `Guarnecendo ${dest}`;
    default: return `Marchando para: ${dest}`;
  }
}

export function armyEta(sim: Simulation, a: Army): number {
  if (!a.path.length) return 0;
  let days = Math.max(0, a.edgeDays - a.progress);
  let prev = a.path[0];
  const speed = sim.military.speed(a);
  for (let i = 1; i < a.path.length; i++) {
    const e = sim.map.edgeBetween(prev, a.path[i]);
    days += e >= 0 ? sim.map.edgeDays[e] / speed : 8;
    prev = a.path[i];
  }
  return days;
}

export function countryOptions(sim: Simulation, exclude: number, selected = -1): string {
  return sim.countries
    .nations()
    .filter((c) => c.id !== exclude)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((c) => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`)
    .join('');
}
