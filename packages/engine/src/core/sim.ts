import type { AttackSlot, ChampionData } from "@lol/data";

import {
  absorb,
  resolveDamage,
  type CritMode,
  type DamageInstance,
  type Defender,
  type ResolvedDamage,
  type Shield,
} from "./damage";
import { EventQueue } from "./queue";
import { seededRandom } from "./rng";
import {
  computeStats,
  type GameConstants,
  type StatBlock,
  type StatBonuses,
} from "./stats";

export const DEFAULT_MAX_DURATION = 20;

/** SIM-002: B + K × (W / AS − B), where B = W / base attack speed. */
export function windupTime(
  slot: AttackSlot,
  baseAttackSpeed: number,
  attackSpeed: number,
) {
  const base = slot.windupPercent / baseAttackSpeed;
  return base + slot.windupModifier * (slot.windupPercent / attackSpeed - base);
}

/** SIM-006. */
export const hastedCooldown = (cooldown: number, haste: number) =>
  (cooldown * 100) / (100 + haste);

export interface BuffSpec {
  id: string;
  maxStacks: number;
  /** Seconds; Infinity for long-term stacks. */
  duration: number;
  /** New stacks reset the duration (SIM-015). */
  refreshOnStack: boolean;
  /** Stats granted per stack (STAT-008). */
  stats?: StatBonuses;
  /** Lifts the attack speed cap while active (STAT-006). */
  attackSpeedCap?: number;
}

export interface DotSpec {
  instance: DamageInstance;
  /** Seconds between ticks. */
  interval: number;
  duration: number;
}

/** Ability test double until the effect system (M3): fixed numbers, applied when the cast ends. */
export interface SimAbility {
  id: string;
  castTime: number;
  cooldown: number;
  cost: number;
  /** SIM-005. */
  resetsAttack?: boolean;
  damage?: DamageInstance;
  buff?: BuffSpec;
  dot?: DotSpec;
}

export interface PolicyState {
  time: number;
  /** The last action was an attack whose windup just ended (ROT-005, SIM-003). */
  afterAttack: boolean;
  mana: number;
  isReady: (abilityId: string) => boolean;
  buffStacks: (buffId: string) => number;
}

/** `attack`, or an ability id. Replaced by rotations in M3. */
export type Policy = (state: PolicyState) => string;

export const autoAttackOnly: Policy = () => "attack";

export interface SimAttacker {
  champion: ChampionData;
  level: number;
  constants: GameConstants;
  /** Items, runes, shards. */
  bonuses?: readonly StatBonuses[];
  /** Attack slot for basic attacks (default `basic`); kits choose others, e.g. Jinx's rockets. */
  attackSlot?: string;
  abilities?: readonly SimAbility[];
  /** Long-term stacks from the build (SIM-010). */
  initialBuffs?: readonly { spec: BuffSpec; stacks: number }[];
  policy?: Policy;
}

export interface SimTarget {
  maxHealth: number;
  defender: Defender;
  shields?: readonly Shield[];
  /** Dies when left below this fraction of max health by the attacker's damage (SIM-023). */
  executeBelow?: number;
}

export interface SimOptions {
  /** Seconds; default 20 (SIM-008). */
  maxDuration?: number;
  /** `expected` averages crits (default, SIM-011); `rng` rolls them from `seed` (SIM-012). */
  critMode?: "expected" | "rng";
  seed?: number;
}

export interface TraceEntry {
  time: number;
  damage: ResolvedDamage;
  absorbed: number;
  toHealth: number;
  healthAfter: number;
}

export interface CastEntry {
  time: number;
  action: string;
}

export interface SimResult {
  killed: boolean;
  /** Time of the killing blow, or null when not killed (METRIC-001, METRIC-002). */
  ttk: number | null;
  executed: boolean;
  remainingHealth: number;
  trace: TraceEntry[];
  /** Every attack start and ability cast, in order. */
  actions: CastEntry[];
}

