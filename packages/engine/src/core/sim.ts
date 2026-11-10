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
import type { Attack, BuffSpec, Effect, EffectContext } from "./effects";
import { EventQueue } from "./queue";
import { attackOnly, ruleConditionsTime, type Rotation } from "./rotation";
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

export type { BuffSpec } from "./effects";

export interface DotSpec {
  instance: DamageInstance;
  /** Seconds between ticks. */
  interval: number;
  duration: number;
}

/**
 * Cast descriptor. The optional fixed payload is applied when the cast ends; kits whose
 * numbers depend on stats use an `onAbilityCast` effect instead.
 */
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
  /** Damage the cast would deal now, for `wouldKill` (ROT-013); defaults to `damage`. */
  estimate?: (ctx: EffectContext) => DamageInstance[];
}

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
  /** Default: attack only. */
  rotation?: Rotation;
  /** Effects run kit → items → runes (SIM-024). */
  kit?: readonly Effect[];
  /** In build order. */
  items?: readonly Effect[];
  /** In page order. */
  runes?: readonly Effect[];
}

export interface SimTarget {
  maxHealth: number;
  defender: Defender;
  shields?: readonly Shield[];
  /** Target defenses; only `modifyIncoming` is used. */
  effects?: readonly Effect[];
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
  | { kind: "attackLand"; attack: Attack }
  | { kind: "castEnd"; ability: SimAbility }
  | { kind: "buffExpire"; id: string; at: number }
  | { kind: "dotTick"; instance: DamageInstance }
  | { kind: "callback"; fn: (ctx: EffectContext) => void };

interface ActiveBuff {
  spec: BuffSpec;
  stacks: number;
  expiresAt: number;
}

/**
 * Discrete-event fight: one attacker vs. one target that never fights back.
 * Events at the same time run in the order they were scheduled.
 * Effects run kit → items → runes (SIM-024).
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
  const rotation = attacker.rotation ?? attackOnly;
  const slotName = attacker.attackSlot ?? "basic";
  const slot = champion.attack.slots[slotName];
  if (!slot) throw new Error(`${champion.id} has no attack slot ${slotName}`);
  const attackSlot: AttackSlot = slot;
  const abilities = new Map((attacker.abilities ?? []).map((a) => [a.id, a]));
  for (const { action } of rotation)
    if (action !== "attack" && !abilities.has(action))
      throw new Error(`unknown action ${action}`);
  const effects = [
    ...(attacker.kit ?? []),
    ...(attacker.items ?? []),
    ...(attacker.runes ?? []),
  ];

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
  /** In a windup or cast; decisions wait for it to end. */
  let busy = false;
  let pendingWake = -1;
  let attackCount = 0;
  let outcome: "killed" | "executed" | undefined;
  const trace: TraceEntry[] = [];
  const actions: CastEntry[] = [];
  const queue = new EventQueue<SimEvent>();

