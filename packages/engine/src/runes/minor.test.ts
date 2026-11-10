import { parsePatch } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../../data/generated/26.22/champions.json";
import constants from "../../../data/generated/26.22/constants.json";
import items from "../../../data/generated/26.22/items.json";
import runes from "../../../data/generated/26.22/runes.json";
import { testChampion, testConstants } from "../../test/champions";
import type { Effect } from "../core/effects";
import { simulate, type SimOptions, type SimTarget } from "../core/sim";
import {
  ABSOLUTE_FOCUS,
  absoluteFocus,
  COUP_DE_GRACE,
  coupDeGrace,
  CUT_DOWN,
  cutDown,
  GATHERING_STORM,
  gatheringStorm,
  LAST_STAND,
  lastStand,
  LEGEND_ALACRITY,
  legendAlacrity,
} from "./minor";

/** Real 26.22 rune data on the test champion (AD 60, 0.8 AS → an attack every 1.25 s). */
const data = parsePatch({ champions, items, runes, constants });
const rune = (id: number) => {
  const r = data.runes[String(id)];
  if (!r) throw new Error(`no rune ${String(id)}`);
  return r;
};

function run(
  effect: Effect | undefined,
  opts: {
    level?: number;
    healthFraction?: number;
    target?: Partial<SimTarget>;
    sim?: SimOptions;
  } = {},
) {
  return simulate(
    {
      champion: testChampion,
      level: opts.level ?? 1,
      constants: testConstants,
      bonuses: [{ attackSpeed: 0.4 }],
      runes: effect ? [effect] : [],
      healthFraction: opts.healthFraction,
    },
    {
      maxHealth: 1000,
      defender: { armor: 0, magicResist: 0 },
      ...opts.target,
    },
    { maxDuration: 30, ...opts.sim },
  );
}
const attacks = (r: ReturnType<typeof run>) =>
  r.trace
    .filter((t) => t.damage.instance.sourceId === "basic")
    .map((t) => Math.round(t.damage.postMitigation * 1e6) / 1e6);
/** A stat with the rune minus without it, at the start of the fight. */
const gain = (
  effect: Effect,
  read: (s: ReturnType<typeof run>["stats"]) => number,
  opts: Parameters<typeof run>[1] = {},
) =>
  read(run(effect, { ...opts, sim: { maxDuration: 0, ...opts.sim } }).stats) -
  read(run(undefined, { ...opts, sim: { maxDuration: 0, ...opts.sim } }).stats);
const ad = (s: ReturnType<typeof run>["stats"]) => s.attackDamage.total;

it(
  "Cut Down: 8% more damage to champions above 60% health",
  { tags: ["RUNE-007"] },
  () => {
    // 1000 → 611.2 after six amplified hits; the 8th starts at 546.4
    const hits = attacks(run(cutDown(rune(CUT_DOWN))));
    expect(hits.slice(0, 8)).toEqual([...Array<number>(7).fill(64.8), 60]);
    const dummy = attacks(
      run(cutDown(rune(CUT_DOWN)), { target: { champion: false } }),
    );
    expect(dummy[0]).toBe(60);
  },
);

it(
  "Coup de Grace: 8% more damage to champions below 40% health",
  { tags: ["RUNE-008"] },
  () => {
    // the 11th hit starts at exactly 400, the 12th at 340
    const hits = attacks(run(coupDeGrace(rune(COUP_DE_GRACE))));
    expect(hits.slice(9, 13)).toEqual([60, 60, 64.8, 64.8]);
  },
);

it(
  "Last Stand: 5% below 60% health, up to 11% at 30%",
  { tags: ["RUNE-014"] },
  () => {
    const first = (healthFraction: number) =>
      attacks(run(lastStand(rune(LAST_STAND)), { healthFraction }))[0];
    expect(first(1)).toBe(60);
    expect(first(0.6)).toBe(60);
    expect(first(0.59)).toBeCloseTo(60 * (1.05 + 0.06 / 30), 6);
    expect(first(0.45)).toBe(64.8);
    expect(first(0.2)).toBe(66.6);
  },
);

it(
  "Absolute Focus: adaptive force above 70% health",
  { tags: ["RUNE-015"] },
  () => {
    const focus = absoluteFocus(rune(ABSOLUTE_FOCUS));
    // 3–30 adaptive by level → 0.6 × that as AD
    expect(gain(focus, ad, { healthFraction: 1 })).toBeCloseTo(1.8, 9);
    expect(gain(focus, ad, { healthFraction: 1, level: 18 })).toBeCloseTo(
      18,
      9,
    );
    expect(gain(focus, ad, { healthFraction: 0.7 })).toBe(0);
  },
);

it(
  "Legend: Alacrity starts the fight with its stacks' attack speed",
  { tags: ["RUNE-009"] },
  () => {
    const bonusAS = (stacks: number) =>
      gain(
        legendAlacrity(rune(LEGEND_ALACRITY), stacks),
        (s) => s.bonusAttackSpeed,
      );
    // 3% + 1.5% per stack, up to 10 stacks
    expect(bonusAS(0)).toBeCloseTo(0.03, 9);
    expect(bonusAS(10)).toBeCloseTo(0.18, 9);
    expect(bonusAS(25)).toBeCloseTo(0.18, 9);
  },
);

describe("Gathering Storm", { tags: ["RUNE-010"] }, () => {
  it("adds a growing bonus every 10 minutes", () => {
    const storm = gatheringStorm(rune(GATHERING_STORM));
    const at = (gameTime: number) => gain(storm, ad, { sim: { gameTime } });
    // 6 AD per step in the game file: 6 × (1 + 2 + … + n)
    expect([0, 9.9, 10, 20, 30].map(at)).toEqual([0, 0, 6, 18, 36]);
  });
});
