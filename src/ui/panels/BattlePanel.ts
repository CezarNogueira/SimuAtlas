// Painel da batalha: lados, tropas iniciais, perdas, moral, terreno, resultado e registro dia a dia.
import { fmtInt, fmtPct } from '../../core/format';
import { terrainInfo } from '../../data/terrain';
import type { BattleSide } from '../../state/types';
import { bar, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, dateOf, pLink, sec, warLink } from './common';
import { BasePanel } from './Panel';

export class BattlePanel extends BasePanel {
  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
  }

  protected alive(): boolean {
    return this.sim.index.battleById.has(this.id);
  }

  protected close(): void {
    this.ui.closeRight();
  }

  protected renderHead(): string {
    const sim = this.sim;
    const b = sim.index.battleById.get(this.id);
    if (!b) return '';
    return `${icon('swords', 40)}
      <div class="titles"><h2>${esc(b.name.toUpperCase())}</h2><div class="sub">${dateOf(sim, b.start)} · ${pLink(sim, b.province)}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>
        <button class="px-btn square" data-action="focus" title="Centralizar">${icon('target', 16)}</button>
      </div>`;
  }

  private side(s: BattleSide, won: boolean | null): string {
    const sim = this.sim;
    const initial = s.initial.infantry + s.initial.cavalry + s.initial.artillery;
    return `<div class="side-box">
      <div>${s.countries.map((c) => cLink(sim, c)).join('<br>')}</div>
      ${won === null ? '' : won ? '<span class="chip green">Vencedor</span>' : '<span class="chip red">Derrotado</span>'}
      <div class="muted" style="margin-top:4px">General: ${esc(s.general || '—')}</div>
      <div style="margin-top:4px"><b>${fmtInt(initial)}</b> soldados</div>
      <div class="muted">Inf. ${fmtInt(s.initial.infantry)} · Cav. ${fmtInt(s.initial.cavalry)} · Art. ${fmtInt(s.initial.artillery)}</div>
      <div style="margin-top:4px">Perdas: <b class="neg">${fmtInt(s.losses)}</b> <span class="muted">(${fmtPct(initial > 0 ? s.losses / initial : 0, 0)})</span></div>
      <div style="margin-top:4px">Moral ${Math.round(s.morale * 100)}%</div>${bar(s.morale, 'var(--green)')}
    </div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const b = sim.index.battleById.get(this.id);
    if (!b) return '';
    const war = b.war >= 0 ? sim.index.warById.get(b.war) : undefined;
    const t = terrainInfo(b.terrain);
    let banner: string;
    if (b.end < 0) banner = `<div class="banner gold">${icon('swords', 20)} Em andamento — dia ${b.days}</div>`;
    else if (b.winner) {
      const side = b.winner === 'attacker' ? b.attacker : b.defender;
      banner = `<div class="banner green">${icon('trophy', 20)} Vitória: ${esc(sim.country(side.countries[0]).name)} <span class="muted">· ${b.days} dias de combate</span></div>`;
    } else banner = `<div class="banner">${icon('dove', 20)} Batalha interrompida pela paz</div>`;
    const won = (who: 'attacker' | 'defender') => (b.end < 0 || !b.winner ? null : b.winner === who);
    const vs = `<div class="vs">${this.side(b.attacker, won('attacker'))}<div class="mid">VS</div>${this.side(b.defender, won('defender'))}</div>
      <div class="muted" style="display:flex;justify-content:space-between;margin-top:2px"><span>Atacante</span><span>Defensor</span></div>`;
    const details = `<div class="kv">
      ${icon('swords', 16)}<span class="k">Guerra</span><span class="v">${war ? warLink(war) : '—'}</span>
      ${icon('mountain', 16)}<span class="k">Terreno</span><span class="v">${esc(t.name)} (defesa ×${t.defense.toFixed(2)})</span>
      ${icon('anchor', 16)}<span class="k">Travessia de rio</span><span class="v">${b.river ? 'Sim (+20% defesa)' : 'Não'}</span>
      ${icon('castle', 16)}<span class="k">Fortificação</span><span class="v">${b.fort > 0 ? `Nível ${b.fort}` : 'Nenhuma'}</span>
      ${icon('info', 16)}<span class="k">Início</span><span class="v">${dateOf(sim, b.start)}</span>
      ${b.end >= 0 ? `${icon('info', 16)}<span class="k">Fim</span><span class="v">${dateOf(sim, b.end)}</span>` : ''}
    </div>`;
    const log = `<div class="log">${b.log.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
    return banner + sec('Forças', 'sword', vs) + sec('Detalhes', 'info', details) + sec('Relato', 'book', log);
  }

  protected action(name: string): void {
    const b = this.sim.index.battleById.get(this.id);
    if (name === 'focus' && b) this.ui.renderer.focusProvince(b.province);
  }
}
