import type { ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { Effect } from "../core/effects";
import type { Rotation } from "../core/rotation";
import { simulate, type SimAbility, type SimTarget } from "../core/sim";
import { computeStats, type GameConstants } from "../core/stats";
import { equip } from ".";

/** Ranged, AD 60, +40% AS → attacks start at 0, 1.25 …, land 0.25 s later. */
const constants: GameConstants = {
  ...testConstants,
  energizeStacksPerAttack: 6,
  energizeMaxStacks: 100,
};

const item = (id: string, over: Partial<ItemData> = {}): ItemData => ({
  id,
  name: id,
  cost: 3000,
  stats: {},
  otherStats: {},
  values: {},
  calculations: {},
  groups: [],
  ...over,
});

const collector = item("6676", {
  values: { LethalityAmount: 10, ExecuteThreshold: 0.05 },
});
const guinsoo = item("3124", {
  values: {
    OnHitDamage: 30,
    AttackSpeedPerStack: 0.08,
    MaxStacks: 4,
    BuffDuration: 4,
    PhantomStacks: 2,
    PhantomHitDelay: 0.15,
  },
});
const navori = item("6675", { values: { CDRAmount: 0.15 } });
const statikk = item("3087", {
  values: { ChainDamage: 60, NonChampChainDamage: 90, BonusEnergizedStacks: 9 },
});
const rfc = item("3094", { values: { BonusDamage: 40 } });
const terminus = item("3302", {
  values: { PenPerHit: 0.1, PenMax: 0.3, DebuffDuration: 5 },
  calculations: {
    OnHitDamage: {
      __type: "GameCalculation",
      mFormulaParts: [
        { __type: "NumberCalculationPart", mNumber: 30 },
        {
          __type: "StatByCoefficientCalculationPart",
          mStat: 2,
          mStatFormula: 2,
          mCoefficient: 0.1,
        },
      ],
    },
  },
});

const big: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

function run(
  items: ItemData[],
  opts: {
    target?: Partial<SimTarget>;
    extra?: Effect[];
    maxDuration?: number;
    abilities?: SimAbility[];
    rotation?: Rotation;
    bonusAD?: number;
  } = {},
) {
  const { bonuses, effects } = equip(items, testChampion, constants);
  return simulate(
    {
      champion: testChampion,
      level: 1,
      constants,
      bonuses: [
        { attackSpeed: 0.4, attackDamage: opts.bonusAD ?? 0 },
        ...bonuses,
      ],
      items: [...effects, ...(opts.extra ?? [])],
      abilities: opts.abilities,
      rotation: opts.rotation,
    },
    { ...big, ...opts.target },
    { maxDuration: opts.maxDuration ?? 6 },
  );
}

const hits = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const landings = (r: ReturnType<typeof run>) =>
  r.trace.filter((t) => t.damage.instance.autoAttack).map((t) => t.time);
const atLaunch = (
  read: (ctx: Parameters<NonNullable<Effect["init"]>>[0]) => number,
) => {
  const seen: number[] = [];
  return {
    seen,
    effect: {
      id: "Probe",
      onAttackLaunch: (ctx) => seen.push(read(ctx)),
    } as Effect,
  };
};

describe("The Collector", { tags: ["ITEM-014"] }, () => {
  it("executes champions left below its threshold", () => {
    // 1000 health, 60 per attack (10 lethality cancels 10 armor): 40 left after the 16th, at 19 s.
    const target = { maxHealth: 1000, defender: { armor: 10, magicResist: 0 } };
    const r = run([collector], { target, maxDuration: 22 });
    expect(r).toMatchObject({ killed: true, executed: true, ttk: 19 });
    expect(hits(r, "basic").every((h) => h.damage.postMitigation === 60)).toBe(
      true,
    );

    const minion = run([collector], {
      target: { ...target, champion: false },
      maxDuration: 22,
    });
    expect(minion).toMatchObject({ killed: true, executed: false, ttk: 20.25 });
  });
});

describe("Guinsoo's Rageblade", () => {
  it(
    "deals on-hit magic damage and stacks attack speed",
    { tags: ["ITEM-015"] },
    () => {
      const { seen, effect } = atLaunch((ctx) => ctx.stats.bonusAttackSpeed);
      const r = run([guinsoo], { extra: [effect] });
      expect(seen.slice(0, 6).map((v) => Math.round(v * 100) / 100)).toEqual([
        0.4, 0.48, 0.56, 0.64, 0.72, 0.72,
      ]);
      expect(hits(r, "GuinsoosRageblade")[0]?.damage.postMitigation).toBe(30);
    },
  );

  it(
    "repeats on-hit effects on the 7th attack and every 3rd after, after its delay",
    { tags: ["ITEM-016"] },
    () => {
      let onHits = 0;
      const probe: Effect = {
        id: "OnHitProbe",
        onHit: () => {
          onHits += 1;
        },
      };
      const r = run([guinsoo], { extra: [probe], maxDuration: 12 });
      const lands = landings(r);
      const wrath = hits(r, "GuinsoosRageblade").map((h) => h.time);
      const phantoms = wrath.filter((t) => !lands.includes(t));
      expect(phantoms).toHaveLength(Math.floor((lands.length - 4) / 3));
      phantoms.forEach((t, i) => {
        expect(t).toBeCloseTo((lands[6 + 3 * i] ?? NaN) + 0.15, 9);
      });
      expect(onHits).toBe(lands.length + phantoms.length);
    },
  );
});

describe("Navori Flickerblade", { tags: ["ITEM-017"] }, () => {
  it("cuts remaining basic ability cooldowns on each attack", () => {
    // Q at 0 (cd 2). Launch at 0: 2 → 1.7. Launch at 1.25: 0.45 left → 0.3825, ready 1.6325.
    for (const id of ["Q", "W", "E"]) {
      const r = run([navori], {
        abilities: [{ id, castTime: 0, cooldown: 2, cost: 0 }],
        rotation: [{ action: id }, { action: "attack" }],
        maxDuration: 2,
      });
      const q = r.actions.filter((a) => a.action === id).map((a) => a.time);
      expect(q, id).toHaveLength(2);
      expect(q[1], id).toBeCloseTo(1.6325, 9);
    }
  });
});

describe("Energized", { tags: ["ITEM-018"] }, () => {
  it("fills by attacks and empowers the attack after it's full", () => {
    // 6 per attack: full after 17 attacks; the 18th (landing at 21.5 s) is energized.
    const r = run([rfc], { maxDuration: 30 });
    expect(hits(r, "RapidFirecannon").map((h) => h.time)).toEqual([21.5]);
  });

  it("adds Statikk Shiv's bonus stacks", () => {
    // 15 per attack: full after 7; the 8th (9 s) and 16th (19 s) are energized.
    const r = run([statikk, rfc], { maxDuration: 20 });
    expect(hits(r, "StatikkShiv").map((h) => h.time)).toEqual([9, 19]);
    expect(hits(r, "RapidFirecannon").map((h) => h.time)).toEqual([9, 19]);
  });

  it("needs the patch constants", () => {
    expect(() => equip([rfc], testChampion)).toThrow(/constants/);
    for (const partial of [
      { energizeStacksPerAttack: 6 },
      { energizeMaxStacks: 100 },
    ])
      expect(() =>
        equip([rfc], testChampion, { ...testConstants, ...partial }),
      ).toThrow(/energize constants/);
  });
});

describe("Statikk Shiv", { tags: ["ITEM-019"] }, () => {
  it("energized attacks deal chain damage, more against non-champions", () => {
    const at = (champion: boolean) =>
      hits(
        run([statikk], { maxDuration: 10, target: { champion } }),
        "StatikkShiv",
      ).map((h) => h.damage.postMitigation);
    expect(at(true)).toEqual([60]);
    expect(at(false)).toEqual([90]);
  });
});

describe("Rapid Firecannon", { tags: ["ITEM-020"] }, () => {
  it("energized attacks deal bonus magic damage", () => {
    const [proc] = hits(run([rfc], { maxDuration: 22 }), "RapidFirecannon");
    expect(proc?.damage.postMitigation).toBe(40);
    expect(proc?.damage.instance).toMatchObject({ type: "magic", onHit: true });
  });
});

describe("Terminus", { tags: ["ITEM-021"] }, () => {
  it("deals on-hit damage and stacks penetration on every 2nd hit", () => {
    const { seen, effect } = atLaunch((ctx) => ctx.stats.armorPenPercent);
    const magic = atLaunch((ctx) => ctx.stats.magicPenPercent);
    const r = run([terminus], {
      extra: [effect, magic.effect],
      maxDuration: 9,
      bonusAD: 50,
    });
    const pct = (xs: number[]) => xs.map((v) => Math.round(v * 100) / 100);
    expect(pct(seen)).toEqual([0, 0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
    expect(pct(magic.seen)).toEqual(pct(seen));
    // the same effect in a second fight starts from Light again
    const again = atLaunch((ctx) => ctx.stats.armorPenPercent);
    const [terminusEffect] = equip([terminus], testChampion, constants).effects;
    if (!terminusEffect) throw new Error("no effect");
    for (const extra of [[], [again.effect]])
      simulate(
        {
          champion: testChampion,
          level: 1,
          constants,
          bonuses: [{ attackSpeed: 0.4 }],
          items: [terminusEffect, ...extra],
        },
        big,
        { maxDuration: 3 },
      );
    expect(pct(again.seen)).toEqual([0, 0, 0.1]);
    // 30 + 10% of 50 bonus AD
    expect(hits(r, "Terminus")[0]?.damage.postMitigation).toBeCloseTo(35, 9);
  });

  it("doesn't stack against non-champions", () => {
    const { seen, effect } = atLaunch((ctx) => ctx.stats.armorPenPercent);
    run([terminus], { extra: [effect], target: { champion: false } });
    expect(Math.max(...seen)).toBe(0);
  });
});

it("percent penetration sources multiply", () => {
  const stats = computeStats({
    champion: testChampion,
    level: 1,
    constants,
    bonuses: [{ armorPenPercent: 0.35 }, { armorPenPercent: 0.3 }],
  });
  expect(stats.armorPenPercent).toBeCloseTo(1 - 0.65 * 0.7, 9);
});
