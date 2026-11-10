import { describe, expect, it } from "vitest";

import { jinx1622, testChampion, testConstants } from "../../test/champions";
import { computeStats, levelValue, type StatBonuses } from "./stats";

const stats = (level: number, bonuses: StatBonuses[] = []) =>
  computeStats({
    champion: testChampion,
    level,
    constants: testConstants,
    bonuses,
  });

describe("level growth", { tags: ["STAT-001"] }, () => {
  it("is the base value at level 1", () => {
    expect(stats(1).attackDamage.base).toBe(60);
    expect(stats(1).health.base).toBe(600);
  });

  it("follows the growth formula", () => {
    // 600 + 100 × 1 × (0.7025 + 0.0175) = 672
    expect(stats(2).health.base).toBeCloseTo(672, 9);
    // 60 + 3 × 17 × (0.7025 + 0.0175 × 17) = 60 + 51 × 1 = 111
    expect(stats(18).attackDamage.base).toBeCloseTo(111, 9);
    // 30 + 4 × 9 × (0.7025 + 0.0175 × 9) = 30 + 36 × 0.86 = 60.96
    expect(stats(10).armor.base).toBeCloseTo(60.96, 9);
  });

  it("matches the wiki for Jinx's attack damage at 18 (59 + 3/level = 110)", () => {
    const jinx = computeStats({
      champion: jinx1622,
      level: 18,
      constants: testConstants,
    });
    expect(jinx.attackDamage.base).toBeCloseTo(110, 9);
  });

  it("rejects levels outside 1–18", () => {
    expect(() => stats(0)).toThrow(RangeError);
    expect(() => stats(19)).toThrow(RangeError);
    expect(() => stats(2.5)).toThrow(RangeError);
  });

  it("exposes the formula", () => {
    expect(levelValue(10, 2, 1)).toBe(10);
  });
});

describe("flat bonuses", () => {
  it("are added to the level-based value", { tags: ["STAT-002"] }, () => {
    const s = stats(1, [
      { attackDamage: 40, armor: 10 },
      { attackDamage: 15, health: 300, abilityHaste: 20 },
    ]);
    expect(s.attackDamage.total).toBe(115);
    expect(s.armor.total).toBe(40);
    expect(s.health.total).toBe(900);
    expect(s.abilityHaste).toBe(20);
  });

  it("are tracked apart from level growth", { tags: ["STAT-003"] }, () => {
    const s = stats(18, [{ attackDamage: 55 }, { health: 450 }]);
    expect(s.attackDamage).toEqual({
      base: s.attackDamage.base,
      bonus: 55,
      total: s.attackDamage.base + 55,
    });
    expect(s.attackDamage.base).toBeCloseTo(111, 9);
    expect(s.health.bonus).toBe(450);
  });
});

describe("attack speed", () => {
  it("is base + ratio × bonus attack speed", { tags: ["STAT-004"] }, () => {
    // level 1: no growth; 0.6 + 0.5 × 0.4 = 0.8
    expect(stats(1, [{ attackSpeed: 0.4 }]).attackSpeed).toBeCloseTo(0.8, 9);
  });

  it(
    "counts level growth as bonus attack speed",
    { tags: ["STAT-004"] },
    () => {
      // growth 2% × 17 × 1 = 34%; 0.6 + 0.5 × 0.34 = 0.77
      const s = stats(18);
      expect(s.bonusAttackSpeed).toBeCloseTo(0.34, 9);
      expect(s.attackSpeed).toBeCloseTo(0.77, 9);
    },
  );

  it(
    "works out by hand for Jinx at 18 with no items (0.625 + 1%/level)",
    { tags: ["STAT-004"] },
    () => {
      // 0.625 + 0.625 × (0.01 × 17) = 0.73125
      const jinx = computeStats({
        champion: jinx1622,
        level: 18,
        constants: testConstants,
      });
      expect(jinx.attackSpeed).toBeCloseTo(0.73125, 9);
    },
  );

  it("is capped at the patch's cap", { tags: ["STAT-005"] }, () => {
    // uncapped: 0.6 + 0.5 × 5 = 3.1
    expect(stats(1, [{ attackSpeed: 5 }]).attackSpeed).toBe(2.5);
    const otherCap = computeStats({
      champion: testChampion,
      level: 1,
      constants: { attackSpeedCap: 3 },
      bonuses: [{ attackSpeed: 5 }],
    });
    expect(otherCap.attackSpeed).toBe(3);
  });

  it("is not capped below the cap", { tags: ["STAT-005"] }, () => {
    // 0.6 + 0.5 × 3.8 = 2.5 exactly, 3.7 → 2.45
    expect(stats(1, [{ attackSpeed: 3.7 }]).attackSpeed).toBeCloseTo(2.45, 9);
  });
});

describe("crit", () => {
  it("chance is capped at 100%", { tags: ["STAT-007"] }, () => {
    expect(
      stats(1, [{ critChance: 0.6 }, { critChance: 0.6 }]).critChance,
    ).toBe(1);
    expect(stats(1, [{ critChance: 0.25 }]).critChance).toBe(0.25);
  });

  it(
    "total damage is the champion multiplier plus bonuses",
    { tags: ["STAT-009"] },
    () => {
      expect(stats(1).critDamage).toBe(2);
      expect(
        stats(1, [{ critDamage: 0.3 }, { critDamage: 0.1 }]).critDamage,
      ).toBeCloseTo(2.4, 9);
    },
  );

  it(
    "bonus damage excludes the champion multiplier",
    { tags: ["STAT-010"] },
    () => {
      expect(stats(1).bonusCritDamage).toBe(0);
      expect(
        stats(1, [{ critDamage: 0.3 }, { critDamage: 0.1 }]).bonusCritDamage,
      ).toBeCloseTo(0.4, 9);
    },
  );
});

it(
  "percent penetration from several sources combines multiplicatively",
  { tags: ["STAT-002"] },
  () => {
    const s = computeStats({
      champion: testChampion,
      level: 1,
      constants: testConstants,
      bonuses: [
        { magicPenPercent: 0.4, armorPenPercent: 0.3 },
        { magicPenPercent: 0.5, armorPenPercent: 0.3 },
      ],
    });
    expect(s.magicPenPercent).toBeCloseTo(1 - 0.6 * 0.5, 9);
    expect(s.armorPenPercent).toBeCloseTo(1 - 0.7 * 0.7, 9);
  },
);

it("no bonuses leave base stats", { tags: ["STAT-001"] }, () => {
  const s = computeStats({
    champion: testChampion,
    level: 1,
    constants: testConstants,
  });
  expect(s.attackDamage).toEqual({ base: 60, bonus: 0, total: 60 });
});
