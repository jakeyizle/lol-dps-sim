import type { DamageInstance } from "./damage";
import type { StatBlock, StatBonuses } from "./stats";

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
  /** On expiry, lose one stack and restart the duration instead of all stacks. */
  decayOneAtATime?: boolean;
}

/** How basic attacks are made; kits change it (e.g. Jinx's weapons). */
export interface AttackMode {
  /** Attack slot for normal attacks. */
  slot: string;
  /** Attack slot for crits (SIM-022). */
  critSlot: string;
  /** Mana per attack; attacks wait for it (JINX-007, JINX-008). */
  cost: number;
}

/** One attack, from launch to landing. Effects may add damage that lands with it. */
export interface Attack {
  /** Attack slot whose windup it uses (SIM-022). */
  slot: string;
  /** Rolled crit in RNG mode; undefined in expected-value mode. */
  crit?: boolean;
  /** 1 for the first attack of the fight. */
  index: number;
  /** Multiplies the attack's damage (e.g. Jinx's rockets, JINX-002). */
  amountScale: number;
  /** False when an effect has already folded crits into `amountScale` (ITEM-029). */
  critable: boolean;
  /** A repeat of the attack's on-hit effects (Guinsoo's Phantom Hit, ITEM-016). */
  phantom?: boolean;
  /** Extra instances dealt when it lands, after the attack itself and before `onHit`. */
  extra: DamageInstance[];
}

export interface EffectContext {
  time: number;
  stats: StatBlock;
  targetHealth: number;
  targetMaxHealth: number;
  targetBonusHealth: number;
  targetIsChampion: boolean;
  /** Current mana, after regeneration. */
  mana: number;
  /** Deals damage now, through the full pipeline (and `onDamageDealt`). */
  deal: (instance: DamageInstance) => void;
  addBuff: (spec: BuffSpec, stacks?: number) => void;
  removeBuff: (id: string) => void;
  buffStacks: (id: string) => number;
  attackMode: () => AttackMode;
  /** Runs every effect's `onHit` again for `attack` after `delay`, marked `phantom`. */
  applyOnHit: (attack: Attack, delay: number) => void;
  /** Cuts the remaining cooldown of each ability by `fraction` (ITEM-017). */
  reduceCooldowns: (abilityIds: readonly string[], fraction: number) => void;
  setAttackMode: (mode: AttackMode) => void;
  /** Runs `fn` after `delay` seconds, unless the fight has ended. */
  schedule: (delay: number, fn: (ctx: EffectContext) => void) => void;
}

export interface StatContext {
  level: number;
  buffStacks: (id: string) => number;
}

export interface DealtInfo {
  instance: DamageInstance;
  postMitigation: number;
  toHealth: number;
}

/**
 * Champion kits, items, runes and target defenses (PLAN §6). Hooks run in the order
 * kit → items (build order) → runes (page order) (SIM-024).
 */
export interface Effect {
  id: string;
  /** Champion targets left below this fraction of max health die (ITEM-014, SIM-023). */
  executeBelow?: number;
  init?: (ctx: EffectContext) => void;
  /** Extra stats, recomputed whenever buffs change (STAT-008). */
  modifyStats?: (ctx: StatContext) => StatBonuses | undefined;
  onAttackLaunch?: (ctx: EffectContext, attack: Attack) => void;
  onHit?: (ctx: EffectContext, attack: Attack) => void;
  onAbilityCast?: (ctx: EffectContext, abilityId: string) => void;
  /** Attacker amplifier for an instance as a fraction (DMG-010), e.g. 0.1 for +10%. */
  modifyOutgoing?: (
    ctx: EffectContext,
    instance: DamageInstance,
  ) => number | undefined;
  /** Target-side fraction of post-mitigation damage removed, e.g. 0.1 for −10%. */
  modifyIncoming?: (
    ctx: EffectContext,
    instance: DamageInstance,
  ) => number | undefined;
  onDamageDealt?: (ctx: EffectContext, dealt: DealtInfo) => void;
}

/**
 * Calls `apply` on every Nth attack (counted at launch or landing); the count is a buff,
 * so it resets after `duration` without attacks.
 */
export function everyNthAttack(opts: {
  id: string;
  n: number;
  at: "launch" | "hit";
  duration?: number;
  apply: (ctx: EffectContext, attack: Attack) => void;
}): Effect {
  const counter: BuffSpec = {
    id: `${opts.id}:count`,
    maxStacks: opts.n,
    duration: opts.duration ?? Infinity,
    refreshOnStack: true,
  };
  const count = (ctx: EffectContext, attack: Attack) => {
    if (ctx.buffStacks(counter.id) + 1 >= opts.n) {
      ctx.removeBuff(counter.id);
      opts.apply(ctx, attack);
    } else ctx.addBuff(counter);
  };
  return opts.at === "launch"
    ? { id: opts.id, onAttackLaunch: count }
    : { id: opts.id, onHit: count };
}

/** Adds a stack of `buff` on each trigger. */
export function stackingBuff(
  buff: BuffSpec,
  on: "launch" | "hit" | "cast",
): Effect {
  const add = (ctx: EffectContext) => {
    ctx.addBuff(buff);
  };
  return {
    id: buff.id,
    ...(on === "launch" && { onAttackLaunch: add }),
    ...(on === "hit" && { onHit: add }),
    ...(on === "cast" && { onAbilityCast: add }),
  };
}

/** While `buff` is active, the next attack launched consumes it and is changed by `apply`. */
export function empoweredAttack(opts: {
  id: string;
  buff: string;
  apply: (ctx: EffectContext, attack: Attack) => void;
}): Effect {
  return {
    id: opts.id,
    onAttackLaunch: (ctx, attack) => {
      if (ctx.buffStacks(opts.buff) === 0) return;
      ctx.removeBuff(opts.buff);
      opts.apply(ctx, attack);
    },
  };
}
