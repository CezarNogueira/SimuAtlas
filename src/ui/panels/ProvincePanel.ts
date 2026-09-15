// Painel do estado: dono, controle, nucleos, populacao, economia, terreno, cerco, cidades e acoes.
import { fmtArea, fmtCompact, fmtInt, fmtMoney } from '../../core/format';
import { CULTURES } from '../../data/cultures';
import { RELIGIONS } from '../../data/religions';
import { RESOURCES } from '../../data/resources';
import { terrainInfo } from '../../data/terrain';
import { DEVASTATION_OUTPUT_LOSS } from '../../sim/engines/EconomyEngine';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import {
  actions,
  bar,
  barRow,
  button,
  closeButton,
  COLORS,
  FIELD_GROW,
  focusButton,
  grow,
  headButtons,
  headTitles,
  kv,
  kvFull,
  kvGrid,
  kvList,
  muted,
  mutedBlock,
  num,
  row,
  rows,
  section,
  stack,
  sub,
  table,
  td,
} from '../components';
import { esc, icon } from '../dom';
import type { GameUI } from '../game/GameUI';
import { armyStatus, cLink, countryOptions, dateOf, pLink } from './common';
import { BasePanel } from './Panel';

export class ProvincePanel extends BasePanel {
  private transferTo = '';

  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
  }

  protected close(): void {
    this.ui.closeRight();
  }

  // Sem paz automatica, ocupacao por nacao inimiga vira anexacao apos dois anos.
  private annexNote(): string {
    const sim = this.sim;
    const ps = sim.state.provinces[this.id];
    if (sim.state.settings.autoPeace || sim.country(ps.controller)?.kind !== 'nation' || !sim.index.atWar(ps.owner, ps.controller)) return '';
    const months = sim.wars.monthsToAnnex(this.id);
    return months < 0 ? '' : ` · anexação em ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  protected renderHead(): string {
    const sim = this.sim;
    const mp = sim.map.provinces[this.id];
    const ps = sim.state.provinces[this.id];
    const subtitle = `${cLink(sim, ps.owner)} · ${esc(terrainInfo(mp.terrain).name)}${sim.provinces.isCapital(this.id) ? ' · capital nacional' : ''}`;
    return `${icon('pin', 40)}${headTitles(esc(mp.name), [subtitle])}${headButtons(closeButton() + focusButton('Centralizar'))}`;
  }

  protected renderBody(): string {
    const sim = this.sim;
    const mp = sim.map.provinces[this.id];
    const ps = sim.state.provinces[this.id];
    const owner = sim.country(ps.owner);
    const t = terrainInfo(mp.terrain);
    const occupied = ps.controller !== ps.owner;
    const output = owner ? sim.economy.provinceOutput(this.id, owner) : 0;
    const dados = kvGrid([
      kv('flag', 'Dono', cLink(sim, ps.owner)),
      kv('swords', 'Controle', occupied ? `${cLink(sim, ps.controller)}${sub(`desde ${dateOf(sim, ps.occupiedSince)}${this.annexNote()}`)}` : 'Próprio'),
      kvList('crown', 'Núcleos', ps.cores.map((c) => cLink(sim, c)), '—'),
      kv('house', 'Cidade principal', esc(sim.provinces.cityName(this.id))),
      kv('people', 'População', fmtInt(ps.population)),
      kv('pin', 'Área', fmtArea(mp.area)),
      kv('building', 'Desenvolvimento', ps.development.toFixed(1)),
      kv('coins', 'Produção mensal', fmtMoney(output)),
      kv('coins', 'Recurso', esc(RESOURCES[ps.resource].name)),
      kv('mountain', 'Terreno', `${esc(t.name)}${sub(`defesa ×${t.defense.toFixed(2)}`)}`),
      kv('info', 'Efeitos do terreno', ''),
      kvFull(`<span class="text-[12.5px]">${esc(t.effects || '—')}</span>`),
      kv('castle', 'Fortificação', `Nível ${ps.fort}`),
      kv('fire', 'Agitação', `${Math.round(ps.unrest)}%`),
      barRow(ps.unrest / 100, COLORS.red),
      kv('skull', 'Destruição', `${Math.round(ps.devastation * 100)}%${ps.devastation >= 0.01 ? sub(`produção −${Math.round(ps.devastation * DEVASTATION_OUTPUT_LOSS * 100)}%`) : ''}`),
      kv('people', 'Cultura', esc(CULTURES[ps.culture].name)),
      kv('temple', 'Religião', esc(RELIGIONS[ps.religion].name)),
      kv('anchor', 'Geografia', [mp.coast > 0 ? 'costeira' : 'interior', mp.river > 0 ? 'com rio' : '', mp.island ? 'ilha' : ''].filter(Boolean).join(', ')),
      ps.epidemic > 0 ? kv('skull', 'Epidemia', `ativa${sub(`${Math.ceil(ps.epidemic / 30)} meses`)}`) : '',
    ]);
    const siegePct = ps.siege ? Math.min(100, Math.round((ps.siege.progress / ps.siege.needed) * 100)) : 0;
    const siege = ps.siege
      ? section(
          'Cerco',
          'castle',
          row(`${stack(`${esc(sim.provinces.cityName(this.id))} cercada por ${cLink(sim, ps.siege.country)}`)}${num(`${siegePct}%`)}`, { top: true }) +
            bar(ps.siege.progress / ps.siege.needed, COLORS.gold) +
            mutedBlock(`Iniciado em ${dateOf(sim, ps.siege.start)} · guarnição ≈ ${fmtCompact(sim.military.garrison(this.id))}`, 'mt-0.5'),
        )
      : '';
    const cities = sim.cities.provinceCities(this.id);
    const cityTable = table(
      [['Cidade'], ['Pop.', true], ['Import.', true], ['Infra.', true], ['Produção', true], ['Estrat.', true]],
      cities
        .map((c) => `<tr>${td(`${c.isCapital ? `${icon('castle', 12)} ` : ''}${esc(c.name)}`)}${td(fmtCompact(c.population), true)}${td(String(Math.round(c.importance)), true)}${td(String(Math.round(c.infrastructure)), true)}${td(fmtCompact(c.production), true)}${td(String(Math.round(c.strategic)), true)}</tr>`)
        .join(''),
    );
    const armies = sim.index.armiesIn(this.id);
    const armyRows = armies.length
      ? armies.map((a) => row(`${icon('sword', 16)}${stack(`${esc(a.name)}${sub(esc(armyStatus(sim, a)))}`)}${num(fmtCompact(soldiersOf(a)))}`, { link: true, top: true, attrs: `data-army="${a.id}"` })).join('')
      : mutedBlock('Nenhum exército.');
    const neighbors = mp.nb.map(([q]) => row(`${grow(pLink(sim, q))}${muted(esc(sim.country(sim.state.provinces[q].owner).name))}`)).join('');
    const acoes = `<div class="flex flex-col gap-1.5">${actions(button('Incitar revolta', { size: 'sm', icon: 'fire', attrs: 'data-action="incite"' }) + button('Fortificar', { size: 'sm', icon: 'castle', attrs: 'data-action="fortify"' }))}${actions(
      `<select class="${FIELD_GROW}" data-change="pick" data-f="to">${countryOptions(sim, ps.owner, Number(this.transferTo || -1))}</select>${button('Transferir estado', { size: 'sm', attrs: 'data-action="transfer"' })}`,
    )}</div>`;
    return dados + siege + section('Cidades', 'house', cityTable) + section('Exércitos presentes', 'sword', rows(armyRows)) + section('Vizinhos', 'pin', rows(neighbors)) + section('Ações', 'gear', acoes);
  }

  protected action(name: string, t: HTMLElement): void {
    const a = this.ui.actions;
    const ps = this.sim.state.provinces[this.id];
    if (name === 'pick') {
      this.transferTo = (t as HTMLSelectElement).value;
      return;
    }
    if (name === 'focus') {
      this.ui.renderer.focusProvince(this.id);
      return;
    }
    let r = null;
    if (name === 'incite') r = a.incite(ps.owner, this.id);
    else if (name === 'fortify') r = a.fortify(this.id);
    else if (name === 'transfer') {
      const to = Number(this.field('[data-f="to"]'));
      r = a.transferProvince(this.id, to);
    }
    if (r) {
      this.ui.toasts.info(r.message);
      this.refresh();
    }
  }
}
