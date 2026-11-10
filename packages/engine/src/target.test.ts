import type { RuneData, TargetChampion } from "@lol/data";
import { describe, expect, it } from "vitest";

import { levelValue } from "./core/stats";
import type { RunePage } from "./runes";
import {
  CONDITIONING,
  defenderStats,
  hasDefensiveKit,
  type ChampionTargetSetup,
} from "./target";

const garen: TargetChampion = {
  id: "Garen",
  name: "Garen",
  ranged: false,
  stats: {
    health: { base: 690, perLevel: 98 },
    armor: { base: 38, perLevel: 4.2 },
    magicResist: { base: 32, perLevel: 1.55 },
  },
};
const rune = (
  id: number,
  key: string,
  values: Record<string, number>,
): RuneData => ({ id, key, name: key, values, calculations: {} });
const runes: Record<string, RuneData> = {
  "5011": rune(5011, "Health", { StatGain: 65 }),
  [String(CONDITIONING)]: rune(CONDITIONING, "Conditioning", {
    ArmorBase: 8,
    MRBase: 8,
    ExtraResist: 0.03,
    MinutesRequired: 12,
  }),
};
const page: RunePage = {
  primary: 1,
  keystone: 10,
  primaryRunes: [11, 12, 13],
  secondary: 2,
  secondaryRunes: [CONDITIONING, 21],
  shards: [5011, 5011, 5011],
};
const stats = (over: Partial<ChampionTargetSetup> = {}) =>
  defenderStats(
    { champion: garen, level: 10, bonuses: [], gameTime: 0, ...over },
    runes,
  );

it(
  "a champion target's stats grow with level and add item stats",
  { tags: ["TGT-001"] },
  () => {
    const s = stats({ bonuses: [{ armor: 60, health: 400 }, { armor: 20 }] });
    const armor = levelValue(38, 4.2, 10);
    expect(s.armor).toEqual({ base: armor, bonus: 80, total: armor + 80 });
    expect(s.health.total).toBeCloseTo(levelValue(690, 98, 10) + 400, 9);
    expect(s.magicResist.total).toBeCloseTo(levelValue(32, 1.55, 10), 9);
  },
);

it(
  "overrides replace a stat's total and leave the others",
  { tags: ["TGT-003"] },
  () => {
    const s = stats({ bonuses: [{ armor: 60 }], overrides: { armor: 250 } });
    expect(s.armor.total).toBe(250);
    expect(s.armor.base).toBeCloseTo(levelValue(38, 4.2, 10), 9);
    expect(s.magicResist.total).toBeCloseTo(levelValue(32, 1.55, 10), 9);
  },
);

describe("target runes", { tags: ["TGT-012"] }, () => {
  it("add shard stats", () => {
    expect(stats({ runes: page }).health.bonus).toBe(195);
  });

  it("add Conditioning once the game time reaches its minutes", () => {
    const before = stats({ runes: page, gameTime: 11.9 });
    const after = stats({ runes: page, gameTime: 12 });
    const armor = levelValue(38, 4.2, 10);
    expect(before.armor.total).toBeCloseTo(armor, 9);
    expect(after.armor.total).toBeCloseTo(armor + 8 + 0.03 * armor, 9);
  });
});

it(
  "champions without a modelled defensive kit are stats only",
  { tags: ["BUILD-009"] },
  () => {
    expect(hasDefensiveKit("Garen")).toBe(false);
  },
);

describe("target stat details", () => {
  it(
    "health and magic resist overrides work like armor",
    { tags: ["TGT-003"] },
    () => {
      const s = stats({ overrides: { health: 3000, magicResist: 80 } });
      expect(s.health).toEqual({
        base: levelValue(690, 98, 10),
        bonus: 3000 - levelValue(690, 98, 10),
        total: 3000,
      });
      expect(s.magicResist.total).toBe(80);
    },
  );

  it(
    "Conditioning needs the rune and adds to both resistances",
    { tags: ["TGT-012"] },
    () => {
      const armor = levelValue(38, 4.2, 10);
      const mr = levelValue(32, 1.55, 10);
      const without = stats({
        runes: { ...page, secondaryRunes: [20, 21] },
        gameTime: 30,
      });
      expect(without.armor.total).toBeCloseTo(armor, 9);
      const withIt = stats({ runes: page, gameTime: 30 });
      expect(withIt.armor.bonus).toBeCloseTo(8 + 0.03 * armor, 9);
      expect(withIt.magicResist.total).toBeCloseTo(mr + 8 + 0.03 * mr, 9);
    },
  );
});
