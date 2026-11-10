import type { RuneData } from "@lol/data";

import { flatValues, levelInterpolation } from "../core/calc";
import type { Effect } from "../core/effects";

export const CUT_DOWN = 8017;
export const COUP_DE_GRACE = 8014;
export const LAST_STAND = 8299;
export const ABSOLUTE_FOCUS = 8233;
export const GATHERING_STORM = 8236;
export const LEGEND_ALACRITY = 9104;

/** Every value each rune reads (DATA-012). */
export const minorRuneRequiredValues = {
  [CUT_DOWN]: [
    "values.EnemyHealthPercentageThreshold",
    "values.BonusPercentDamage",
  ],
  [COUP_DE_GRACE]: [
    "values.EnemyHealthPercentageThreshold",
    "values.BonusPercentDamage",
  ],
  [LAST_STAND]: [
    "values.MinBonusDamagePercent",
    "values.MaxBonusDamagePercent",
    "values.HealthThresholdStart",
    "values.HealthThresholdEnd",
  ],
  [ABSOLUTE_FOCUS]: [
    "values.HealthPercent",
    "values.MinAdaptive",
    "values.MaxAdaptive",
    "values.AdaptiveADPerAP",
  ],
  [GATHERING_STORM]: ["values.UpdateAfterMinutes", "values.AdaptiveAD"],
  [LEGEND_ALACRITY]: [
    "values.AttackSpeedBase",
    "values.AttackSpeedPerStack",
    "values.MaxLegendStacks",
  ],
} as const;

/**
 * RUNE-007: more damage to champions above the health threshold (since V14.10; the
 * health-difference values in the game file are left over from the old version).
 */
export function cutDown(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  return {
    id: "CutDown",
    modifyOutgoing: (ctx) =>
      ctx.targetIsChampion &&
      // Stryker disable next-line EqualityOperator: exactly on the threshold is a measure-zero boundary
      ctx.targetHealth >
        value("EnemyHealthPercentageThreshold") * ctx.targetMaxHealth
        ? value("BonusPercentDamage")
        : undefined,
  };
}

/** RUNE-008: more damage to champions below the health threshold. */
export function coupDeGrace(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  return {
    id: "CoupDeGrace",
    modifyOutgoing: (ctx) =>
      ctx.targetIsChampion &&
      ctx.targetHealth <
        value("EnemyHealthPercentageThreshold") * ctx.targetMaxHealth
        ? value("BonusPercentDamage")
        : undefined,
  };
}

/** RUNE-014: below the start threshold, min → max bonus linearly down to the end threshold. */
export function lastStand(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  const start = value("HealthThresholdStart");
  const end = value("HealthThresholdEnd");
  return {
    id: "LastStand",
    modifyOutgoing: (ctx) => {
      const health = ctx.attackerHealthFraction;
      if (!ctx.targetIsChampion || health >= start) return undefined;
      const t = Math.min(1, (start - health) / (start - end));
      return (
        value("MinBonusDamagePercent") +
        t * (value("MaxBonusDamagePercent") - value("MinBonusDamagePercent"))
      );
    },
  };
}

/** RUNE-015: adaptive force (AD for the MVP champions) while above the health threshold. */
export function absoluteFocus(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  return {
    id: "AbsoluteFocus",
    modifyStats: (ctx) =>
      ctx.attackerHealthFraction > value("HealthPercent")
        ? {
            attackDamage:
              value("AdaptiveADPerAP") *
              levelInterpolation(
                value("MinAdaptive"),
                value("MaxAdaptive"),
                ctx.level,
              ),
          }
        : undefined,
  };
}

/** RUNE-010: every interval adds n × the per-step AD, so after n steps 1 + 2 + … + n. */
export function gatheringStorm(rune: RuneData): Effect {
  const value = flatValues(rune.values);
  return {
    id: "GatheringStorm",
    modifyStats: (ctx) => {
      const n = Math.floor(ctx.gameTime / value("UpdateAfterMinutes"));
      return { attackDamage: (value("AdaptiveAD") * n * (n + 1)) / 2 };
    },
  };
}

/** RUNE-009: base attack speed plus a long-term amount per Legend stack. */
export function legendAlacrity(rune: RuneData, stacks = 0): Effect {
  const value = flatValues(rune.values);
  const n = Math.max(0, Math.min(value("MaxLegendStacks"), stacks));
  return {
    id: "LegendAlacrity",
    modifyStats: () => ({
      attackSpeed: value("AttackSpeedBase") + value("AttackSpeedPerStack") * n,
    }),
  };
}
