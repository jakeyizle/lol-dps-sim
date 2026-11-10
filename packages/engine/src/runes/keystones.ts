import type { ChampionData, RuneData } from "@lol/data";

import {
  evaluate,
  flatValues,
  isRanged,
  levelInterpolation,
} from "../core/calc";
import type { DamageType } from "../core/damage";
import type { BuffSpec, Effect, EffectContext } from "../core/effects";
import type { StatBlock } from "../core/stats";

export const LETHAL_TEMPO = 8008;
export const PRESS_THE_ATTACK = 8005;
export const CONQUEROR = 8010;
export const HAIL_OF_BLADES = 9923;

/** Every value each keystone reads (DATA-012). */
export const keystoneRequiredValues = {
  [LETHAL_TEMPO]: [
    "values.Duration",
    "values.MaxStacks",
    "values.DecayInterval",
    "calculations.ASPerStack",
    "calculations.NoteDamage",
  ],
  [PRESS_THE_ATTACK]: [
    "values.MinDamage",
    "values.MaxDamage",
    "values.HitsRequired",
    "values.TimeBetweenHits",
    "values.BonusPercentDamage",
    "values.Cooldown",
  ],
  [CONQUEROR]: [
    "values.MinAdaptivePerStack",
    "values.MaxAdaptivePerStack",
    "values.MaxStacks",
    "values.BuffDuration",
    "values.TimeUntilNextStackFromSameSpell",
    "values.StacksPerAttackMelee",
    "values.StacksPerAttackRanged",
    "values.StacksPerAbility",
    "values.AdaptiveADPerAP",
  ],
  [HAIL_OF_BLADES]: [
    "values.NumHits",
    "values.Duration",
    "values.ASBoost",
    "values.ASBoostRanged",
    "values.Cooldown",
    "calculations.BonusDamage",
  ],
} as const;

/** Adaptive damage: magic only with more AP than bonus AD (the MVP champions are AD). */
const adaptiveType = (stats: StatBlock): DamageType =>
  stats.abilityPower > stats.attackDamage.bonus ? "magic" : "physical";

/** RUNE-003, RUNE-011, RUNE-012, RUNE-013. */
export function lethalTempo(rune: RuneData, owner: ChampionData): Effect {
  const value = flatValues(rune.values);
  const ranged = isRanged(owner);
  const calc = (name: string, ctx: { stats: StatBlock }) =>
    evaluate(rune.calculations[name], {
      stats: ctx.stats,
      value,
      calculations: rune.calculations,
      ranged,
    });
  let perStack = 0;
  const stacks: BuffSpec = {
    id: "LethalTempo",
    maxStacks: value("MaxStacks"),
    duration: value("Duration"),
    refreshOnStack: true,
    decayOneAtATime: true,
    decayInterval: value("DecayInterval"),
  };
  return {
    id: "LethalTempo",
    init: (ctx) => {
      perStack = calc("ASPerStack", ctx);
    },
    modifyStats: (ctx) => ({
      attackSpeed: perStack * ctx.buffStacks(stacks.id),
    }),
    onAttackLaunch: (ctx, attack) => {
      if (!ctx.targetIsChampion) return;
      ctx.addBuff(stacks);
      // The bolt fires on-attack once stacks are full and lands with the attack.
      if (ctx.buffStacks(stacks.id) < stacks.maxStacks) return;
      attack.extra.push({
        type: adaptiveType(ctx.stats),
        amount: calc("NoteDamage", ctx),
        source: "rune",
        sourceId: "LethalTempo",
      });
    },
  };
}

