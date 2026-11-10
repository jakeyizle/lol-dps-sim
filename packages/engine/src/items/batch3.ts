import type { ChampionData, ItemData } from "@lol/data";

import { evaluate, flatValues, isRanged } from "../core/calc";
import type { Attack, BuffSpec, Effect } from "../core/effects";
import { isEnergized } from "./batch2";

export const NASHORS_TOOTH = "3115";
export const WITS_END = "3091";
export const YUN_TAL_WILDARROWS = "3032";
export const STORMRAZOR = "3095";
export const HEXOPTICS_C44 = "2523";
export const FIENDHUNTER_BOLTS = "2512";
export const ESSENCE_REAVER = "3508";

/** Every value each effect reads (DATA-012). */
export const batch3RequiredValues = {
  [NASHORS_TOOTH]: ["values.NashorsBaseValue", "values.NashorsAPValue"],
  [WITS_END]: ["calculations.OnHitDamage"],
  [YUN_TAL_WILDARROWS]: [
    "values.CritPerStackMelee",
    "values.StackRangedMultiplier",
    "values.CritMax",
    "values.ASMod",
    "values.ASDuration",
    "values.Cooldown",
    "values.AACDR",
    "values.CritCDR",
  ],
  [STORMRAZOR]: ["calculations.TotalProcDamage"],
  [HEXOPTICS_C44]: ["values.MaxDamageAmp", "values.MaxRange"],
  [FIENDHUNTER_BOLTS]: [
    "values.UltimateHaste",
    "values.Cooldown",
    "values.Duration",
    "values.NumberOfAttacks",
    "values.BonusAS",
    "values.CritModifier",
    "values.BonusTrueDamage",
  ],
  [ESSENCE_REAVER]: [
    "values.SpellbladeCooldown",
    "values.SpellbladeWindow",
    "calculations.SpellbladeDamage",
  ],
} as const;

const magicOnHit = (sourceId: string, amount: number) => ({
  type: "magic" as const,
  amount,
  source: "item" as const,
  sourceId,
  onHit: true,
});

/** ITEM-022. */
export function nashorsTooth(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "NashorsTooth",
    onHit: (ctx) => {
      ctx.deal(
        magicOnHit(
          "NashorsTooth",
          value("NashorsBaseValue") +
            value("NashorsAPValue") * ctx.stats.abilityPower,
        ),
      );
    },
  };
}

/** ITEM-023. */
export function witsEnd(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "WitsEnd",
    onHit: (ctx) => {
      ctx.deal(
        magicOnHit(
          "WitsEnd",
          evaluate(item.calculations.OnHitDamage, { stats: ctx.stats, value }),
        ),
      );
    },
  };
}

/** ITEM-024 (long-term crit stacks, SIM-010) and ITEM-025 (Flurry). */
export function yunTalWildarrows(
  item: ItemData,
  owner: ChampionData,
  startingStacks = 0,
): Effect {
  const value = flatValues(item.values);
  const perStack =
    (value("CritPerStackMelee") *
      (isRanged(owner) ? value("StackRangedMultiplier") : 1)) /
    100;
  const critMax = value("CritMax") / 100;
  const stacks: BuffSpec = {
    id: "YunTalStacks",
    maxStacks: Math.ceil(critMax / perStack),
    duration: Infinity,
    refreshOnStack: false,
  };
  const flurry: BuffSpec = {
    id: "YunTalFlurry",
    maxStacks: 1,
    duration: value("ASDuration"),
    refreshOnStack: true,
    stats: { attackSpeed: value("ASMod") },
  };
  let readyAt = 0;
  return {
    id: "YunTalWildarrows",
    init: (ctx) => {
      readyAt = 0;
      if (startingStacks > 0) ctx.addBuff(stacks, startingStacks);
    },
    modifyStats: (ctx) => ({
      critChance: Math.min(critMax, perStack * ctx.buffStacks(stacks.id)),
    }),
    onAttackLaunch: (ctx) => {
      ctx.addBuff(stacks);
      if (ctx.targetIsChampion && ctx.time >= readyAt) {
        ctx.addBuff(flurry);
        readyAt = ctx.time + value("Cooldown");
      }
    },
    onHit: (ctx, attack) => {
      if (attack.phantom) return;
      const critShare =
        attack.crit === undefined ? ctx.stats.critChance : attack.crit ? 1 : 0;
      readyAt -=
        value("AACDR") + critShare * (value("CritCDR") - value("AACDR"));
    },
  };
}

