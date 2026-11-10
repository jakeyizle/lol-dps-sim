import type { ChampionData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import { percentile, simulateMany, spread } from "./many";
import { simulate, type SimAttacker, type SimTarget } from "./sim";

/** basic windup 20%, crit windup 10% */
const champion: ChampionData = {
  ...testChampion,
  attack: {
    ...testChampion.attack,
    slots: {
      basic: { windupPercent: 0.2, windupModifier: 1 },
      crit: { windupPercent: 0.1, windupModifier: 1 },
    },
    critSlot: "crit",
  },
};
const attacker: SimAttacker = {
  champion,
  level: 1,
  constants: testConstants,
  bonuses: [{ attackSpeed: 0.4, critChance: 0.5 }],
};
const target: SimTarget = {
  maxHealth: 600,
  defender: { armor: 50, magicResist: 0 },
};

describe("RNG mode", () => {
  it("is reproducible from its seed", { tags: ["SIM-012"] }, () => {
    const run = (seed: number) =>
      simulate(attacker, target, { critMode: "rng", seed });
    expect(run(7)).toEqual(run(7));
    const crits = (seed: number) =>
      run(seed)
        .trace.map((e) => e.damage.crit)
        .join();
    expect(crits(7)).not.toBe(crits(8));
  });

  it("rolls each attack as a full crit or none", { tags: ["SIM-012"] }, () => {
    const r = simulate(attacker, target, { critMode: "rng", seed: 3 });
    const amounts = new Set(r.trace.map((e) => e.damage.preMitigation));
    expect([...amounts].sort((a, b) => a - b)).toEqual([60, 120]);
    expect(r.trace.every((e) => e.damage.crit !== "averaged")).toBe(true);
  });

  it("uses the crit attack's windup for crits", { tags: ["SIM-022"] }, () => {
    const r = simulate(
      { ...attacker, bonuses: [{ attackSpeed: 0.4, critChance: 1 }] },
      target,
      { critMode: "rng", maxDuration: 1 },
    );
    // crit slot 10% at 0.8 AS → 0.125 s
    expect(r.trace[0]?.time).toBeCloseTo(0.125, 9);
    expect(r.trace[0]?.damage.instance.sourceId).toBe("crit");
  });
});

describe("aggregation", { tags: ["SIM-013"] }, () => {
  it("runs 200 times by default and reports the spread", () => {
    const many = simulateMany(attacker, target, { critMode: "rng" });
    expect(many.runs).toBe(200);
    expect(many.killRate).toBe(1);
    const { ttk } = many;
    expect(ttk.p10).toBeLessThanOrEqual(ttk.p50);
    expect(ttk.p50).toBeLessThanOrEqual(ttk.p90);
    expect(ttk.p10).toBeLessThan(ttk.p90); // crits vary the kill time
    // the RNG mean lands near the expected-value result
    const ev = simulate(attacker, target).ttk ?? NaN;
    expect(Math.abs(ttk.mean - ev)).toBeLessThan(1.5);
  });

  it("runs once in expected-value mode", () => {
    const many = simulateMany(attacker, target, { runs: 50 });
    expect(many.runs).toBe(1);
    expect(many.ttk.p10).toBe(many.ttk.p90);
  });

  it("counts runs that don't kill as infinite TTK", () => {
    const tank = { ...target, maxHealth: 1e9 };
    const many = simulateMany(attacker, tank, { critMode: "rng", runs: 5 });
    expect(many.killRate).toBe(0);
    expect(many.ttk.p50).toBe(Infinity);
    expect(many.damage.p50).toBeGreaterThan(0);
  });

  it("uses nearest-rank percentiles", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 0.1)).toBe(1);
    expect(percentile(values, 0.5)).toBe(5);
    expect(percentile(values, 0.9)).toBe(9);
    expect(spread([3, 1, 2]).mean).toBe(2);
    expect(() => percentile([], 0.5)).toThrow();
  });
});

describe("performance", { tags: ["CMP-005"] }, () => {
  it("runs a 4 build × 3 target matrix with 200 RNG runs each within 2 s", () => {
    const builds = [0.2, 0.5, 0.8, 1.2].map((as): SimAttacker => ({
      ...attacker,
      level: 18,
      bonuses: [{ attackSpeed: as, attackDamage: 100, critChance: 0.6 }],
    }));
    const targets: SimTarget[] = [
      { maxHealth: 2000, defender: { armor: 60, magicResist: 50 } },
      { maxHealth: 3500, defender: { armor: 150, magicResist: 80 } },
      { maxHealth: 5000, defender: { armor: 250, magicResist: 120 } },
    ];
    const start = Date.now();
    for (const b of builds)
      for (const t of targets) simulateMany(b, t, { critMode: "rng" });
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
