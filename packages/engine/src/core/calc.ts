import type { AbilityKey, ChampionData } from "@lol/data";

import type { StatBlock } from "./stats";

/** Ability ranks at a level, from the champion's skill order (DATA-016). */
export function abilityRanks(
  champion: ChampionData,
  level: number,
): Record<AbilityKey, number> {
  const ranks: Record<AbilityKey, number> = { Q: 0, W: 0, E: 0, R: 0 };
  for (const key of champion.skillOrder.slice(0, level)) ranks[key] += 1;
  return ranks;
}

/**
 * Melee champions' attack range is at most 250; ranged ones start well above that.
 * Items with melee / ranged values use this (e.g. ITEM-005, ITEM-012).
 */
export const isRanged = (champion: ChampionData) =>
  champion.stats.attackRange.base > 250;

interface Breakpoint {
  mLevel?: number;
  mBonusPerLevelAtAndAfter?: number;
  mAdditionalBonusAtThisLevel?: number;
}

interface Part {
  __type?: string;
  mDataValue?: string;
  mStat?: number;
  mStatFormula?: number;
  mCoefficient?: number;
  mNumber?: number;
  mLevel1Value?: number;
  mBreakpoints?: Breakpoint[];
}

interface Calculation {
  __type?: string;
  mFormulaParts?: Part[];
  /** Multiplies the sum of the parts. */
  mMultiplier?: Part;
  /** Multiplies the result for ranged attackers (e.g. Kraken Slayer). */
  mRangedMultiplier?: Part;
  /** `GameCalculationModified`: another calculation of the same entity, times `mMultiplier`. */
  mModifiedGameCalculation?: string;
}

export interface CalcContext {
  stats: StatBlock;
  /** A named data value, already at the right rank. */
  value: (name: string) => number;
  /** The entity's calculations, for `GameCalculationModified`. */
  calculations?: Readonly<Record<string, unknown>>;
  ranged?: boolean;
}

/** Looks up per-rank ability values (rank is 1-based). */
export function rankValues(
  values: Readonly<Record<string, readonly number[]>>,
  rank: number,
) {
  return (name: string) => {
    const v = values[name]?.[rank - 1];
    if (v === undefined)
      throw new Error(`no value ${name} at rank ${String(rank)}`);
    return v;
  };
}

/** Looks up an item's or rune's values. */
export function flatValues(values: Readonly<Record<string, number>>) {
  return (name: string) => {
    const v = values[name];
    if (v === undefined) throw new Error(`no value ${name}`);
    return v;
  };
}

/** Game files store coefficients as float32 (0.11999999731779099). */
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Game-file stat codes the MVP kits and items use. */
function statValue(stats: StatBlock, stat = 0, formula?: number) {
  const pick = (s: { base: number; bonus: number; total: number }) =>
    formula === 1 ? s.base : formula === 2 ? s.bonus : s.total;
  switch (stat) {
    case 0:
      return stats.abilityPower;
    case 2:
      return pick(stats.attackDamage);
    default:
      throw new Error(`unsupported calculation stat ${String(stat)}`);
  }
}

function part(p: Part, ctx: CalcContext): number {
  const named = () => {
    if (p.mDataValue === undefined) throw new Error("part has no data value");
    return ctx.value(p.mDataValue);
  };
  switch (p.__type) {
    case "NamedDataValueCalculationPart":
      return named();
    case "NumberCalculationPart":
      return p.mNumber ?? 0;
    case "StatByNamedDataValueCalculationPart":
      return statValue(ctx.stats, p.mStat, p.mStatFormula) * named();
    case "StatByCoefficientCalculationPart":
      return (
        statValue(ctx.stats, p.mStat, p.mStatFormula) *
        round6(p.mCoefficient ?? 0)
      );
    case "ByCharLevelBreakpointsCalculationPart": {
      // Each breakpoint adds a one-off bonus and/or a bonus per level from its level on.
      const level = ctx.stats.level;
      let total = p.mLevel1Value ?? 0;
      for (const b of p.mBreakpoints ?? []) {
        const from = b.mLevel ?? Infinity;
        if (level < from) continue;
        total += b.mAdditionalBonusAtThisLevel ?? 0;
        total += (b.mBonusPerLevelAtAndAfter ?? 0) * (level - from + 1);
      }
      return total;
    }
    default:
      throw new Error(`unsupported calculation part ${String(p.__type)}`);
  }
}

/** Evaluates a game-file calculation with the attacker's current stats. */
export function evaluate(calculation: unknown, ctx: CalcContext): number {
  const calc = calculation as Calculation | undefined;
  if (!calc) throw new Error("missing calculation");
  let total: number;
  if (calc.mModifiedGameCalculation !== undefined)
    total = evaluate(ctx.calculations?.[calc.mModifiedGameCalculation], ctx);
  else if (calc.mFormulaParts)
    total = calc.mFormulaParts.reduce((sum, p) => sum + part(p, ctx), 0);
  else throw new Error("not a calculation");
  if (calc.mMultiplier) total *= part(calc.mMultiplier, ctx);
  if (ctx.ranged && calc.mRangedMultiplier)
    total *= part(calc.mRangedMultiplier, ctx);
  return total;
}
