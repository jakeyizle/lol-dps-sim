import { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { fixture, MANIFEST_IDS, type FixtureChampion } from "../test/fixtures";
import { normalizeChampion } from "./champion";

const normalize = (id: FixtureChampion) => {
  const f = fixture(id);
  const result = normalizeChampion(f.ddragon, f.bin, id);
  return { ...result, data: ChampionData.parse(result.data) };
};

/** Fixture CharacterRecord with some fields replaced. */
const withRecord = (id: FixtureChampion, patch: Record<string, unknown>) => {
  const f = fixture(id);
  const [key, record] = Object.entries(f.bin)[0] ?? [];
  if (!key || !record) throw new Error("fixture has no record");
  return { ddragon: f.ddragon, bin: { [key]: { ...record, ...patch } } };
};

describe("real 16.22 champions", () => {
  it.each(Object.keys(MANIFEST_IDS))("%s normalizes to valid data", (id) => {
    expect(() => normalize(id as FixtureChampion)).not.toThrow();
  });
});

describe("windup", () => {
  it(
    "is cast time ÷ total time when both are given (Jinx)",
    { tags: ["DATA-003"] },
    () => {
      // 0.28333 / 1.6
      expect(normalize("Jinx").data.attack.slots.basic?.windupPercent).toBe(
        0.177081,
      );
    },
  );

  it.each([
    ["Caitlyn", 0.177083], // 0.3 − 0.122917
    ["Ashe", 0.219298], // 0.3 − 0.080702
    ["Vayne", 0.175439], // 0.3 − 0.124561
  ] as const)(
    "is 0.3 + cast offset when only an offset is given (%s)",
    { tags: ["DATA-011"] },
    (id, expected) => {
      expect(normalize(id).data.attack.slots.basic?.windupPercent).toBe(
        expected,
      );
    },
  );

  it("copies the windup modifier", { tags: ["DATA-012"] }, () => {
    const f = withRecord("Ashe", {
      basicAttack: {
        mAttackDelayCastOffsetPercent: -0.08,
        mAttackDelayCastOffsetPercentAttackSpeedRatio: 0.5,
      },
    });
    const data = ChampionData.parse(
      normalizeChampion(f.ddragon, f.bin, "Ashe").data,
    );
    expect(data.attack.slots.basic?.windupModifier).toBe(0.5);
  });

  it("defaults the windup modifier to 1", { tags: ["DATA-012"] }, () => {
    const slots = normalize("Jinx").data.attack.slots;
    expect(slots.basic?.windupModifier).toBe(1);
    expect(slots.JinxQAttack2?.windupModifier).toBe(1);
  });

  it(
    "keeps each attack slot's own windup (Jinx rockets)",
    { tags: ["DATA-013"] },
    () => {
      const { attack } = normalize("Jinx").data;
      expect(attack.slots.JinxQAttack2?.windupPercent).toBe(0.16875); // 0.27 / 1.6
      expect(attack.slots.basic?.windupPercent).toBe(0.177081);
      expect(attack.critSlot).toBe("JinxCritAttack");
    },
  );

  it(
    "inherits all timing for a slot with none (Jinx crit)",
    { tags: ["DATA-018"] },
    () => {
      const { slots } = normalize("Jinx").data.attack;
      expect(slots.JinxCritAttack).toEqual(slots.basic);
    },
  );

  it(
    "inherits only the missing total time (Kai'Sa E attack)",
    { tags: ["DATA-018"] },
    () => {
      // 0.1 own cast time / 1.552 basic total time
      expect(
        normalize("Kaisa").data.attack.slots.KaisaEAttack?.windupPercent,
      ).toBe(0.064433);
    },
  );
});

describe("attack values", { tags: ["DATA-014"] }, () => {
  it("copies attack speed ratio and crit multiplier, rounding float noise", () => {
    const { attack } = normalize("Caitlyn").data;
    expect(attack.baseAttackSpeed).toBe(0.681); // 0.6809999942779541
    expect(attack.attackSpeedRatio).toBe(0.625);
    expect(attack.critMultiplier).toBe(2);
  });

  it("keeps Ashe's 1.0 crit multiplier", () => {
    expect(normalize("Ashe").data.attack.critMultiplier).toBe(1);
  });
});

describe("stats", () => {
  it(
    "takes stats from the game file and mana from Data Dragon",
    { tags: ["DATA-019"] },
    () => {
      const { stats } = normalize("Caitlyn").data;
      expect(stats.attackDamage).toEqual({ base: 62, perLevel: 3.8 });
      expect(stats.armor).toEqual({ base: 27, perLevel: 4.7 });
      expect(stats.attackRange).toEqual({ base: 650, perLevel: 0 });
      expect(stats.mana).toEqual({ base: 315, perLevel: 40 });
      expect(stats.manaRegen).toEqual({ base: 7.4, perLevel: 0.7 });
    },
  );

  it("stores regen per 5 seconds", { tags: ["DATA-019"] }, () => {
    // game file: 0.75 and 0.1 per second
    expect(normalize("Jinx").data.stats.healthRegen).toEqual({
      base: 3.75,
      perLevel: 0.5,
    });
  });

  it(
    "reports values that differ between sources and keeps the game file's",
    { tags: ["DATA-020"] },
    () => {
      const { data, warnings } = normalize("Jinx");
      // Data Dragon 16.22.1 lists 0 AD per level.
      expect(warnings).toEqual([
        "Jinx: attackDamage.perLevel: game file 3, Data Dragon 0",
      ]);
      expect(data.stats.attackDamage.perLevel).toBe(3);
    },
  );
});
