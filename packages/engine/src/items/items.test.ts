import type { ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import { simulate } from "../core/sim";
import { computeStats } from "../core/stats";
import { equip, itemEffects, itemStats } from ".";

/** A stats-only item, with a passive value the engine doesn't model. */
const sword: ItemData = {
  id: "9001",
  name: "Test Sword",
  cost: 1000,
  stats: { attackDamage: 20, attackSpeed: 0.2 },
  otherStats: { mPercentLifeStealMod: 0.1 },
  values: {},
  calculations: {},
  groups: [],
};

describe("items without effects", { tags: ["ITEM-001"] }, () => {
  it("only add their stats", () => {
    expect(itemStats(sword)).toEqual({ attackDamage: 20, attackSpeed: 0.2 });
    expect(itemEffects(sword, testChampion)).toEqual([]);

    const level = {
      champion: testChampion,
      level: 1,
      constants: testConstants,
    };
    expect(computeStats({ ...level, bonuses: [itemStats(sword)] })).toEqual(
      computeStats({
        ...level,
        bonuses: [{ attackDamage: 20, attackSpeed: 0.2 }],
      }),
    );

    const target = { maxHealth: 1e9, defender: { armor: 0, magicResist: 0 } };
    const { bonuses, effects } = equip([sword], testChampion);
    const withItem = simulate({ ...level, bonuses, items: effects }, target);
    const withStats = simulate(
      { ...level, bonuses: [{ attackDamage: 20, attackSpeed: 0.2 }] },
      target,
    );
    expect(withItem).toEqual(withStats);
  });
});
