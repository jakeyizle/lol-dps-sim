import type { AbilityKey, ChampionData } from "@lol/data";

import { abilityRanks, evaluate, rankAt, rankValues } from "../core/calc";
import type { DamageInstance } from "../core/damage";
import type {
  AttackMode,
  BuffSpec,
  Effect,
  EffectContext,
} from "../core/effects";
import type { Rotation } from "../core/rotation";
import type { SimAbility } from "../core/sim";
import type { StatBlock } from "../core/stats";

export interface ChampionKit {
  abilities: SimAbility[];
  kit: Effect[];
  /** ROT-007. */
  rotation: Rotation;
  /** ROT-009: stack buffs a rotation's "min stacks" condition may name. */
  buffs: { id: string; label: string; max: number }[];
}

const REVD_UP = "JinxRevdUp";
// Stryker disable next-line StringLiteral: a consistent rename of an internal buff id
const FISHBONES = "JinxFishbones";
const MINIGUN: AttackMode = {
  slot: "basic",
  critSlot: "JinxCritAttack",
  cost: 0,
};

/** Every value the kit reads (DATA-012). */
export const jinxRequiredValues = [
  "abilities.Q.values.MinigunAttackSpeedMax",
  "abilities.Q.values.MinigunAttackSpeedStacks",
  "abilities.Q.values.MinigunAttackSpeedDuration",
  "abilities.Q.values.MinigunFirstStackWeight",
  "abilities.Q.values.RocketTAD",
  "abilities.Q.values.RocketASPDPenalty",
  "abilities.W.values.JinxLowEndWCastTime",
  "abilities.W.values.JinxWASpeedCastTimeScalarPerHundrethSecond",
  "abilities.W.calculations.TotalDamage",
  "abilities.R.values.PercentDamage",
  "abilities.R.calculations.DamageMax",
] as const;

/**
 * Jinx (scenarios/jinx.md): Q toggles minigun / rockets, W Zap!, R Super Mega Death
 * Rocket at max range. Ranks come from the skill order at `level` unless given.
 */
export function jinx(
  champion: ChampionData,
  level: number,
  ranks: Record<AbilityKey, number> = abilityRanks(champion, level),
): ChampionKit {
  const { Q, W, R } = champion.abilities;
  const at = rankAt;
  const q = (name: string) => at(Q.values[name], ranks.Q, `Q ${name}`);
  const w = (name: string) => at(W.values[name], ranks.W, `W ${name}`);

  const abilities: SimAbility[] = [];
  // Stryker disable next-line ArrayDeclaration: a junk effect has no hooks, so the sim skips it
  const kit: Effect[] = [];
  const rotation: Rotation[number][] = [];

  if (ranks.Q > 0) {
    const stacks = q("MinigunAttackSpeedStacks");
    const weight = q("MinigunFirstStackWeight");
    const perStack = q("MinigunAttackSpeedMax") / 100 / (weight + stacks - 1);
    const revdUp: BuffSpec = {
      id: REVD_UP,
      maxStacks: stacks,
      duration: q("MinigunAttackSpeedDuration"),
      refreshOnStack: true,
      decayOneAtATime: true,
    };
    const rockets: AttackMode = {
      slot: "JinxQAttack",
      critSlot: "JinxQCritAttack",
      cost: at(Q.cost, ranks.Q, "Q cost"),
    };
    const fishbones: BuffSpec = {
      id: FISHBONES,
      maxStacks: 1,
      duration: Infinity,
      // Stryker disable next-line BooleanLiteral: with no expiry, refreshing changes nothing
      refreshOnStack: false,
    };
    const usingRockets = (ctx: { buffStacks: (id: string) => number }) =>
      ctx.buffStacks(FISHBONES) > 0;

    abilities.push({
      id: "Q",
      castTime: Q.castTime,
      cooldown: at(Q.cooldown, ranks.Q, "Q cooldown"),
      cost: 0,
    });
    kit.push({
      id: "JinxQ",
      modifyStats: (ctx) => {
        // Stacks still count until the first rocket attack launches (JINX-003).
        const n = ctx.buffStacks(REVD_UP);
        return {
          attackSpeed: n > 0 ? perStack * (weight + n - 1) : 0,
          bonusAttackSpeedReduction: usingRockets(ctx)
            ? q("RocketASPDPenalty")
            : 0,
        };
      },
      onHit: (ctx) => {
        if (!usingRockets(ctx)) ctx.addBuff(revdUp); // JINX-001
      },
      onAttackLaunch: (ctx, attack) => {
        if (!usingRockets(ctx)) return;
        attack.amountScale = q("RocketTAD"); // JINX-002
        ctx.removeBuff(REVD_UP); // JINX-003: only the first rocket attack keeps them
      },
      onAbilityCast: (ctx, id) => {
        if (id !== "Q") return;
        if (usingRockets(ctx)) {
          ctx.removeBuff(FISHBONES);
          ctx.setAttackMode(MINIGUN);
        } else {
          ctx.addBuff(fishbones);
          ctx.setAttackMode(rockets);
        }
      },
    });
  }

  if (ranks.W > 0) {
    const zap = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount: evaluate(W.calculations.TotalDamage, {
        stats: ctx.stats,
        value: rankValues(W.values, ranks.W),
      }),
      source: "ability",
      sourceId: "JinxW",
      ability: true,
    });
    const low = w("JinxLowEndWCastTime");
    const perHundredth = w("JinxWASpeedCastTimeScalarPerHundrethSecond");
    abilities.push({
      id: "W",
      // JINX-009: 0.01 s less per `perHundredth` bonus attack speed, down to `low`.
      castTime: (stats: StatBlock) =>
        Math.max(
          low,
          W.castTime - (0.01 * stats.bonusAttackSpeed) / perHundredth,
        ),
      cooldown: at(W.cooldown, ranks.W, "W cooldown"),
      cost: at(W.cost, ranks.W, "W cost"),
      estimate: (ctx) => [zap(ctx)],
    });
    kit.push({
      id: "JinxW",
      onAbilityCast: (ctx, id) => {
        if (id === "W") ctx.deal(zap(ctx)); // JINX-004
      },
    });
    rotation.push({ action: "W", when: [{ kind: "afterAttack" }] });
  }

  if (ranks.R > 0) {
    const percent =
      at(R.values.PercentDamage, ranks.R, "R PercentDamage") / 100;
    const rocket = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount:
        evaluate(R.calculations.DamageMax, {
          stats: ctx.stats,
          value: rankValues(R.values, ranks.R),
        }) +
        percent * (ctx.targetMaxHealth - ctx.targetHealth),
      source: "ability",
      sourceId: "JinxR",
      ability: true,
    });
    abilities.push({
      id: "R",
      castTime: R.castTime,
      cooldown: at(R.cooldown, ranks.R, "R cooldown"),
      cost: at(R.cost, ranks.R, "R cost"),
      estimate: (ctx) => [rocket(ctx)],
    });
    kit.push({
      id: "JinxR",
      onAbilityCast: (ctx, id) => {
        if (id === "R") ctx.deal(rocket(ctx)); // JINX-005
      },
    });
    rotation.unshift({ action: "R", when: [{ kind: "wouldKill" }] });
  }

  rotation.push({ action: "attack" }); // JINX-006
  const buffs =
    ranks.Q > 0
      ? [{ id: REVD_UP, label: "Rev'd up", max: q("MinigunAttackSpeedStacks") }]
      : [];
  return { abilities, kit, rotation, buffs };
}