/** RUNE-004: three hits in a row deal bonus damage and leave the target exposed. */
export function pressTheAttack(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  const hits: BuffSpec = {
    id: "PressTheAttack:hits",
    maxStacks: value("HitsRequired"),
    duration: value("TimeBetweenHits"),
    refreshOnStack: true,
  };
  // The fight never leaves combat, so exposure lasts until it ends.
  const exposed: BuffSpec = {
    id: "PressTheAttackExposed",
    maxStacks: 1,
    duration: Infinity,
    refreshOnStack: true,
  };
  let readyAt = 0;
  return {
    id: "PressTheAttack",
    init: () => {
      readyAt = 0;
    },
    // Guinsoo's Phantom Hit applies on-hit again, so it stacks too.
    onHit: (ctx) => {
      if (!ctx.targetIsChampion || ctx.time < readyAt) return;
      if (ctx.buffStacks(hits.id) + 1 < hits.maxStacks) {
        ctx.addBuff(hits);
        return;
      }
      ctx.removeBuff(hits.id);
      readyAt = ctx.time + value("Cooldown");
      ctx.deal({
        type: adaptiveType(ctx.stats),
        amount: levelInterpolation(
          value("MinDamage"),
          value("MaxDamage"),
          ctx.stats.level,
        ),
        source: "rune",
        sourceId: "PressTheAttack",
      });
      ctx.addBuff(exposed);
    },
    modifyOutgoing: (ctx) =>
      ctx.buffStacks(exposed.id) > 0 ? value("BonusPercentDamage") : undefined,
  };
}

/** RUNE-005: the opening attacks gain attack speed above the cap and true damage. */
export function hailOfBlades(rune: RuneData, owner: ChampionData): Effect {
  const value = flatValues(rune.values);
  const boost: BuffSpec = {
    id: "HailOfBlades",
    maxStacks: value("NumHits"),
    duration: value("Duration"),
    refreshOnStack: true,
    attackSpeedCap: Infinity,
  };
  const bonusAS = isRanged(owner) ? value("ASBoostRanged") : value("ASBoost");
  let waiting = false;
  // Triggered by the first attack's windup, so the triggering attack benefits.
  const activate = (ctx: EffectContext) => {
    waiting = false;
    if (ctx.targetIsChampion) ctx.addBuff(boost, boost.maxStacks);
  };
  return {
    id: "HailOfBlades",
    init: activate,
    modifyStats: (ctx) => ({
      attackSpeed: ctx.buffStacks(boost.id) > 0 ? bonusAS : 0,
    }),
    onAttackLaunch: (ctx, attack) => {
      const left = ctx.buffStacks(boost.id);
      if (left === 0) {
        // Expired without being spent: the cooldown starts now.
        if (!waiting) {
          waiting = true;
          ctx.schedule(value("Cooldown"), activate);
        }
        return;
      }
      // The attack's own timer already used the bonus; spend one stack.
      ctx.removeBuff(boost.id);
      if (left > 1) ctx.addBuff(boost, left - 1);
      else {
        waiting = true;
        ctx.schedule(value("Cooldown"), activate);
      }
      attack.extra.push({
        type: "true",
        amount: evaluate(rune.calculations.BonusDamage, {
          stats: ctx.stats,
          value,
        }),
        source: "rune",
        sourceId: "HailOfBlades",
      });
    },
  };
}

/** RUNE-006: attacks and abilities that hit stack adaptive force (AD for the MVP champions). */
export function conqueror(rune: RuneData, owner: ChampionData): Effect {
  const value = flatValues(rune.values);
  const stacks: BuffSpec = {
    id: "Conqueror",
    maxStacks: value("MaxStacks"),
    duration: value("BuffDuration"),
    refreshOnStack: true,
  };
  const perAttack = isRanged(owner)
    ? value("StacksPerAttackRanged")
    : value("StacksPerAttackMelee");
  const nextFromSpell = new Map<string, number>();
  return {
    id: "Conqueror",
    init: () => {
      nextFromSpell.clear();
    },
    modifyStats: (ctx) => ({
      attackDamage:
        ctx.buffStacks(stacks.id) *
        value("AdaptiveADPerAP") *
        levelInterpolation(
          value("MinAdaptivePerStack"),
          value("MaxAdaptivePerStack"),
          ctx.level,
        ),
    }),
    onDamageDealt: (ctx, { instance }) => {
      if (!ctx.targetIsChampion) return;
      if (instance.autoAttack) ctx.addBuff(stacks, perAttack);
      else if (instance.ability) {
        // Each spell stacks at most once per interval.
        const id = instance.sourceId;
        if (ctx.time < (nextFromSpell.get(id) ?? 0)) return;
        nextFromSpell.set(
          id,
          ctx.time + value("TimeUntilNextStackFromSameSpell"),
        );
        ctx.addBuff(stacks, value("StacksPerAbility"));
      }
    },
  };
}
