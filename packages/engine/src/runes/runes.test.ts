import type { RuneData, RuneTree } from "@lol/data";
import { describe, expect, it } from "vitest";

import { pageProblem, runeStats, shardStats, type RunePage } from ".";

const trees: RuneTree[] = [
  {
    id: 1,
    key: "A",
    name: "A",
    slots: [
      [10, 11],
      [12, 13],
      [14, 15],
      [16, 17],
    ],
  },
  {
    id: 2,
    key: "B",
    name: "B",
    slots: [
      [20, 21],
      [22, 23],
      [24, 25],
      [26, 27],
    ],
  },
];
const shardRows = [
  [100, 101],
  [100, 102],
  [103, 102],
];
const valid: RunePage = {
  primary: 1,
  keystone: 10,
  primaryRunes: [12, 15, 16],
  secondary: 2,
  secondaryRunes: [22, 26],
  shards: [101, 100, 103],
};

describe("rune pages", { tags: ["RUNE-001"] }, () => {
  const problem = (over: Partial<RunePage>) =>
    pageProblem({ ...valid, ...over }, trees, shardRows);

  it("accept one keystone, a rune per primary row, two secondary rows and three shards", () => {
    expect(problem({})).toBeUndefined();
  });

  it("reject anything else", () => {
    expect(problem({ keystone: 12 })).toMatch(/keystone/);
    expect(problem({ primaryRunes: [12, 15] })).toMatch(/primary tree/);
    expect(problem({ primaryRunes: [12, 13, 16] })).toMatch(/primary tree/);
    expect(problem({ secondary: 1 })).toMatch(/differ/);
    expect(problem({ secondaryRunes: [22, 23] })).toMatch(/different rows/);
    expect(problem({ secondaryRunes: [20, 22] })).toMatch(/different rows/);
    expect(problem({ secondaryRunes: [22] })).toMatch(/different rows/);
    expect(problem({ shards: [101, 101, 103] })).toMatch(/shard/);
  });
});

const shard = (
  id: number,
  key: string,
  values: Record<string, number>,
): RuneData => ({
  id,
  key,
  name: key,
  values,
  calculations: {},
});

describe("stat shards", { tags: ["RUNE-002"] }, () => {
  it("add their stats, scaling with level where the shard says so", () => {
    const adaptive = shard(100, "Adaptive", { StatGain1: 5, StatGain2: 9 });
    expect(shardStats(adaptive, 1)).toEqual({ attackDamage: 5 });
    expect(shardStats(adaptive, 1, true)).toEqual({ abilityPower: 9 });
    expect(shardStats(shard(101, "AttackSpeed", { StatGain: 10 }), 1)).toEqual({
      attackSpeed: 0.1,
    });
    const scaling = shard(102, "HealthScaling", {
      StatGainMin: 10,
      StatGainMax: 180,
    });
    expect(shardStats(scaling, 1)).toEqual({ health: 10 });
    expect(shardStats(scaling, 18)).toEqual({ health: 180 });
    expect(shardStats(scaling, 10).health).toBeCloseTo(10 + (170 * 9) / 17, 9);
    expect(shardStats(shard(103, "Health", { StatGain: 65 }), 5)).toEqual({
      health: 65,
    });
  });

  it("come from the page's three shards", () => {
    const runes = {
      "100": shard(100, "Adaptive", { StatGain1: 5, StatGain2: 9 }),
      "101": shard(101, "AttackSpeed", { StatGain: 10 }),
      "103": shard(103, "Health", { StatGain: 65 }),
    };
    expect(runeStats(valid, runes, 1)).toEqual([
      { attackSpeed: 0.1 },
      { attackDamage: 5 },
      { health: 65 },
    ]);
  });
});
