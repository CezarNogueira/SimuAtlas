// AI ENGINE (tatica): decisoes de cada exercito — atacar exercitos mais fracos, cercar
// provincias inimigas, libertar territorio, recuar para recuperar moral, unir forcas
// e posicionar guarnicoes em tempo de paz.
import { terrainInfo } from '../../data/terrain';
import type { Army, ArmyMission } from '../../state/types';
import type { Simulation } from '../Simulation';
import { soldiersOf } from './MilitaryEngine';

export class ArmyAI {
  private targets = new Map<number, number>();

  constructor(private sim: Simulation) {}

  daily(): void {
    const sim = this.sim;
    const day = sim.day;
    let pending = false;
    for (const a of sim.state.armies) {
      if (a.battle < 0 && a.thinkDay <= day) {
        pending = true;
        break;
      }
    }
    if (!pending) return;
    this.targets.clear();
    for (const a of sim.state.armies) {
      if (a.target >= 0 && (a.mission === 'siege' || a.mission === 'attack')) {
        const k = a.target * 8192 + a.owner;
        this.targets.set(k, (this.targets.get(k) ?? 0) + 1);
      }
    }
    for (const a of [...sim.state.armies]) {
      if (a.battle >= 0 || a.thinkDay > day || !sim.index.armyById.has(a.id)) continue;
      if (a.player) a.player = false;
      this.think(a);
    }
  }

