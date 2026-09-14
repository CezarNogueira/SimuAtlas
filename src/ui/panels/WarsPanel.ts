// Lista de guerras e rebelioes em andamento e das guerras encerradas recentemente.
import { formatDuration } from '../../core/calendar';
import { isRebelGoal } from '../../sim/engines/WarEngine';
import type { War } from '../../state/types';
import { esc, flagInline, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { sec } from './common';
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
    return `${icon('swords', 36)}<div class="titles"><h2>Guerras</h2><div class="sub">${active} conflitos em andamento</div></div>
      <button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  private row(w: War): string {
    const sim = this.sim;
    const a = sim.country(w.attackerLeader);
    const d = sim.country(w.defenderLeader);
    const extra = w.attackers.length + w.defenders.length - 2;
    const pct = (w.warscore + 100) / 2;
    return `<div class="row link" data-war="${w.id}" style="flex-direction:column;align-items:stretch;border-color:var(--paper-dark);margin-bottom:4px">
      <div style="display:flex;gap:6px;align-items:center"><b class="grow">${esc(w.name)}</b><span class="muted">${formatDuration(sim.day - w.start)}</span></div>
      <div style="display:flex;gap:6px;align-items:center;font-size:13px">${flagInline(a, 18)}${esc(a.name)} <span class="muted">x</span> ${flagInline(d, 18)}${esc(d.name)}${extra > 0 ? ` <span class="muted">+${extra}</span>` : ''}</div>
      <div class="war-score" style="height:10px"><i style="left:calc(${pct}% - 2px)"></i></div>
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
        return `<div class="row link" data-war="${w.id}">${icon(isRebelGoal(w.goal.type) ? 'fire' : 'dove', 14)}<span class="grow">${esc(w.name)}</span><span class="muted">${sim.year(w.start)}–${sim.year(w.end)} · ${esc(label)}</span></div>`;
      })
      .join('');
    return (
      sec(`Guerras (${wars.length})`, 'swords', wars.map((w) => this.row(w)).join('') || '<div class="muted">O mundo está em paz.</div>') +
      sec(`Rebeliões e guerras civis (${rebellions.length})`, 'fire', rebellions.map((w) => this.row(w)).join('') || '<div class="muted">Nenhuma rebelião ativa.</div>') +
      sec('Encerradas recentemente', 'dove', `<div class="rows">${ended || '<div class="muted">Nenhuma ainda.</div>'}</div>`)
    );
  }
}
