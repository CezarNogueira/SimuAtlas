// Painel da nacao: dados gerais, economia, militar, diplomacia, territorios, historico e acoes de estado.
import { formatDuration } from '../../core/calendar';
import { fmtArea, fmtCompact, fmtDec, fmtInt, fmtMoney, fmtPct, fmtSignedPct } from '../../core/format';
import { CULTURES } from '../../data/cultures';
import { GOVERNMENT_IDS, GOVERNMENTS } from '../../data/governments';
import { IDEOLOGIES } from '../../data/ideologies';
import { PERSONALITIES, PERSONALITY_IDS } from '../../data/personalities';
import { RELIGIONS } from '../../data/religions';
import { RESOURCES } from '../../data/resources';
import { terrainInfo } from '../../data/terrain';
import { cavalryName, eraName, hasAirForce, nextTech, unlockedTechs } from '../../data/techs';
import { relationLabel, TREATY_NAMES } from '../../sim/engines/DiplomacyEngine';
import { soldiersOf } from '../../sim/engines/MilitaryEngine';
import { GOAL_NAMES } from '../../sim/engines/WarEngine';
import { EVENTS } from '../../sim/events/definitions';
import { agePt } from '../../sim/names';
import type { ActionResult, PlayerGoal, TreatyAction } from '../../sim/PlayerActions';
import type { War } from '../../state/types';
import { chartColor, LineChart } from '../charts/LineChart';
import { bar, centerBar, esc, flag, icon, kv } from '../dom';
import type { GameUI } from '../game/GameUI';
import { armyStatus, cLink, countryOptions, dateOf, historyList, kvGrid, pLink, sec, warLink } from './common';
import { BasePanel } from './Panel';

const barRow = (v: number, color: string) => `<span></span><div class="full">${bar(v, color)}</div>`;

export class NationPanel extends BasePanel {
  private form: Record<string, string> = { target: '', goal: 'conquest', dip: '', gov: '', pers: '', event: EVENTS[0].id, name: '' };
  private lastResult = '';
  private charts: LineChart[] = [];

  constructor(ui: GameUI, readonly id: number) {
    super(ui, 'right');
    this.tab = 'geral';
  }

  protected alive(): boolean {
    return !!this.sim.country(this.id);
  }

  protected tabs(): [string, string][] {
    const c = this.sim.country(this.id);
    if (!c.alive) return [['geral', 'Geral'], ['historico', 'Histórico']];
    const base: [string, string][] = [['geral', 'Geral'], ['economia', 'Economia'], ['militar', 'Militar'], ['diplomacia', 'Diplomacia'], ['territorio', 'Territórios'], ['historico', 'Histórico']];
    if (c.kind === 'nation') base.push(['acoes', 'Ações']);
    return base;
  }

  protected isStatic(): boolean {
    return this.tab === 'acoes';
  }

  protected close(): void {
    this.ui.closeRight();
  }

  protected renderHead(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const gov = GOVERNMENTS[c.government];
    const title = c.kind === 'nation' ? sim.countries.formalName(c.id) : c.name;
    return `${flag(c, 64)}
      <div class="titles">
        <h2>${esc(title)}</h2>
        <div class="sub">${esc(c.name)} · ${esc(gov.name)}${c.alive ? '' : ` · extinta em ${dateOf(sim, c.died)}`}</div>
        <div class="sub">${esc(gov.rulerTitle)} ${esc(c.ruler.name)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="px-btn square" data-close title="Fechar (Esc)">${icon('close', 16)}</button>
        <button class="px-btn square" data-action="focus" title="Centralizar no mapa">${icon('target', 16)}</button>
      </div>`;
  }

  protected renderBody(): string {
    switch (this.tab) {
      case 'economia': return this.economia();
      case 'militar': return this.militar();
      case 'diplomacia': return this.diplomacia();
      case 'territorio': return this.territorio();
      case 'historico': return historyList(this.sim, this.sim.history.forCountry(this.id, 150));
      case 'acoes': return this.acoes();
      default: return this.geral();
    }
  }

  protected afterRender(): void {
    for (const ch of this.charts) ch.destroy();
    this.charts = [];
    const series = this.sim.state.stats.countries[this.id];
    const c = this.sim.country(this.id);
    this.bodyEl.querySelectorAll<HTMLCanvasElement>('canvas[data-chart]').forEach((canvas) => {
      const key = canvas.dataset.chart as 'pop' | 'gdp' | 'army' | 'provinces';
      if (!series) return;
      const fmt = key === 'gdp' ? fmtMoney : key === 'provinces' ? fmtInt : fmtCompact;
      this.charts.push(new LineChart(canvas, { x: series.years, series: [{ label: c.name, color: chartColor(c.color), values: series[key] }], yFormat: fmt, xFormat: String }));
    });
  }

