import type { AbilityKey, ChampionData } from "@lol/data";

import { abilityRanks, evaluate, rankValues } from "../core/calc";
import type { DamageInstance } from "../core/damage";
import type { BuffSpec, Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import type { SimAbility } from "../core/sim";
import type { ChampionKit } from "./jinx";

const STACKS = "CaitlynHeadshotStacks";

/** Every value the kit reads (DATA-012). */
export const caitlynRequiredValues = [
  "passive.values.AttacksPerHeadshot",
  "passive.values.CriticalStrikeScaling",
  "passive.calculations.HeadShotBonusDamage",
  "abilities.Q.calculations.InitialDamage",
  "abilities.W.values.ArmDelay",
  "abilities.W.values.HeadshotWindow",
  "abilities.W.calculations.HeadShotBonusDamage",
  "abilities.E.values.HeadshotWindow",
  "abilities.E.calculations.NetDamage",
  "abilities.R.values.CriticalStrikeModifier",
  "abilities.R.calculations.RTotalDamage",
] as const;

/** A headshot granted by a trap or net: usable from `from` until `until` (CAIT-002). */
interface Granted {
  source: "W" | "E";
  from: number;
  until: number;
}

/**
 * Caitlyn (scenarios/caitlyn.md): Headshot every (stacks + 1)th attack, trap and net
 * headshots that keep the stacks, Q Piltover Peacemaker, R Ace in the Hole (not in the
 * default rotation: CAIT-005).
 */
export function caitlyn(
  champion: ChampionData,
  level: number,
  ranks: Record<AbilityKey, number> = abilityRanks(champion, level),
): ChampionKit {
  const { passive } = champion;
  const { Q, W, E, R } = champion.abilities;
  const at = (
    list: readonly number[] | undefined,
    rank: number,
    name: string,
  ) => {
    const v = list?.[rank - 1];
    if (v === undefined)
      throw new Error(`Caitlyn: no ${name} at rank ${String(rank)}`);
    return v;
  };
  const passiveValue = rankValues(passive.values, 1);
  const maxStacks = passiveValue("AttacksPerHeadshot");
  const stacks: BuffSpec = {
    id: STACKS,
    maxStacks,
    duration: Infinity,
    refreshOnStack: false,
  };

  const abilities: SimAbility[] = [];
  const kit: Effect[] = [];
  const rotation: Rotation[number][] = [];
  let granted: Granted[] = [];

  const headshotDamage = (ctx: EffectContext, extra: number) => ({
    // Added after the crit roll, so it never crits (CAIT-001).
    type: "physical" as const,
    amount:
      evaluate(passive.calculations.HeadShotBonusDamage, {
        stats: ctx.stats,
        value: passiveValue,
      }) + extra,
    source: "passive" as const,
    sourceId: "CaitlynHeadshot",
  });
  const trapBonus = (ctx: EffectContext) =>
    ranks.W > 0
      ? evaluate(W.calculations.HeadShotBonusDamage, {
          stats: ctx.stats,
          value: rankValues(W.values, ranks.W),
        })
      : 0;

  kit.push({
    id: "CaitlynHeadshot",
    init: () => {
      granted = [];
    },
    onAttackLaunch: (ctx, attack) => {
      if (attack.phantom) return;
      granted = granted.filter((g) => g.until >= ctx.time);
      // CAIT-002: a trap or net headshot keeps the stacks (and the attack still stacks).
      const ready = granted
        .filter((g) => g.from <= ctx.time)
        .sort((a, b) => a.until - b.until)[0];
      if (ready) {
        granted = granted.filter((g) => g !== ready);
        ctx.addBuff(stacks);
        attack.extra.push(
          headshotDamage(ctx, ready.source === "W" ? trapBonus(ctx) : 0),
        );
        return;
      }
      // CAIT-001: at max stacks the attack consumes them and is a headshot.
      if (ctx.buffStacks(STACKS) >= maxStacks) {
        ctx.removeBuff(STACKS);
        attack.extra.push(headshotDamage(ctx, 0));
      } else ctx.addBuff(stacks);
    },
  });

  if (ranks.Q > 0) {
    const shot = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount: evaluate(Q.calculations.InitialDamage, {
        stats: ctx.stats,
        value: rankValues(Q.values, ranks.Q),
      }),
      source: "ability",
      sourceId: "CaitlynQ",
      ability: true,
    });
    abilities.push({
      id: "Q",
      castTime: Q.castTime,
      cooldown: at(Q.cooldown, ranks.Q, "Q cooldown"),
      cost: at(Q.cost, ranks.Q, "Q cost"),
      estimate: (ctx) => [shot(ctx)],
    });
    kit.push({
      id: "CaitlynQ",
      onAbilityCast: (ctx, id) => {
        if (id === "Q") ctx.deal(shot(ctx)); // CAIT-003
      },
    });
  }

  if (ranks.W > 0) {
    const w = rankValues(W.values, ranks.W);
    abilities.push({
      id: "W",
      castTime: W.castTime,
      cooldown: at(W.cooldown, ranks.W, "W cooldown"),
      cost: at(W.cost, ranks.W, "W cost"),
    });
    kit.push({
      id: "CaitlynW",
      onAbilityCast: (ctx, id) => {
        if (id !== "W") return;
        // CAIT-006: placed under the target, it springs once armed.
        const sprung = ctx.time + w("ArmDelay");
        granted = [
          ...granted.filter((g) => g.source !== "W"),
          { source: "W", from: sprung, until: sprung + w("HeadshotWindow") },
        ];
      },
    });
    rotation.push({ action: "W" });
  }

  if (ranks.E > 0) {
    const e = rankValues(E.values, ranks.E);
    const net = (ctx: EffectContext): DamageInstance => ({
      type: "magic",
      amount: evaluate(E.calculations.NetDamage, {
        stats: ctx.stats,
        value: e,
      }),
      source: "ability",
      sourceId: "CaitlynE",
      ability: true,
    });
    abilities.push({
      id: "E",
      castTime: E.castTime,
      cooldown: at(E.cooldown, ranks.E, "E cooldown"),
      cost: at(E.cost, ranks.E, "E cost"),
      estimate: (ctx) => [net(ctx)],
    });
    kit.push({
      id: "CaitlynE",
      onAbilityCast: (ctx, id) => {
        if (id !== "E") return;
        ctx.deal(net(ctx));
        granted = [
          ...granted.filter((g) => g.source !== "E"),
          {
            source: "E",
            from: ctx.time,
            until: ctx.time + e("HeadshotWindow"),
          },
        ];
      },
    });
    rotation.push({ action: "E" });
  }

  if (ranks.Q > 0)
    rotation.push({ action: "Q", when: [{ kind: "afterAttack" }] });

  if (ranks.R > 0) {
    const bullet = (ctx: EffectContext): DamageInstance => ({
      type: "physical",
      amount: evaluate(R.calculations.RTotalDamage, {
        stats: ctx.stats,
        value: rankValues(R.values, ranks.R),
      }),
      source: "ability",
      sourceId: "CaitlynR",
      ability: true,
    });
    // CAIT-005: available, but only in rotations the user writes.
    abilities.push({
      id: "R",
      castTime: R.castTime,
      cooldown: at(R.cooldown, ranks.R, "R cooldown"),
      cost: at(R.cost, ranks.R, "R cost"),
      estimate: (ctx) => [bullet(ctx)],
    });
    kit.push({
      id: "CaitlynR",
      onAbilityCast: (ctx, id) => {
        if (id === "R") ctx.deal(bullet(ctx)); // CAIT-004
      },
    });
  }

  rotation.push({ action: "attack" });
  const buffs = [{ id: STACKS, label: "Headshot stacks", max: maxStacks }];
  return { abilities, kit, rotation, buffs };
}
