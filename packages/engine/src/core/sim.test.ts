import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import { EventQueue } from "./queue";
import { simulate, windupTime, type SimTarget } from "./sim";
import { computeStats } from "./stats";

/** Base AS 0.6; slots: basic (20%, K 1), slow (30%, K 0.5), crit (10%, K 1). */
const champion: ChampionData = {
  ...testChampion,
  attack: {
    ...testChampion.attack,
    slots: {
      basic: { windupPercent: 0.2, windupModifier: 1 },
      slow: { windupPercent: 0.3, windupModifier: 0.5 },
      crit: { windupPercent: 0.1, windupModifier: 1 },
    },
    critSlot: "crit",
  },
};

/** Level 1: 60 AD; +40% AS → 0.6 + 0.5 × 0.4 = 0.8 attacks/s (1.25 s apart). */
const stats = computeStats({
  champion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
});
const attacker = { champion, stats };
const target = (maxHealth: number, extra: Partial<SimTarget> = {}) => ({
  maxHealth,
  defender: { armor: 0, magicResist: 0 },
  ...extra,
});
const landTimes = (r: ReturnType<typeof simulate>) =>
  r.trace.map((e) => e.time);

describe("attack timing", () => {
  it("attacks start every 1/AS seconds from 0", { tags: ["SIM-001"] }, () => {
    // windup 0.2 / 0.8 = 0.25 s after each start at 0, 1.25, 2.5, …
    const times = landTimes(
      simulate(attacker, target(1e9), { maxDuration: 5 }),
    );
    expect(times).toHaveLength(4);
    times.forEach((t, k) => {
      expect(t).toBeCloseTo(k * 1.25 + 0.25, 9);
    });
  });

  it(
    "damage lands at the end of windup, using the windup formula",
    { tags: ["SIM-002"] },
    () => {
      const slow = champion.attack.slots.slow;
      if (!slow) throw new Error("fixture");
      // B = 0.3 / 0.6 = 0.5; W / AS = 0.375; 0.5 + 0.5 × (0.375 − 0.5) = 0.4375
      expect(windupTime(slow, 0.6, 0.8)).toBeCloseTo(0.4375, 9);
      // modifier 1 at base attack speed: windup = W / base AS
      expect(
        windupTime({ windupPercent: 0.2, windupModifier: 1 }, 0.6, 0.6),
      ).toBeCloseTo(0.2 / 0.6, 9);
      const first = simulate({ ...attacker, attackSlot: "slow" }, target(1e9), {
        maxDuration: 1,
      });
      expect(landTimes(first)[0]).toBeCloseTo(0.4375, 9);
    },
  );

  it("each attack uses its slot's windup", { tags: ["SIM-022"] }, () => {
    const times = (attackSlot?: string) =>
      landTimes(
        simulate({ ...attacker, attackSlot }, target(1e9), { maxDuration: 1 }),
      );
    expect(times()[0]).toBeCloseTo(0.25, 9);
    expect(times("slow")[0]).toBeCloseTo(0.4375, 9);
  });

  it(
    "expected-value mode never uses the crit slot",
    { tags: ["SIM-022"] },
    () => {
      const r = simulate(
        { champion, stats: { ...stats, critChance: 1 } },
        target(1e9),
        { maxDuration: 1 },
      );
      expect(landTimes(r)[0]).toBeCloseTo(0.25, 9); // basic, not crit (0.125)
      expect(r.trace[0]?.damage.instance.sourceId).toBe("basic");
    },
  );

  it("rejects an unknown attack slot", () => {
    expect(() =>
      simulate({ ...attacker, attackSlot: "nope" }, target(100)),
    ).toThrow(/no attack slot nope/);
  });
});

describe("ending", () => {
  it("stops when the target dies", { tags: ["SIM-007"] }, () => {
    // 60 damage per hit: the third hit (at 2.5 + 0.25) kills 150 health
    const r = simulate(attacker, target(150));
    expect(r.killed).toBe(true);
    expect(r.ttk).toBeCloseTo(2.75, 9);
    expect(r.trace).toHaveLength(3);
    expect(r.trace.at(-1)?.time).toBe(r.ttk);
    expect(r.remainingHealth).toBe(0);
  });

  it("stops at the max duration", { tags: ["SIM-008"] }, () => {
    const r = simulate(attacker, target(1e9));
    expect(r.killed).toBe(false);
    expect(r.ttk).toBeNull();
    // starts at 0 … 18.75 land by 19.0; the start at 20 lands at 20.25, after the end
    expect(r.trace).toHaveLength(16);
    expect(Math.max(...landTimes(r))).toBeLessThanOrEqual(20);
    expect(r.remainingHealth).toBe(1e9 - 16 * 60);
  });

  it("executes the target below the threshold", { tags: ["SIM-023"] }, () => {
    // 1000 health, execute below 5%: after 16 hits health is 40 < 50
    const r = simulate(attacker, target(1000, { executeBelow: 0.05 }));
    expect(r).toMatchObject({ killed: true, executed: true });
    expect(r.trace).toHaveLength(16);
    expect(r.ttk).toBeCloseTo(15 * 1.25 + 0.25, 9);
  });

  it("doesn't execute above the threshold", { tags: ["SIM-023"] }, () => {
    const r = simulate(attacker, target(1000, { executeBelow: 0.01 }));
    expect(r.executed).toBe(false);
    expect(r.killed).toBe(false);
  });
});

describe("damage", () => {
  it("applies the attacker's crit as expected value and the target's armor", () => {
    const r = simulate(
      { champion, stats: { ...stats, critChance: 0.5 } },
      target(1e9, { defender: { armor: 100, magicResist: 0 } }),
      { maxDuration: 1 },
    );
    // 60 × 1.5 × 0.5
    expect(r.trace[0]?.toHealth).toBeCloseTo(45, 9);
  });

  it("shields absorb before health", () => {
    const r = simulate(
      attacker,
      target(1000, { shields: [{ amount: 100, blocks: "all" }] }),
      { maxDuration: 3 },
    );
    expect(r.trace.map((e) => e.absorbed)).toEqual([60, 40, 0]);
    expect(r.trace.at(-1)?.healthAfter).toBe(1000 - 80);
  });
});

it("expected-value mode is deterministic", { tags: ["SIM-011"] }, () => {
  const run = () =>
    simulate(
      { champion, stats: { ...stats, critChance: 0.3 } },
      target(2000, { defender: { armor: 50, magicResist: 0 } }),
    );
  expect(run()).toEqual(run());
});

describe("EventQueue", () => {
  it("pops by time, then insertion order", () => {
    const q = new EventQueue<string>();
    q.push(2, "c");
    q.push(1, "a");
    q.push(2, "d");
    q.push(1, "b");
    q.push(0.5, "first");
    const out: string[] = [];
    for (let e = q.pop(); e; e = q.pop()) out.push(e.event);
    expect(out).toEqual(["first", "a", "b", "c", "d"]);
    expect(q.size).toBe(0);
  });
});
