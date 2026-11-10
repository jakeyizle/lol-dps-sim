import type { ItemData } from "@lol/data";

import { evaluate, flatValues } from "../core/calc";
import type { Attack, BuffSpec, Effect } from "../core/effects";
import type { GameConstants } from "../core/stats";

export const THE_COLLECTOR = "6676";
export const GUINSOOS_RAGEBLADE = "3124";
export const NAVORI_FLICKERBLADE = "6675";
export const STATIKK_SHIV = "3087";
export const RAPID_FIRECANNON = "3094";
export const TERMINUS = "3302";

/** Every value each effect reads (DATA-012). */
export const batch2RequiredValues = {
  [THE_COLLECTOR]: ["values.LethalityAmount", "values.ExecuteThreshold"],
  [GUINSOOS_RAGEBLADE]: [
    "values.OnHitDamage",
    "values.AttackSpeedPerStack",
    "values.MaxStacks",
    "values.BuffDuration",
    "values.PhantomStacks",
    "values.PhantomHitDelay",
  ],
  [NAVORI_FLICKERBLADE]: ["values.CDRAmount"],
  [STATIKK_SHIV]: [
    "values.ChainDamage",
    "values.NonChampChainDamage",
    "values.BonusEnergizedStacks",
  ],
  [RAPID_FIRECANNON]: ["values.BonusDamage"],
  [TERMINUS]: [
    "values.PenPerHit",
    "values.PenMax",
    "values.DebuffDuration",
    "calculations.OnHitDamage",
  ],
} as const;

const magicOnHit = (sourceId: string, amount: number) => ({
  type: "magic" as const,
  amount,
  source: "item" as const,
  sourceId,
  onHit: true,
});

/** ITEM-014: lethality and an execute against champions. */
export function theCollector(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "TheCollector",
    executeBelow: value("ExecuteThreshold"),
    modifyStats: () => ({ lethality: value("LethalityAmount") }),
  };
}

/** ITEM-015, ITEM-016. */
export function guinsoosRageblade(item: ItemData): Effect {
  const value = flatValues(item.values);
  const seething: BuffSpec = {
    id: "GuinsooSeething",
    maxStacks: value("MaxStacks"),
    duration: value("BuffDuration"),
    refreshOnStack: true,
    stats: { attackSpeed: value("AttackSpeedPerStack") },
  };
  const phantom: BuffSpec = {
    id: "GuinsooPhantom",
    maxStacks: value("PhantomStacks"),
    duration: value("BuffDuration"),
    refreshOnStack: true,
  };
  return {
    id: "GuinsoosRageblade",
    onHit: (ctx, attack) => {
      ctx.deal(magicOnHit("GuinsoosRageblade", value("OnHitDamage")));
      if (attack.phantom) return;
      // Phantom stacks come only once all attack speed stacks are active.
      if (ctx.buffStacks(phantom.id) >= phantom.maxStacks) {
        ctx.removeBuff(phantom.id);
        ctx.applyOnHit(attack, value("PhantomHitDelay"));
      } else if (ctx.buffStacks(seething.id) >= seething.maxStacks)
        ctx.addBuff(phantom);
      ctx.addBuff(seething);
    },
  };
}

/** ITEM-017: attacks cut the remaining cooldowns of basic abilities. */
export function navoriFlickerblade(item: ItemData): Effect {
  const fraction = flatValues(item.values)("CDRAmount");
  return {
    id: "NavoriFlickerblade",
    onAttackLaunch: (ctx) => {
      ctx.reduceCooldowns(["Q", "W", "E"], fraction);
    },
  };
}

const energized = new WeakSet<Attack>();

/** The attack spent a full Energized meter (ITEM-018). */
export const isEnergized = (attack: Attack) => energized.has(attack);

/**
 * ITEM-018: the shared Energized meter, added once for a build with Energized items.
 * Stationary attacker: only attacks add stacks. At max, the next attack spends them.
 */
export function energizeMeter(
  constants: GameConstants,
  bonusPerAttack: number,
): Effect {
  const perAttack = constants.energizeStacksPerAttack;
  const max = constants.energizeMaxStacks;
  if (perAttack === undefined || max === undefined)
    throw new Error("Energized items need the patch's energize constants");
  const meter: BuffSpec = {
    id: "Energized",
    maxStacks: max,
    duration: Infinity,
    refreshOnStack: false,
  };
  return {
    id: "Energized",
    onAttackLaunch: (ctx, attack) => {
      if (ctx.buffStacks(meter.id) >= max) {
        ctx.removeBuff(meter.id);
        energized.add(attack);
      } else ctx.addBuff(meter, perAttack + bonusPerAttack);
    },
  };
}

/** Extra Energized stacks per attack the item adds (Statikk Shiv). */
export const bonusEnergizeStacks = (item: ItemData) =>
  item.id === STATIKK_SHIV
    ? flatValues(item.values)("BonusEnergizedStacks")
    : 0;

/** ITEM-019: energized attacks deal chain damage (single target: the target only). */
export function statikkShiv(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "StatikkShiv",
    onHit: (ctx, attack) => {
      if (attack.phantom || !isEnergized(attack)) return;
      const amount = value(
        ctx.targetIsChampion ? "ChainDamage" : "NonChampChainDamage",
      );
      ctx.deal(magicOnHit("StatikkShiv", amount));
    },
  };
}

/** ITEM-020: energized attacks deal bonus magic damage. */
export function rapidFirecannon(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "RapidFirecannon",
    onHit: (ctx, attack) => {
      if (attack.phantom || !isEnergized(attack)) return;
      ctx.deal(magicOnHit("RapidFirecannon", value("BonusDamage")));
    },
  };
}

/** ITEM-021: on-hit magic damage; against champions, Dark hits (every 2nd) stack penetration. */
export function terminus(item: ItemData): Effect {
  const value = flatValues(item.values);
  const perHit = value("PenPerHit");
  const dark: BuffSpec = {
    id: "TerminusDark",
    maxStacks: Math.round(value("PenMax") / perHit),
    duration: value("DebuffDuration"),
    refreshOnStack: true,
  };
  let hits = 0;
  return {
    id: "Terminus",
    init: () => {
      hits = 0;
    },
    // Summed within the item (10% per stack, 30% max), then multiplied with other sources.
    modifyStats: (ctx) => {
      const n = ctx.buffStacks(dark.id);
      return n > 0
        ? { armorPenPercent: perHit * n, magicPenPercent: perHit * n }
        : undefined;
    },
    onHit: (ctx, attack) => {
      ctx.deal(
        magicOnHit(
          "Terminus",
          evaluate(item.calculations.OnHitDamage, {
            stats: ctx.stats,
            value,
          }),
        ),
      );
      if (attack.phantom || !ctx.targetIsChampion) return;
      hits += 1;
      if (hits % 2 === 0) ctx.addBuff(dark); // Light first, then Dark
    },
  };
}
