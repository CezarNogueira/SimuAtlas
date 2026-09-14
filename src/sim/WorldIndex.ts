// Indices de runtime (nao salvos): posse de provincias, exercitos por provincia,
// guerras ativas, pares em guerra e tratados por pais.
import type { Army, Battle, Treaty, War } from '../state/types';
import type { Simulation } from './Simulation';

export const pairKey = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a);

export class WorldIndex {
  ownedBy: number[][] = [];
  armyById = new Map<number, Army>();
  armiesAt = new Map<number, Army[]>();
  warById = new Map<number, War>();
  battleById = new Map<number, Battle>();
  activeWars: War[] = [];
  warsOf = new Map<number, War[]>();
  treatiesOf = new Map<number, Treaty[]>();
  ownershipVersion = 0;
  warVersion = 0;
  private enemies = new Set<number>();

  constructor(private sim: Simulation) {}

  rebuild(): void {
    this.rebuildOwnership();
    this.rebuildArmies();
    this.rebuildWars();
    this.rebuildTreaties();
    this.battleById.clear();
    for (const b of this.sim.state.battles) this.battleById.set(b.id, b);
  }

  rebuildOwnership(): void {
    const s = this.sim.state;
    this.ownedBy = s.countries.map(() => []);
    s.provinces.forEach((p, id) => {
      if (p.owner >= 0) this.ownedBy[p.owner].push(id);
    });
    this.ownershipVersion++;
  }

  ensureCountry(id: number): void {
    while (this.ownedBy.length <= id) this.ownedBy.push([]);
  }

  setOwner(province: number, from: number, to: number): void {
    if (from >= 0) {
      const list = this.ownedBy[from];
      const i = list.indexOf(province);
      if (i >= 0) {
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
    if (to >= 0) {
      this.ensureCountry(to);
      this.ownedBy[to].push(province);
    }
    this.ownershipVersion++;
  }

  rebuildArmies(): void {
    this.armyById.clear();
    this.armiesAt.clear();
    for (const a of this.sim.state.armies) {
      this.armyById.set(a.id, a);
      this.pushAt(a.location, a);
    }
  }

  private pushAt(province: number, army: Army): void {
    let list = this.armiesAt.get(province);
    if (!list) {
      list = [];
      this.armiesAt.set(province, list);
    }
    list.push(army);
  }

  addArmy(army: Army): void {
    this.armyById.set(army.id, army);
    this.pushAt(army.location, army);
  }

  removeArmy(army: Army): void {
    this.armyById.delete(army.id);
    const list = this.armiesAt.get(army.location);
    if (list) {
      const i = list.indexOf(army);
      if (i >= 0) list.splice(i, 1);
    }
  }

  moveArmy(army: Army, to: number): void {
    const list = this.armiesAt.get(army.location);
    if (list) {
      const i = list.indexOf(army);
      if (i >= 0) list.splice(i, 1);
    }
    army.location = to;
    this.pushAt(to, army);
  }

  armiesIn(province: number): Army[] {
    return this.armiesAt.get(province) ?? [];
  }

  rebuildWars(): void {
    this.warVersion++;
    this.warById.clear();
    this.warsOf.clear();
    this.enemies.clear();
    this.activeWars = [];
    for (const w of this.sim.state.wars) {
      this.warById.set(w.id, w);
      if (!w.active) continue;
      this.activeWars.push(w);
      for (const c of [...w.attackers, ...w.defenders]) {
        let list = this.warsOf.get(c);
        if (!list) {
          list = [];
          this.warsOf.set(c, list);
        }
        list.push(w);
      }
      for (const a of w.attackers) for (const d of w.defenders) this.enemies.add(pairKey(a, d));
    }
  }

  atWar(a: number, b: number): boolean {
    return a !== b && this.enemies.has(pairKey(a, b));
  }

  isAtWar(c: number): boolean {
    return (this.warsOf.get(c)?.length ?? 0) > 0;
  }

  rebuildTreaties(): void {
    this.treatiesOf.clear();
    for (const t of this.sim.state.treaties) {
      if (!t.active) continue;
      for (const m of t.members) {
        let list = this.treatiesOf.get(m);
        if (!list) {
          list = [];
          this.treatiesOf.set(m, list);
        }
        list.push(t);
      }
    }
  }
}
