import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion } from "../../test/champions";
import {
  abilityRanks,
  evaluate,
  flatValues,
  isRanged,
  rankAt,
  rankValues,
  type CalcContext,
} from "./calc";
import { computeStats } from "./stats";

/** Level 10 test champion with 20 bonus AD and 50 AP: AD base 60 + 3 × 9 × (0.7025 + 0.1575). */
const stats = computeStats({
  champion: testChampion,
  level: 10,
  constants: { attackSpeedCap: 2.5 },
  bonuses: [{ attackDamage: 20, abilityPower: 50, critChance: 0.5 }],
});
const ctx = (values: Record<string, number> = {}): CalcContext => ({
  stats,
  value: flatValues(values),
});
const n = (mNumber: number) => ({ __type: "NumberCalculationPart", mNumber });
const calc = (...parts: unknown[]) => ({
  __type: "GameCalculation",
  mFormulaParts: parts,
});

describe("calculation parts", { tags: ["DATA-004"] }, () => {
  it("read base, bonus or total stats by formula", () => {
    const ad = (mStatFormula?: number) =>
      evaluate(
        calc({
          __type: "StatByCoefficientCalculationPart",
          mStat: 2,
          mStatFormula,
          mCoefficient: 1,
        }),
        ctx(),
      );
    expect(ad(1)).toBeCloseTo(stats.attackDamage.base, 9);
    expect(ad(2)).toBe(20);
    expect(ad()).toBeCloseTo(stats.attackDamage.total, 9);
  });

  it("multiply, sum and clamp subparts", () => {
    const product = {
      __type: "ProductOfSubPartsCalculationPart",
      mPart1: n(2),
      mPart2: n(3),
    };
    expect(evaluate(calc(product), ctx())).toBe(6);
    expect(
      evaluate(calc({ __type: "SumOfSubPartsCalculationPart" }), ctx()),
    ).toBe(0);
    const clamp = (sum: number, mFloor?: number | null, mCeiling?: number) =>
      evaluate(
        calc({
          __type: "ClampSubPartsCalculationPart",
          mFloor,
          mCeiling,
          mSubparts: [n(sum)],
        }),
        ctx(),
      );
    expect(clamp(-5, null)).toBe(-5);
    expect(clamp(-5, 0)).toBe(0);
    expect(clamp(9, 0, 4)).toBe(4);
    expect(
      evaluate(calc({ __type: "ClampSubPartsCalculationPart" }), ctx()),
    ).toBe(0);
  });

  it("scale a stat by a subpart", () => {
    const part = {
      __type: "StatBySubPartCalculationPart",
      mStat: 0,
      mSubpart: n(0.5),
    };
    expect(evaluate(calc(part), ctx())).toBe(25);
  });

  it("add level breakpoints from their level on, with none listed adding nothing", () => {
    const bp = (level: number) =>
      evaluate(
        calc({
          __type: "ByCharLevelBreakpointsCalculationPart",
          mLevel1Value: 1,
          mBreakpoints: [{ mLevel: level, mAdditionalBonusAtThisLevel: 10 }],
        }),
        ctx(),
      );
    expect(bp(10)).toBe(11);
    expect(bp(11)).toBe(1);
    expect(
      evaluate(
        calc({
          __type: "ByCharLevelBreakpointsCalculationPart",
          mLevel1Value: 3,
        }),
        ctx(),
      ),
    ).toBe(3);
  });

  it("use another calculation of the entity, times a multiplier", () => {
    const calculations = { Base: calc(n(10)) };
    const modified = {
      __type: "GameCalculationModified",
      mModifiedGameCalculation: "Base",
      mMultiplier: n(1.5),
    };
    expect(evaluate(modified, { ...ctx(), calculations })).toBe(15);
    expect(() => evaluate(modified, ctx())).toThrow(/missing calculation/);
  });
});

describe("broken calculations fail loudly", () => {
  const fails = (c: unknown, re: RegExp, values = {}) => {
    expect(() => evaluate(c, ctx(values))).toThrow(re);
  };

  it("names what is missing", () => {
    fails(undefined, /missing calculation/);
    fails({ __type: "GameCalculation" }, /not a calculation/);
    fails(calc({ __type: "Nope" }), /unsupported calculation part Nope/);
    fails(
      calc({ __type: "StatByCoefficientCalculationPart", mStat: 99 }),
      /unsupported calculation stat 99/,
    );
    fails(calc({ __type: "NamedDataValueCalculationPart" }), /no data value/);
    fails(
      calc({ __type: "NamedDataValueCalculationPart", mDataValue: "X" }),
      /no value X/,
    );
    fails(calc({ __type: "StatBySubPartCalculationPart" }), /no subpart/);
    for (const product of [{ mPart1: n(1) }, { mPart2: n(1) }])
      fails(
        calc({ __type: "ProductOfSubPartsCalculationPart", ...product }),
        /no parts/,
      );
    for (const ends of [{ StartDataValue: "A" }, { EndDataValue: "B" }])
      fails(calc({ __type: "{ee18a47b}", ...ends }), /no data values/, {
        A: 1,
        B: 2,
      });
  });

  it("names a missing rank value", () => {
    expect(() => rankValues({ X: [1, 2] }, 3)("X")).toThrow(
      /no value X at rank 3/,
    );
    expect(() => rankValues({}, 1)("Y")).toThrow(/no value Y at rank 1/);
    expect(rankValues({ X: [1, 2] }, 2)("X")).toBe(2);
  });
});

it("rank lists are read by 1-based rank, failing loudly past the end", () => {
  expect(rankAt([10, 20, 30], 2, "Q cooldown")).toBe(20);
  expect(() => rankAt([10], 2, "Q cooldown")).toThrow(
    /no Q cooldown at rank 2/,
  );
  expect(() => rankAt(undefined, 1, "W cost")).toThrow(/no W cost at rank 1/);
});

it("ability ranks follow the skill order up to the level", () => {
  expect(abilityRanks(testChampion, 1)).toEqual({ Q: 1, W: 0, E: 0, R: 0 });
  expect(abilityRanks(testChampion, 3)).toEqual({ Q: 1, W: 1, E: 1, R: 0 });
});

it("champions with 250 range or less are melee", () => {
  const at = (base: number): ChampionData => ({
    ...testChampion,
    stats: { ...testChampion.stats, attackRange: { base, perLevel: 0 } },
  });
  expect(isRanged(at(250))).toBe(false);
  expect(isRanged(at(251))).toBe(true);
});
