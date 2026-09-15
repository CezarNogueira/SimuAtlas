// Painel do exercito: tropas, moral, experiencia, suprimento, general, situacao e ordens.
import { fmtCompact, fmtInt, fmtPct } from '../../core/format';
import { terrainInfo } from '../../data/terrain';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import {
  actions,
  banner,
  bar,
  barRow,
  button,
  closeButton,
  COLORS,
  focusButton,
  grow,
  headButtons,
  headTitles,
  hint,
  kv,
  kvGrid,
  MUTED,
  muted,
  mutedBlock,
  row,
  rows,
  section,
} from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { armyEta, armyStatus, cLink, pLink } from './common';
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
    return `${icon('sword', 40)}${headTitles(`⚔ ${esc(a.name.toUpperCase())}`, [`${fmtInt(soldiersOf(a))} soldados · ${cLink(sim, a.owner)}`])}${headButtons(closeButton() + focusButton('Centralizar'))}`;
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
    const situation = banner(
      `${icon(a.battle >= 0 ? 'swords' : a.path.length ? 'flag' : 'castle', 20)} ${esc(status)}${a.path.length ? ` ${muted(`· chegada em ~${Math.ceil(eta)} dias`)}` : ''}`,
      a.battle >= 0 ? 'red' : a.path.length ? 'gold' : 'plain',
    );
    const battleLink = a.battle >= 0 ? row(`${icon('swords', 16)}${grow('Ver batalha em andamento')}`, { link: true, attrs: `data-battle="${a.battle}"` }) : '';
    const tropas = kvGrid([
      kv('sword', 'Soldados', fmtInt(soldiersOf(a))),
      kv('helmet', 'Infantaria', fmtInt(a.infantry)),
      kv('flag', sim.technology.cavalryName(c), fmtInt(a.cavalry)),
      kv('castle', 'Artilharia', fmtInt(a.artillery)),
      kv('swords', 'Poder de combate', fmtCompact(sim.military.armyPower(a))),
    ]);
    const condicao = kvGrid([
      kv('smile', 'Moral', fmtPct(a.morale, 0)), barRow(a.morale, COLORS.green),
      kv('trophy', 'Experiência', fmtPct(a.experience, 0)), barRow(a.experience, COLORS.gold),
      kv('chest', 'Suprimento', fmtPct(a.supply, 0)), barRow(a.supply, COLORS.blue),
    ]);
    const skill = (label: string, v: number, color: string) => `<span>${label}</span>${bar(v / 6, color)}<span>${v}</span>`;
    const general = g
      ? `<div class="mb-1 flex flex-col"><b>${esc(g.name)}</b>${muted(`${g.victories} vitórias · ${g.defeats} derrotas`)}</div>
         <div class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 text-[12.5px]">${skill('Ataque', g.attack, COLORS.red)}${skill('Defesa', g.defense, COLORS.blue)}${skill('Manobra', g.maneuver, COLORS.green)}${skill('Cerco', g.siege, COLORS.gold)}</div>`
      : mutedBlock('Sem comandante.');
    const posicao = kvGrid([
      kv('pin', 'Localização', pLink(sim, a.location)),
      kv('mountain', 'Terreno', esc(terrainInfo(mp.terrain).name)),
      kv('flag', 'Controlado por', cLink(sim, ps.controller)),
      kv('anchor', 'Transporte', a.naval ? 'Em navios' : 'Por terra'),
    ]);
    const route = a.path.length
      ? rows(a.path.slice(0, 10).map((p, i) => row(`<span class="${MUTED} w-5 shrink-0">${i + 1}.</span>${grow(pLink(sim, p))}`)).join('')) +
        (a.path.length > 10 ? mutedBlock(`… mais ${a.path.length - 10} etapas`) : '')
      : mutedBlock('Sem rota.');
    const ordens =
      hint('Com o exército selecionado, clique com o botão direito em um estado para ordenar a marcha.') +
      actions(
        button('Parar', { size: 'sm', attrs: 'data-action="stop"' }) +
          button('Voltar para casa', { size: 'sm', attrs: 'data-action="home"' }) +
          button('Dividir', { size: 'sm', attrs: 'data-action="split"' }) +
          button('Unir exércitos aqui', { size: 'sm', attrs: 'data-action="merge"' }) +
          button('Dissolver', { size: 'sm', tone: 'danger', attrs: 'data-action="disband"' }),
      );
    return (
      situation +
      battleLink +
      section('Tropas', 'sword', tropas) +
      section('Condição', 'smile', condicao) +
      section('Comandante', 'helmet', general) +
      section('Posição', 'pin', posicao) +
      section('Rota', 'flag', route) +
      section('Ordens', 'gear', ordens)
    );
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
