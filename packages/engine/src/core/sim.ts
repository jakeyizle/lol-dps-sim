import type { AttackSlot, ChampionData } from "@lol/data";

import {
  absorb,
  resolveDamage,
  type CritMode,
  type DamageInstance,
  type DamageType,
  type Defender,
  type ResolvedDamage,
  type Shield,
} from "./damage";
import type {
  Attack,
  AttackMode,
  BuffSpec,
  Effect,
  EffectContext,
} from "./effects";
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
  /** Seconds, or computed from current stats when the cast starts (JINX-009). */
  castTime: number | ((stats: StatBlock) => number);
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
  /** The attacker's health as a fraction of max, constant during the fight (BUILD-012). Default 1. */
  healthFraction?: number;
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
  /** TGT-008: shields gained when damage would take health below a fraction. */
  lowHealthShields?: readonly LowHealthShield[];
  /** TGT-009: on first reaching 0 health, untargetable for `delay`, then back with `health`. */
  revive?: { delay: number; health: number };
  /** TGT-010: on first dropping below `below` × max health, untargetable for `duration`. */
  stasis?: { below: number; duration: number };
  /** Target defenses; only `modifyIncoming` is used. */
  effects?: readonly Effect[];
  /** Health above the champion's base, for effects like Giant Slayer (ITEM-013). Default 0. */
  bonusHealth?: number;
  /** Champion-only effects apply (ITEM-013, ITEM-014). Default true. */
  champion?: boolean;
  /** Dies when left below this fraction of max health by the attacker's damage (SIM-023). */
  executeBelow?: number;
}

export interface LowHealthShield {
  id: string;
  /** Fraction of max health. */
  below: number;
  /** Only damage of this type triggers it (Maw of Malmortius: magic). */
  trigger: "all" | DamageType;
  amount: number;
  blocks: Shield["blocks"];
  /** Seconds the shield lasts. */
  duration: number;
  /** TGT-013: seconds after which it decays linearly to 0 at `duration`. */
  decayAfter?: number;
  cooldown: number;
}

/** What happened to the target (shields, revive, stasis), for the event log. */
export interface TargetEvent {
  time: number;
  kind: "shield" | "revive" | "stasis";
  id: string;
}

/** A shield on the target with its expiry and decay (TGT-013). */
interface ActiveShield extends Shield {
  expiresAt: number;
  decayFrom: number;
  decayPerSecond: number;
  updatedAt: number;
}

export interface SimOptions {
  /** Seconds; default 20 (SIM-008). */
  maxDuration?: number;
  /** `expected` averages crits (default, SIM-011); `rng` rolls them from `seed` (SIM-012). */
  critMode?: "expected" | "rng";
  seed?: number;
  /**
   * The DPS run (METRIC-008, METRIC-009): health keeps falling below 0 and the fight runs
   * to the max duration; effects see missing health capped at 100%; executes are off.
   */
  dpsRun?: boolean;
  /** Game time in minutes, for time-scaling effects (BUILD-013). Default 30. */
  gameTime?: number;
}

export interface TraceEntry {
  time: number;
  damage: ResolvedDamage;
  absorbed: number;
  toHealth: number;
  healthAfter: number;
  /** The attacker's active buff ids when it landed (METRIC-006). */
  buffs: string[];
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
  targetEvents: TargetEvent[];
  /** The attacker's stats at the start of the fight (METRIC-007). */
  stats: StatBlock;
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
  const slotOf = (name: string): AttackSlot => {
    const slot = champion.attack.slots[name];
    if (!slot) throw new Error(`${champion.id} has no attack slot ${name}`);
    return slot;
  };
  slotOf(slotName);
  let attackMode: AttackMode = {
    slot: slotName,
    critSlot: slotName === "basic" ? champion.attack.critSlot : slotName,
    cost: 0,
  };
  const abilities = new Map((attacker.abilities ?? []).map((a) => [a.id, a]));
  const effects = [
    ...(attacker.kit ?? []),
    ...(attacker.items ?? []),
    ...(attacker.runes ?? []),
  ];
  const dpsRun = options.dpsRun ?? false;
  const executeBelow = dpsRun
    ? 0
    : Math.max(
        target.executeBelow ?? 0,
        ...((target.champion ?? true)
          ? effects.map((e) => e.executeBelow ?? 0)
          : []),
      );

