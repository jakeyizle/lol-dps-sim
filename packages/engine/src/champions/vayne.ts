import type { AbilityKey, ChampionData } from "@lol/data";

import { abilityRanks, evaluate, rankAt, rankValues } from "../core/calc";
import type { DamageInstance } from "../core/damage";
import type { BuffSpec, Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import type { SimAbility } from "../core/sim";
import type { StatBlock } from "../core/stats";
import type { ChampionKit } from "./jinx";

export const VAYNE_SILVER_BOLTS = "VayneSilverBolts";
// Stryker disable next-line StringLiteral: a consistent rename of an internal buff id
const TUMBLE = "VayneTumble";
// Stryker disable next-line StringLiteral: a consistent rename of an internal buff id
const FINAL_HOUR = "VayneFinalHour";
/** Stacks consumed by the third (the game's fixed count). */
const BOLTS_TO_PROC = 3;

/** Every value the kit reads (DATA-012). */
export const vayneRequiredValues = [
  "abilities.Q.values.Duration",
  "abilities.Q.values.DashRange",
  "abilities.Q.values.DashSpeed",
  "abilities.Q.calculations.ADRatioBonus",
  "abilities.W.values.MaxHealthRatio",
  "abilities.W.values.DamageFloor",
  "abilities.W.values.DebuffDuration",
  "abilities.E.calculations.TotalDamage",
  "abilities.R.values.BonusAttackDamage",
  "abilities.R.values.BaseDuration",
  "abilities.R.values.TumbleCDReduction",
] as const;

/**
 * Vayne (scenarios/vayne.md): Silver Bolts on the third stack, Q Tumble (attack reset and
 * empowered attack), E Condemn (no wall in a dummy fight), R Final Hour.
 */
export function vayne(
  champion: ChampionData,
  level: number,
  ranks: Record<AbilityKey, number> = abilityRanks(champion, level),
): ChampionKit {
  const { Q, W, E, R } = champion.abilities;
  const at = rankAt;

  const abilities: SimAbility[] = [];
  // Stryker disable next-line ArrayDeclaration: a junk effect has no hooks, so the sim skips it
  const kit: Effect[] = [];
  const rotation: Rotation[number][] = [];

  /** VAYNE-001: a stack per attack hit or Condemn; the third deals true damage. */
  let bolt: (ctx: EffectContext) => void = () => {
    // no W points: no Silver Bolts
  };
  if (ranks.W > 0) {
    const w = rankValues(W.values, ranks.W);
    const bolts: BuffSpec = {
      id: VAYNE_SILVER_BOLTS,
      maxStacks: BOLTS_TO_PROC,
      duration: w("DebuffDuration"),
      refreshOnStack: true,
    };
    bolt = (ctx) => {
      if (ctx.buffStacks(VAYNE_SILVER_BOLTS) + 1 < BOLTS_TO_PROC) {
        ctx.addBuff(bolts);
        return;
      }
      ctx.removeBuff(VAYNE_SILVER_BOLTS);
      ctx.deal({
        type: "true",
        amount: Math.max(
          w("DamageFloor"),
          w("MaxHealthRatio") * ctx.targetMaxHealth,
        ),
        source: "ability",
        sourceId: "VayneW",
      });
    };
    // Guinsoo's Phantom Hit applies on-hit again, so it stacks too.
    kit.push({
      id: "VayneW",
      onHit: (ctx) => {
        bolt(ctx);
      },
    });
  }

  if (ranks.Q > 0) {
    const q = rankValues(Q.values, ranks.Q);
    const empowered: BuffSpec = {
      id: TUMBLE,
      maxStacks: 1,
      duration: q("Duration"),
      // Stryker disable next-line BooleanLiteral: Tumble is recast only after the empowered attack spends it
      refreshOnStack: true,
    };
    const rCut =
      ranks.R > 0
        ? at(R.values.TumbleCDReduction, ranks.R, "R TumbleCDReduction") / 100
        : 0;
    abilities.push({
      id: "Q",
      // VAYNE-006: the dash, after which the attack timer is reset.
      castTime: (stats: StatBlock) =>
        q("DashRange") / (q("DashSpeed") + stats.moveSpeed.total),
      cooldown: at(Q.cooldown, ranks.Q, "Q cooldown"),
      cost: at(Q.cost, ranks.Q, "Q cost"),
      resetsAttack: true,
    });
    kit.push({
      id: "VayneQ",
      onAbilityCast: (ctx, id) => {
        if (id !== "Q") return;
        ctx.addBuff(empowered);
        // VAYNE-007: Final Hour shortens Tumble's cooldown.
        if (ctx.buffStacks(FINAL_HOUR) > 0)
          ctx.reduceCooldownsBy(
            ["Q"],
            rCut * at(Q.cooldown, ranks.Q, "Q cooldown"),
          );
      },
      onAttackLaunch: (ctx, attack) => {
        if (ctx.buffStacks(TUMBLE) === 0) return;
        ctx.removeBuff(TUMBLE);
        // VAYNE-002: bonus physical damage that can't crit, landing with the attack.
        attack.extra.push({
          type: "physical",
          amount: evaluate(Q.calculations.ADRatioBonus, {
            stats: ctx.stats,
            value: q,
          }),
          source: "ability",
          sourceId: "VayneQ",
        });
      },
    });
  }

  if (ranks.E > 0) {
    const condemn = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount: evaluate(E.calculations.TotalDamage, {
        stats: ctx.stats,
        value: rankValues(E.values, ranks.E),
      }),
      source: "ability",
      sourceId: "VayneE",
      ability: true,
    });
    abilities.push({
      id: "E",
      castTime: E.castTime,
      cooldown: at(E.cooldown, ranks.E, "E cooldown"),
      cost: at(E.cost, ranks.E, "E cost"),
      estimate: (ctx) => [condemn(ctx)],
    });
    kit.push({
      id: "VayneE",
      onAbilityCast: (ctx, id) => {
        if (id !== "E") return;
        ctx.deal(condemn(ctx)); // VAYNE-004
        bolt(ctx);
      },
    });
  }

  if (ranks.R > 0) {
    const r = rankValues(R.values, ranks.R);
    const finalHour: BuffSpec = {
      id: FINAL_HOUR,
      maxStacks: 1,
      duration: r("BaseDuration"),
      // Stryker disable next-line BooleanLiteral: R is cast once per buff (its cooldown outlasts it)
      refreshOnStack: true,
      stats: { attackDamage: r("BonusAttackDamage") },
    };
    // VAYNE-005: available, but only in rotations the user writes.
    abilities.push({
      id: "R",
      castTime: R.castTime,
      cooldown: at(R.cooldown, ranks.R, "R cooldown"),
      cost: at(R.cost, ranks.R, "R cost"),
    });
    kit.push({
      id: "VayneR",
      onAbilityCast: (ctx, id) => {
        if (id === "R") ctx.addBuff(finalHour); // VAYNE-003
      },
    });
  }

  if (ranks.Q > 0)
    rotation.push({ action: "Q", when: [{ kind: "afterAttack" }] });
  rotation.push({ action: "attack" });
  const buffs =
    ranks.W > 0
      ? [
          {
            id: VAYNE_SILVER_BOLTS,
            label: "Silver Bolts",
            max: BOLTS_TO_PROC - 1,
          },
        ]
      : [];
  return { abilities, kit, rotation, buffs };
}
