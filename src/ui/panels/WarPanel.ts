// Painel da guerra: atacantes x defensores, objetivo, placar, exaustao, baixas, ocupacoes,
// evolucao do placar, batalhas, registro e acoes de paz.
import { formatDuration } from '../../core/calendar';
import { fmtCompact, fmtInt } from '../../core/format';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { GOAL_NAMES, isRebelGoal } from '../../sim/engines/WarEngine';
import type { War } from '../../state/types';
import { LineChart } from '../charts/LineChart';
import {
  actions,
  banner,
  bar,
  button,
  chip,
  closeButton,
  COLORS,
  grow,
  headTitles,
  hint,
  LOG,
  MUTED,
  muted,
  mutedBlock,
  row,
  ROWS,
  rows,
  section,
  SIDE_BOX,
  SPARK,
  table,
  td,
  VS,
  VS_MID,
  warScore,
  WHEN,
} from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, dateOf, pLink } from './common';
import { BasePanel } from './Panel';

export class WarPanel extends BasePanel {
  private chart: LineChart | null = null;

  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
  }

  private get war(): War | undefined {
    return this.sim.index.warById.get(this.id);
  }

  protected alive(): boolean {
    return !!this.war;
  }

  protected close(): void {
    this.ui.closeRight();
  }

  protected renderHead(): string {
    const sim = this.sim;
    const w = this.war;
    if (!w) return '';
    const duration = formatDuration((w.active ? sim.day : w.end) - w.start);
    return `${icon('swords', 40)}${headTitles(esc(w.name), [`${esc(GOAL_NAMES[w.goal.type])} · ${dateOf(sim, w.start)} · ${duration}${w.active ? '' : ' · encerrada'}`])}${closeButton()}`;
  }

  private sideBox(members: number[], leader: number): string {
    const sim = this.sim;
    const soldiers = sim.state.armies.filter((a) => members.includes(a.owner)).reduce((acc, a) => acc + soldiersOf(a), 0);
    const provinces = members.reduce((acc, c) => acc + (sim.index.ownedBy[c]?.length ?? 0), 0);
    const list = members.map((c) => `<div>${c === leader ? `${icon('crown', 12)} ` : ''}${cLink(sim, c)}</div>`).join('') || muted('—');
    return `<div class="${SIDE_BOX}">${list}${mutedBlock(`${fmtCompact(soldiers)} soldados · ${provinces} ${provinces === 1 ? 'estado' : 'estados'}`, 'mt-1')}</div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const w = this.war;
    if (!w) return '';
    const ws = Math.round(w.warscore);
    const endless = !sim.state.settings.autoPeace && !isRebelGoal(w.goal.type);
    const still = sim.wars.daysStatic(w);
    const activity = w.active
      ? mutedBlock(`Última batalha ou mudança de ocupação: ${still < 45 ? 'recente' : `há ${formatDuration(still)}`}`, 'mt-1') +
        (endless && still >= 5 * 365 ? hint('Guerra parada: os lados não conseguem se alcançar ou nenhum consegue avançar. Ela só termina por dominação ou pela sua decisão abaixo.') : '')
      : '';
    const balance = ws > 5 ? '(favorece os atacantes)' : ws < -5 ? '(favorece os defensores)' : '(equilibrada)';
    const marker = warScore((w.warscore + 100) / 2) + row(`${muted('Defensores')}<span class="min-w-0 flex-1 text-center"><b>${ws > 0 ? '+' : ''}${ws}</b> ${balance}</span>${muted('Atacantes')}`);
    const vs = `<div class="${VS}">${this.sideBox(w.attackers, w.attackerLeader)}<div class="${VS_MID}">VS</div>${this.sideBox(w.defenders, w.defenderLeader)}</div>
      <div class="mt-0.5 flex justify-between ${MUTED}"><span>Atacantes</span><span>Defensores</span></div>`;
    const goalRows = w.goal.provinces
      .slice(0, 10)
      .map((p) => {
        const ps = sim.state.provinces[p];
        const ctrl = ps.controller;
        const held = w.attackers.includes(ctrl);
        const annex = held && endless && ps.owner !== ctrl ? sim.wars.monthsToAnnex(p) : -1;
        const label = held ? (ps.owner === ctrl ? 'anexado pelos atacantes' : annex >= 0 ? `ocupado · anexação em ${annex} ${annex === 1 ? 'mês' : 'meses'}` : 'ocupado pelos atacantes') : esc(sim.country(ctrl).name);
        return row(`${grow(pLink(sim, p))}${chip(label, held ? 'green' : 'plain')}`);
      })
      .join('');
    const goal = `<div>${esc(w.goal.description)}</div>${goalRows ? `<div class="${ROWS} mt-1">${goalRows}</div>` : ''}`;
    const statRow = (label: string, a: string, d: string) => `<tr>${td(label)}${td(a, true)}${td(d, true)}</tr>`;
    const stats =
      table(
        [[''], ['Atacantes', true], ['Defensores', true]],
        statRow('Baixas', fmtInt(w.casualties[0]), fmtInt(w.casualties[1])) +
          statRow('Batalhas vencidas', String(w.battlesWon[0]), String(w.battlesWon[1])) +
          statRow('Estados inimigos ocupados', String(w.occupied[0]), String(w.occupied[1])) +
          statRow('Exaustão', `${Math.round(w.exhaustion[0])}%`, `${Math.round(w.exhaustion[1])}%`),
      ) + `<div class="mt-1.5 grid grid-cols-2 gap-x-3.5 gap-y-0.5"><div>${bar(w.exhaustion[0] / 100, COLORS.red)}</div><div>${bar(w.exhaustion[1] / 100, COLORS.red)}</div></div>`;
    const result = w.result
      ? section(
          'Resultado',
          'dove',
          banner(`${w.result.winner === 'white' ? 'Paz branca' : w.result.winner === 'attackers' ? 'Vitória dos atacantes' : 'Vitória dos defensores'} · ${dateOf(sim, w.end)}`, w.result.winner === 'white' ? 'plain' : 'green') +
            `<div class="text-[13px] leading-[1.4]">${esc(w.result.summary)}</div>` +
            (w.result.ceded.length
              ? `<div class="${ROWS} mt-1">${w.result.ceded
                  .slice(0, 20)
                  .map((c) => row(`${grow(pLink(sim, c.province))}${muted(`${esc(sim.country(c.from)?.name ?? '')} → ${esc(sim.country(c.to)?.name ?? '')}`)}`))
                  .join('')}</div>`
              : ''),
        )
      : '';
    const battles = w.battles
      .slice(-12)
      .reverse()
      .map((id) => sim.index.battleById.get(id))
      .filter((b) => !!b)
      .map((b) => {
        const winner = b.winner ? sim.country((b.winner === 'attacker' ? b.attacker : b.defender).countries[0]).name : b.end < 0 ? 'em andamento' : 'interrompida';
        return row(`${icon('swords', 14)}${grow(esc(b.name))}${muted(`${sim.year(b.start)} · ${esc(winner)}`)}`, { link: true, attrs: `data-battle="${b.id}"` });
      })
      .join('');
    const log = w.log
      .slice(-30)
      .reverse()
      .map((l) => `<div><span class="${WHEN}">${dateOf(sim, l.day)}</span>${esc(l.text)}</div>`)
      .join('');
    const chart = w.scoreHistory.length >= 2 ? `<canvas class="${SPARK}" style="height:130px" data-chart="score"></canvas>` : mutedBlock('O placar é registrado mensalmente.');
    const selected = this.ui.renderer.selectedCountry;
    const canJoin = selected >= 0 && sim.wars.sideOf(w, selected) < 0 && sim.country(selected).alive;
    const decide = w.active
      ? section(
          'Decidir a guerra',
          'gear',
          (endless ? hint('As nações não farão as pazes sozinhas: esta guerra continua até um lado dominar o outro (perder todo o território) ou até você decidir abaixo. Estados ocupados por dois anos passam a pertencer ao ocupante.') : '') +
            actions(
              button('Paz branca', { size: 'sm', icon: 'dove', attrs: 'data-action="white"' }) +
                button('Vitória dos atacantes', { size: 'sm', attrs: 'data-action="attackers"' }) +
                button('Vitória dos defensores', { size: 'sm', attrs: 'data-action="defenders"' }),
            ) +
            (canJoin
              ? actions(
                  `<span class="min-w-0 flex-1">${cLink(sim, selected)}:</span>${button('Entrar com os atacantes', { size: 'sm', attrs: 'data-action="join-0"' })}${button('Entrar com os defensores', { size: 'sm', attrs: 'data-action="join-1"' })}`,
                  'mt-1.5',
                )
              : ''),
        )
      : '';
    return (
      section('Placar de guerra', 'scales', marker + activity) +
      section('Participantes', 'flag', vs) +
      section('Objetivo', 'target', goal) +
      section('Estatísticas', 'chart', stats) +
      section('Evolução do placar', 'chart', chart) +
      result +
      decide +
      section('Batalhas recentes', 'swords', rows(battles || mutedBlock('Nenhuma batalha ainda.'))) +
      section('Registro', 'book', `<div class="${LOG}">${log}</div>`)
    );
  }

  protected afterRender(): void {
    this.chart?.destroy();
    this.chart = null;
    const canvas = this.bodyEl.querySelector<HTMLCanvasElement>('canvas[data-chart="score"]');
    const w = this.war;
    if (!canvas || !w) return;
    const start = this.sim.year(w.start);
    const x = w.scoreHistory.map((_, i) => start + (i + 1) / 12);
    this.chart = new LineChart(canvas, {
      x,
      series: [{ label: 'Placar', color: '#7a1e18', values: w.scoreHistory }],
      yFormat: (v) => `${Math.round(v)}`,
      xFormat: (v) => String(Math.floor(v)),
      yMin: -100,
      yMax: 100,
      zeroLine: true,
    });
  }

  protected action(name: string): void {
    const a = this.ui.actions;
    let r = null;
    if (name === 'white' || name === 'attackers' || name === 'defenders') r = a.endWar(this.id, name);
    else if (name === 'join-0' || name === 'join-1') r = a.joinWar(this.id, this.ui.renderer.selectedCountry, name === 'join-0' ? 0 : 1);
    if (r) {
      this.ui.toasts.info(r.message);
      this.refresh();
    }
  }

  destroy(): void {
    this.chart?.destroy();
    super.destroy();
  }
}
