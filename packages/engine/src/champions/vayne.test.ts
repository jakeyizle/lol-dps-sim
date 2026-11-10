import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import type { Rotation } from "../core/rotation";
import { simulate, type SimResult, type SimTarget } from "../core/sim";
import { vayne } from "./vayne";

/**
 * Hand-calculated from patch 26.22 data (PLAN §8), ±1%. Vayne level 18, no items:
 * AD 60 + 2.35 × 17 = 99.95 (no bonus AD), move speed 325, ranks Q5 W5 E5 R3.
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const champion = data.champions.Vayne;
if (!champion) throw new Error("no Vayne in 26.22 data");
const kit = vayne(champion, 18);
const run = (rotation: Rotation, maxHealth = 1e9, maxDuration = 6) => {
  const target: SimTarget = {
    maxHealth,
    defender: { armor: 0, magicResist: 0 },
  };
  return simulate(
    {
      champion,
      level: 18,
      constants: data.constants,
      abilities: kit.abilities,
      kit: kit.kit,
      rotation,
    },
    target,
    { maxDuration },
  );
};
const within1 = (actual: number | undefined, expected: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) / expected - 1)).toBeLessThan(0.01);
};
const hits = (r: SimResult, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const casts = (r: SimResult, action: string) =>
  r.actions.filter((a) => a.action === action).map((a) => a.time);
const attackOnly: Rotation = [{ action: "attack" }];
const DASH = 300 / (500 + 325);

describe("Silver Bolts", () => {
  it(
    "every third hit deals 10% of max health as true damage, at least 100",
    { tags: ["VAYNE-001"] },
    () => {
      const r = run(attackOnly, 5000);
      const basic = hits(r, "basic");
      const bolts = hits(r, "VayneW");
      expect(bolts[0]?.time).toBe(basic[2]?.time);
      expect(bolts[1]?.time).toBe(basic[5]?.time);
      within1(bolts[0]?.damage.postMitigation, 500);
      expect(bolts[0]?.damage.instance.type).toBe("true");
      within1(
        hits(run(attackOnly, 600), "VayneW")[0]?.damage.postMitigation,
        100,
      );
    },
  );
});

describe("Tumble", () => {
  it(
    "empowers the next attack with 115% AD that can't crit",
    { tags: ["VAYNE-002"] },
    () => {
      const q = hits(run([{ action: "Q" }, { action: "attack" }]), "VayneQ");
      within1(q[0]?.damage.postMitigation, 1.15 * 99.95);
      expect(q[0]?.damage.crit).toBe("notCritable");
    },
  );

  it(
    "resets the attack timer: the next attack starts when the dash ends",
    { tags: ["VAYNE-006"] },
    () => {
      const r = run([
        { action: "Q", when: [{ kind: "afterAttack" }] },
        { action: "attack" },
      ]);
      const [first, second] = casts(r, "attack");
      const [q] = casts(r, "Q");
      expect(first).toBe(0);
      within1((second ?? 0) - (q ?? 0), DASH);
      // sooner than waiting for the next attack
      const plain = casts(run(attackOnly), "attack")[1];
      expect(second).toBeLessThan(plain ?? 0);
    },
  );
});

describe("Final Hour", () => {
  it("grants 65 AD at rank 3", { tags: ["VAYNE-003"] }, () => {
    const r = run([{ action: "R" }, { action: "attack" }]);
    within1(hits(r, "basic")[0]?.damage.postMitigation, 99.95 + 65);
  });

  it("halves Tumble's cooldown at rank 3", { tags: ["VAYNE-007"] }, () => {
    // Q cooldown 2 s at rank 5; Tumble casts back to back
    const withR = casts(run([{ action: "R" }, { action: "Q" }], 1e9, 3), "Q");
    within1((withR[1] ?? 0) - (withR[0] ?? 0), 1);
    const without = casts(run([{ action: "Q" }], 1e9, 3), "Q");
    within1((without[1] ?? 0) - (without[0] ?? 0), 2);
  });
});

it(
  "Condemn: 190 + 50% bonus AD after 0.25 s, and a Silver Bolts stack",
  { tags: ["VAYNE-004"] },
  () => {
    const r = run([{ action: "E" }, { action: "attack" }], 5000);
    const e = hits(r, "VayneE")[0];
    expect(e?.time).toBe(0.25);
    within1(e?.damage.postMitigation, 190);
    // Condemn + two attacks: the bolt lands on the second attack
    expect(hits(r, "VayneW")[0]?.time).toBe(hits(r, "basic")[1]?.time);
  },
);

it(
  "default rotation: Q after an attack, attack; R and E only if added",
  { tags: ["VAYNE-005"] },
  () => {
    expect(kit.rotation).toEqual([
      { action: "Q", when: [{ kind: "afterAttack" }] },
      { action: "attack" },
    ]);
    expect(kit.abilities.map((a) => a.id)).toEqual(["Q", "E", "R"]);
  },
);