/** ITEM-026. */
export function stormrazor(item: ItemData): Effect {
  const value = flatValues(item.values);
  return {
    id: "Stormrazor",
    onHit: (ctx, attack) => {
      if (attack.phantom || !isEnergized(attack)) return;
      ctx.deal(
        magicOnHit(
          "Stormrazor",
          evaluate(item.calculations.TotalProcDamage, {
            stats: ctx.stats,
            value,
          }),
        ),
      );
    },
  };
}

/** ITEM-027: attacking from the champion's attack range. */
export function hexopticsC44(item: ItemData, owner: ChampionData): Effect {
  const value = flatValues(item.values);
  const amp =
    value("MaxDamageAmp") *
    Math.min(1, owner.stats.attackRange.base / value("MaxRange"));
  return {
    id: "HexopticsC44",
    modifyOutgoing: (_ctx, instance) => (instance.autoAttack ? amp : undefined),
  };
}

/** ITEM-028 (ultimate haste) and ITEM-029 (Opening Barrage after R). */
export function fiendhunterBolts(item: ItemData): Effect {
  const value = flatValues(item.values);
  const barrage: BuffSpec = {
    id: "FiendhunterBarrage",
    maxStacks: value("NumberOfAttacks"),
    duration: value("Duration"),
    refreshOnStack: true,
  };
  const empowered = new WeakSet<Attack>();
  let readyAt = 0;
  return {
    id: "FiendhunterBolts",
    init: () => {
      readyAt = 0;
    },
    modifyStats: (ctx) => ({
      ultimateHaste: value("UltimateHaste"),
      attackSpeed: ctx.buffStacks(barrage.id) > 0 ? value("BonusAS") : 0,
    }),
    onAbilityCast: (ctx, id) => {
      if (id !== "R" || ctx.time < readyAt) return;
      readyAt = ctx.time + value("Cooldown");
      ctx.addBuff(barrage, barrage.maxStacks);
    },
    onAttackLaunch: (ctx, attack) => {
      const left = ctx.buffStacks(barrage.id);
      if (left === 0) return;
      // The attack's own timer already used the bonus attack speed; spend one charge.
      ctx.removeBuff(barrage.id);
      if (left > 1) ctx.addBuff(barrage, left - 1);
      empowered.add(attack);

      // Always crits: a would-be non-crit uses the crit modifier on bonus crit damage.
      const critDamage = ctx.stats.critDamage;
      const weak = 1 + (critDamage - 1) * value("CritModifier");
      const critShare =
        attack.crit === undefined ? ctx.stats.critChance : attack.crit ? 1 : 0;
      const base = ctx.stats.attackDamage.total * attack.amountScale;
      attack.amountScale *= critShare * critDamage + (1 - critShare) * weak;
      attack.critable = false;
      // A real crit also deals true damage from that crit's pre-mitigation damage.
      if (critShare > 0)
        attack.extra.push({
          type: "true",
          amount: critShare * value("BonusTrueDamage") * base * critDamage,
          source: "item",
          sourceId: "FiendhunterBolts",
        });
    },
  };
}

/** ITEM-030: after an ability, the next attack within the window deals Spellblade damage. */
export function essenceReaver(item: ItemData): Effect {
  const value = flatValues(item.values);
  const charged: BuffSpec = {
    id: "EssenceReaverSpellblade",
    maxStacks: 1,
    duration: value("SpellbladeWindow"),
    refreshOnStack: true,
  };
  let readyAt = 0;
  return {
    id: "EssenceReaver",
    init: () => {
      readyAt = 0;
    },
    onAbilityCast: (ctx) => {
      if (ctx.time >= readyAt) ctx.addBuff(charged);
    },
    onHit: (ctx, attack) => {
      if (attack.phantom || ctx.buffStacks(charged.id) === 0) return;
      ctx.removeBuff(charged.id);
      readyAt = ctx.time + value("SpellbladeCooldown");
      ctx.deal({
        type: "physical",
        amount: evaluate(item.calculations.SpellbladeDamage, {
          stats: ctx.stats,
          value,
        }),
        source: "item",
        sourceId: "EssenceReaver",
        onHit: true,
      });
    },
  };
}
