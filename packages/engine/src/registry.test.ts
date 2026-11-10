import { parsePatch, type ChampionData, type ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../data/generated/26.22/champions.json";
import constants from "../../data/generated/26.22/constants.json";
import items from "../../data/generated/26.22/items.json";
import runes from "../../data/generated/26.22/runes.json";
import targets from "../../data/generated/26.22/targets.json";
import { testChampion } from "../test/champions";
import { simulate, type TraceEntry } from "./core/sim";
import { equip, itemStats, longTermStack } from "./items";
import { dpsWindows, effectiveHealth } from "./metrics";
import {
  pageProblem,
  runeEffects,
  runeLongTermStack,
  runeStats,
  shardStats,
  type RunePage,
} from "./runes";

/** The registries and helpers the app builds simulations from, on real 26.22 data. */
const data = parsePatch({ champions, items, runes, constants, targets });
const item = (id: string): ItemData => {
  const i = data.items[id];
  if (!i) throw new Error(`no item ${id}`);
  return i;
};
const rune = (id: number) => {
  const r = data.runes[String(id)];
  if (!r) throw new Error(`no rune ${String(id)}`);
  return r;
};
const melee: ChampionData = {
  ...testChampion,
  stats: { ...testChampion.stats, attackRange: { base: 125, perLevel: 0 } },
};

describe("items", () => {
  it(
    "only Yun Tal has a long-term stack input, sized by range",
    { tags: ["BUILD-007"] },
    () => {
      // 25% crit at 0.4% per stack (melee), halved for ranged
      expect(longTermStack(item("3032"), melee)).toEqual({
        id: "3032",
        label: "Yun Tal Wildarrows stacks",
        max: 63,
      });
      expect(longTermStack(item("3032"), testChampion)?.max).toBe(125);
      expect(longTermStack(item("3031"), testChampion)).toBeUndefined();
    },
  );

  it(
    "item stats hold only the stats the item has",
    { tags: ["STAT-002"] },
    () => {
      expect(itemStats(item("3031"))).toStrictEqual({
        attackDamage: 75,
        critChance: 0.25,
        critDamage: 0.3,
      });
    },
  );

  it(
    "a build with any Energized item gets one Energized meter",
    { tags: ["ITEM-018"] },
    () => {
      const ids = (list: string[]) =>
        equip(list.map(item), testChampion, data.constants).effects.map(
          (e) => e.id,
        );
      expect(ids(["3031", "3087"])).toContain("Energized");
      expect(ids(["3031"])).not.toContain("Energized");
      expect(() => equip([item("3087")], testChampion)).toThrow(
        /patch constants/,
      );
      expect(() =>
        equip([item("3087")], testChampion, { attackSpeedCap: 2.5 }),
      ).toThrow(/energize constants/);
    },
  );
});

describe("metrics", () => {
  const at = (time: number, amount: number): TraceEntry => {
    const r = simulate(
      {
        champion: testChampion,
        level: 1,
        constants: data.constants,
        rotation: [{ action: "attack" }],
      },
      { maxHealth: 1e9, defender: { armor: 0, magicResist: 0 } },
      { maxDuration: 0.5 },
    );
    const [first] = r.trace;
    if (!first) throw new Error("no hit");
    return {
      ...first,
      time,
      damage: { ...first.damage, postMitigation: amount },
    };
  };

  it(
    "a DPS window includes damage at its last instant",
    { tags: ["METRIC-003"] },
    () => {
      expect(dpsWindows([at(1, 30), at(3, 30), at(3.5, 99)], [3])).toEqual([
        { seconds: 3, dps: 20 },
      ]);
    },
  );

  it(
    "effective health adds shields, low-health shields and revive health",
    { tags: ["CMP-009"] },
    () => {
      expect(
        effectiveHealth({
          maxHealth: 1000,
          defender: { armor: 0, magicResist: 0 },
          shields: [
            { amount: 50, blocks: "all" },
            { amount: 25, blocks: "magic" },
          ],
          lowHealthShields: [
            {
              id: "S",
              below: 0.3,
              trigger: "all",
              amount: 200,
              blocks: "all",
              duration: 3,
              cooldown: 90,
            },
          ],
          revive: { delay: 4, health: 300 },
        }),
      ).toBe(1575);
      expect(
        effectiveHealth({
          maxHealth: 900,
          defender: { armor: 0, magicResist: 0 },
        }),
      ).toBe(900);
    },
  );
});

describe("runes", () => {
  const precision = data.trees.find((t) => t.key === "Precision");
  const sorcery = data.trees.find((t) => t.key === "Sorcery");
  if (!precision || !sorcery) throw new Error("no trees");
  const page: RunePage = {
    primary: precision.id,
    keystone: 8008,
    primaryRunes: [9111, 9104, 8014],
    secondary: sorcery.id,
    secondaryRunes: [8233, 8236],
    shards: [5005, 5008, 5011],
  };
  const problem = (over: Partial<RunePage>) =>
    pageProblem({ ...page, ...over }, data.trees, data.shards);

  it(
    "pages need known, different trees and full rows",
    { tags: ["RUNE-001"] },
    () => {
      expect(problem({})).toBeUndefined();
      expect(problem({ primary: 1 })).toMatch(/primary and a secondary/);
      expect(problem({ secondary: 1 })).toMatch(/primary and a secondary/);
      expect(problem({ secondary: precision.id })).toMatch(/must differ/);
      expect(problem({ primaryRunes: [9111, 9104, 8014, 8014] })).toMatch(
        /one rune per row/,
      );
      expect(problem({ shards: [5005, 5008] })).toMatch(/one shard per row/);
      // a keystone of the secondary tree isn't a secondary rune
      expect(problem({ secondaryRunes: [8214, 8236] })).toMatch(/two runes/);
    },
  );

  it(
    "shards add haste, armor and magic resist; others add nothing",
    { tags: ["RUNE-002"] },
    () => {
      const s = (id: number) => shardStats(rune(id), 1);
      const haste = s(5007);
      expect(Object.keys(haste)).toEqual(["abilityHaste"]);
      expect(haste.abilityHaste).toBeGreaterThan(0);
      expect(
        shardStats(
          {
            id: 1,
            key: "Armor",
            name: "Armor",
            values: { StatGain: 9 },
            calculations: {},
          },
          1,
        ),
      ).toEqual({ armor: 9 });
      expect(
        shardStats(
          {
            id: 2,
            key: "MagicRes",
            name: "MR",
            values: { StatGain: 8 },
            calculations: {},
          },
          1,
        ),
      ).toEqual({ magicResist: 8 });
      expect(s(5010)).toEqual({});
      expect(
        runeStats({ ...page, shards: [5005, 99999, 5011] }, data.runes, 1),
      ).toHaveLength(2);
    },
  );

  it(
    "only Legend: Alacrity has a stack input; its stacks reach its effect",
    { tags: ["RUNE-009"] },
    () => {
      expect(runeLongTermStack(rune(9104))).toEqual({
        id: "9104",
        label: "Legend: Alacrity stacks",
        max: 10,
      });
      expect(runeLongTermStack(rune(8008))).toBeUndefined();

      const effects = runeEffects(page, data.runes, testChampion, {
        "9104": 10,
      });
      // Lethal Tempo, Legend: Alacrity, Coup de Grace, Absolute Focus, Gathering Storm
      expect(effects.map((e) => e.id)).toEqual([
        "LethalTempo",
        "LegendAlacrity",
        "CoupDeGrace",
        "AbsoluteFocus",
        "GatheringStorm",
      ]);
      const alacrity = effects[1]?.modifyStats?.({
        level: 1,
        attackerHealthFraction: 1,
        gameTime: 0,
        buffStacks: () => 0,
      });
      expect(alacrity?.attackSpeed).toBeCloseTo(0.18, 9);
      // unknown runes are skipped
      expect(
        runeEffects(
          { ...page, primaryRunes: [99999, 9104, 8014] },
          data.runes,
          testChampion,
        ).map((e) => e.id),
      ).not.toContain(undefined);
    },
  );
});
