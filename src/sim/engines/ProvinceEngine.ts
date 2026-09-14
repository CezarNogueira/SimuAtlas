// PROVINCE ENGINE: posse e controle de provincias, agitacao, desenvolvimento, nucleos e assimilacao.
import { clamp } from '../../core/math';
import { GOVERNMENTS } from '../../data/governments';
import type { ProvinceState } from '../../state/types';
import type { Simulation } from '../Simulation';

// occupation: anexacao, durante a guerra, de um estado ja ocupado ha tempo (ou de um pais dominado).
export type TransferReason = 'conquest' | 'peace' | 'independence' | 'annex' | 'revolt' | 'union' | 'restore' | 'return' | 'occupation';

export class ProvinceEngine {
  constructor(private sim: Simulation) {}

  get(id: number): ProvinceState {
    return this.sim.state.provinces[id];
  }

  name(id: number): string {
    return this.sim.map.provinces[id].name;
  }

  cityName(id: number): string {
    const p = this.sim.map.provinces[id];
    return this.sim.map.cities[p.cities[0]]?.name ?? p.name;
  }

  // "Munique (Baviera)": marchas e cercos miram a cidade principal de cada estado.
  placeName(id: number): string {
    const city = this.cityName(id);
    const state = this.name(id);
    return city === state ? state : `${city} (${state})`;
  }

  // Lista de estados para textos ("Baviera, Saxônia e mais 2").
  nameList(ids: number[], max = 3): string {
    const names = ids.slice(0, max).map((id) => this.name(id));
    if (ids.length > max) return `${names.join(', ')} e mais ${ids.length - max}`;
    if (names.length < 2) return names.join('');
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  }

  isCapital(id: number): boolean {
    const p = this.get(id);
    return p.owner >= 0 && this.sim.country(p.owner).capital === id;
  }

  // Valor estrategico/economico usado por war score e IA.
  value(id: number): number {
    const p = this.get(id);
    let v = 1 + p.development / 5 + Math.log10(p.population + 10) * 0.35;
    if (this.isCapital(id)) v += 4;
    return v;
  }

  setController(id: number, controller: number): void {
    const p = this.get(id);
    if (p.controller === controller) return;
    const previous = p.controller;
    p.controller = controller;
    p.siege = null;
    p.occupiedSince = controller === p.owner ? -1 : this.sim.day;
    this.sim.bus.emit('provinceChanged', { province: id });
    if (controller !== p.owner && p.owner >= 0 && this.sim.country(p.owner).capital === id) {
      this.sim.bus.emit('capitalOccupied', { province: id, by: controller, owner: p.owner });
      this.sim.wars.onCapitalOccupied(id, controller, p.owner);
    } else if (controller === p.owner && previous !== p.owner) {
      p.unrest = Math.max(0, p.unrest - 5);
      const owner = this.sim.country(p.owner);
      if (owner.originalCapital === id && owner.capital !== id) {
        owner.capital = id;
        this.sim.history.add('government', `${owner.name} retomou sua capital histórica, ${this.cityName(id)}.`, { countries: [owner.id], province: id, importance: 2 });
      }
    }
  }

