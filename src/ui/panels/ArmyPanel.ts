// Painel do exercito: tropas, moral, experiencia, suprimento, general, situacao e ordens.
import { fmtCompact, fmtInt, fmtPct } from '../../core/format';
import { terrainInfo } from '../../data/terrain';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { bar, esc, icon, kv } from '../dom';
import type { GameUI } from '../game/GameUI';
import { armyEta, armyStatus, cLink, kvGrid, pLink, sec } from './common';
import { BasePanel } from './Panel';

export class ArmyPanel extends BasePanel {
  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
  }

  protected alive(): boolean {
    return this.sim.index.armyById.has(this.id);
  }

  protected close(): void {
    this.ui.closeRight();
  }

  protected renderHead(): string {
    const sim = this.sim;
    const a = sim.index.armyById.get(this.id);
    if (!a) return '';
    return `${icon('sword', 40)}
      <div class="titles">
        <h2>⚔ ${esc(a.name.toUpperCase())}</h2>
        <div class="sub">${fmtInt(soldiersOf(a))} soldados · ${cLink(sim, a.owner)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>
        <button class="px-btn square" data-action="focus" title="Centralizar">${icon('target', 16)}</button>
      </div>`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const a = sim.index.armyById.get(this.id);
    if (!a) return '';
    const c = sim.country(a.owner);
    const g = sim.military.general(a);
    const status = armyStatus(sim, a);
    const eta = armyEta(sim, a);
    const ps = sim.state.provinces[a.location];
    const mp = sim.map.provinces[a.location];
    const banner = `<div class="banner ${a.battle >= 0 ? 'red' : a.path.length ? 'gold' : ''}">${icon(a.battle >= 0 ? 'swords' : a.path.length ? 'flag' : 'castle', 20)} ${esc(status)}${a.path.length ? ` <span class="muted">· chegada em ~${Math.ceil(eta)} dias</span>` : ''}</div>`;
    const battleLink = a.battle >= 0 ? `<div class="row link" data-battle="${a.battle}">${icon('swords', 16)} <span class="grow">Ver batalha em andamento</span></div>` : '';
    const tropas = kvGrid([
      kv('sword', 'Soldados', fmtInt(soldiersOf(a))),
      kv('helmet', 'Infantaria', fmtInt(a.infantry)),
      kv('flag', this.sim.technology.cavalryName(c), fmtInt(a.cavalry)),
      kv('castle', 'Artilharia', fmtInt(a.artillery)),
      kv('swords', 'Poder de combate', fmtCompact(sim.military.armyPower(a))),
    ]);
    const estado = kvGrid([
      kv('smile', 'Moral', fmtPct(a.morale, 0)), `<span></span><div class="full">${bar(a.morale, 'var(--green)')}</div>`,
      kv('trophy', 'Experiência', fmtPct(a.experience, 0)), `<span></span><div class="full">${bar(a.experience, 'var(--gold)')}</div>`,
      kv('chest', 'Suprimento', fmtPct(a.supply, 0)), `<span></span><div class="full">${bar(a.supply, 'var(--blue)')}</div>`,
    ]);
    const general = g
      ? `<div class="row"><b class="grow">${esc(g.name)}</b><span class="muted">${g.victories} vitórias · ${g.defeats} derrotas</span></div>
         <div class="skills"><span>Ataque</span>${bar(g.attack / 6, 'var(--red-2)')}<span>${g.attack}</span><span>Defesa</span>${bar(g.defense / 6, 'var(--blue)')}<span>${g.defense}</span><span>Manobra</span>${bar(g.maneuver / 6, 'var(--green)')}<span>${g.maneuver}</span><span>Cerco</span>${bar(g.siege / 6, 'var(--gold)')}<span>${g.siege}</span></div>`
      : '<div class="muted">Sem comandante.</div>';
    const local = kvGrid([
      kv('pin', 'Localização', pLink(sim, a.location)),
      kv('mountain', 'Terreno', esc(terrainInfo(mp.terrain).name)),
      kv('flag', 'Controlado por', cLink(sim, ps.controller)),
      kv('anchor', 'Transporte', a.naval ? 'Em navios' : 'Por terra'),
    ]);
    const route = a.path.length ? `<div class="rows">${a.path.slice(0, 10).map((p, i) => `<div class="row"><span class="muted" style="width:20px">${i + 1}.</span><span class="grow">${pLink(sim, p)}</span></div>`).join('')}${a.path.length > 10 ? `<div class="muted">… mais ${a.path.length - 10} etapas</div>` : ''}</div>` : '<div class="muted">Sem rota.</div>';
    const actions = `
      <div class="hint-box">Com o exército selecionado, clique com o botão direito em um estado para ordenar a marcha.</div>
      <div class="action">
        <button class="px-btn small" data-action="stop">Parar</button>
        <button class="px-btn small" data-action="home">Voltar para casa</button>
        <button class="px-btn small" data-action="split">Dividir</button>
        <button class="px-btn small" data-action="merge">Unir exércitos aqui</button>
        <button class="px-btn small danger" data-action="disband">Dissolver</button>
      </div>`;
    return banner + battleLink + sec('Tropas', 'sword', tropas) + sec('Condição', 'smile', estado) + sec('Comandante', 'helmet', general) + sec('Posição', 'pin', local) + sec('Rota', 'flag', route) + sec('Ordens', 'gear', actions);
  }

  protected action(name: string): void {
    const a = this.ui.actions;
    if (name === 'focus') {
      const army = this.sim.index.armyById.get(this.id);
      if (army) this.ui.renderer.focusProvince(army.location);
      return;
    }
    const r =
      name === 'stop' ? a.stopArmy(this.id)
      : name === 'home' ? a.sendHome(this.id)
      : name === 'split' ? a.splitArmy(this.id)
      : name === 'merge' ? a.mergeHere(this.id)
      : name === 'disband' ? a.disband(this.id)
      : null;
    if (r) {
      this.ui.toasts.info(r.message);
      this.refresh();
    }
  }
}
