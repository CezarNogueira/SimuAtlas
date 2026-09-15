// Painel da batalha: lados, tropas iniciais, perdas, moral, terreno, resultado e registro dia a dia.
import { fmtInt, fmtPct } from '../../core/format';
import { terrainInfo } from '../../data/terrain';
import type { BattleSide } from '../../state/types';
import {
  banner,
  bar,
  chip,
  closeButton,
  COLORS,
  focusButton,
  headButtons,
  headTitles,
  kv,
  kvGrid,
  LOG,
  MUTED,
  muted,
  mutedBlock,
  section,
  SIDE_BOX,
  sub,
  VS,
  VS_MID,
} from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, dateOf, pLink, warLink } from './common';
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
    return `${icon('swords', 40)}${headTitles(esc(b.name.toUpperCase()), [`${dateOf(sim, b.start)} · ${pLink(sim, b.province)}`])}${headButtons(closeButton() + focusButton('Centralizar'))}`;
  }

  private side(s: BattleSide, won: boolean | null): string {
    const sim = this.sim;
    const initial = s.initial.infantry + s.initial.cavalry + s.initial.artillery;
    return `<div class="${SIDE_BOX}">
      ${s.countries.map((c) => `<div>${cLink(sim, c)}</div>`).join('')}
      ${won === null ? '' : won ? chip('Vencedor', 'green') : chip('Derrotado', 'red')}
      ${mutedBlock(`General: ${esc(s.general || '—')}`, 'mt-1')}
      <div class="mt-1"><b>${fmtInt(initial)}</b> soldados</div>
      ${mutedBlock(`Inf. ${fmtInt(s.initial.infantry)} · Cav. ${fmtInt(s.initial.cavalry)} · Art. ${fmtInt(s.initial.artillery)}`)}
      <div class="mt-1">Perdas: <b class="text-neg">${fmtInt(s.losses)}</b> ${muted(`(${fmtPct(initial > 0 ? s.losses / initial : 0, 0)})`)}</div>
      <div class="mt-1">Moral ${Math.round(s.morale * 100)}%</div>${bar(s.morale, COLORS.green)}
    </div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const b = sim.index.battleById.get(this.id);
    if (!b) return '';
    const war = b.war >= 0 ? sim.index.warById.get(b.war) : undefined;
    const t = terrainInfo(b.terrain);
    let status: string;
    if (b.end < 0) status = banner(`${icon('swords', 20)} Em andamento — dia ${b.days}`, 'gold');
    else if (b.winner) {
      const side = b.winner === 'attacker' ? b.attacker : b.defender;
      status = banner(`${icon('trophy', 20)} Vitória: ${esc(sim.country(side.countries[0]).name)} ${muted(`· ${b.days} dias de combate`)}`, 'green');
    } else status = banner(`${icon('dove', 20)} Batalha interrompida pela paz`);
    const won = (who: 'attacker' | 'defender') => (b.end < 0 || !b.winner ? null : b.winner === who);
    const vs = `<div class="${VS}">${this.side(b.attacker, won('attacker'))}<div class="${VS_MID}">VS</div>${this.side(b.defender, won('defender'))}</div>
      <div class="mt-0.5 flex justify-between ${MUTED}"><span>Atacante</span><span>Defensor</span></div>`;
    const details = kvGrid([
      kv('swords', 'Guerra', war ? warLink(war) : '—'),
      kv('mountain', 'Terreno', `${esc(t.name)}${sub(`defesa ×${t.defense.toFixed(2)}`)}`),
      kv('anchor', 'Travessia de rio', b.river ? `Sim${sub('+20% defesa')}` : 'Não'),
      kv('castle', 'Fortificação', b.fort > 0 ? `Nível ${b.fort}` : 'Nenhuma'),
      kv('info', 'Início', dateOf(sim, b.start)),
      b.end >= 0 ? kv('info', 'Fim', dateOf(sim, b.end)) : '',
    ]);
    const log = `<div class="${LOG}">${b.log.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
    return status + section('Forças', 'sword', vs) + section('Detalhes', 'info', details) + section('Relato', 'book', log);
  }

  protected action(name: string): void {
    const b = this.sim.index.battleById.get(this.id);
    if (name === 'focus' && b) this.ui.renderer.focusProvince(b.province);
  }
}