  transfer(id: number, to: number, reason: TransferReason): void {
    const sim = this.sim;
    const p = this.get(id);
    const from = p.owner;
    const wasCapital = from >= 0 && sim.country(from).capital === id;
    if (from === to) {
      if (p.controller !== to) this.setController(id, to);
      return;
    }
    p.owner = to;
    p.controller = to;
    p.siege = null;
    p.lastChange = sim.day;
    p.occupiedSince = -1;
    if (reason === 'conquest' || reason === 'peace' || reason === 'annex') {
      p.unrest = clamp(p.unrest + 18, 0, 100);
      p.devastation = clamp(p.devastation + 0.08, 0, 1);
    } else if (reason === 'occupation') {
      // O choque maior ja veio com a ocupacao; a anexacao formal agita menos.
      p.unrest = clamp(p.unrest + 8, 0, 100);
    } else {
      p.unrest = clamp(p.unrest * 0.4, 0, 100);
    }
    if ((reason === 'independence' || reason === 'revolt' || reason === 'restore' || reason === 'union') && !p.cores.includes(to)) {
      p.cores.push(to);
    }
    sim.index.setOwner(id, from, to);
    const change = { day: sim.day, province: id, from, to };
    const target = sim.country(to);
    target.recentChanges.push(change);
    if (target.recentChanges.length > 30) target.recentChanges.shift();
    if (reason === 'conquest' || reason === 'peace' || reason === 'annex' || reason === 'occupation') target.provincesConquered++;
    if (target.capital < 0 || sim.province(target.capital).owner !== to) target.capital = id;
    if (from >= 0) {
      const source = sim.country(from);
      source.recentChanges.push(change);
      if (source.recentChanges.length > 30) source.recentChanges.shift();
      if (reason === 'conquest' || reason === 'peace' || reason === 'annex' || reason === 'occupation') source.provincesLost++;
      if (source.capital === id) sim.countries.relocateCapital(from, true);
    }
    sim.bus.emit('provinceChanged', { province: id });
    sim.bus.emit('provinceTransferred', { province: id, from, to, reason, wasCapital });
    if (from >= 0 && sim.index.ownedBy[from].length === 0 && sim.country(from).kind === 'nation') {
      sim.countries.destroy(from, to);
    }
  }

  monthly(): void {
    const sim = this.sim;
    const s = sim.state;
    const freq = s.settings.rebellionFrequency;
    for (let id = 0; id < s.provinces.length; id++) {
      const p = s.provinces[id];
      if (p.owner < 0) continue;
      const c = sim.country(p.owner);
      const gov = GOVERNMENTS[c.government];
      let target = Math.max(0, (60 - c.stability) / 3);
      if (!p.cores.includes(p.owner)) target += 12;
      if (p.culture !== c.culture) target += 6;
      if (p.religion !== c.religion) target += 5;
      target += c.warExhaustion / 6 + c.corruption * 18 + p.devastation * 8;
      if (p.controller !== p.owner) target += 8;
      if (p.epidemic > 0) target += 10;
      target -= p.development / 6;
      target = clamp(target * gov.rebellion * freq, 0, 100);
      p.unrest += (target - p.unrest) * 0.1;
      if (p.controller !== p.owner) p.devastation = Math.min(1, p.devastation + 0.006);
      // Recuperacao natural lenta (mais lenta ainda num pais instavel ou falido); o investimento acelera.
      else p.devastation *= c.stability > 40 && c.treasury > 0 ? 0.96 : 0.98;
      // Estado arrasado: estradas, pontes e oficinas abandonadas se deterioram.
      if (p.devastation > 0.5) p.development = Math.max(1, p.development - 0.01);
      if (p.epidemic > 0) p.epidemic = Math.max(0, p.epidemic - 30);
      if (p.controller === p.owner && c.stability > 30 && p.devastation < 0.3) {
        p.development = Math.min(30, p.development + 0.003 * (0.5 + c.stability / 100) * (1 + c.tech / 25) * (1 + this.sim.technology.fx(c).infrastructure));
      }
    }
  }

  yearly(): void {
    const sim = this.sim;
    const s = sim.state;
    for (let id = 0; id < s.provinces.length; id++) {
      const p = s.provinces[id];
      if (p.owner < 0) continue;
      const c = sim.country(p.owner);
      if (!p.cores.includes(p.owner) && p.controller === p.owner && s.day - p.lastChange > 40 * 365) {
        p.cores.push(p.owner);
      }
      if (p.cores.length > 1) {
        p.cores = p.cores.filter((core) => {
          const cc = sim.country(core);
          return core === p.owner || cc.alive || s.day - cc.died < 150 * 365;
        });
      }
      const assim = 0.012 * (0.4 + c.stability / 80);
      if (p.culture !== c.culture && sim.rng.chance(assim)) p.culture = c.culture;
      if (p.religion !== c.religion && sim.rng.chance(assim * 0.8)) p.religion = c.religion;
    }
  }
}
