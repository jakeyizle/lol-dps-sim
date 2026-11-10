import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import targets from "../../../data/generated/26.22/targets.json";
import type { Rotation } from "../core/rotation";
import { simulate, type SimResult, type SimTarget } from "../core/sim";
import type { StatBonuses } from "../core/stats";
import { caitlyn } from "./caitlyn";

/**
 * Hand-calculated from patch 26.22 data (PLAN §8), ±1%. Caitlyn level 18, no items:
 * AD 62 + 3.8 × 17 = 126.6 (no bonus AD), crit damage 2, ranks Q5 W5 E5 R3.
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const champion = data.champions.Caitlyn;
if (!champion) throw new Error("no Caitlyn in 26.22 data");
const kit = caitlyn(champion, 18);
const target: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};
const run = (rotation: Rotation, bonus: StatBonuses = {}, maxDuration = 12) =>
  simulate(
    {
      champion,
      level: 18,
      constants: data.constants,
      bonuses: [bonus],
      abilities: kit.abilities,
      kit: kit.kit,
      rotation,
    },
    target,
    { maxDuration },
  );
const within1 = (actual: number | undefined, expected: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) / expected - 1)).toBeLessThan(0.01);
};
const hits = (r: SimResult, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const attackStarts = (r: SimResult) =>
  r.actions.filter((a) => a.action === "attack").map((a) => a.time);
const attackOnly: Rotation = [{ action: "attack" }];

describe("Headshot", () => {
  it(
    "every 6th attack (5 stacks, then a headshot): 80% AD at 18, + 80% × crit × (crit damage − 1)",
    { tags: ["CAIT-001"] },
    () => {
      const r = run(attackOnly);
      const basic = hits(r, "basic");
      const head = hits(r, "CaitlynHeadshot");
      expect(head.map((h) => h.time)).toEqual([
        basic[5]?.time,
        basic[11]?.time,
      ]);
      within1(head[0]?.damage.postMitigation, 0.8 * 126.6);
      // 100% crit: + 0.8 × 1 × (2 − 1); the headshot part itself never crits
      const crit = hits(run(attackOnly, { critChance: 1 }), "CaitlynHeadshot");
      within1(crit[0]?.damage.postMitigation, 1.6 * 126.6);
      expect(crit[0]?.damage.crit).toBe("notCritable");
    },
  );
});

describe("trap and net headshots", () => {
  it(
    "a sprung trap makes the next attack a headshot with W's bonus, keeping the stacks",
    { tags: ["CAIT-002"] },
    () => {
      // 8 s: before the trap recharges (10 s at rank 5)
      const r = run([{ action: "W" }, { action: "attack" }], {}, 8);
      const starts = attackStarts(r);
      const head = hits(r, "CaitlynHeadshot");
      // W ends at 0.25 and arms 1 s later: the first attack from 1.25 on
      const trapped = starts.findIndex((t) => t >= 1.25);
      expect(trapped).toBeGreaterThan(0);
      // 101.28 + 215 (W rank 5 + 30% bonus AD)
      within1(head[0]?.damage.postMitigation, 0.8 * 126.6 + 215);
      // the 6th attack is still the regular headshot
      expect(head).toHaveLength(2);
      within1(head[1]?.damage.postMitigation, 0.8 * 126.6);
      const basic = hits(r, "basic");
      expect(head[1]?.time).toBe(basic[5]?.time);
    },
  );

  it(
    "a net deals E's magic damage and enables a headshot without W's bonus",
    { tags: ["CAIT-002"] },
    () => {
      const r = run([{ action: "E" }, { action: "attack" }]);
      within1(hits(r, "CaitlynE")[0]?.damage.postMitigation, 280);
      const head = hits(r, "CaitlynHeadshot");
      within1(head[0]?.damage.postMitigation, 0.8 * 126.6);
      expect(head[0]?.time).toBe(hits(r, "basic")[0]?.time);
    },
  );

  it("a trap gives no headshot before it arms", { tags: ["CAIT-006"] }, () => {
    const r = run([{ action: "W" }, { action: "attack" }], {}, 1.2);
    expect(hits(r, "basic").length).toBeGreaterThan(0);
    expect(hits(r, "CaitlynHeadshot")).toEqual([]);
  });
});

it(
  "Q: 230 + 205% AD when its 0.625 s cast ends",
  { tags: ["CAIT-003"] },
  () => {
    const q = hits(run([{ action: "Q" }], {}, 1), "CaitlynQ")[0];
    expect(q?.time).toBe(0.625);
    within1(q?.damage.postMitigation, 230 + 2.05 * 126.6);
  },
);

it(
  "R: 650 + 100% bonus AD after 1.375 s, + 30% × crit × (crit damage − 1)",
  { tags: ["CAIT-004"] },
  () => {
    const r = hits(run([{ action: "R" }], {}, 2), "CaitlynR")[0];
    expect(r?.time).toBe(1.375);
    within1(r?.damage.postMitigation, 650);
    const half = hits(
      run([{ action: "R" }], { critChance: 0.5 }, 2),
      "CaitlynR",
    );
    within1(half[0]?.damage.postMitigation, 650 * 1.15);
  },
);

it(
  "default rotation: W, E, attack; Q after an attack; R only if the user adds it",
  { tags: ["CAIT-005"] },
  () => {
    expect(kit.rotation).toEqual([
      { action: "W" },
      { action: "E" },
      { action: "Q", when: [{ kind: "afterAttack" }] },
      { action: "attack" },
    ]);
    expect(kit.abilities.map((a) => a.id)).toContain("R");
  },
);
