// Painel do estado: dono, controle, nucleos, populacao, economia, terreno, cerco, cidades e acoes.
import { fmtArea, fmtCompact, fmtInt, fmtMoney } from '../../core/format';
import { CULTURES } from '../../data/cultures';
import { RELIGIONS } from '../../data/religions';
import { RESOURCES } from '../../data/resources';
import { terrainInfo } from '../../data/terrain';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { bar, esc, icon, kv } from '../dom';
import type { GameUI } from '../game/GameUI';
import { armyStatus, cLink, countryOptions, dateOf, kvGrid, pLink, sec } from './common';
import { BasePanel } from './Panel';

export class ProvincePanel extends BasePanel {
  private transferTo = '';

  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
  }

  protected close(): void {
    this.ui.closeRight();
  }

  // Sem paz automatica, ocupacao por nacao inimiga vira anexacao apos um ano.
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
    return `${icon('pin', 40)}
      <div class="titles">
        <h2>${esc(mp.name)}</h2>
        <div class="sub">${cLink(sim, ps.owner)} · ${esc(terrainInfo(mp.terrain).name)}${sim.provinces.isCapital(this.id) ? ' · capital nacional' : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="px-btn square" data-close title="Fechar">${icon('close', 16)}</button>
        <button class="px-btn square" data-action="focus" title="Centralizar">${icon('target', 16)}</button>
      </div>`;
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
      kv('swords', 'Controle', occupied ? `${cLink(sim, ps.controller)} <span class="muted">desde ${dateOf(sim, ps.occupiedSince)}${this.annexNote()}</span>` : 'Próprio'),
      kv('crown', 'Núcleos', ps.cores.map((c) => cLink(sim, c)).join(', ') || '—'),
      kv('house', 'Cidade principal', esc(sim.provinces.cityName(this.id))),
      kv('people', 'População', fmtInt(ps.population)),
      kv('pin', 'Área', fmtArea(mp.area)),
      kv('building', 'Desenvolvimento', ps.development.toFixed(1)),
      kv('coins', 'Produção mensal', fmtMoney(output)),
      kv('coins', 'Recurso', esc(RESOURCES[ps.resource].name)),
      kv('mountain', 'Terreno', `${esc(t.name)} <span class="muted">(defesa ×${t.defense.toFixed(2)})</span>`),
      kv('info', 'Efeitos do terreno', `<span style="white-space:normal">${esc(t.effects || '—')}</span>`),
      kv('castle', 'Fortificação', `Nível ${ps.fort}`),
      kv('fire', 'Agitação', `${Math.round(ps.unrest)}%`),
      `<span></span><div class="full">${bar(ps.unrest / 100, 'var(--red-2)')}</div>`,
      kv('skull', 'Devastação', `${Math.round(ps.devastation * 100)}%`),
      kv('people', 'Cultura', esc(CULTURES[ps.culture].name)),
      kv('temple', 'Religião', esc(RELIGIONS[ps.religion].name)),
      kv('anchor', 'Geografia', [mp.coast > 0 ? 'costeira' : 'interior', mp.river > 0 ? 'com rio' : '', mp.island ? 'ilha' : ''].filter(Boolean).join(', ')),
      ps.epidemic > 0 ? kv('skull', 'Epidemia', `ativa (${Math.ceil(ps.epidemic / 30)} meses)`) : '',
    ]);
    const siege = ps.siege
      ? sec('Cerco', 'castle', `<div class="row"><span class="grow">${esc(sim.provinces.cityName(this.id))} cercada por ${cLink(sim, ps.siege.country)}</span><span class="num">${Math.min(100, Math.round((ps.siege.progress / ps.siege.needed) * 100))}%</span></div>${bar(ps.siege.progress / ps.siege.needed, 'var(--gold)')}<div class="muted">Iniciado em ${dateOf(sim, ps.siege.start)} · guarnição ≈ ${fmtCompact(sim.military.garrison(this.id))}</div>`)
      : '';
    const cities = sim.cities.provinceCities(this.id);
    const cityTable = `<table class="mini-table"><tr><th>Cidade</th><th class="num">Pop.</th><th class="num">Import.</th><th class="num">Infra.</th><th class="num">Produção</th><th class="num">Estrat.</th></tr>${cities
      .map((c) => `<tr><td>${c.isCapital ? icon('castle', 12) + ' ' : ''}${esc(c.name)}</td><td class="num">${fmtCompact(c.population)}</td><td class="num">${Math.round(c.importance)}</td><td class="num">${Math.round(c.infrastructure)}</td><td class="num">${fmtCompact(c.production)}</td><td class="num">${Math.round(c.strategic)}</td></tr>`)
      .join('')}</table>`;
    const armies = sim.index.armiesIn(this.id);
    const armyRows = armies.length
      ? armies.map((a) => `<div class="row link" data-army="${a.id}">${icon('sword', 16)}<span class="grow">${esc(a.name)} <span class="muted">${esc(armyStatus(sim, a))}</span></span><span class="num">${fmtCompact(soldiersOf(a))}</span></div>`).join('')
      : '<div class="muted">Nenhum exército.</div>';
    const neighbors = mp.nb
      .map(([q]) => `<div class="row"><span class="grow">${pLink(sim, q)}</span><span class="muted">${esc(sim.country(sim.state.provinces[q].owner).name)}</span></div>`)
      .join('');
    const actions = `
      <div class="action"><button class="px-btn small" data-action="incite">${icon('fire', 14)} Incitar revolta</button><button class="px-btn small" data-action="fortify">${icon('castle', 14)} Fortificar</button></div>
      <div class="action"><select class="px-select" data-change="pick" data-f="to">${countryOptions(sim, ps.owner, Number(this.transferTo || -1))}</select><button class="px-btn small" data-action="transfer">Transferir estado</button></div>`;
    return dados + siege + sec('Cidades', 'house', cityTable) + sec('Exércitos presentes', 'sword', `<div class="rows">${armyRows}</div>`) + sec('Vizinhos', 'pin', `<div class="rows">${neighbors}</div>`) + sec('Ações', 'gear', actions);
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
