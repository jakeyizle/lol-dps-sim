import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import { simulate, type SimTarget } from "../core/sim";
import { DEFAULT_RUNES, KITS } from ".";

/** What every kit shares: rank gating, would-kill estimates, ability damage tags. */
const data = parsePatch({ champions, items, runes, constants, targets });
const kitOf = (id: string, level: number) => {
  const champion = data.champions[id];
  const make = KITS[id];
  if (!champion || !make) throw new Error(`no ${id}`);
  return { champion, kit: make(champion, level) };
};
const IDS = ["Jinx", "Caitlyn", "Ashe", "Kaisa", "Vayne"] as const;
const target = (maxHealth: number): SimTarget => ({
  maxHealth,
  defender: { armor: 0, magicResist: 0 },
});

it(
  "every attacker kit has a default rune page",
  { tags: ["BUILD-001"] },
  () => {
    expect(Object.keys(KITS)).toEqual([...IDS]);
    for (const id of IDS)
      expect(DEFAULT_RUNES[id]?.keystone, id).toBeGreaterThan(0);
  },
);

describe("rank gating", { tags: ["BUILD-003"] }, () => {
  it("only ranked abilities exist, and rotations only use them", () => {
    // level 1: each skill order's first point; R from level 6
    const first = {
      Jinx: "Q",
      Caitlyn: "Q",
      Ashe: "W",
      Kaisa: "Q",
      Vayne: "Q",
    };
    for (const id of IDS) {
      const at1 = kitOf(id, 1).kit;
      expect(
        at1.abilities.map((a) => a.id),
        id,
      ).toEqual([first[id]]);
      const actions = new Set(["attack", ...at1.abilities.map((a) => a.id)]);
      expect(
        at1.rotation.every((r) => actions.has(r.action)),
        id,
      ).toBe(true);
      expect(
        kitOf(id, 5).kit.abilities.map((a) => a.id),
        id,
      ).not.toContain("R");
      // Kai'Sa's R is a shield: no damage, so no ability
      if (id !== "Kaisa")
        expect(
          kitOf(id, 6).kit.abilities.map((a) => a.id),
          id,
        ).toContain("R");
    }
  });

  it(
    "stack buffs a rotation can name come with their ability",
    { tags: ["ROT-009"] },
    () => {
      const buffs = (id: string, level: number) =>
        kitOf(id, level).kit.buffs.map((b) => [b.id, b.label, b.max]);
      expect(buffs("Jinx", 18)).toEqual([["JinxRevdUp", "Rev'd up", 3]]);
      expect(buffs("Jinx", 1)).toEqual([["JinxRevdUp", "Rev'd up", 3]]);
      expect(buffs("Ashe", 18)).toEqual([["AsheFocus", "Focus", 4]]);
      expect(buffs("Ashe", 1)).toEqual([]);
      expect(buffs("Caitlyn", 1)).toEqual([
        ["CaitlynHeadshotStacks", "Headshot stacks", 5],
      ]);
      expect(buffs("Kaisa", 1)).toEqual([["KaisaPlasma", "Plasma", 4]]);
      expect(buffs("Vayne", 18)).toEqual([
        ["VayneSilverBolts", "Silver Bolts", 2],
      ]);
      expect(buffs("Vayne", 1)).toEqual([]);
    },
  );
});

describe("abilities at level 18", () => {
  /** Each damaging ability cast alone, with its damage type. */
  const DAMAGE: Record<string, "physical" | "magic"> = {
    JinxW: "physical",
    JinxR: "physical",
    CaitlynQ: "physical",
    CaitlynE: "magic",
    CaitlynR: "physical",
    AsheW: "physical",
    AsheR: "magic",
    KaisaQ: "physical",
    KaisaW: "magic",
    VayneE: "physical",
  };

  it("deal ability damage of their type", { tags: ["DMG-011"] }, () => {
    for (const [sourceId, type] of Object.entries(DAMAGE)) {
      const id = sourceId.replace(/[QWER]$/, "");
      const action = sourceId.slice(-1);
      const { champion, kit } = kitOf(id, 18);
      const r = simulate(
        {
          champion,
          level: 18,
          constants: data.constants,
          abilities: kit.abilities,
          kit: kit.kit,
          rotation: [{ action }],
        },
        target(1e9),
        { maxDuration: 3 },
      );
      const hit = r.trace.find((t) => t.damage.instance.sourceId === sourceId);
      expect(hit?.damage.instance, sourceId).toMatchObject({
        type,
        ability: true,
      });
      expect(hit?.damage.postMitigation, sourceId).toBeGreaterThan(0);
    }
  });

  it(
    "estimate their damage for would-kill rules",
    { tags: ["ROT-013"] },
    () => {
      for (const id of IDS) {
        const { champion, kit } = kitOf(id, 18);
        for (const ability of kit.abilities.filter((a) => a.estimate)) {
          const cast = (health: number) =>
            simulate(
              {
                champion,
                level: 18,
                constants: data.constants,
                abilities: kit.abilities,
                kit: kit.kit,
                rotation: [
                  { action: ability.id, when: [{ kind: "wouldKill" }] },
                ],
              },
              target(health),
              { maxDuration: 0.1 },
            ).actions.map((a) => a.action);
          expect(cast(1), `${id} ${ability.id}`).toEqual([ability.id]);
          expect(cast(1e9), `${id} ${ability.id}`).toEqual([]);
        }
      }
    },
  );

  it("Ashe's R: 600 magic (+120% AP) at rank 3", { tags: ["ASHE-005"] }, () => {
    const { champion, kit } = kitOf("Ashe", 18);
    const r = simulate(
      {
        champion,
        level: 18,
        constants: data.constants,
        bonuses: [{ abilityPower: 100 }],
        abilities: kit.abilities,
        kit: kit.kit,
        rotation: [{ action: "R" }],
      },
      target(1e9),
      { maxDuration: 1 },
    );
    const arrow = r.trace.find((t) => t.damage.instance.sourceId === "AsheR");
    expect(arrow?.time).toBe(0.25);
    expect(arrow?.damage.postMitigation).toBeCloseTo(600 + 120, 9);
  });
});
