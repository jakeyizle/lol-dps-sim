import type { AbilityKey, ChampionData } from "@lol/data";

import { abilityRanks, evaluate, rankValues } from "../core/calc";
import type { DamageInstance } from "../core/damage";
import type { BuffSpec, Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import type { SimAbility } from "../core/sim";
import type { ChampionKit } from "./jinx";

export const ASHE_FOCUS = "AsheFocus";
const FROST = "AsheFrost";
const RANGERS_FOCUS = "AsheRangersFocus";

/** Every value the kit reads (DATA-012). */
export const asheRequiredValues = [
  "passive.values.SlowDuration",
  "passive.calculations.DamageBonus",
  "abilities.Q.values.MaxStacks",
  "abilities.Q.values.StackDuration",
  "abilities.Q.values.StackFalloffDuration",
  "abilities.Q.values.BuffDuration",
  "abilities.Q.values.BonusAS",
  "abilities.Q.values.DamagePerStrike",
  "abilities.Q.values.ShotsPerStrike",
  "abilities.Q.values.FirstFlurryShots",
  "abilities.W.calculations.TotalDamage",
  "abilities.R.calculations.RMainDamage",
] as const;

/**
 * Ashe (scenarios/ashe.md): Frost Shot (attacks and abilities slow; attacks on slowed
 * targets deal more, scaling with crit; her crits add nothing), Focus and Ranger's Focus
 * flurries, W Volley, R Enchanted Crystal Arrow (user rotations only).
 */
export function ashe(
  champion: ChampionData,
  level: number,
  ranks: Record<AbilityKey, number> = abilityRanks(champion, level),
): ChampionKit {
  const { passive } = champion;
  const { Q, W, R } = champion.abilities;
  const at = (
    list: readonly number[] | undefined,
    rank: number,
    name: string,
  ) => {
    const v = list?.[rank - 1];
    if (v === undefined)
      throw new Error(`Ashe: no ${name} at rank ${String(rank)}`);
    return v;
  };
  const passiveValue = rankValues(passive.values, 1);
  // The target's slow, tracked on Ashe's side (the target never acts).
  const frost: BuffSpec = {
    id: FROST,
    maxStacks: 1,
    duration: passiveValue("SlowDuration"),
    refreshOnStack: true,
  };
  const slow = (ctx: EffectContext) => {
    ctx.addBuff(frost);
  };
  /** ASHE-006: 1 + crit chance × (1 + bonus crit damage) of the attack. */
  const frostScale = (ctx: EffectContext) =>
    ctx.buffStacks(FROST) > 0
      ? evaluate(passive.calculations.DamageBonus, {
          stats: ctx.stats,
          value: passiveValue,
        })
      : 1;

  const abilities: SimAbility[] = [];
  const kit: Effect[] = [];
  const rotation: Rotation[number][] = [];
  let flurries = 0;

  kit.push({
    id: "AsheFrostShot",
    init: () => {
      flurries = 0;
    },
    onAttackLaunch: (ctx, attack) => {
      if (attack.phantom) return;
      // Crits add no damage; crit chance is in the Frost Shot bonus instead.
      attack.critable = false;
      attack.amountScale *= frostScale(ctx); // ASHE-007: not before the first hit
    },
    onHit: (ctx) => {
      slow(ctx); // ASHE-001
    },
    onDamageDealt: (ctx, { instance }) => {
      if (instance.ability) slow(ctx);
    },
  });

  if (ranks.Q > 0) {
    const q = rankValues(Q.values, ranks.Q);
    const focus: BuffSpec = {
      id: ASHE_FOCUS,
      maxStacks: q("MaxStacks"),
      duration: q("StackDuration"),
      refreshOnStack: true,
      decayOneAtATime: true,
      decayInterval: q("StackFalloffDuration"),
    };
    const active: BuffSpec = {
      id: RANGERS_FOCUS,
      maxStacks: 1,
      duration: q("BuffDuration"),
      refreshOnStack: true,
      stats: { attackSpeed: q("BonusAS") / 100 },
    };
    abilities.push({
      id: "Q",
      castTime: Q.castTime,
      cooldown: at(Q.cooldown, ranks.Q, "Q cooldown"),
      cost: at(Q.cost, ranks.Q, "Q cost"),
    });
    kit.push({
      id: "AsheQ",
      onHit: (ctx, attack) => {
        // ASHE-002: no Focus while Ranger's Focus is up.
        if (!attack.phantom && ctx.buffStacks(RANGERS_FOCUS) === 0)
          ctx.addBuff(focus);
      },
      onAbilityCast: (ctx, id) => {
        if (id !== "Q") return;
        ctx.removeBuff(ASHE_FOCUS);
        ctx.addBuff(active); // ASHE-003
      },
      onAttackLaunch: (ctx, attack) => {
        if (attack.phantom || ctx.buffStacks(RANGERS_FOCUS) === 0) return;
        // ASHE-008: the flurry's arrows, as a share of one attack's damage; on-hit
        // effects still apply once per flurry (ASHE-009).
        const shots = q("ShotsPerStrike");
        const arrows = flurries === 0 ? q("FirstFlurryShots") : shots;
        flurries += 1;
        attack.amountScale *= (q("DamagePerStrike") * arrows) / shots;
      },
    });
    rotation.push({
      action: "Q",
      when: [{ kind: "minStacks", buff: ASHE_FOCUS, stacks: focus.maxStacks }],
    });
  }

  if (ranks.W > 0) {
    const volley = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount: evaluate(W.calculations.TotalDamage, {
        stats: ctx.stats,
        value: rankValues(W.values, ranks.W),
      }),
      source: "ability",
      sourceId: "AsheW",
      ability: true,
    });
    abilities.push({
      id: "W",
      castTime: W.castTime,
      cooldown: at(W.cooldown, ranks.W, "W cooldown"),
      cost: at(W.cost, ranks.W, "W cost"),
      estimate: (ctx) => [volley(ctx)],
    });
    kit.push({
      id: "AsheW",
      onAbilityCast: (ctx, id) => {
        if (id === "W") ctx.deal(volley(ctx)); // ASHE-004: one arrow hits
      },
    });
    rotation.push({ action: "W", when: [{ kind: "afterAttack" }] });
  }

  if (ranks.R > 0) {
    const arrow = (ctx: EffectContext): DamageInstance => ({
      type: "magic",
      amount: evaluate(R.calculations.RMainDamage, {
        stats: ctx.stats,
        value: rankValues(R.values, ranks.R),
      }),
      source: "ability",
      sourceId: "AsheR",
      ability: true,
    });
    // ASHE-005: available, but only in rotations the user writes.
    abilities.push({
      id: "R",
      castTime: R.castTime,
      cooldown: at(R.cooldown, ranks.R, "R cooldown"),
      cost: at(R.cost, ranks.R, "R cost"),
      estimate: (ctx) => [arrow(ctx)],
    });
    kit.push({
      id: "AsheR",
      onAbilityCast: (ctx, id) => {
        if (id === "R") ctx.deal(arrow(ctx));
      },
    });
  }

  rotation.push({ action: "attack" });
  return { abilities, kit, rotation };
}
