import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import type { Effect } from "../core/effects";
import type { Rotation } from "../core/rotation";
import { simulate, type SimTarget } from "../core/sim";
import { jinx } from "./jinx";

/**
 * Accuracy fixtures (PLAN §8): hand-calculated from patch 26.22 data, ±1%.
 * Jinx level 18, no items (AD 59 + 3 × 17 = 110, bonus AS 1% × 17 = 17%), all ranks maxed.
 * Update these by hand when the patch changes them; never from the sim's output.
 */
const data = parsePatch({ champions, items, runes, constants });
const champion = data.champions.Jinx;
if (!champion) throw new Error("no Jinx in 26.22 data");
const kit = jinx(champion, 18);
const target: SimTarget = {
  maxHealth: 3000,
  defender: { armor: 100, magicResist: 0 },
};

const run = (rotation: Rotation, extra: Effect[] = [], maxDuration = 2) =>
  simulate(
    {
      champion,
      level: 18,
      constants: data.constants,
      abilities: kit.abilities,
      kit: kit.kit,
      items: extra,
      rotation,
    },
    target,
    { maxDuration },
  );

const within1 = (actual: number | undefined, expected: number) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) / expected - 1)).toBeLessThan(0.01);
};
const damage = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace.find((t) => t.damage.instance.sourceId === sourceId)?.damage
    .postMitigation;

describe("Jinx 26.22 accuracy", () => {
  it("W rank 5: (210 + 140% of 110 AD) halved by 100 armor = 182", () => {
    within1(damage(run([{ action: "W" }]), "JinxW"), 182);
  });

  it("W cast time: 0.6 − 0.01 × 0.17 / 0.08 = 0.57875 s", () => {
    within1(run([{ action: "W" }]).trace[0]?.time, 0.57875);
  });

  it("R rank 3 at 1500 missing health: (500 + 35% × 1500) / 2 = 512.5", () => {
    const wound: Effect = {
      id: "Wound",
      init: (ctx) => {
        ctx.deal({
          type: "true",
          amount: 1500,
          source: "item",
          sourceId: "Wound",
        });
      },
    };
    within1(damage(run([{ action: "R" }], [wound]), "JinxR"), 512.5);
  });

  it("rocket attack: 110% of 110 AD halved = 60.5", () => {
    const r = run([{ action: "Q" }, { action: "attack" }]);
    within1(damage(r, "JinxQAttack"), 60.5);
  });

  it("3 minigun stacks: 0.625 × (1 + 0.17 + 1.30) = 1.54375 attacks/s", () => {
    const seen: number[] = [];
    const probe: Effect = {
      id: "Probe",
      onAttackLaunch: (ctx) => seen.push(ctx.stats.attackSpeed),
    };
    run([{ action: "attack" }], [probe], 4);
    within1(seen[3], 1.54375);
  });
});
