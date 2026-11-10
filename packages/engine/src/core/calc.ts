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

interface Part {
  __type?: string;
  mDataValue?: string;
  mStat?: number;
  mStatFormula?: number;
  mCoefficient?: number;
}

/** Game files store coefficients as float32 (0.11999999731779099). */
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Game-file stat codes the MVP kits use. */
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

/**
 * Evaluates a game-file `GameCalculation` (sum of its formula parts) at an ability rank
 * (1-based) with the attacker's current stats.
 */
export function evaluate(
  calculation: unknown,
  values: Readonly<Record<string, readonly number[]>>,
  rank: number,
  stats: StatBlock,
): number {
  const parts = (calculation as { mFormulaParts?: Part[] } | undefined)
    ?.mFormulaParts;
  if (!parts) throw new Error("not a calculation");
  const value = (name: string | undefined) => {
    const list = name === undefined ? undefined : values[name];
    const v = list?.[rank - 1];
    if (v === undefined)
      throw new Error(`no value ${String(name)} at rank ${String(rank)}`);
    return v;
  };
  let total = 0;
  for (const part of parts)
    switch (part.__type) {
      case "NamedDataValueCalculationPart":
        total += value(part.mDataValue);
        break;
      case "StatByNamedDataValueCalculationPart":
        total +=
          statValue(stats, part.mStat, part.mStatFormula) *
          value(part.mDataValue);
        break;
      case "StatByCoefficientCalculationPart":
        total +=
          statValue(stats, part.mStat, part.mStatFormula) *
          round6(part.mCoefficient ?? 0);
        break;
      default:
        throw new Error(`unsupported calculation part ${String(part.__type)}`);
    }
  return total;
}