  private think(a: Army): void {
    const sim = this.sim;
    const day = sim.day;
    if (!sim.index.isAtWar(a.owner)) {
      this.peacetime(a);
      return;
    }
    a.thinkDay = day + 7 + sim.rng.int(0, 4);
    if (a.mission === 'retreat' && a.path.length && day < a.retreatUntil) return;
    const soldiers = soldiersOf(a);
    if ((a.morale < 0.35 || soldiers < 2500) && this.retreatToSafety(a)) return;

    const chunk = sim.era.armyChunk * 1.8;
    for (const o of sim.index.armiesIn(a.location)) {
      if (o !== a && o.owner === a.owner && o.battle < 0 && o.path.length === 0 && soldiersOf(o) + soldiersOf(a) <= chunk) {
        sim.military.merge(a, o);
        break;
      }
    }

    const myPower = sim.military.armyPower(a);
    const enemies = sim.wars.enemiesOf(a.owner);
    const provs = sim.state.provinces;
    const pf = sim.pathfinder;
    // Guerras nao terminam sozinhas: se uma guerra esta parada ha mais de um ano e este lado e mais forte
    // (ou parada ha mais de tres anos, para qualquer lado), os exercitos partem para ofensivas mais ousadas.
    const boldTargets = new Set<number>();
    for (const w of sim.wars.warsOf(a.owner)) {
      const still = sim.wars.daysStatic(w);
      if (!w.active || still < 365) continue;
      const side = sim.wars.sideOf(w, a.owner);
      const foes = side === 0 ? w.defenders : w.attackers;
      const mine = (side === 0 ? w.attackers : w.defenders).reduce((acc, c) => acc + sim.countries.strength(c), 0);
      const theirs = foes.reduce((acc, c) => acc + sim.countries.strength(c), 0);
      if (still >= 3 * 365 || mine >= theirs * 1.1) for (const f of foes) boldTargets.add(f);
    }
    const bold = boldTargets.size > 0;
    const edge = bold ? 0.9 : 1.15;
    const dangerLimit = bold ? 2.5 : 1.3;
    // Forca inimiga efetiva em cada estado (com a defesa do terreno e as fortificacoes que o inimigo
    // controla, como nas batalhas), memorizada durante esta decisao.
    const powerCache = new Map<number, number>();
    const enemyPowerIn = (p: number) => {
      let v = powerCache.get(p);
      if (v === undefined) {
        v = 0;
        for (const o of sim.index.armiesIn(p)) if (enemies.has(o.owner)) v += sim.military.armyPower(o);
        if (v > 0) v *= terrainInfo(sim.map.provinces[p].terrain).defense * (1 + (enemies.has(provs[p].controller) ? provs[p].fort : 0) * 0.12);
        powerCache.set(p, v);
      }
      return v;
    };
    // Rotas nao atravessam estados com forcas inimigas que este exercito nao consegue vencer
    // (evita levas sucessivas marchando para a mesma batalha perdida).
    const basePassable = sim.military.passable(a.owner, 'normal');
    const passable = (p: number) => basePassable(p) && (p === a.location || enemyPowerIn(p) * edge <= myPower);
    // Exercito ja a caminho de um alvo ainda valido: segue a rota e so reavalia de tempos em tempos
    // (explorar o mapa a cada decisao e o custo dominante quando ha muitas guerras simultaneas).
    if (a.path.length > 1 && a.target >= 0 && (a.mission === 'siege' || a.mission === 'attack') && sim.rng.chance(0.65)) {
      const next = a.path[0] === a.location ? a.path[1] : a.path[0];
      const target = enemyPowerIn(a.target);
      const valid = a.mission === 'siege' ? sim.index.atWar(a.owner, provs[a.target].controller) : target > 0 && target * edge <= myPower;
      if (valid && enemyPowerIn(next) * edge <= myPower) return;
    }
    // Ofensivas de guerras paradas buscam alvos mais longe (inclusive travessias maritimas longas).
    pf.explore(a.location, passable, sim.military.canUseSea(a.owner), bold ? 160 : 100, sim.military.speed(a));
    const goals = new Set<number>();
    for (const w of sim.wars.warsOf(a.owner)) if (sim.wars.sideOf(w, a.owner) === 0) for (const p of w.goal.provinces) goals.add(p);

    let bestP = -1;
    let bestScore = 0;
    let bestMission: ArmyMission = 'idle';
    for (const p of pf.reached) {
      const days = pf.distanceTo(p);
      const enemyPower = enemyPowerIn(p);
      if (enemyPower > 0) {
        const ratio = myPower / enemyPower;
        if (ratio >= edge) {
          const score = (60 * Math.min(3, ratio)) / (days + 6);
          if (score > bestScore) {
            bestScore = score;
            bestP = p;
            bestMission = 'attack';
          }
        }
        continue;
      }
      const ps = provs[p];
      if (!sim.index.atWar(a.owner, ps.controller)) continue;
      let v = sim.provinces.value(p);
      if (goals.has(p)) v *= 2.2;
      if (ps.owner === a.owner || sim.wars.sameSide(ps.owner, a.owner)) v *= 2.5;
      if (sim.provinces.isCapital(p)) v *= 2.5;
      if (boldTargets.has(ps.owner)) v *= 1.8;
      if (ps.siege && ps.siege.country !== a.owner && sim.wars.sameSide(ps.siege.country, a.owner)) v *= 0.35;
      const already = this.targets.get(p * 8192 + a.owner) ?? 0;
      if (already > 0 && a.target !== p) v *= Math.pow(0.4, already);
      let danger = enemyPowerIn(p);
      for (let e = sim.map.edgeStart[p]; e < sim.map.edgeStart[p + 1]; e++) danger += enemyPowerIn(sim.map.edgeTo[e]);
      if (danger > myPower * dangerLimit) continue;
      const score = (v * 10) / (days + 5);
      if (score > bestScore) {
        bestScore = score;
        bestP = p;
        bestMission = 'siege';
      }
    }
    if (bestP < 0) {
      if (this.joinNearbyArmy(a)) return;
      a.mission = 'idle';
      return;
    }
    if (bestP === a.location) {
      a.path = [];
      a.mission = bestMission;
      a.target = bestP;
      return;
    }
    if (a.target === bestP && a.path.length) return;
    sim.military.setPath(a, pf.pathTo(bestP), bestMission, bestP);
    const k = bestP * 8192 + a.owner;
    this.targets.set(k, (this.targets.get(k) ?? 0) + 1);
  }

