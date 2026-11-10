import type { ChampionData, ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { Effect } from "../core/effects";
import { simulate, type SimTarget } from "../core/sim";
import { computeStats } from "../core/stats";
import { equip, itemStats } from ".";

/** Ranged (550 range); a melee copy for melee values. AD 60, +40% AS → attacks at 0, 1.25 …, land +0.25. */
const ranged = testChampion;
const melee: ChampionData = {
  ...testChampion,
  stats: { ...testChampion.stats, attackRange: { base: 125, perLevel: 0 } },
};

const item = (over: Partial<ItemData>): ItemData => ({
  id: "0",
  name: "Item",
  cost: 3000,
  stats: {},
  otherStats: {},
  values: {},
  calculations: {},
  groups: [],
  ...over,
});

/** 100 at level 1, +10 per level from 9; up to +50% by missing health; ranged × 0.5. */
const kraken = (buffDuration = 4) =>
  item({
    id: "6672",
    name: "Kraken Slayer",
    values: {
      AttackCount: 3,
      BuffDuration: buffDuration,
      MaxAmpNumber: 1.5,
      RangedDamageMultiplier: 0.5,
    },
    calculations: {
      DamageAmount: {
        __type: "{e9a3c91d}",
        mFormulaParts: [
          {
            __type: "ByCharLevelBreakpointsCalculationPart",
            mLevel1Value: 100,
            mBreakpoints: [
              { __type: "Breakpoint", mLevel: 9, mBonusPerLevelAtAndAfter: 10 },
            ],
          },
        ],
        mRangedMultiplier: {
          __type: "NamedDataValueCalculationPart",
          mDataValue: "RangedDamageMultiplier",
        },
      },
    },
  });
const botrk = item({
  id: "3153",
  name: "Blade of the Ruined King",
  values: { RangedValue: 0.06, MeleeValue: 0.09 },
});
const ldr = item({
  id: "3036",
  name: "Lord Dominik's Regards",
  stats: { armorPenPercent: 0.35 },
  values: { MaxBonusDamagePercent: 0.15, MaxBonusHealth: 1500 },
});

const big: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

function run(
  items: ItemData[],
  opts: {
    champion?: ChampionData;
    level?: number;
    target?: Partial<SimTarget>;
    extra?: Effect[];
    maxDuration?: number;
  } = {},
) {
  const champion = opts.champion ?? ranged;
  const { bonuses, effects } = equip(items, champion);
  return simulate(
    {
      champion,
      level: opts.level ?? 1,
      constants: testConstants,
      bonuses: [{ attackSpeed: 0.4 }, ...bonuses],
      items: [...effects, ...(opts.extra ?? [])],
    },
    { ...big, ...opts.target },
    { maxDuration: opts.maxDuration ?? 7 },
  );
}

const hits = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace
    .filter((t) => t.damage.instance.sourceId === sourceId)
    .map((t) => ({ time: t.time, amount: t.damage.postMitigation }));

const wound = (amount: number): Effect => ({
  id: "Wound",
  init: (ctx) => {
    ctx.deal({ type: "true", amount, source: "item", sourceId: "Wound" });
  },
});

describe("Kraken Slayer", () => {
  it(
    "empowers every 3rd attack with level-based damage, scaled by missing health",
    { tags: ["ITEM-004"] },
    () => {
      // Melee: 3rd hit at 2.75 s; 500 + 3 × 60 = 680 of 1000 missing → × (1 + 0.5 × 0.68)
      const r = run([kraken()], {
        champion: melee,
        target: { maxHealth: 1000 },
        extra: [wound(500)],
        maxDuration: 3,
      });
      expect(hits(r, "KrakenSlayer")).toEqual([{ time: 2.75, amount: 134 }]);

      // Level 10: 100 + 10 × 2 = 120; procs on the 3rd and 6th attacks.
      const later = run([kraken()], { champion: melee, level: 10 });
      const procs = hits(later, "KrakenSlayer");
      expect(procs.map((p) => p.amount)).toEqual([
        expect.closeTo(120, 3),
        expect.closeTo(120, 3),
      ]);
      expect(procs).toHaveLength(2);
      expect(procs[1]?.time).toBeCloseTo(
        later.trace.filter((t) => t.damage.instance.autoAttack)[5]?.time ?? 0,
        9,
      );
    },
  );

  it(
    "restarts its count after the buff duration without attacks",
    { tags: ["ITEM-011"] },
    () => {
      // Attacks are 1.25 s apart; a 1 s duration never lets the count reach 3.
      expect(
        hits(run([kraken(1)], { champion: melee }), "KrakenSlayer"),
      ).toEqual([]);
    },
  );

  it(
    "counts at launch for ranged attackers, lands on hit, with the ranged multiplier",
    { tags: ["ITEM-012"] },
    () => {
      const counts = (champion: ChampionData) => {
        const seen: number[] = [];
        run([kraken()], {
          champion,
          maxDuration: 4,
          extra: [
            {
              id: "Probe",
              onAttackLaunch: (ctx) =>
                seen.push(ctx.buffStacks("KrakenSlayer:count")),
            },
          ],
        });
        return seen;
      };
      expect(counts(ranged)).toEqual([1, 2, 0, 1]);
      expect(counts(melee)).toEqual([0, 1, 2, 0]);

      const r = run([kraken()], { maxDuration: 3 });
      const procs = hits(r, "KrakenSlayer");
      expect(procs.map((p) => p.time)).toEqual([2.75]);
      expect(procs[0]?.amount).toBeCloseTo(50, 3);
    },
  );
});

describe("Blade of the Ruined King", { tags: ["ITEM-005"] }, () => {
  it("deals a percent of current health on hit, by melee or ranged", () => {
    // first hit: 60 → 940 health left
    const at = (champion: ChampionData) =>
      hits(
        run([botrk], { champion, target: { maxHealth: 1000 }, maxDuration: 1 }),
        "BladeOfTheRuinedKing",
      ).map((h) => h.amount);
    expect(at(ranged)).toEqual([expect.closeTo(56.4, 9)]);
    expect(at(melee)).toEqual([expect.closeTo(84.6, 9)]);
  });
});

describe("Infinity Edge", { tags: ["ITEM-006"] }, () => {
  it("adds crit damage to total and bonus crit damage", () => {
    const ie = item({ stats: { critChance: 0.25, critDamage: 0.3 } });
    const stats = computeStats({
      champion: ranged,
      level: 1,
      constants: testConstants,
      bonuses: [itemStats(ie)],
    });
    expect(stats.critDamage).toBeCloseTo(2.3, 9);
    expect(stats.bonusCritDamage).toBeCloseTo(0.3, 9);
  });
});

describe("Lord Dominik's Regards", () => {
  it("applies its armor penetration", { tags: ["ITEM-007"] }, () => {
    // 100 armor × (1 − 0.35) = 65 → 60 × 100 / 165
    const r = run([ldr], {
      target: { defender: { armor: 100, magicResist: 0 } },
      maxDuration: 0.5,
    });
    expect(hits(r, "basic")[0]?.amount).toBeCloseTo(6000 / 165, 9);
  });

  it(
    "amplifies damage by the champion target's bonus health",
    { tags: ["ITEM-013"] },
    () => {
      const first = (target: Partial<SimTarget>) =>
        hits(run([ldr], { target, maxDuration: 0.5 }), "basic")[0]?.amount;
      expect(first({ bonusHealth: 750 })).toBeCloseTo(60 * 1.075, 9);
      expect(first({ bonusHealth: 3000 })).toBeCloseTo(60 * 1.15, 9);
      expect(first({ bonusHealth: 3000, champion: false })).toBe(60);
    },
  );
});