  // Short-term state starts empty (SIM-009); abilities start ready (SIM-018).
  const buffs = new Map<string, ActiveBuff>();
  const readyAt = new Map<string, number>();
  let stats = recompute();
  let mana = stats.mana.total; // SIM-019
  let manaTime = 0;
  let health = target.maxHealth;
  let shields: ActiveShield[] = (target.shields ?? []).map((s) => ({
    ...s,
    expiresAt: Infinity,
    decayFrom: Infinity,
    decayPerSecond: 0,
    updatedAt: 0,
  }));
  const shieldReadyAt = new Map<string, number>();
  const targetEvents: TargetEvent[] = [];
  /** Untargetable (revive delay, stasis) until then; damage is dropped (TGT-015). */
  let untargetableUntil = -Infinity;
  // METRIC-009: no revive or stasis in the DPS run.
  let reviveLeft = dpsRun ? undefined : target.revive;
  let stasisLeft = dpsRun ? undefined : target.stasis;
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
      attackerHealthFraction: attacker.healthFraction ?? 1,
      gameTime: options.gameTime ?? 30,
      buffStacks: (id: string) => buffs.get(id)?.stacks ?? 0,
    };
    return computeStats({
      champion,
      level: attacker.level,
      constants: attacker.constants,
      bonuses: [
        ...(attacker.bonuses ?? []),
        ...active.flatMap((b) =>
          // Stryker disable next-line ArrayDeclaration: summing bonuses skips a junk element
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
      // Stryker disable next-line ConditionalExpression: an expiry at Infinity is never reached before the fight ends
      if (Number.isFinite(buff.expiresAt))
        queue.push(buff.expiresAt, {
          kind: "buffExpire",
          id: spec.id,
          at: buff.expiresAt,
        });
    }
    buffs.set(spec.id, buff);
    // Stryker disable next-line CallExpression: no buff changes mana regen, so settling mana first changes nothing
    manaAt(time);
    stats = recompute();
  }

  function removeBuff(id: string, time: number) {
    if (!buffs.delete(id)) return;
    // Stryker disable next-line CallExpression: no buff changes mana regen, so settling mana first changes nothing
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
        return Math.max(0, health); // METRIC-008: missing health caps at 100%
      },
      targetMaxHealth: target.maxHealth,
      attackerHealthFraction: attacker.healthFraction ?? 1,
      gameTime: options.gameTime ?? 30,
      targetBonusHealth: target.bonusHealth ?? 0,
      targetIsChampion: target.champion ?? true,
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
      attackMode: () => attackMode,
      applyOnHit: (attack, delay) => {
        queue.push(time + delay, {
          kind: "callback",
          fn: (later) => {
            // Stryker disable next-line ArrayDeclaration: a phantom hit's extra damage is never dealt
            const phantom = { ...attack, phantom: true, extra: [] };
            // Stryker disable next-line ConditionalExpression: after the kill, deal() ignores damage and the fight ends with this event
            for (const e of effects) if (!outcome) e.onHit?.(later, phantom);
          },
        });
      },
      reduceCooldowns: (ids, fraction) => {
        for (const id of ids) {
          const at = readyAt.get(id);
          // Stryker disable next-line ConditionalExpression,LogicalOperator,EqualityOperator: a ready or never-cast ability stays ready either way
          if (at !== undefined && at > time)
            readyAt.set(id, time + (at - time) * (1 - fraction));
        }
      },
      reduceCooldownsBy: (ids, seconds) => {
        for (const id of ids) {
          const at = readyAt.get(id);
          // Stryker disable next-line ConditionalExpression,LogicalOperator,EqualityOperator: a ready or never-cast ability stays ready either way
          if (at !== undefined && at > time)
            readyAt.set(id, Math.max(time, at - seconds));
        }
      },
      setAttackMode: (mode) => {
        slotOf(mode.slot);
        slotOf(mode.critSlot);
        attackMode = mode;
      },
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
        ? [attackInstance(attackMode.slot)]
        : // Stryker disable next-line OptionalChaining: every rotation action other than attack is a known ability
          (ability?.estimate?.(ctx) ??
          // Stryker disable next-line OptionalChaining: every rotation action other than attack is a known ability
          // Stryker disable next-line ArrayDeclaration: a junk instance resolves to NaN damage, which never kills
          (ability?.damage ? [ability.damage] : []));
    const damage = instances.reduce(
      // Stryker disable next-line ObjectLiteral,StringLiteral: any mode that isn't "roll" is expected value
      (sum, i) => sum + mitigate(ctx, i, { kind: "expected" }).postMitigation,
      0,
    );
    const shielding = shieldsAt(time).reduce((sum, s) => sum + s.amount, 0);
    return damage >= health + shielding;
  }

  /** TGT-013: shields decayed and expired up to `time`. */
  function shieldsAt(time: number) {
    shields = shields.flatMap((s) => {
      // Stryker disable next-line EqualityOperator: exactly at expiry is a measure-zero boundary in continuous time
      // Stryker disable next-line ArrayDeclaration: a junk shield blocks nothing and is dropped on the next update
      if (time >= s.expiresAt) return [];
      const from = Math.max(s.updatedAt, s.decayFrom);
      const amount =
        // Stryker disable next-line EqualityOperator: at time === from both branches give s.amount
        time > from ? s.amount - s.decayPerSecond * (time - from) : s.amount;
      // Stryker disable next-line EqualityOperator: a 0-amount shield absorbs nothing either way
      // Stryker disable next-line ConditionalExpression: a decaying shield reaches 0 at its expiry, and absorb drops emptied shields
      // Stryker disable next-line ArrayDeclaration: a junk shield blocks nothing and is dropped on the next update
      return amount > 0 ? [{ ...s, amount, updatedAt: time }] : [];
    });
    return shields;
  }

  /** TGT-008: grants shields this damage would trigger, before it lands. */
  function triggerShields(
    time: number,
    instance: DamageInstance,
    amount: number,
  ) {
    for (const s of target.lowHealthShields ?? []) {
      if (s.trigger !== "all" && s.trigger !== instance.type) continue;
      // Stryker disable next-line EqualityOperator: exactly at the cooldown's end is a measure-zero boundary
      if (time < (shieldReadyAt.get(s.id) ?? 0)) continue;
      // Stryker disable next-line EqualityOperator: landing exactly on the threshold is a measure-zero boundary
      if (health - amount >= s.below * target.maxHealth) continue;
      shieldReadyAt.set(s.id, time + s.cooldown);
      const decayFrom = time + (s.decayAfter ?? s.duration);
      shields = [
        ...shieldsAt(time),
        {
          amount: s.amount,
          blocks: s.blocks,
          expiresAt: time + s.duration,
          decayFrom,
          decayPerSecond:
            // Stryker disable next-line ConditionalExpression: without decayAfter decay starts at expiry, so the rate is never used
            s.decayAfter === undefined
              ? 0
              : s.amount / (s.duration - s.decayAfter),
          updatedAt: time,
        },
      ];
      targetEvents.push({ time, kind: "shield", id: s.id });
    }
  }

  /** Sets `outcome` when the target dies; damage after that is ignored. */
  function deal(time: number, instance: DamageInstance, crit?: boolean) {
    // Stryker disable next-line EqualityOperator: exactly at the end of untargetability is a measure-zero boundary
    if (outcome || time < untargetableUntil) return;
    const critMode: CritMode =
      crit === undefined ? { kind: "expected" } : { kind: "roll", crit };
    const ctx = context(time);
    const damage = mitigate(ctx, instance, critMode);
    const { postMitigation } = damage;

    triggerShields(time, instance, postMitigation);
    const shielded = absorb(shieldsAt(time), postMitigation, instance.type);
    shields = shielded.shields;
    health -= shielded.toHealth;
    trace.push({
      time,
      damage,
      absorbed: shielded.absorbed,
      toHealth: shielded.toHealth,
      healthAfter: health,
      buffs: [...buffs.keys()],
    });
    // Stryker disable next-line EqualityOperator: landing exactly on the execute threshold is a measure-zero boundary
    const dead = health <= 0 || health < executeBelow * target.maxHealth;
    const entersStasis = (below: number) =>
      // Stryker disable next-line EqualityOperator: landing exactly on the stasis threshold is a measure-zero boundary
      health < below * target.maxHealth;
    if (dpsRun) {
      // METRIC-008: keep going below 0
    } else if (dead && reviveLeft) {
      // TGT-009: TTK counts to the final death (METRIC-001).
      const { delay, health: revived } = reviveLeft;
      reviveLeft = undefined;
      health = 0;
      untargetableUntil = time + delay;
      targetEvents.push({ time, kind: "revive", id: "revive" });
      queue.push(untargetableUntil, {
        kind: "callback",
        fn: () => {
          health = revived;
        },
      });
    } else if (dead) outcome = health <= 0 ? "killed" : "executed";
    else if (stasisLeft && entersStasis(stasisLeft.below)) {
      untargetableUntil = time + stasisLeft.duration;
      stasisLeft = undefined;
      targetEvents.push({ time, kind: "stasis", id: "stasis" });
    }
    // Stryker disable next-line ConditionalExpression: after the kill nothing an effect does is recorded
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
    if (action === "attack")
      return affordableAt(attackMode.cost, Math.max(time, nextAttackAt), time);
    const ability = abilities.get(action);
    if (!ability) throw new Error(`unknown action ${action}`);
    const cooldownAt = Math.max(time, readyAt.get(action) ?? 0);
    return affordableAt(ability.cost, cooldownAt, time);
  }

  /** Earliest time ≥ `readyAt` with `cost` mana, or Infinity if never. */
  function affordableAt(cost: number, readyAt: number, time: number) {
    const missing = cost - manaAt(time);
    if (missing <= 0) return readyAt;
    // Stryker disable next-line ConditionalExpression,LogicalOperator,EqualityOperator: champions always regenerate mana; with no regen or cost at max the wait below is Infinity or the cap is reached anyway
    if (stats.manaRegen <= 0 || cost > stats.mana.total) return Infinity;
    return Math.max(readyAt, time + missing / (stats.manaRegen / 5));
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
      targetHealth: Math.max(0, health),
      targetMaxHealth: target.maxHealth,
      buffStacks: (id: string) => buffs.get(id)?.stacks ?? 0,
      wouldKill: (action: string) => wouldKill(action, time),
    };
    let next = Infinity;
    for (const rule of rotation) {
      const conditionsAt = ruleConditionsTime(rule, state);
      const at = Math.max(conditionsAt, availableAt(rule.action, time));
      if (at <= time) {
        act(rule.action, time);
        return;
      }
      next = Math.min(next, at);
    }
    // Stryker disable next-line ConditionalExpression,LogicalOperator: an extra or Infinity-time decide is a no-op
    if (Number.isFinite(next) && next !== pendingWake) {
      pendingWake = next;
      queue.push(next, { kind: "decide" });
    }
  }

  /** Re-decide after a state change if the attacker is waiting. */
  function wake(time: number) {
    // Stryker disable next-line ConditionalExpression: decide() itself returns while busy
    if (!busy) queue.push(time, { kind: "decide" });
  }

  function act(action: string, time: number) {
    actions.push({ time, action });
    afterAttack = false;
    busy = true;

    if (action === "attack") {
      // Rolled at the start: a crit uses the crit attack's windup (SIM-022).
      // Stryker disable next-line EqualityOperator: random() hitting crit chance exactly has probability 0
      const crit = random ? random() < stats.critChance : undefined;
      const name = crit === true ? attackMode.critSlot : attackMode.slot;
      mana = manaAt(time) - attackMode.cost; // JINX-007
      const windup = windupTime(
        slotOf(name),
        champion.attack.baseAttackSpeed,
        stats.attackSpeed,
      );
      nextAttackAt = time + 1 / stats.attackSpeed;
      const attack: Attack = {
        slot: name,
        crit,
        index: ++attackCount,
        amountScale: 1,
        critable: true,
        extra: [],
      };
      const ctx = context(time);
      for (const e of effects) e.onAttackLaunch?.(ctx, attack);
      queue.push(time + windup, { kind: "attackLand", attack });
      return;
    }

    const ability = abilities.get(action);
    // Stryker disable next-line all: availableAt has already rejected unknown actions
    if (!ability) throw new Error(`unknown action ${action}`);
    mana = manaAt(time) - ability.cost; // SIM-021
    readyAt.set(
      ability.id,
      time +
        hastedCooldown(
          ability.cooldown,
          stats.abilityHaste + (ability.id === "R" ? stats.ultimateHaste : 0),
        ),
    );
    const castTime =
      typeof ability.castTime === "number"
        ? ability.castTime
        : ability.castTime(stats);
    queue.push(time + castTime, { kind: "castEnd", ability });
  }

  for (const { spec, stacks } of attacker.initialBuffs ?? [])
    addBuff(spec, stacks, 0);
  const start = context(0);
  for (const e of effects) e.init?.(start);
  queue.push(0, { kind: "decide" });

  const startStats = stats;
  const end = (killed: boolean, time: number | null, executed = false) => ({
    killed,
    ttk: time,
    executed,
    remainingHealth: Math.max(0, health),
    trace,
    actions,
    targetEvents,
    stats: startStats,
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
        const instance = attackInstance(attack.slot);
        deal(
          time,
          {
            ...instance,
            amount: instance.amount * attack.amountScale,
            critable: attack.critable,
          },
          attack.crit,
        );
        for (const instance of attack.extra) deal(time, instance, attack.crit);
        // ITEM-008: on-hit effects run once per landed attack.
        const ctx = context(time);
        // Stryker disable next-line ConditionalExpression: after the kill nothing an effect does is recorded
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
          // Stryker disable next-line EqualityOperator: the 1e-9 slack makes < and <= the same
          for (let k = 1; k * dot.interval <= dot.duration + 1e-9; k++)
            queue.push(time + k * dot.interval, {
              kind: "dotTick",
              instance: dot.instance,
            }); // SIM-014
        }
        if (ability.damage) deal(time, ability.damage);
        const ctx = context(time);
        for (const e of effects)
          // Stryker disable next-line ConditionalExpression: after the kill nothing an effect does is recorded
          if (!outcome) e.onAbilityCast?.(ctx, ability.id);
        busy = false;
        queue.push(time, { kind: "decide" }); // SIM-004: nothing before the cast ends
        break;
      }
      case "buffExpire": {
        const buff = buffs.get(event.id);
        if (buff?.expiresAt === event.at) {
          if (buff.spec.decayOneAtATime && buff.stacks > 1) {
            buff.stacks -= 1;
            buff.expiresAt =
              time + (buff.spec.decayInterval ?? buff.spec.duration);
            queue.push(buff.expiresAt, {
              kind: "buffExpire",
              id: event.id,
              at: buff.expiresAt,
            });
            // Stryker disable next-line CallExpression: no buff changes mana regen, so settling mana first changes nothing
            manaAt(time);
            stats = recompute();
          } else removeBuff(event.id, time);
          // Stryker disable next-line CallExpression: no rule condition becomes true when a buff ends
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