  private dangerNear(p: number, enemies: Set<number>): number {
    const sim = this.sim;
    const m = sim.map;
    let power = 0;
    const add = (q: number) => {
      for (const o of sim.index.armiesIn(q)) if (enemies.has(o.owner)) power += sim.military.armyPower(o);
    };
    add(p);
    for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) add(m.edgeTo[e]);
    return power;
  }

  private retreatToSafety(a: Army): boolean {
    const sim = this.sim;
    const friends = sim.diplomacy.accessSet(a.owner);
    const provs = sim.state.provinces;
    const enemies = sim.wars.enemiesOf(a.owner);
    if (friends.has(provs[a.location].controller) && this.dangerNear(a.location, enemies) === 0) {
      a.path = [];
      a.mission = 'idle';
      a.thinkDay = sim.day + 10;
      return true;
    }
    sim.pathfinder.explore(a.location, (p) => friends.has(provs[p].controller), sim.military.canUseSea(a.owner), 60, sim.military.speed(a));
    const safe = sim.pathfinder.reached.find((p) => p !== a.location && this.dangerNear(p, enemies) === 0);
    if (safe === undefined) return false;
    sim.military.setPath(a, sim.pathfinder.pathTo(safe), 'retreat', safe);
    a.retreatUntil = sim.day + 15;
    return true;
  }

  private joinNearbyArmy(a: Army): boolean {
    const sim = this.sim;
    let best: Army | null = null;
    let bd = Infinity;
    for (const o of sim.state.armies) {
      if (o === a || o.owner !== a.owner || o.battle >= 0 || o.path.length) continue;
      const pa = sim.map.provinces[a.location];
      const po = sim.map.provinces[o.location];
      const d = Math.hypot(pa.x - po.x, pa.y - po.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (!best || bd > sim.map.avgDiameter * 6 || best.location === a.location) return false;
    const path = sim.pathfinder.findPath(a.location, best.location, sim.military.passable(a.owner, 'friendly'), sim.military.canUseSea(a.owner), 60, sim.military.speed(a));
    if (!path) return false;
    sim.military.setPath(a, path, 'move', best.location);
    return true;
  }

  private peacetime(a: Army): void {
    const sim = this.sim;
    const rng = sim.rng;
    a.thinkDay = sim.day + 30 + rng.int(0, 30);
    const provs = sim.state.provinces;
    if (!sim.diplomacy.accessSet(a.owner).has(provs[a.location].controller)) {
      sim.military.sendHome(a);
      return;
    }
    if (a.path.length) return;
    for (const o of sim.index.armiesIn(a.location)) {
      if (o !== a && o.owner === a.owner && o.battle < 0 && o.path.length === 0) {
        sim.military.merge(a, o);
        break;
      }
    }
    if (!rng.chance(0.25)) return;
    const c = sim.country(a.owner);
    let rival = -1;
    let worst = 0;
    for (const n of sim.countries.landNeighbors(a.owner)) {
      const r = sim.diplomacy.relation(a.owner, n);
      if (r < worst) {
        worst = r;
        rival = n;
      }
    }
    const m = sim.map;
    let target = c.capital;
    if (rival >= 0) {
      let bestV = -1;
      for (const p of sim.index.ownedBy[a.owner]) {
        let borders = false;
        for (let e = m.edgeStart[p]; e < m.edgeStart[p + 1]; e++) if (provs[m.edgeTo[e]].owner === rival) borders = true;
        if (!borders) continue;
        const v = sim.provinces.value(p) + rng.next();
        if (v > bestV) {
          bestV = v;
          target = p;
        }
      }
    }
    if (target < 0 || target === a.location) return;
    const path = sim.pathfinder.findPath(a.location, target, sim.military.passable(a.owner, 'friendly'), false, 200, sim.military.speed(a));
    if (path) sim.military.setPath(a, path, 'garrison', target);
  }
}