type SimEvent =
  | { kind: "decide" }
  | { kind: "attackLand"; slot: string; crit?: boolean }
  | { kind: "castEnd"; ability: SimAbility }
  | { kind: "buffExpire"; id: string; at: number }
  | { kind: "dotTick"; instance: DamageInstance };

interface ActiveBuff {
  spec: BuffSpec;
  stacks: number;
  expiresAt: number;
}

/**
 * Discrete-event fight: one attacker vs. one target that never fights back.
 * Events at the same time run in the order they were scheduled.
 * Expected-value crit mode only for now (SIM-011).
 */
export function simulate(
  attacker: SimAttacker,
  target: SimTarget,
  options: SimOptions = {},
): SimResult {
  const maxDuration = options.maxDuration ?? DEFAULT_MAX_DURATION;
  const random =
    options.critMode === "rng" ? seededRandom(options.seed ?? 1) : undefined;
  const { champion } = attacker;
  const policy = attacker.policy ?? autoAttackOnly;
  const slotName = attacker.attackSlot ?? "basic";
  const slot = champion.attack.slots[slotName];
  if (!slot) throw new Error(`${champion.id} has no attack slot ${slotName}`);
  const attackSlot: AttackSlot = slot;
  const abilities = new Map((attacker.abilities ?? []).map((a) => [a.id, a]));

  // Short-term state starts empty (SIM-009); abilities start ready (SIM-018).
  const buffs = new Map<string, ActiveBuff>();
  const readyAt = new Map<string, number>();
  let stats = recompute();
  let mana = stats.mana.total; // SIM-019
  let manaTime = 0;
  let health = target.maxHealth;
  let shields = target.shields ?? [];
  let nextAttackAt = 0;
  let afterAttack = false;
  const trace: TraceEntry[] = [];
  const actions: CastEntry[] = [];
  const queue = new EventQueue<SimEvent>();

  function recompute(): StatBlock {
    const active = [...buffs.values()];
    const caps = active.flatMap((b) =>
      b.spec.attackSpeedCap === undefined ? [] : [b.spec.attackSpeedCap],
    );
    return computeStats({
      champion,
      level: attacker.level,
      constants: attacker.constants,
      bonuses: [
        ...(attacker.bonuses ?? []),
        ...active.flatMap((b) =>
          b.spec.stats ? Array<StatBonuses>(b.stacks).fill(b.spec.stats) : [],
        ),
      ],
      attackSpeedCap: caps.length ? Math.max(...caps) : undefined,
    });
  }

  /** SIM-020: mana regenerates continuously up to max. */
  function manaAt(time: number) {
    mana = Math.min(
      stats.mana.total,
      mana + (stats.manaRegen / 5) * (time - manaTime),
    );
    manaTime = time;
    return mana;
  }

  function addBuff(spec: BuffSpec, stacks: number, time: number) {
    const current = buffs.get(spec.id);
    const buff: ActiveBuff = current ?? { spec, stacks: 0, expiresAt: 0 };
    buff.stacks = Math.min(spec.maxStacks, buff.stacks + stacks);
    if (!current || spec.refreshOnStack) {
      buff.expiresAt = time + spec.duration;
      if (Number.isFinite(buff.expiresAt))
        queue.push(buff.expiresAt, {
          kind: "buffExpire",
          id: spec.id,
          at: buff.expiresAt,
        });
    }
    buffs.set(spec.id, buff);
    manaAt(time);
    stats = recompute();
  }

  /** Returns true when the target died. */
  function deal(time: number, instance: DamageInstance, crit?: boolean) {
    const critMode: CritMode =
      crit === undefined ? { kind: "expected" } : { kind: "roll", crit };
    const damage = resolveDamage({
      instance,
      attacker: stats,
      defender: target.defender,
      critMode,
    });
    const shielded = absorb(shields, damage.postMitigation, instance.type);
    shields = shielded.shields;
    health -= shielded.toHealth;
    trace.push({
      time,
      damage,
      absorbed: shielded.absorbed,
      toHealth: shielded.toHealth,
      healthAfter: health,
    });
    if (health <= 0) return "killed";
    if (
      target.executeBelow !== undefined &&
      health < target.executeBelow * target.maxHealth
    )
      return "executed";
    return undefined;
  }

  /** Earliest time the action can be taken, or Infinity if never. */
  function availableAt(action: string, time: number): number {
    if (action === "attack") return Math.max(time, nextAttackAt);
    const ability = abilities.get(action);
    if (!ability) throw new Error(`unknown action ${action}`);
    const cooldownAt = Math.max(time, readyAt.get(action) ?? 0);
    const missing = ability.cost - manaAt(time);
    if (missing <= 0) return cooldownAt;
    if (stats.manaRegen <= 0) return Infinity;
    return Math.max(cooldownAt, time + missing / (stats.manaRegen / 5));
  }

  function decide(time: number) {
    const action = policy({
      time,
      afterAttack,
      mana: manaAt(time),
      isReady: (id) => availableAt(id, time) <= time,
      buffStacks: (id) => buffs.get(id)?.stacks ?? 0,
    });
    const at = availableAt(action, time);
    if (at > time) {
      if (Number.isFinite(at)) queue.push(at, { kind: "decide" });
      return;
    }
    actions.push({ time, action });
    afterAttack = false;

    if (action === "attack") {
      // Rolled at the start: a crit uses the crit attack's windup (SIM-022).
      const crit = random ? random() < stats.critChance : undefined;
      const name =
        crit === true && slotName === "basic"
          ? champion.attack.critSlot
          : slotName;
      const windup = windupTime(
        champion.attack.slots[name] ?? attackSlot,
        champion.attack.baseAttackSpeed,
        stats.attackSpeed,
      );
      nextAttackAt = time + 1 / stats.attackSpeed;
      queue.push(time + windup, { kind: "attackLand", slot: name, crit });
      return;
    }

    const ability = abilities.get(action);
    if (!ability) throw new Error(`unknown action ${action}`);
    mana = manaAt(time) - ability.cost; // SIM-021
    readyAt.set(
      ability.id,
      time + hastedCooldown(ability.cooldown, stats.abilityHaste),
    );
    queue.push(time + ability.castTime, { kind: "castEnd", ability });
  }

  for (const { spec, stacks } of attacker.initialBuffs ?? [])
    addBuff(spec, stacks, 0);
  queue.push(0, { kind: "decide" });

  const end = (killed: boolean, time: number | null, executed = false) => ({
    killed,
    ttk: time,
    executed,
    remainingHealth: Math.max(0, health),
    trace,
    actions,
  });

  for (let next = queue.pop(); next; next = queue.pop()) {
    const { time, event } = next;
    if (time > maxDuration) break;
    let outcome: "killed" | "executed" | undefined;

    switch (event.kind) {
      case "decide":
        decide(time);
        break;
      case "attackLand":
        outcome = deal(
          time,
          {
            type: "physical",
            amount: stats.attackDamage.total,
            source: "attack",
            sourceId: event.slot,
            autoAttack: true,
            critable: true,
          },
          event.crit,
        );
        afterAttack = true;
        queue.push(time, { kind: "decide" }); // SIM-003
        break;
      case "castEnd": {
        const { ability } = event;
        if (ability.resetsAttack) nextAttackAt = time; // SIM-005
        if (ability.buff) addBuff(ability.buff, 1, time);
        if (ability.dot) {
          const { dot } = ability;
          for (let k = 1; k * dot.interval <= dot.duration + 1e-9; k++)
            queue.push(time + k * dot.interval, {
              kind: "dotTick",
              instance: dot.instance,
            }); // SIM-014
        }
        if (ability.damage) outcome = deal(time, ability.damage);
        queue.push(time, { kind: "decide" }); // SIM-004: nothing before the cast ends
        break;
      }
      case "buffExpire": {
        const buff = buffs.get(event.id);
        if (buff?.expiresAt === event.at) {
          buffs.delete(event.id);
          manaAt(time);
          stats = recompute();
        }
        break;
      }
      case "dotTick":
        outcome = deal(time, event.instance);
        break;
    }

    if (outcome) return end(true, time, outcome === "executed");
  }
  return end(false, null);
}
