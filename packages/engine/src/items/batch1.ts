import type { ChampionData, ItemData } from "@lol/data";

import { evaluate, flatValues, isRanged } from "../core/calc";
import { everyNthAttack, type Attack, type Effect } from "../core/effects";

export const KRAKEN_SLAYER = "6672";
export const BLADE_OF_THE_RUINED_KING = "3153";
export const LORD_DOMINIKS_REGARDS = "3036";

/** Every value each effect reads (DATA-012). */
export const batch1RequiredValues = {
  [KRAKEN_SLAYER]: [
    "values.AttackCount",
    "values.BuffDuration",
    "values.MaxAmpNumber",
    "values.RangedDamageMultiplier",
    "calculations.DamageAmount",
  ],
  [BLADE_OF_THE_RUINED_KING]: ["values.RangedValue", "values.MeleeValue"],
  [LORD_DOMINIKS_REGARDS]: [
    "values.MaxBonusDamagePercent",
    "values.MaxBonusHealth",
  ],
} as const;

/**
 * ITEM-004, ITEM-011, ITEM-012: every Nth attack deals level-based physical on-hit damage,
 * amplified by missing health. Ranged attackers count at launch; damage lands on hit.
 */
export function krakenSlayer(item: ItemData, owner: ChampionData): Effect {
  const value = flatValues(item.values);
  const ranged = isRanged(owner);
  const maxAmp = value("MaxAmpNumber") - 1;
  const empowered = new WeakSet<Attack>();

  const counter = everyNthAttack({
    id: "KrakenSlayer",
    n: value("AttackCount"),
    // Stryker disable next-line StringLiteral: anything but "launch" counts hits
    at: ranged ? "launch" : "hit",
    duration: value("BuffDuration"),
    apply: (_ctx, attack) => {
      empowered.add(attack);
    },
  });

  return {
    id: "KrakenSlayer",
    onAttackLaunch: counter.onAttackLaunch,
    onHit: (ctx, attack) => {
      counter.onHit?.(ctx, attack);
      if (!empowered.has(attack)) return;
      const base = evaluate(item.calculations.DamageAmount, {
        stats: ctx.stats,
        value,
        calculations: item.calculations,
        ranged,
      });
      const missing = 1 - ctx.targetHealth / ctx.targetMaxHealth;
      ctx.deal({
        type: "physical",
        amount: base * (1 + maxAmp * missing),
        source: "item",
        sourceId: "KrakenSlayer",
        onHit: true,
      });
    },
  };
}

/** ITEM-005: physical on-hit damage, a percent of the target's current health. */
export function bladeOfTheRuinedKing(
  item: ItemData,
  owner: ChampionData,
): Effect {
  const value = flatValues(item.values);
  const percent = value(isRanged(owner) ? "RangedValue" : "MeleeValue");
  return {
    id: "BladeOfTheRuinedKing",
    onHit: (ctx) => {
      ctx.deal({
        type: "physical",
        amount: percent * ctx.targetHealth,
        source: "item",
        sourceId: "BladeOfTheRuinedKing",
        onHit: true,
      });
    },
  };
}

/** ITEM-013: Giant Slayer, up to a max amp at the item's max bonus health. */
export function lordDominiksRegards(item: ItemData): Effect {
  const value = flatValues(item.values);
  const max = value("MaxBonusDamagePercent");
  const atHealth = value("MaxBonusHealth");
  return {
    id: "LordDominiksRegards",
    modifyOutgoing: (ctx) =>
      ctx.targetIsChampion
        ? max * Math.min(1, ctx.targetBonusHealth / atHealth)
        : undefined,
  };
}
