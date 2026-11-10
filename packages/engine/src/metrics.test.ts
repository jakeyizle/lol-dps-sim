import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../test/champions";
import { stackingBuff, type Effect } from "./core/effects";
import type { SimAttacker, SimTarget } from "./core/sim";
import { computeStats } from "./core/stats";
import { analyze, breakdown, damageCurve, dpsWindows } from "./metrics";

/** AD 60, +40% AS: attacks land at 0.25, 1.5, 2.75, 4.0, 5.25 … (60 each vs 0 armor). */
const attacker: SimAttacker = {
  champion: testChampion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4 }],
};
const target = (
  maxHealth: number,
  over: Partial<SimTarget> = {},
): SimTarget => ({
  maxHealth,
  defender: { armor: 0, magicResist: 0 },
  ...over,
});
const magicOnHit: Effect = {
  id: "Spark",
  onHit: (ctx) => {
    ctx.deal({
      type: "magic",
      amount: 10,
      source: "item",
      sourceId: "Spark",
      onHit: true,
    });
  },
};

describe("time to kill", () => {
  it("is the time of the killing blow", { tags: ["METRIC-001"] }, () => {
    // 300 health: the 5th attack (5.25 s) kills
    expect(analyze(attacker, target(300))).toMatchObject({
      killed: true,
      ttk: 5.25,
      remainingHealth: 0,
    });
  });

  it(
    "is 'not killed' with the remaining health at the max duration",
    { tags: ["METRIC-002"] },
    () => {
      // 4 landings by 5 s
      expect(
        analyze(attacker, target(10_000), { maxDuration: 5 }),
      ).toMatchObject({
        killed: false,
        ttk: null,
        remainingHealth: 10_000 - 240,
      });
    },
  );
});

describe("DPS windows", () => {
  it(
    "average damage over [0, N] from the DPS run",
    { tags: ["METRIC-003"] },
    () => {
      // 300 health dies at 5.25 s, but the DPS run keeps going:
      // 3 s: 3 landings; 6 s: 5; 10 s: 8.
      const { dps } = analyze(attacker, target(300));
      expect(dps).toEqual([
        { seconds: 3, dps: 60 },
        { seconds: 6, dps: 50 },
        { seconds: 10, dps: 48 },
      ]);
      expect(dpsWindows([], [4])).toEqual([{ seconds: 4, dps: 0 }]);
    },
  );

  it(
    "come from a run where health goes below 0 and missing health caps at 100%",
    { tags: ["METRIC-008"] },
    () => {
      const missing: number[] = [];
      const probe: Effect = {
        id: "Probe",
        onHit: (ctx) =>
          missing.push(1 - ctx.targetHealth / ctx.targetMaxHealth),
      };
      const { fight } = analyze({ ...attacker, items: [probe] }, target(100));
      expect(fight.killed).toBe(true);
      expect(Math.max(...missing)).toBeLessThanOrEqual(1);
      // in the DPS run, every landing counts even after health is gone
      const dpsRun = analyze({ ...attacker, items: [probe] }, target(100));
      expect(dpsRun.dps[2]?.dps).toBe(48);
    },
  );

  it("come from a run without executes", { tags: ["METRIC-009"] }, () => {
    const collector: Effect = { id: "Execute", executeBelow: 0.5 };
    const result = analyze(
      { ...attacker, items: [collector] },
      target(300, { executeBelow: 0.5 }),
    );
    // normal run: 300 → 120 after 3 landings (< 50%) → executed at 2.75 s
    expect(result).toMatchObject({ executed: true, ttk: 2.75 });
    expect(result.dps[2]?.dps).toBe(48);
  });
});

it(
  "cumulative damage curve has a point per damage instance",
  { tags: ["METRIC-004"] },
  () => {
    const { curve, fight } = analyze(
      { ...attacker, items: [magicOnHit] },
      target(10_000),
      { maxDuration: 2 },
    );
    expect(curve).toEqual([
      { time: 0.25, cumulative: 60 },
      { time: 0.25, cumulative: 70 },
      { time: 1.5, cumulative: 130 },
      { time: 1.5, cumulative: 140 },
    ]);
    expect(damageCurve(fight.trace)).toEqual(curve);
  },
);

it(
  "breakdown splits by type and source, each summing to the total",
  { tags: ["METRIC-005"] },
  () => {
    const { breakdown: b, fight } = analyze(
      { ...attacker, items: [magicOnHit] },
      target(10_000),
      { maxDuration: 2 },
    );
    expect(b).toEqual({
      total: 140,
      byType: { physical: 120, magic: 20, true: 0 },
      bySource: { basic: 120, Spark: 20 },
    });
    expect(breakdown(fight.trace)).toEqual(b);
  },
);

it("reports the build's stats at fight start", { tags: ["METRIC-007"] }, () => {
  expect(analyze(attacker, target(1000)).stats).toEqual(
    computeStats({
      champion: testChampion,
      level: 1,
      constants: testConstants,
      bonuses: [{ attackSpeed: 0.4 }],
    }),
  );
});

it(
  "marks critable attacks 'averaged' in expected-value mode",
  { tags: ["METRIC-010"] },
  () => {
    const { fight } = analyze(
      { ...attacker, bonuses: [{ critChance: 0.5 }], items: [magicOnHit] },
      target(10_000),
      { maxDuration: 1 },
    );
    expect(fight.trace.map((t) => t.damage.crit)).toEqual([
      "averaged",
      "notCritable",
    ]);
  },
);

it("records the attacker's active buffs on each damage instance", () => {
  const fury = {
    id: "Fury",
    maxStacks: 3,
    duration: Infinity,
    refreshOnStack: true,
  };
  const { fight } = analyze(
    { ...attacker, kit: [stackingBuff(fury, "hit")] },
    target(10_000),
    { maxDuration: 2 },
  );
  expect(fight.trace.map((t) => t.buffs)).toEqual([[], ["Fury"]]);
});

it(
  "analyze adds the spread over runs in RNG mode only",
  { tags: ["SIM-013"] },
  () => {
    const attacker = {
      champion: testChampion,
      level: 1,
      constants: testConstants,
      bonuses: [{ critChance: 0.5 }],
    };
    const target = { maxHealth: 2000, defender: { armor: 0, magicResist: 0 } };
    expect(analyze(attacker, target).spread).toBeUndefined();
    const rng = analyze(attacker, target, { critMode: "rng", runs: 30 });
    expect(rng.spread?.runs).toBe(30);
    expect(rng.spread?.ttk.p10).toBeLessThanOrEqual(rng.spread?.ttk.p90 ?? 0);
  },
);
