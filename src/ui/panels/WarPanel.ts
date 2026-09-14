// Painel da guerra: atacantes x defensores, objetivo, placar, exaustao, baixas, ocupacoes,
// evolucao do placar, batalhas, registro e acoes de paz.
import { formatDuration } from '../../core/calendar';
import { fmtCompact, fmtInt } from '../../core/format';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { GOAL_NAMES, isRebelGoal } from '../../sim/engines/WarEngine';
import type { War } from '../../state/types';
import { LineChart } from '../charts/LineChart';
import { bar, esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { cLink, dateOf, pLink, sec } from './common';
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
    return `${icon('swords', 40)}
      <div class="titles"><h2>${esc(w.name)}</h2>
        <div class="sub">${esc(GOAL_NAMES[w.goal.type])} · ${dateOf(sim, w.start)} · ${duration}${w.active ? '' : ' · encerrada'}</div>
      </div>
      <button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>`;
  }

  private sideBox(members: number[], leader: number): string {
    const sim = this.sim;
    const soldiers = sim.state.armies.filter((a) => members.includes(a.owner)).reduce((acc, a) => acc + soldiersOf(a), 0);
    const provinces = members.reduce((acc, c) => acc + (sim.index.ownedBy[c]?.length ?? 0), 0);
    return `<div class="side-box">${members.map((c) => `<div>${c === leader ? icon('crown', 12) + ' ' : ''}${cLink(sim, c)}</div>`).join('') || '<span class="muted">—</span>'}
      <div class="muted" style="margin-top:4px">${fmtCompact(soldiers)} soldados · ${provinces} ${provinces === 1 ? 'estado' : 'estados'}</div></div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const w = this.war;
    if (!w) return '';
    const ws = Math.round(w.warscore);
    const endless = !sim.state.settings.autoPeace && !isRebelGoal(w.goal.type);
    const still = sim.wars.daysStatic(w);
    const activity = w.active
      ? `<div class="muted" style="margin-top:4px">Última batalha ou mudança de ocupação: ${still < 45 ? 'recente' : `há ${formatDuration(still)}`}</div>${
          endless && still >= 5 * 365 ? '<div class="hint-box">Guerra parada: os lados não conseguem se alcançar ou nenhum consegue avançar. Ela só termina por dominação ou pela sua decisão abaixo.</div>' : ''
        }`
      : '';
    const marker = `<div class="war-score"><i style="left:calc(${(w.warscore + 100) / 2}% - 2px)"></i></div>
      <div class="row"><span class="muted">Defensores</span><span class="grow" style="text-align:center"><b>${ws > 0 ? '+' : ''}${ws}</b> ${ws > 5 ? '(favorece os atacantes)' : ws < -5 ? '(favorece os defensores)' : '(equilibrada)'}</span><span class="muted">Atacantes</span></div>`;
    const vs = `<div class="vs">${this.sideBox(w.attackers, w.attackerLeader)}<div class="mid">VS</div>${this.sideBox(w.defenders, w.defenderLeader)}</div>
      <div class="muted" style="display:flex;justify-content:space-between;margin-top:2px"><span>Atacantes</span><span>Defensores</span></div>`;
    const goal = `<div>${esc(w.goal.description)}</div>${w.goal.provinces.length ? `<div class="rows" style="margin-top:4px">${w.goal.provinces.slice(0, 10).map((p) => {
      const ps = sim.state.provinces[p];
      const ctrl = ps.controller;
      const held = w.attackers.includes(ctrl);
      const annex = held && endless && ps.owner !== ctrl ? sim.wars.monthsToAnnex(p) : -1;
      const label = held ? (ps.owner === ctrl ? 'anexado pelos atacantes' : annex >= 0 ? `ocupado · anexação em ${annex} ${annex === 1 ? 'mês' : 'meses'}` : 'ocupado pelos atacantes') : esc(sim.country(ctrl).name);
      return `<div class="row"><span class="grow">${pLink(sim, p)}</span><span class="chip ${held ? 'green' : ''}">${label}</span></div>`;
    }).join('')}</div>` : ''}`;
    const statRow = (label: string, a: string, d: string) => `<tr><td>${label}</td><td class="num">${a}</td><td class="num">${d}</td></tr>`;
    const stats = `<table class="mini-table"><tr><th></th><th class="num">Atacantes</th><th class="num">Defensores</th></tr>
      ${statRow('Baixas', fmtInt(w.casualties[0]), fmtInt(w.casualties[1]))}
      ${statRow('Batalhas vencidas', String(w.battlesWon[0]), String(w.battlesWon[1]))}
      ${statRow('Estados inimigos ocupados', String(w.occupied[0]), String(w.occupied[1]))}
      ${statRow('Exaustão', `${Math.round(w.exhaustion[0])}%`, `${Math.round(w.exhaustion[1])}%`)}
    </table>
    <div class="kv2" style="margin-top:6px"><div>${bar(w.exhaustion[0] / 100, 'var(--red-2)')}</div><div>${bar(w.exhaustion[1] / 100, 'var(--red-2)')}</div></div>`;
    const result = w.result
      ? sec('Resultado', 'dove', `<div class="banner ${w.result.winner === 'white' ? '' : 'green'}">${w.result.winner === 'white' ? 'Paz branca' : w.result.winner === 'attackers' ? 'Vitória dos atacantes' : 'Vitória dos defensores'} · ${dateOf(sim, w.end)}</div>
          <div class="result-line">${esc(w.result.summary)}</div>
          ${w.result.ceded.length ? `<div class="rows" style="margin-top:4px">${w.result.ceded.slice(0, 20).map((c) => `<div class="row"><span class="grow">${pLink(sim, c.province)}</span><span class="muted">${esc(sim.country(c.from)?.name ?? '')} → ${esc(sim.country(c.to)?.name ?? '')}</span></div>`).join('')}</div>` : ''}`)
      : '';
    const battles = w.battles
      .slice(-12)
      .reverse()
      .map((id) => sim.index.battleById.get(id))
      .filter((b) => !!b)
      .map((b) => {
        const winner = b.winner ? sim.country((b.winner === 'attacker' ? b.attacker : b.defender).countries[0]).name : b.end < 0 ? 'em andamento' : 'interrompida';
        return `<div class="row link" data-battle="${b.id}">${icon('swords', 14)}<span class="grow">${esc(b.name)}</span><span class="muted">${sim.year(b.start)} · ${esc(winner)}</span></div>`;
      })
      .join('');
    const log = w.log.slice(-30).reverse().map((l) => `<div><span class="when">${dateOf(sim, l.day)}</span>${esc(l.text)}</div>`).join('');
    const chart = w.scoreHistory.length >= 2 ? `<canvas class="spark" style="height:130px" data-chart="score"></canvas>` : '<div class="muted">O placar é registrado mensalmente.</div>';
    const actions = w.active
      ? sec('Decidir a guerra', 'gear', `${endless ? '<div class="hint-box">As nações não farão as pazes sozinhas: esta guerra continua até um lado dominar o outro (perder todo o território) ou até você decidir abaixo. Estados ocupados por dois anos passam a pertencer ao ocupante.</div>' : ''}<div class="action"><button class="px-btn small" data-action="white">${icon('dove', 14)} Paz branca</button><button class="px-btn small" data-action="attackers">Vitória dos atacantes</button><button class="px-btn small" data-action="defenders">Vitória dos defensores</button></div>
          ${this.ui.renderer.selectedCountry >= 0 && sim.wars.sideOf(w, this.ui.renderer.selectedCountry) < 0 && sim.country(this.ui.renderer.selectedCountry).alive
            ? `<div class="action"><span class="grow">${cLink(sim, this.ui.renderer.selectedCountry)}:</span><button class="px-btn small" data-action="join-0">Entrar com os atacantes</button><button class="px-btn small" data-action="join-1">Entrar com os defensores</button></div>`
            : ''}`)
      : '';
    return (
      sec('Placar de guerra', 'scales', marker + activity) +
      sec('Participantes', 'flag', vs) +
      sec('Objetivo', 'target', goal) +
      sec('Estatísticas', 'chart', stats) +
      sec('Evolução do placar', 'chart', chart) +
      result +
      actions +
      sec('Batalhas recentes', 'swords', `<div class="rows">${battles || '<div class="muted">Nenhuma batalha ainda.</div>'}</div>`) +
      sec('Registro', 'book', `<div class="log">${log}</div>`)
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
