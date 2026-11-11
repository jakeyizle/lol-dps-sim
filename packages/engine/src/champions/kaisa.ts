import type { AbilityKey, ChampionData } from "@lol/data";

import { abilityRanks, evaluate, rankAt, rankValues } from "../core/calc";
import type { DamageInstance } from "../core/damage";
import type { BuffSpec, Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import type { SimAbility } from "../core/sim";
import { levelValue, type StatBlock } from "../core/stats";
import type { ChampionKit } from "./jinx";

/** Plasma on the target, tracked on Kai'Sa's side (the target never acts). */
export const KAISA_PLASMA = "KaisaPlasma";
// Stryker disable next-line StringLiteral: a consistent rename of an internal buff id
const SUPERCHARGE = "KaisaSupercharge";

/** Every value the kit reads (DATA-012). */
export const kaisaRequiredValues = [
  "passive.values.PMaxStacks",
  "passive.values.PDuration",
  "passive.calculations.PBaseDamage",
  "passive.calculations.PCurrentPerStackDamage",
  "passive.calculations.PExecutePercentage",
  "abilities.Q.values.BaseDamage",
  "abilities.Q.values.BonusADRatio",
  "abilities.Q.values.APRatio",
  "abilities.Q.values.ExtraHitReduction",
  "abilities.Q.values.MissileDelay",
  "abilities.Q.values.Effect2",
  "abilities.Q.values.Effect6",
  "abilities.Q.values.Effect7",
  "abilities.W.calculations.TotalDamage",
  "abilities.W.values.Effect2",
  "abilities.W.values.Effect3",
  "abilities.W.values.Effect4",
  "abilities.W.values.Effect5",
  "abilities.E.calculations.TotalCastTime",
  "abilities.E.values.Effect2",
  "abilities.E.values.Effect4",
  "abilities.E.values.Effect5",
  "abilities.E.values.Effect6",
] as const;

/**
 * Kai'Sa (scenarios/kaisa.md): Plasma on-hit damage and rupture, evolutions from the
 * starting stats, Q Icathian Rain, W Void Seeker, E Supercharge. R is a shield: no damage.
 */
export function kaisa(
  champion: ChampionData,
  level: number,
  ranks: Record<AbilityKey, number> = abilityRanks(champion, level),
): ChampionKit {
  const { passive } = champion;
  const { Q, W, E } = champion.abilities;
  const at = rankAt;
  const p = rankValues(passive.values, 1);
  const pCalc = (name: string, stats: StatBlock) =>
    evaluate(passive.calculations[name], { stats, value: p });
  const maxStacks = p("PMaxStacks");
  const plasma: BuffSpec = {
    id: KAISA_PLASMA,
    maxStacks,
    duration: p("PDuration"),
    refreshOnStack: true,
  };

  // Evolutions, decided from the stats the fight starts with (KAISA-003, -011, -012).
  // Stryker disable next-line all: init() sets every evolution before the fight
  const evolved = { Q: false, W: false, E: false };
  /** AD from items plus level growth. */
  const adFromItemsAndGrowth = (s: StatBlock) =>
    s.attackDamage.total - levelValue(champion.stats.attackDamage.base, 0, 1);

  const abilities: SimAbility[] = [];
  // Stryker disable next-line ArrayDeclaration: a junk effect has no hooks, so the sim skips it
  const kit: Effect[] = [];
  const rotation: Rotation[number][] = [];
  let lastAttackToHealth = 0;

  /**
   * KAISA-001, KAISA-002: `n` Plasma stacks; the one past the max ruptures for a share of
   * missing health, measured before the triggering attack's own damage.
   */
  const applyPlasma = (ctx: EffectContext, n: number, before: number) => {
    for (let i = 0; i < n; i++) {
      if (ctx.buffStacks(KAISA_PLASMA) < maxStacks) {
        ctx.addBuff(plasma);
        continue;
      }
      ctx.removeBuff(KAISA_PLASMA);
      const missing = Math.max(
        0,
        ctx.targetMaxHealth - ctx.targetHealth - before,
      );
      ctx.deal({
        type: "magic",
        amount: pCalc("PExecutePercentage", ctx.stats) * missing,
        source: "passive",
        sourceId: "KaisaRupture",
      });
      return;
    }
  };

  kit.push({
    id: "KaisaSecondSkin",
    init: (ctx) => {
      lastAttackToHealth = 0;
      const s = ctx.stats;
      // Stryker disable next-line EqualityOperator: exactly on the float threshold is a measure-zero boundary; with the ability unranked the flag only labels the event log
      evolved.Q = ranks.Q > 0 && adFromItemsAndGrowth(s) >= q("Effect6");
      evolved.W = ranks.W > 0 && s.abilityPower >= w("Effect2");
      // Stryker disable next-line EqualityOperator: exactly on the float threshold is a measure-zero boundary; with the ability unranked the flag only labels the event log
      evolved.E = ranks.E > 0 && s.bonusAttackSpeed * 100 >= e("Effect6");
      // Shown in the event log's buffs.
      for (const key of ["Q", "W", "E"] as const)
        if (evolved[key])
          ctx.addBuff({
            id: `Kaisa${key}Evolved`,
            maxStacks: 1,
            duration: Infinity,
            // Stryker disable next-line BooleanLiteral: with no expiry, refreshing changes nothing
            refreshOnStack: false,
          });
    },
    onDamageDealt: (_ctx, { instance, toHealth }) => {
      if (instance.autoAttack) lastAttackToHealth = toHealth;
    },
    onHit: (ctx, attack) => {
      if (attack.phantom) return;
      const stacks = ctx.buffStacks(KAISA_PLASMA);
      ctx.deal({
        type: "magic",
        amount:
          pCalc("PBaseDamage", ctx.stats) +
          pCalc("PCurrentPerStackDamage", ctx.stats) * stacks,
        source: "passive",
        sourceId: "KaisaCausticWounds",
        onHit: true,
      });
      applyPlasma(ctx, 1, lastAttackToHealth);
      // KAISA-009: attacks cut Supercharge's remaining cooldown.
      // Stryker disable next-line ConditionalExpression,EqualityOperator: without E there is no E cooldown to cut
      if (ranks.E > 0) ctx.reduceCooldownsBy(["E"], e("Effect4"));
    },
  });

  function q(name: string) {
    return at(Q.values[name], Math.max(1, ranks.Q), `Q ${name}`);
  }
  function w(name: string) {
    // Stryker disable next-line MethodExpression: W's effect values are the same at every rank
    return at(W.values[name], Math.max(1, ranks.W), `W ${name}`);
  }
  function e(name: string) {
    return at(E.values[name], Math.max(1, ranks.E), `E ${name}`);
  }

  if (ranks.Q > 0) {
    // KAISA-004: one target takes every missile, those after the first reduced.
    const missile = (ctx: EffectContext, scale: number): DamageInstance => ({
      type: "physical",
      amount:
        scale *
        (q("BaseDamage") +
          q("BonusADRatio") * ctx.stats.attackDamage.bonus +
          q("APRatio") * ctx.stats.abilityPower),
      source: "ability",
      sourceId: "KaisaQ",
      ability: true,
    });
    const missiles = () => (evolved.Q ? q("Effect7") : q("Effect2"));
    const volley = (ctx: EffectContext) =>
      Array.from({ length: missiles() }, (_, i) =>
        missile(ctx, i === 0 ? 1 : q("ExtraHitReduction")),
      );
    abilities.push({
      id: "Q",
      castTime: Q.castTime,
      cooldown: at(Q.cooldown, ranks.Q, "Q cooldown"),
      cost: at(Q.cost, ranks.Q, "Q cost"),
      estimate: volley,
    });
    kit.push({
      id: "KaisaQ",
      onAbilityCast: (ctx, id) => {
        if (id !== "Q") return;
        ctx.schedule(q("MissileDelay"), (later) => {
          for (const m of volley(later)) later.deal(m);
        });
      },
    });
  }

  if (ranks.E > 0) {
    const e5 = e("Effect5");
    const supercharge: BuffSpec = {
      id: SUPERCHARGE,
      maxStacks: 1,
      duration: e("Effect2"),
      // Stryker disable next-line BooleanLiteral: E's cooldown outlasts its 4 s buff, so it's never re-added while active
      refreshOnStack: true,
      stats: { attackSpeed: e5 },
    };
    abilities.push({
      id: "E",
      // KAISA-008: 1.2 s, shorter with bonus attack speed, to a floor.
      castTime: (stats: StatBlock) =>
        evaluate(E.calculations.TotalCastTime, {
          stats,
          value: rankValues(E.values, ranks.E),
        }),
      cooldown: at(E.cooldown, ranks.E, "E cooldown"),
      cost: at(E.cost, ranks.E, "E cost"),
    });
    kit.push({
      id: "KaisaE",
      onAbilityCast: (ctx, id) => {
        if (id === "E") ctx.addBuff(supercharge); // KAISA-005
      },
    });
    rotation.push({ action: "E" });
  }

  if (ranks.Q > 0)
    rotation.push({ action: "Q", when: [{ kind: "afterAttack" }] });

  if (ranks.W > 0) {
    const seeker = (ctx: EffectContext): DamageInstance => ({
      type: "magic",
      amount: evaluate(W.calculations.TotalDamage, {
        stats: ctx.stats,
        value: rankValues(W.values, ranks.W),
      }),
      source: "ability",
      sourceId: "KaisaW",
      ability: true,
    });
    abilities.push({
      id: "W",
      castTime: W.castTime,
      cooldown: at(W.cooldown, ranks.W, "W cooldown"),
      cost: at(W.cost, ranks.W, "W cost"),
      estimate: (ctx) => [seeker(ctx)],
    });
    kit.push({
      id: "KaisaW",
      onAbilityCast: (ctx, id) => {
        if (id !== "W") return;
        ctx.deal(seeker(ctx)); // KAISA-006
        applyPlasma(ctx, evolved.W ? w("Effect5") : w("Effect4"), 0);
        // KAISA-010: evolved Void Seeker refunds cooldown on a champion hit.
        if (evolved.W && ctx.targetIsChampion)
          ctx.reduceCooldowns(["W"], w("Effect3") / 100);
      },
    });
    rotation.push({
      action: "W",
      when: [
        { kind: "afterAttack" },
        { kind: "minStacks", buff: KAISA_PLASMA, stacks: 2 },
      ],
    });
  }

  rotation.push({ action: "attack" });
  const buffs = [{ id: KAISA_PLASMA, label: "Plasma", max: maxStacks }];
  return { abilities, kit, rotation, buffs };
}