  destroy(): void {
    for (const ch of this.charts) ch.destroy();
    super.destroy();
  }

  private geral(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const gov = GOVERNMENTS[c.government];
    const pers = PERSONALITIES[c.personality];
    const gdppc = c.population > 0 ? c.gdp / c.population : 0;
    const avgIncome = gdppc * (1 - c.taxRate) * (1 - c.unemployment);
    const owned = sim.index.ownedBy[c.id] ?? [];
    let production = 0;
    const resources = new Map<string, number>();
    for (const p of owned) {
      production += sim.economy.provinceOutput(p, c);
      const r = sim.state.provinces[p].resource;
      resources.set(r, (resources.get(r) ?? 0) + 1);
    }
    const topRes = [...resources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, n]) => `${RESOURCES[r as keyof typeof RESOURCES].name} (${n})`).join(', ') || '—';
    const nation = c.kind === 'nation' && c.alive;
    const rank = (m: 'population' | 'gdp' | 'army' | 'area' | 'tech') => (nation ? ` <span class="muted">#${sim.stats.rankOf(c.id, m)}</span>` : '');
    const next = nextTech(c.tech);
    const age = agePt(c.ruler.birthDay, sim.day);
    const wars = sim.wars.warsOf(c.id);
    const vassals = sim.state.countries.filter((v) => v.alive && v.overlord === c.id);
    const rebelInfo = c.rebel ? `<div class="banner red">${icon('fire', 20)} Facção rebelde (${esc({ separatist: 'separatista', revolution: 'revolucionária', restoration: 'restauracionista', civil_war: 'guerra civil' }[c.rebel.type])}) contra ${cLink(sim, c.rebel.target)}</div>` : '';

    const pg = sim.population.growthInfo(c);
    const brakes = ([
      ['instabilidade', pg.stability], ['guerra', pg.war], ['falta de terras', pg.crowding], ['ocupação', pg.occupation],
      ['destruição', pg.devastation], ['epidemias', pg.epidemic], ['fome e escassez', pg.hardship],
    ] as const).filter(([, v]) => v <= -0.00005).map(([label, v]) => `${label} ${fmtSignedPct(v, 2)}`);
    const dados = kvGrid([
      kv('castle', 'Capital', c.capital < 0 ? '—' : sim.provinces.cityName(c.capital) === sim.provinces.name(c.capital) ? pLink(sim, c.capital) : `${esc(sim.provinces.cityName(c.capital))} <span class="muted">(${pLink(sim, c.capital)})</span>`),
      kv('people', 'População', fmtInt(c.population) + rank('population')),
      kv('chart', 'Crescimento populacional', `<span class="${pg.rate >= 0 ? 'pos' : 'neg'}">${fmtSignedPct(pg.rate, 2)} ao ano</span> <span class="muted">(natural ${fmtPct(pg.base, 2)})</span>`),
      kv('info', 'Freios ao crescimento', brakes.length ? `<span class="muted">${brakes.join(' · ')}</span>` : '<span class="muted">nenhum</span>'),
      kv('pin', 'Área', fmtArea(c.area) + rank('area')),
      kv('chart', 'PIB', fmtMoney(c.gdp) + rank('gdp')),
      kv('coins', 'PIB per capita', fmtMoney(gdppc)),
      kv('coins', 'Renda média', fmtMoney(avgIncome)),
      kv('chart', 'Crescimento do PIB', `<span class="${c.growth >= 0 ? 'pos' : 'neg'}">${fmtSignedPct(c.growth)}</span>`),
      kv('building', 'Produção anual', fmtMoney(production * 12)),
      kv('coins', 'Recursos', '') + `<span></span><span class="list">${esc(topRes)}</span>`,
      kv('chest', 'Tesouro', fmtMoney(c.treasury)),
      kv('helmet', 'Manpower', `${fmtCompact(c.manpower)} / ${fmtCompact(c.maxManpower)}`),
    ]);
    const sociedade = kvGrid([
      kv('scales', 'Estabilidade', `${Math.round(c.stability)}%`), barRow(c.stability / 100, 'var(--green)'),
      kv('coins', 'Corrupção', fmtPct(c.corruption, 0)), barRow(c.corruption, 'var(--red-2)'),
      kv('smile', 'Felicidade', `${Math.round(c.happiness)}%`), barRow(c.happiness / 100, 'var(--gold)'),
      kv('crown', 'Prestígio', `${Math.round(c.prestige)}`), barRow(c.prestige / 100, 'var(--blue)'),
      kv('swords', 'Exaustão de guerra', `${Math.round(c.warExhaustion)}%`),
      kv('fire', 'Expansão agressiva', `${Math.round(c.aggressiveExpansion)}`),
    ]);
    const estado = kvGrid([
      kv('crown', 'Governo', esc(gov.name)),
      kv('book', 'Ideologia', esc(IDEOLOGIES[c.ideology].name)),
      kv('temple', 'Religião', esc(RELIGIONS[c.religion].name)),
      kv('people', 'Cultura', esc(CULTURES[c.culture].name)),
      kv('info', 'Personalidade (IA)', `<span title="${esc(pers.description)}">${esc(pers.name)}</span>`),
      kv('gear', 'Tecnologia', `${fmtDec(c.tech)} · ${esc(eraName(c.tech))}${rank('tech')}`),
      kv('gear', 'Próxima descoberta', next ? esc(next.name) : '—'),
      kv('sword', 'Poder militar', fmtCompact(sim.countries.strength(c.id)) + rank('army')),
      kv('scroll', 'Diplomacia autônoma', c.ai ? 'Sim' : 'Não (controle manual)'),
    ]);
    const skills = (label: string, v: number) => `<span>${label}</span>${bar(v / 10, 'var(--blue)')}<span>${v}</span>`;
    const governante = `
      <div class="row"><b class="grow">${esc(gov.rulerTitle)} ${esc(c.ruler.name)}</b><span class="muted">casa ${esc(c.ruler.house)} · ${age} anos · desde ${sim.year(c.ruler.startDay)}</span></div>
      <div class="skills">${skills('Administração', c.ruler.skills.adm)}${skills('Diplomacia', c.ruler.skills.dip)}${skills('Militar', c.ruler.skills.mil)}</div>
      <div style="margin-top:4px">${c.ruler.traits.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>`;
    const situacao = [
      wars.length ? `<div>${icon('swords', 16)} Em guerra: ${wars.map((w) => warLink(w)).join(', ')}</div>` : `<div>${icon('dove', 16)} Em paz</div>`,
      c.overlord >= 0 ? `<div>${icon('crown', 16)} Vassalo de ${cLink(sim, c.overlord)}</div>` : '',
      vassals.length ? `<div>${icon('crown', 16)} Vassalos: ${vassals.map((v) => cLink(sim, v.id)).join(', ')}</div>` : '',
      c.modifiers.length ? `<div>${c.modifiers.map((m) => `<span class="chip gold" title="até ${dateOf(sim, m.until)}">${esc(m.name)}</span>`).join('')}</div>` : '',
      `<div class="muted">Fundada em ${sim.year(c.founded)} · ${c.warsWon} guerras vencidas, ${c.warsLost} perdidas · ${c.battlesWon}/${c.battlesLost} batalhas</div>`,
    ].join('');
    const charts = sim.state.stats.countries[c.id]?.years.length
      ? `<div class="chart-title">${icon('people', 16)} População</div><canvas class="spark" data-chart="pop"></canvas><div class="chart-title">${icon('chart', 16)} PIB</div><canvas class="spark" data-chart="gdp"></canvas>`
      : '';
    return rebelInfo + sec('Dados gerais', 'globe', dados) + sec('Sociedade', 'scales', sociedade) + sec('Governo', 'crown', estado) + sec('Governante', 'crown', governante) + sec('Situação', 'flag', situacao) + (charts ? sec('Evolução', 'chart', charts) : '');
  }

  private economia(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const gdppc = c.population > 0 ? c.gdp / c.population : 0;
    const base = sim.economy.gdpPerCapita(c);
    const war = sim.economy.warEconomy(c);
    const army = c.armySize * sim.economy.soldierMonthlyCost(c) * war.warFactor;
    const navy = ((c.navy * base * 30) / 12) * (war.atWar ? 1.5 : 1);
    const air = ((c.airForce * base * 60) / 12) * (war.atWar ? 1.5 : 1);
    const admin = (c.gdp / 12) * 0.03;
    const interest = Math.max(0, c.expenses - army - navy - air - admin);
    const balance = c.income - c.expenses;
    const trades = sim.diplomacy.partners(c.id, 'trade');
    const sanctions = sim.state.treaties.filter((t) => t.active && t.type === 'sanction' && t.target === c.id).length;
    const rows = kvGrid([
      kv('chart', 'PIB anual', fmtMoney(c.gdp)),
      kv('coins', 'PIB per capita', fmtMoney(gdppc)),
      kv('chart', 'Crescimento anual', `<span class="${c.growth >= 0 ? 'pos' : 'neg'}">${fmtSignedPct(c.growth)}</span>`),
      kv('coins', 'Receita mensal', fmtMoney(c.income)),
      kv('', '· impostos e saques', fmtMoney(c.income - c.tradeIncome)),
      kv('', '· comércio', fmtMoney(c.tradeIncome)),
      kv('coins', 'Despesa mensal', fmtMoney(c.expenses)),
      kv('', '· exército', fmtMoney(army)),
      kv('', '· marinha', fmtMoney(navy)),
      kv('', '· força aérea', fmtMoney(air)),
      kv('', '· administração', fmtMoney(admin)),
      kv('', '· juros da dívida', fmtMoney(interest)),
      kv('scales', 'Saldo mensal', `<span class="${balance >= 0 ? 'pos' : 'neg'}">${fmtMoney(balance)}</span>`),
      kv('chest', 'Tesouro', fmtMoney(c.treasury)),
      kv('scroll', 'Dívida', `${fmtMoney(c.debt)} <span class="muted">(${fmtPct(c.gdp > 0 ? c.debt / c.gdp : 0, 0)} do PIB)</span>`),
      kv('fire', 'Inflação', fmtPct(c.inflation)),
      kv('people', 'Desemprego', fmtPct(c.unemployment)),
      kv('coins', 'Impostos', fmtPct(c.taxRate)),
      kv('scroll', 'Acordos comerciais', trades.length ? trades.map((t) => cLink(sim, t)).join(', ') : '0'),
      kv('skull', 'Sanções sofridas', String(sanctions)),
    ]);
    const mods = c.modifiers.filter((m) => m.economy || m.growth);
    const modsHtml = mods.length ? mods.map((m) => `<span class="chip ${((m.economy ?? 0) + (m.growth ?? 0)) >= 0 ? 'green' : 'red'}">${esc(m.name)} até ${sim.year(m.until)}</span>`).join('') : '<span class="muted">Nenhum</span>';
    const chart = sim.state.stats.countries[c.id]?.years.length ? `<canvas class="spark" style="height:140px" data-chart="gdp"></canvas>` : '';
    const inflationLabel = c.inflation >= 0.3 ? 'escassez grave' : c.inflation >= 0.2 ? 'escassez' : c.inflation >= 0.1 ? 'alta' : 'controlada';
    const warHint =
      war.atWar || war.devastation > 0.05
        ? '<div class="hint-box">A guerra custa caro: tropas em campanha, armamentos e munição são pagos com dívida; a mobilização, a destruição e a ocupação fazem faltar produtos e a inflação sobe. Estados arrasados produzem menos até serem reconstruídos, e sem crédito os soldos atrasam e as tropas desertam.</div>'
        : '';
    const warRows = kvGrid([
      kv('swords', 'Situação', war.atWar ? `Em guerra · tropas custam ×${fmtDec(war.warFactor)}` : 'Em paz'),
      kv('coins', 'Gasto militar', `${fmtMoney(war.militaryCost)} <span class="muted">(${fmtPct(c.income > 0 ? war.militaryCost / c.income : 0, 0)} da receita)</span>`),
      kv('people', 'Mobilização', fmtPct(war.mobilization, 1)),
      kv('scroll', 'Crédito de guerra', war.atWar ? (war.credit > 0 ? fmtMoney(war.credit) : '<span class="neg">esgotado</span>') : '—'),
      kv('fire', 'Inflação', `${fmtPct(c.inflation)} <span class="muted">(${inflationLabel})</span>`),
      kv('skull', 'Infraestrutura destruída', fmtPct(war.devastation, 0)),
      barRow(war.devastation, 'var(--red-2)'),
      kv('building', 'Produção perdida', `${fmtPct(war.lostShare, 0)} <span class="muted">(${fmtPct(war.occupiedShare, 0)} em estados ocupados)</span>`),
      kv('pin', 'Estados arrasados', String(war.ruined)),
    ]);
    return sec('Finanças', 'coins', rows) + sec('Economia de guerra', 'swords', warHint + warRows) + sec('Modificadores', 'info', modsHtml) + (chart ? sec('PIB ao longo do tempo', 'chart', chart) : '');
  }

  private militar(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const armies = sim.military.armiesOf(c.id);
    let inf = 0;
    let cav = 0;
    let art = 0;
    let exp = 0;
    let morale = 0;
    let supply = 0;
    for (const a of armies) {
      const n = soldiersOf(a);
      inf += a.infantry;
      cav += a.cavalry;
      art += a.artillery;
      exp += a.experience * n;
      morale += a.morale * n;
      supply += a.supply * n;
    }
    const total = Math.max(1, inf + cav + art);
    const armyCost = c.armySize * sim.economy.soldierMonthlyCost(c);
    const rows = kvGrid([
      kv('sword', 'Exército', `${fmtInt(inf + cav + art)} soldados`),
      kv('helmet', 'Infantaria', fmtInt(inf)),
      kv('flag', cavalryName(c.tech), fmtInt(cav)),
      kv('castle', 'Artilharia', fmtInt(art)),
      kv('anchor', 'Marinha', `${Math.round(c.navy)} navios`),
      kv('plane', 'Força aérea', hasAirForce(c.tech) ? `${Math.round(c.airForce)} esquadrões` : 'Não disponível'),
      kv('trophy', 'Experiência', fmtPct(exp / total, 0)),
      kv('smile', 'Moral', fmtPct(morale / total, 0)), barRow(morale / total, 'var(--green)'),
      kv('chest', 'Logística', fmtPct(supply / total, 0)),
      kv('people', 'Manpower', `${fmtCompact(c.manpower)} / ${fmtCompact(c.maxManpower)}`),
      kv('coins', 'Gasto militar', `${fmtMoney(armyCost)}/mês <span class="muted">(${fmtPct(c.income > 0 ? armyCost / c.income : 0, 0)} da receita)</span>`),
      kv('target', 'Efetivo desejado', fmtCompact(sim.military.targetArmySize(c))),
      kv('swords', 'Batalhas', `${c.battlesWon} vitórias · ${c.battlesLost} derrotas`),
    ]);
    const generals = c.generals.length
      ? `<table class="mini-table"><tr><th>General</th><th class="num">Atq</th><th class="num">Def</th><th class="num">Man</th><th class="num">Cer</th><th class="num">V/D</th></tr>${c.generals
          .map((g) => `<tr${g.army >= 0 ? ` class="link" data-army="${g.army}"` : ''}><td>${esc(g.name)}${g.army >= 0 ? ' ' + icon('sword', 12) : ''}</td><td class="num">${g.attack}</td><td class="num">${g.defense}</td><td class="num">${g.maneuver}</td><td class="num">${g.siege}</td><td class="num">${g.victories}/${g.defeats}</td></tr>`)
          .join('')}</table>`
      : '<div class="muted">Nenhum general.</div>';
    const armyRows = armies.length
      ? `<table class="mini-table">${armies.map((a) => `<tr class="link" data-army="${a.id}"><td>${esc(a.name)}<br><span class="muted">${esc(armyStatus(sim, a))}</span></td><td class="num">${fmtCompact(soldiersOf(a))}</td></tr>`).join('')}</table>`
      : '<div class="muted">Sem exércitos mobilizados.</div>';
    return sec('Forças armadas', 'sword', rows) + sec('Exércitos', 'flag', armyRows) + sec('Generais', 'helmet', generals) + sec('Guerras', 'swords', this.warLists());
  }

  private warLists(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const current = sim.wars.warsOf(c.id);
    const cur = current.length
      ? current.map((w) => `<div class="row">${icon('swords', 16)}<span class="grow">${warLink(w)}</span><span class="num">${w.warscore >= 0 === (sim.wars.sideOf(w, c.id) === 0) ? '+' : '−'}${Math.abs(Math.round(w.warscore))}</span></div>`).join('')
      : '<div class="muted">Nenhuma guerra em andamento.</div>';
    const past = c.pastWars
      .slice(-12)
      .reverse()
      .map((wid) => sim.index.warById.get(wid))
      .filter((w): w is War => !!w && !!w.result)
      .map((w) => {
        const side = w.attackers.includes(c.id) ? 0 : w.defenders.includes(c.id) ? 1 : -1;
        const res = w.result?.winner;
        const label = res === 'white' ? '<span class="chip">Paz branca</span>' : side < 0 ? '<span class="chip">—</span>' : (res === 'attackers') === (side === 0) ? '<span class="chip green">Vitória</span>' : '<span class="chip red">Derrota</span>';
        return `<div class="row"><span class="grow">${warLink(w)}</span><span class="muted">${sim.year(w.start)}–${sim.year(w.end)}</span>${label}</div>`;
      })
      .join('');
    return `<div class="rows">${cur}</div><div class="muted" style="margin-top:6px">Guerras anteriores:</div><div class="rows">${past || '<div class="muted">Nenhuma.</div>'}</div>`;
  }

  private diplomacia(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const dip = sim.diplomacy;
    const allies = dip.partners(c.id, 'alliance');
    const enemies = [...sim.wars.enemiesOf(c.id)];
    const vassals = sim.state.countries.filter((v) => v.alive && v.overlord === c.id).map((v) => v.id);
    const treaties = dip.treatiesOf(c.id).filter((t) => t.type !== 'peace');
    const guaranteesGiven = sim.state.treaties.filter((t) => t.active && t.type === 'guarantee' && t.members[0] === c.id).map((t) => t.target);
    const guaranteed = dip.guarantorsOf(c.id);
    const list = (ids: number[]) => (ids.length ? ids.map((i) => cLink(sim, i)).join(', ') : '<span class="muted">Nenhum</span>');
    const summary = kvGrid([
      kv('shield', 'Aliados', list(allies)),
      kv('swords', 'Inimigos (em guerra)', list(enemies)),
      kv('crown', 'Suserano', c.overlord >= 0 ? cLink(sim, c.overlord) : '<span class="muted">Independente</span>'),
      kv('crown', 'Vassalos', list(vassals)),
      kv('shield', 'Garante', list(guaranteesGiven)),
      kv('shield', 'Garantido por', list(guaranteed)),
    ]);
    const pool = new Set<number>([...sim.countries.neighbors(c.id), ...allies, ...enemies, ...vassals]);
    for (const t of treaties) {
      for (const m of t.members) pool.add(m);
      if (t.target >= 0) pool.add(t.target);
    }
    pool.delete(c.id);
    const rels = [...pool]
      .filter((o) => sim.country(o)?.alive)
      .map((o) => [o, dip.relation(c.id, o)] as [number, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
    const relRows = rels.length
      ? rels.map(([o, r]) => `<div class="row"><span class="grow">${cLink(sim, o)}</span><span style="width:84px">${centerBar(r / 100)}</span><span class="num" style="width:34px;text-align:right">${Math.round(r)}</span><span class="muted" style="width:92px;text-align:right">${relationLabel(r)}</span></div>`).join('')
      : '<div class="muted">Sem relações conhecidas.</div>';
    const treatyRows = treaties.length
      ? `<table class="mini-table"><tr><th>Tratado</th><th>Com</th><th class="num">Até</th></tr>${treaties
          .map((t) => {
            const others = [...t.members.filter((m) => m !== c.id), ...(t.target >= 0 && t.target !== c.id ? [t.target] : [])];
            return `<tr><td>${esc(TREATY_NAMES[t.type])}</td><td>${others.slice(0, 3).map((o) => cLink(sim, o)).join(', ')}</td><td class="num">${t.end >= 0 ? sim.year(t.end) : '—'}</td></tr>`;
          })
          .join('')}</table>`
      : '<div class="muted">Nenhum tratado ativo.</div>';
    return sec('Resumo', 'scroll', summary) + sec('Relações', 'scales', `<div class="rows">${relRows}</div>`) + sec('Tratados', 'scroll', treatyRows) + sec('Guerras', 'swords', this.warLists());
  }

  private territorio(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const owned = [...(sim.index.ownedBy[c.id] ?? [])];
    const summary = kvGrid([
      kv('pin', 'Estados', String(owned.length)),
      kv('flag', 'Conquistados', String(c.provincesConquered)),
      kv('skull', 'Perdidos', String(c.provincesLost)),
      kv('pin', 'Área', fmtArea(c.area)),
    ]);
    const changes = c.recentChanges
      .slice()
      .reverse()
      .slice(0, 20)
      .map((ch) => {
        const gained = ch.to === c.id;
        const other = gained ? ch.from : ch.to;
        return `<div class="row"><span class="muted" style="width:44px">${sim.year(ch.day)}</span><span class="chip ${gained ? 'green' : 'red'}">${gained ? 'Ganhou' : 'Perdeu'}</span><span class="grow">${pLink(sim, ch.province)}</span><span class="muted">${other >= 0 ? `${gained ? 'de' : 'para'} ${esc(sim.country(other).name)}` : ''}</span></div>`;
      })
      .join('');
    const cities = sim.cities.citiesOf(c.id, 10);
    const cityRows = cities.length
      ? `<table class="mini-table"><tr><th>Cidade</th><th class="num">População</th><th class="num">Import.</th><th class="num">Estrat.</th></tr>${cities
          .map((ci) => `<tr class="link" data-province="${ci.province}"><td>${ci.isCapital ? icon('castle', 12) + ' ' : ''}${esc(ci.name)}</td><td class="num">${fmtCompact(ci.population)}</td><td class="num">${Math.round(ci.importance)}</td><td class="num">${Math.round(ci.strategic)}</td></tr>`)
          .join('')}</table>`
      : '<div class="muted">Sem cidades.</div>';
    owned.sort((a, b) => sim.state.provinces[b].population - sim.state.provinces[a].population);
    const provRows = owned.length
      ? `<table class="mini-table"><tr><th>Estado</th><th class="num">Pop.</th><th class="num">Desenv.</th><th class="num">Agit.</th><th>Terreno</th></tr>${owned
          .slice(0, 80)
          .map((p) => {
            const ps = sim.state.provinces[p];
            return `<tr class="link" data-province="${p}"><td>${esc(sim.map.provinces[p].name)}${ps.controller !== c.id ? ' ' + icon('swords', 12) : ''}</td><td class="num">${fmtCompact(ps.population)}</td><td class="num">${ps.development.toFixed(1)}</td><td class="num">${Math.round(ps.unrest)}%</td><td>${esc(terrainInfo(sim.map.provinces[p].terrain).name)}</td></tr>`;
          })
          .join('')}</table>${owned.length > 80 ? `<div class="muted">… e mais ${owned.length - 80} estados.</div>` : ''}`
      : '<div class="muted">Nenhum estado.</div>';
    const techs = unlockedTechs(c.tech);
    const techHtml = `${techs.map((t) => `<span class="chip" title="${esc(t.description)}">${esc(t.name)}</span>`).join('')}${nextTech(c.tech) ? `<div class="muted">Próxima: ${esc(nextTech(c.tech)?.name ?? '')} (nível ${nextTech(c.tech)?.level})</div>` : ''}`;
    const traits = [...c.traits, ...c.modifiers.map((m) => m.name)];
    const traitsHtml = traits.length ? traits.map((t) => `<span class="chip gold">${esc(t)}</span>`).join('') : `<span class="chip">${esc(PERSONALITIES[c.personality].name)}</span><span class="chip">${esc(CULTURES[c.culture].name)}</span><span class="chip">${esc(RELIGIONS[c.religion].name)}</span>`;
    return (
      sec('Território', 'pin', summary) +
      sec('Mudanças territoriais recentes', 'flag', changes || '<div class="muted">Nenhuma mudança recente.</div>') +
      sec('Cidades importantes', 'house', cityRows) +
      sec('Estados', 'pin', provRows) +
      sec('Tecnologias', 'gear', techHtml) +
      sec('Características', 'info', traitsHtml)
    );
  }

  private acoes(): string {
    const sim = this.sim;
    const c = sim.country(this.id);
    const f = this.form;
    const sel = (key: string, options: string) => `<select class="px-select" data-f="${key}" data-change="remember">${options}</select>`;
    const targetOpts = countryOptions(sim, c.id, Number(f.target || -1));
    const dipOpts = countryOptions(sim, c.id, Number(f.dip || -1));
    const wars = sim.wars.warsOf(c.id);
    const warRows = wars.length
      ? wars.map((w) => `<div class="action"><span class="grow">${warLink(w)}</span><button class="px-btn small" data-action="peace-white" data-war-id="${w.id}">Paz branca</button><button class="px-btn small" data-action="peace-win" data-war-id="${w.id}">Vencer</button><button class="px-btn small" data-action="peace-lose" data-war-id="${w.id}">Render-se</button></div>`).join('')
      : '<div class="muted">Nenhuma guerra ativa.</div>';
    const govOpts = GOVERNMENT_IDS.map((g) => `<option value="${g}"${g === (f.gov || c.government) ? ' selected' : ''}>${esc(GOVERNMENTS[g].name)}</option>`).join('');
    const persOpts = PERSONALITY_IDS.map((p) => `<option value="${p}"${p === (f.pers || c.personality) ? ' selected' : ''}>${esc(PERSONALITIES[p].name)}</option>`).join('');
    const eventOpts = EVENTS.map((e) => `<option value="${e.id}"${e.id === f.event ? ' selected' : ''}>${esc(e.name)}</option>`).join('');
    const goalOpts = (['conquest', 'annex', 'subjugate'] as const).map((g) => `<option value="${g}"${g === f.goal ? ' selected' : ''}>${esc(GOAL_NAMES[g])}</option>`).join('');
    const btn = (action: string, label: string, iconName: string) => `<button class="px-btn small" data-action="${action}">${icon(iconName, 14)} ${esc(label)}</button>`;
    return (
      `<div class="hint-box">Você é o observador e controlador deste mundo. As ações abaixo interferem diretamente na simulação.</div>` +
      (this.lastResult ? `<div class="banner gold">${icon('info', 16)} ${esc(this.lastResult)}</div>` : '') +
      sec('Controle', 'gear', `<div class="action"><span class="grow">Diplomacia autônoma: <b>${c.ai ? 'ativada' : 'desativada'}</b></span><button class="px-btn small" data-action="toggle-ai">${c.ai ? 'Assumir controle' : 'Devolver à IA'}</button></div>`) +
      sec('Guerra', 'swords', `
        <div class="action">${sel('target', targetOpts)}</div>
        <div class="action">${sel('goal', goalOpts)}<button class="px-btn small primary" data-action="declare">${icon('swords', 14)} Declarar guerra</button></div>
        <div class="rows" style="margin-top:6px">${warRows}</div>`) +
      sec('Diplomacia', 'scroll', `
        <div class="action">${sel('dip', dipOpts)}</div>
        <div class="action">${btn('alliance', 'Formar aliança', 'shield')}${btn('break-alliance', 'Romper aliança', 'skull')}${btn('nap', 'Não agressão', 'dove')}${btn('trade', 'Acordo comercial', 'coins')}</div>
        <div class="action">${btn('access', 'Acesso militar', 'flag')}${btn('guarantee', 'Garantir independência', 'shield')}${btn('sanction', 'Impor sanções', 'skull')}${btn('support', 'Apoiar (ouro)', 'chest')}</div>
        <div class="action">${btn('threaten', 'Ameaçar', 'sword')}${btn('recognize', 'Reconhecer independência', 'scroll')}${btn('coalition', 'Coalizão contra', 'swords')}</div>`) +
      sec('Política interna', 'crown', `
        <div class="action">${sel('gov', govOpts)}<button class="px-btn small" data-action="government">Mudar governo</button></div>
        <div class="action">${sel('pers', persOpts)}<button class="px-btn small" data-action="personality">Definir personalidade</button></div>
        <div class="action">${btn('stab-up', 'Estabilidade +15', 'scales')}${btn('stab-down', 'Estabilidade −15', 'scales')}${btn('corruption', 'Combater corrupção', 'coins')}${btn('prestige', 'Prestígio +15', 'crown')}</div>
        <div class="action">${btn('incite', 'Incitar rebelião', 'fire')}${btn('civil-war', 'Provocar guerra civil', 'fire')}</div>`) +
      sec('Recursos', 'chest', `<div class="action">${btn('grant-army', 'Conceder exército', 'sword')}${btn('grant-gold', 'Conceder ouro', 'coins')}${btn('tech', 'Avançar tecnologia', 'gear')}</div>`) +
      sec('Eventos', 'info', `<div class="action">${sel('event', eventOpts)}<button class="px-btn small" data-action="event">Disparar evento</button></div>`) +
      sec('Identidade', 'flag', `<div class="action"><input class="px-input" data-f="name" data-change="remember" placeholder="Novo nome" value="${esc(f.name)}"><button class="px-btn small" data-action="rename">Renomear</button></div>`)
    );
  }

  protected action(name: string, t: HTMLElement): void {
    const sim = this.sim;
    const a = this.ui.actions;
    const id = this.id;
    if (name === 'remember') {
      const key = t.dataset.f;
      if (key) this.form[key] = (t as HTMLInputElement).value;
      return;
    }
    if (name === 'focus') {
      this.ui.renderer.focusCountry(id);
      return;
    }
    for (const el of this.box.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-f]')) {
      if (el.dataset.f) this.form[el.dataset.f] = el.value;
    }
    const target = Number(this.form.target);
    const dip = Number(this.form.dip);
    const warId = Number(t.dataset.warId);
    const war = sim.index.warById.get(warId);
    const side = war ? sim.wars.sideOf(war, id) : -1;
    let r: ActionResult | null = null;
    switch (name) {
      case 'toggle-ai': r = a.toggleAI(id); break;
      case 'declare': r = Number.isFinite(target) ? a.declareWar(id, target, this.form.goal as PlayerGoal) : null; break;
      case 'peace-white': r = a.endWar(warId, 'white'); break;
      case 'peace-win': r = a.endWar(warId, side === 0 ? 'attackers' : 'defenders'); break;
      case 'peace-lose': r = a.endWar(warId, side === 0 ? 'defenders' : 'attackers'); break;
      case 'alliance':
      case 'nap':
      case 'trade':
      case 'access': r = a.treaty(id, dip, name as TreatyAction); break;
      case 'break-alliance': r = a.breakAlliance(id, dip); break;
      case 'guarantee': r = a.guarantee(id, dip); break;
      case 'sanction': r = a.sanction(id, dip); break;
      case 'support': r = a.support(id, dip); break;
      case 'threaten': r = a.threaten(id, dip); break;
      case 'recognize': r = a.recognize(id, dip); break;
      case 'coalition': r = a.coalition(id, dip); break;
      case 'government': r = a.changeGovernment(id, (this.form.gov || sim.country(id).government) as never); break;
      case 'personality': r = a.setPersonality(id, (this.form.pers || sim.country(id).personality) as never); break;
      case 'stab-up': r = a.adjust(id, 'stability', 15); break;
      case 'stab-down': r = a.adjust(id, 'stability', -15); break;
      case 'prestige': r = a.adjust(id, 'prestige', 15); break;
      case 'corruption': r = a.corruption(id, -0.1); break;
      case 'incite': r = a.incite(id); break;
      case 'civil-war': r = a.civilWar(id); break;
      case 'grant-army': r = a.grantArmy(id); break;
      case 'grant-gold': r = a.grantGold(id); break;
      case 'tech': r = a.boostTech(id); break;
      case 'event': r = a.triggerEvent(id, this.form.event); break;
      case 'rename': r = a.rename(id, this.form.name); break;
      default: break;
    }
    if (!r) return;
    this.lastResult = r.message;
    this.ui.toasts.info(r.message);
    this.refresh();
  }
}

export { formatDuration };