  function recompute(): StatBlock {
    const active = [...buffs.values()];
    const caps = active.flatMap((b) =>
      b.spec.attackSpeedCap === undefined ? [] : [b.spec.attackSpeedCap],
    );
    const statContext = {
      level: attacker.level,
      buffStacks: (id: string) => buffs.get(id)?.stacks ?? 0,
    };
    return computeStats({
      champion,
      level: attacker.level,
      constants: attacker.constants,
      bonuses: [
        ...(attacker.bonuses ?? []),
        ...active.flatMap((b) =>
          b.spec.stats ? Array<StatBonuses>(b.stacks).fill(b.spec.stats) : [],
        ),
        ...effects.flatMap((e) => e.modifyStats?.(statContext) ?? []),
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

  function removeBuff(id: string, time: number) {
    if (!buffs.delete(id)) return;
    manaAt(time);
    stats = recompute();
  }

  function context(time: number): EffectContext {
    return {
      time,
      get stats() {
        return stats;
      },
      get targetHealth() {
        return health;
      },
      targetMaxHealth: target.maxHealth,
      get mana() {
        return manaAt(time);
      },
      deal: (instance) => {
        deal(time, instance);
      },
      addBuff: (spec, stacks = 1) => {
        addBuff(spec, stacks, time);
      },
      removeBuff: (id) => {
        removeBuff(id, time);
      },
      buffStacks: (id) => buffs.get(id)?.stacks ?? 0,
      schedule: (delay, fn) => {
        queue.push(time + delay, { kind: "callback", fn });
      },
    };
  }

  /** Crit, amplifiers, resistances and target reductions; no shields. */
  function mitigate(
    ctx: EffectContext,
    instance: DamageInstance,
    critMode: CritMode,
  ): ResolvedDamage {
    const amplifiers = effects.flatMap((e) => {
      const amp = e.modifyOutgoing?.(ctx, instance);
      return amp ? [amp] : [];
    });
    const resolved = resolveDamage({
      instance,
      attacker: stats,
      defender: target.defender,
      critMode,
      amplifiers,
    });
    let postMitigation = resolved.postMitigation;
    for (const e of target.effects ?? [])
      postMitigation *= 1 - (e.modifyIncoming?.(ctx, instance) ?? 0);
    return { ...resolved, postMitigation };
  }

  const attackInstance = (sourceId: string): DamageInstance => ({
    type: "physical",
    amount: stats.attackDamage.total,
    source: "attack",
    sourceId,
    autoAttack: true,
    critable: true,
  });

  /** ROT-013: expected-value damage of the action vs. health + shields. */
  function wouldKill(action: string, time: number) {
    const ctx = context(time);
    const ability = abilities.get(action);
    const instances =
      action === "attack"
        ? [attackInstance(slotName)]
        : (ability?.estimate?.(ctx) ??
          (ability?.damage ? [ability.damage] : []));
    const damage = instances.reduce(
      (sum, i) => sum + mitigate(ctx, i, { kind: "expected" }).postMitigation,
      0,
    );
    const shielding = shields.reduce((sum, s) => sum + s.amount, 0);
    return instances.length > 0 && damage >= health + shielding;
  }

  /** Sets `outcome` when the target dies; damage after that is ignored. */
  function deal(time: number, instance: DamageInstance, crit?: boolean) {
    if (outcome) return;
    const critMode: CritMode =
      crit === undefined ? { kind: "expected" } : { kind: "roll", crit };
    const ctx = context(time);
    const damage = mitigate(ctx, instance, critMode);
    const { postMitigation } = damage;

    const shielded = absorb(shields, postMitigation, instance.type);
    shields = shielded.shields;
    health -= shielded.toHealth;
    trace.push({
      time,
      damage,
      absorbed: shielded.absorbed,
      toHealth: shielded.toHealth,
      healthAfter: health,
    });
    if (health <= 0) outcome = "killed";
    else if (
      target.executeBelow !== undefined &&
      health < target.executeBelow * target.maxHealth
    )
      outcome = "executed";
    if (outcome) return;
    for (const e of effects)
      e.onDamageDealt?.(ctx, {
        instance,
        postMitigation,
        toHealth: shielded.toHealth,
      });
  }

  /** Earliest time the action can be taken, or Infinity if never. */
  function availableAt(action: string, time: number): number {
    if (action === "attack") return Math.max(time, nextAttackAt);
    const ability = abilities.get(action);
    if (!ability) throw new Error(`unknown action ${action}`);
    const cooldownAt = Math.max(time, readyAt.get(action) ?? 0);
    const missing = ability.cost - manaAt(time);
    if (missing <= 0) return cooldownAt;
    if (stats.manaRegen <= 0 || ability.cost > stats.mana.total)
      return Infinity;
    return Math.max(cooldownAt, time + missing / (stats.manaRegen / 5));
  }

  /**
   * ROT-001: take the first rule whose action is ready and whose conditions hold.
   * ROT-002: otherwise wait until the earliest time one could be; state changes from
   * other events also wake the attacker (`wake`).
   */
  function decide(time: number) {
    if (busy) return;
    const state = {
      time,
      afterAttack,
      mana: manaAt(time),
      maxMana: stats.mana.total,
      manaRegen: stats.manaRegen / 5,
      targetHealth: health,
      targetMaxHealth: target.maxHealth,
      buffStacks: (id: string) => buffs.get(id)?.stacks ?? 0,
      wouldKill: (action: string) => wouldKill(action, time),
    };
    let next = Infinity;
    for (const rule of rotation) {
      const conditionsAt = ruleConditionsTime(rule, state);
      if (!Number.isFinite(conditionsAt)) continue;
      const at = Math.max(conditionsAt, availableAt(rule.action, time));
      if (at <= time) {
        act(rule.action, time);
        return;
      }
      next = Math.min(next, at);
    }
    if (Number.isFinite(next) && next !== pendingWake) {
      pendingWake = next;
      queue.push(next, { kind: "decide" });
    }
  }

  /** Re-decide after a state change if the attacker is waiting. */
  function wake(time: number) {
    if (!busy) queue.push(time, { kind: "decide" });
  }

  function act(action: string, time: number) {
    actions.push({ time, action });
    afterAttack = false;
    busy = true;

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
      const attack: Attack = {
        slot: name,
        crit,
        index: ++attackCount,
        extra: [],
      };
      const ctx = context(time);
      for (const e of effects) e.onAttackLaunch?.(ctx, attack);
      queue.push(time + windup, { kind: "attackLand", attack });
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
  const start = context(0);
  for (const e of effects) e.init?.(start);
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

    switch (event.kind) {
      case "decide":
        decide(time);
        break;
      case "attackLand": {
        const { attack } = event;
        deal(time, attackInstance(attack.slot), attack.crit);
        for (const instance of attack.extra) deal(time, instance, attack.crit);
        // ITEM-008: on-hit effects run once per landed attack.
        const ctx = context(time);
        for (const e of effects) if (!outcome) e.onHit?.(ctx, attack);
        afterAttack = true;
        busy = false;
        queue.push(time, { kind: "decide" }); // SIM-003
        break;
      }
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
        if (ability.damage) deal(time, ability.damage);
        const ctx = context(time);
        for (const e of effects)
          if (!outcome) e.onAbilityCast?.(ctx, ability.id);
        busy = false;
        queue.push(time, { kind: "decide" }); // SIM-004: nothing before the cast ends
        break;
      }
      case "buffExpire": {
        const buff = buffs.get(event.id);
        if (buff?.expiresAt === event.at) {
          removeBuff(event.id, time);
          wake(time);
        }
        break;
      }
      case "dotTick":
        deal(time, event.instance);
        wake(time);
        break;
      case "callback":
        event.fn(context(time));
        wake(time);
        break;
    }

    if (outcome) return end(true, time, outcome === "executed");
  }
  return end(false, null);
}
