import { parsePatch, type ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import champions from "../../data/generated/26.22/champions.json";
import constants from "../../data/generated/26.22/constants.json";
import items from "../../data/generated/26.22/items.json";
import runes from "../../data/generated/26.22/runes.json";
import targets from "../../data/generated/26.22/targets.json";
import { testChampion, testConstants } from "../test/champions";
import type { Effect } from "./core/effects";
import { simulate, type SimOptions, type SimTarget } from "./core/sim";
import type { StatBonuses } from "./core/stats";
import {
  GUARDIAN_ANGEL,
  MAW_OF_MALMORTIUS,
  PLATED_STEELCAPS,
  RANDUINS_OMEN,
  STERAKS_GAGE,
  targetDefenses,
  ZHONYAS_HOURGLASS,
  type DefenseSetup,
} from "./target";

/**
 * Real 26.22 item values. The attacker is the test champion: 60 physical damage per attack,
 * landing at 0.25, 1.5, 2.75 … (every 1.25 s); targets have no armor or magic resist.
 */
const data = parsePatch({ champions, items, runes, constants, targets });
const item = (id: string): ItemData => {
  const i = data.items[id];
  if (!i) throw new Error(`no item ${id}`);
  return i;
};
const split = (base: number, bonus: number) => ({
  base,
  bonus,
  total: base + bonus,
});
const setup = (over: Partial<DefenseSetup> = {}): DefenseSetup => ({
  stats: {
    health: split(600, 400),
    armor: split(0, 0),
    magicResist: split(0, 0),
  },
  bonusAttackDamage: 0,
  ranged: false,
  zhonyaBelow: null,
  ...over,
});

function run(
  ids: string[],
  opts: {
    health?: number;
    defense?: Partial<DefenseSetup>;
    bonus?: StatBonuses;
    extra?: Effect[];
    sim?: SimOptions;
  } = {},
) {
  const { critDamageReduction, reductions, ...rest } = targetDefenses(
    ids.map(item),
    setup(opts.defense),
  );
  const target: SimTarget = {
    maxHealth: opts.health ?? 1000,
    defender: { armor: 0, magicResist: 0, critDamageReduction, reductions },
    ...rest,
  };
  return simulate(
    {
      champion: testChampion,
      level: 1,
      constants: testConstants,
      bonuses: [{ attackSpeed: 0.4, ...opts.bonus }],
      items: opts.extra ?? [],
    },
    target,
    { maxDuration: 30, ...opts.sim },
  );
}
const basic = (r: ReturnType<typeof run>) =>
  r.trace.filter((t) => t.damage.instance.sourceId === "basic");
const round = (xs: number[]) => xs.map((x) => Math.round(x * 1e6) / 1e6);
const magicOnHit = (amount: number): Effect => ({
  id: "MagicOnHit",
  onHit: (ctx) => {
    ctx.deal({
      type: "magic",
      amount,
      source: "item",
      sourceId: "MagicOnHit",
      onHit: true,
    });
  },
});

it(
  "Randuin's Omen reduces the whole critical strike",
  { tags: ["TGT-006"] },
  () => {
    // crit ×2 reduced by 30% → 60 × 1.4; expected value at 50% crit: 60 × (1 + 0.5 × 0.4)
    const sure = basic(run([RANDUINS_OMEN], { bonus: { critChance: 1 } }));
    expect(sure[0]?.damage.postMitigation).toBeCloseTo(84, 9);
    const half = basic(run([RANDUINS_OMEN], { bonus: { critChance: 0.5 } }));
    expect(half[0]?.damage.postMitigation).toBeCloseTo(72, 9);
  },
);

it(
  "Plated Steelcaps reduce auto attack damage, not on-hit effects",
  { tags: ["TGT-007"] },
  () => {
    const r = run([PLATED_STEELCAPS], { extra: [magicOnHit(10)] });
    expect(basic(r)[0]?.damage.postMitigation).toBeCloseTo(54, 9);
    expect(
      r.trace.find((t) => t.damage.instance.sourceId === "MagicOnHit")?.damage
        .postMitigation,
    ).toBe(10);
  },
);

describe("Sterak's Gage", () => {
  it(
    "shields 60% of bonus health when damage would drop it below 30%",
    { tags: ["TGT-008"] },
    () => {
      // 11 hits leave 340; the 12th would leave 280 < 300
      const hits = basic(run([STERAKS_GAGE]));
      expect(hits.slice(0, 11).every((h) => h.absorbed === 0)).toBe(true);
      expect(hits[11]?.absorbed).toBe(60);
      expect(hits[11]?.healthAfter).toBe(340);
    },
  );

  it(
    "decays after its delay, to 0 at the end of its duration",
    { tags: ["TGT-013"] },
    () => {
      // 240: −60 at once; from 0.75 s it loses 240 / 3.75 = 64 per second
      // +1.25 s: 180 − 32 = 148 → −60; +2.5 s: 88 − 80 = 8; +3.75 s: gone
      const hits = basic(run([STERAKS_GAGE])).slice(11, 15);
      expect(round(hits.map((h) => h.absorbed))).toEqual([60, 60, 8, 0]);
    },
  );
});

it(
  "Maw of Malmortius is triggered by and absorbs magic damage only",
  { tags: ["TGT-008", "TGT-014"] },
  () => {
    // each hit: 60 physical + 100 magic; melee shield 200 + 150% bonus AD
    const r = run([MAW_OF_MALMORTIUS], {
      extra: [magicOnHit(100)],
      defense: { bonusAttackDamage: 20 },
    });
    const magic = r.trace.filter(
      (t) => t.damage.instance.sourceId === "MagicOnHit",
    );
    // after 4 hits: 360 left; the 5th's physical leaves 300, its magic would leave 200
    expect(basic(r).every((h) => h.absorbed === 0)).toBe(true);
    expect(magic.slice(0, 4).every((h) => h.absorbed === 0)).toBe(true);
    expect(magic[4]?.absorbed).toBe(100);
    expect(magic[5]?.absorbed).toBe(100);
    expect(magic[6]?.absorbed).toBe(30);
    expect(r.targetEvents).toEqual([
      { time: magic[4]?.time, kind: "shield", id: "MawOfMalmortius" },
    ]);

    const ranged = run([MAW_OF_MALMORTIUS], {
      extra: [magicOnHit(1000)],
      defense: { ranged: true, bonusAttackDamage: 20 },
    });
    expect(ranged.trace.find((t) => t.absorbed > 0)?.absorbed).toBeCloseTo(
      230 * 0.75,
      9,
    );
  },
);

describe("Guardian Angel", () => {
  it(
    "revives after its delay with half base health; TTK is the final death",
    { tags: ["TGT-009", "METRIC-001"] },
    () => {
      // 300 health: dies to the 5th hit at 5.25; back at 9.25 with 300 (50% of 600)
      const r = run([GUARDIAN_ANGEL], { health: 300 });
      expect(r.targetEvents).toEqual([
        { time: 5.25, kind: "revive", id: "revive" },
      ]);
      const during = r.trace.filter((t) => t.time > 5.25 && t.time < 9.25);
      expect(during).toEqual([]);
      const after = basic(r).filter((t) => t.time > 9.25);
      expect(after[0]?.healthAfter).toBe(240);
      expect(r.killed).toBe(true);
      expect(r.ttk).toBe(after[4]?.time);
    },
  );
});

describe("Zhonya's Hourglass", () => {
  it(
    "makes the target untargetable once it drops below the chosen health",
    { tags: ["TGT-010", "TGT-015"] },
    () => {
      // the 9th hit at 10.25 leaves 460 < 500: no damage until 12.75
      const r = run([ZHONYAS_HOURGLASS], { defense: { zhonyaBelow: 0.5 } });
      expect(r.targetEvents).toEqual([
        { time: 10.25, kind: "stasis", id: "stasis" },
      ]);
      expect(r.trace.filter((t) => t.time > 10.25 && t.time < 12.75)).toEqual(
        [],
      );
      // the attacker's timers keep running: it attacks throughout
      const attacks = r.actions.filter((a) => a.action === "attack");
      expect(attacks.some((a) => a.time > 10.25 && a.time < 12.75)).toBe(true);
      expect(basic(r).find((t) => t.time >= 12.75)?.healthAfter).toBe(400);
    },
  );

  it("never activates when set to never", { tags: ["TGT-011"] }, () => {
    const r = run([ZHONYAS_HOURGLASS], { defense: { zhonyaBelow: null } });
    expect(r.targetEvents).toEqual([]);
  });
});

it(
  "the DPS run has no revive or stasis, but low-health shields trigger once",
  { tags: ["METRIC-009"] },
  () => {
    const r = run([GUARDIAN_ANGEL, ZHONYAS_HOURGLASS, STERAKS_GAGE], {
      health: 300,
      defense: { zhonyaBelow: 0.5 },
      sim: { dpsRun: true },
    });
    expect(r.targetEvents.map((e) => e.kind)).toEqual(["shield"]);
    expect(r.killed).toBe(false);
  },
);
