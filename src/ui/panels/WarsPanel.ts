// Lista de guerras e rebelioes em andamento e das guerras encerradas recentemente.
import { formatDuration } from '../../core/calendar';
import { isRebelGoal } from '../../sim/engines/WarEngine';
import type { War } from '../../state/types';
import { closeButton, headTitles, MUTED, muted, mutedBlock, row, rows, section, stack, sub, warScore } from '../components';
import { esc, flagInline, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { BasePanel } from './Panel';

export class WarsPanel extends BasePanel {
  constructor(ui: GameUI) {
    super(ui, 'left');
  }

  protected close(): void {
    this.ui.closeLeft();
  }

  protected renderHead(): string {
    const active = this.sim.index.activeWars.length;
    return `${icon('swords', 36)}${headTitles('Guerras', [`${active} conflitos em andamento`])}${closeButton()}`;
  }

  private card(w: War): string {
    const sim = this.sim;
    const a = sim.country(w.attackerLeader);
    const d = sim.country(w.defenderLeader);
    const extra = w.attackers.length + w.defenders.length - 2;
    return `<div class="mb-1 flex cursor-pointer flex-col items-stretch gap-1 border border-paper-dark px-1.5 py-1 hover:bg-paper-2" data-war="${w.id}">
      <div class="flex items-start gap-1.5">${stack(`<b>${esc(w.name)}</b>`)}<span class="${MUTED} shrink-0 whitespace-nowrap">${formatDuration(sim.day - w.start)}</span></div>
      <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]"><span>${flagInline(a, 18, 'mr-1')}${esc(a.name)}</span>${muted('x')}<span>${flagInline(d, 18, 'mr-1')}${esc(d.name)}</span>${extra > 0 ? muted(`+${extra}`) : ''}</div>
      ${warScore((w.warscore + 100) / 2, 'h-2.5')}
    </div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const active = [...sim.index.activeWars].sort((x, y) => {
      const size = (w: War) => [...w.attackers, ...w.defenders].reduce((acc, c) => acc + sim.country(c).provinceCount, 0);
      return size(y) - size(x);
    });
    const wars = active.filter((w) => !isRebelGoal(w.goal.type));
    const rebellions = active.filter((w) => isRebelGoal(w.goal.type));
    const ended = sim.state.wars
      .filter((w) => !w.active)
      .slice(-30)
      .reverse()
      .map((w) => {
        const res = w.result?.winner;
        const leader = res === 'attackers' ? w.attackerLeader : res === 'defenders' ? w.defenderLeader : -1;
        const label = res === 'white' ? 'Paz branca' : leader >= 0 ? `Vitória: ${sim.country(leader).name}` : '—';
        return row(`${icon(isRebelGoal(w.goal.type) ? 'fire' : 'dove', 14)}${stack(`${esc(w.name)}${sub(`${sim.year(w.start)}–${sim.year(w.end)} · ${esc(label)}`)}`)}`, { link: true, top: true, attrs: `data-war="${w.id}"` });
      })
      .join('');
    return (
      section(`Guerras (${wars.length})`, 'swords', wars.map((w) => this.card(w)).join('') || mutedBlock('O mundo está em paz.')) +
      section(`Rebeliões e guerras civis (${rebellions.length})`, 'fire', rebellions.map((w) => this.card(w)).join('') || mutedBlock('Nenhuma rebelião ativa.')) +
      section('Encerradas recentemente', 'dove', rows(ended || mutedBlock('Nenhuma ainda.')))
    );
  }
}
