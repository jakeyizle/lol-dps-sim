import type { ChampionData, ItemData } from "@lol/data";
import { describe, expect, it } from "vitest";

import { testChampion, testConstants } from "../../test/champions";
import type { Effect, EffectContext } from "../core/effects";
import type { Rotation } from "../core/rotation";
import {
  hastedCooldown,
  simulate,
  type SimAbility,
  type SimOptions,
  type SimTarget,
} from "../core/sim";
import type { GameConstants, StatBonuses } from "../core/stats";
import { equip } from ".";

/** Ranged (550 range), AD 60, +40% AS → attacks start at 0, 1.25 …, land 0.25 s later. */
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
const number = (n: number) => ({
  __type: "GameCalculation",
  mFormulaParts: [{ __type: "NumberCalculationPart", mNumber: n }],
});

const nashors = item("3115", {
  values: { NashorsBaseValue: 15, NashorsAPValue: 0.15 },
});
const wits = item("3091", { calculations: { OnHitDamage: number(45) } });
const yunTal = (over: Record<string, number> = {}) =>
  item("3032", {
    values: {
      CritPerStackMelee: 0.4,
      StackRangedMultiplier: 0.5,
      CritMax: 25,
      ASMod: 0.3,
      ASDuration: 0.1,
      Cooldown: 5,
      AACDR: 1,
      CritCDR: 2,
      ...over,
    },
  });
const stormrazor = item("3095", {
  calculations: { TotalProcDamage: number(100) },
});
const hexoptics = item("2523", {
  values: { MaxDamageAmp: 0.1, MaxRange: 500 },
});
const fiendhunter = item("2512", {
  values: {
    UltimateHaste: 30,
    Cooldown: 45,
    Duration: 8,
    NumberOfAttacks: 3,
    BonusAS: 0.5,
    CritModifier: 0.8,
    BonusTrueDamage: 0.15,
  },
});
const essenceReaver = item("3508", {
  values: { SpellbladeCooldown: 1.5, SpellbladeWindow: 10 },
  calculations: {
    SpellbladeDamage: {
      __type: "GameCalculation",
      mFormulaParts: [
        {
          __type: "StatByNamedDataValueCalculationPart",
          mStat: 2,
          mStatFormula: 1,
          mDataValue: "BaseADRatio",
        },
        {
          __type: "StatByNamedDataValueCalculationPart",
          mStat: 8,
          mDataValue: "CritChanceMultiplier",
        },
      ],
    },
  },
});
essenceReaver.values.BaseADRatio = 1.25;
essenceReaver.values.CritChanceMultiplier = 50;

const big: SimTarget = {
  maxHealth: 1e9,
  defender: { armor: 0, magicResist: 0 },
};

function run(
  items: ItemData[],
  opts: {
    champion?: ChampionData;
    target?: Partial<SimTarget>;
    extra?: Effect[];
    bonus?: StatBonuses;
    abilities?: SimAbility[];
    rotation?: Rotation;
    stacks?: Record<string, number>;
    sim?: SimOptions;
  } = {},
) {
  const champion = opts.champion ?? testChampion;
  const { bonuses, effects } = equip(items, champion, constants, opts.stacks);
  return simulate(
    {
      champion,
      level: 1,
      constants,
      bonuses: [{ attackSpeed: 0.4, ...opts.bonus }, ...bonuses],
      items: [...effects, ...(opts.extra ?? [])],
      abilities: opts.abilities,
      rotation: opts.rotation,
    },
    { ...big, ...opts.target },
    { maxDuration: 6, ...opts.sim },
  );
}

const hits = (r: ReturnType<typeof run>, sourceId: string) =>
  r.trace.filter((t) => t.damage.instance.sourceId === sourceId);
const amounts = (r: ReturnType<typeof run>, sourceId: string) =>
  hits(r, sourceId).map((h) => h.damage.postMitigation);
function atLaunch(read: (ctx: EffectContext) => number) {
  const seen: number[] = [];
  const effect: Effect = {
    id: "Probe",
    onAttackLaunch: (ctx) => seen.push(read(ctx)),
  };
  return { seen, effect };
}
const round = (xs: number[]) => xs.map((x) => Math.round(x * 1e4) / 1e4);

it("Nashor's Tooth: base + AP ratio on hit", { tags: ["ITEM-022"] }, () => {
  const r = run([nashors], { bonus: { abilityPower: 100 } });
  expect(amounts(r, "NashorsTooth")[0]).toBeCloseTo(30, 9);
});

it("Wit's End: on-hit magic damage", { tags: ["ITEM-023"] }, () => {
  expect(amounts(run([wits]), "WitsEnd")[0]).toBe(45);
});

describe("Yun Tal Wildarrows", () => {
  it(
    "adds crit per attack from the build's stacks, up to its max",
    { tags: ["ITEM-024"] },
    () => {
      // ranged: 0.4% × 0.5 per stack; 10 stacks from the build, +1 per launch
      const { seen, effect } = atLaunch((ctx) => ctx.stats.critChance);
      run([yunTal()], { extra: [effect], stacks: { "3032": 10 } });
      expect(round(seen.slice(0, 3))).toEqual([0.022, 0.024, 0.026]);

      const capped = atLaunch((ctx) => ctx.stats.critChance);
      run([yunTal()], { extra: [capped.effect], stacks: { "3032": 500 } });
      expect(capped.seen[0]).toBeCloseTo(0.25, 9);
    },
  );

  it(
    "Flurry triggers on champions, its cooldown cut per hit (more on crits)",
    { tags: ["ITEM-025"] },
    () => {
      const flurry = (bonus: StatBonuses, champion = true) => {
        const { seen, effect } = atLaunch((ctx) =>
          ctx.buffStacks("YunTalFlurry"),
        );
        run([yunTal()], {
          extra: [effect],
          bonus,
          target: { champion },
          sim: { maxDuration: 8 },
        });
        return seen;
      };
      // cooldown 5, −1 per hit: triggers at 0, 3.75, 7.5
      expect(flurry({})).toEqual([1, 0, 0, 1, 0, 0, 1]);
      // 100% crit: −2 per hit: triggers at 0, 2.5, 5.0, 7.5
      expect(flurry({ critChance: 1 })).toEqual([1, 0, 1, 0, 1, 0, 1]);
      expect(flurry({}, false).every((s) => s === 0)).toBe(true);
    },
  );
});

it(
  "Stormrazor: energized attacks deal its proc damage",
  { tags: ["ITEM-026"] },
  () => {
    const r = run([stormrazor], { sim: { maxDuration: 22 } });
    expect(hits(r, "Stormrazor").map((h) => h.time)).toEqual([21.5]);
    expect(amounts(r, "Stormrazor")).toEqual([100]);
  },
);

it(
  "Hexoptics C44: amplifies attacks by range, up to its max",
  { tags: ["ITEM-027"] },
  () => {
    const onHit: Effect = {
      id: "OnHit",
      onHit: (ctx) => {
        ctx.deal({
          type: "true",
          amount: 10,
          source: "item",
          sourceId: "OnHit",
          onHit: true,
        });
      },
    };
    const short: ChampionData = {
      ...testChampion,
      stats: { ...testChampion.stats, attackRange: { base: 250, perLevel: 0 } },
    };
    const r = run([hexoptics], { extra: [onHit] });
    expect(amounts(r, "basic")[0]).toBeCloseTo(66, 9); // 550 ≥ 500 → +10%
    expect(amounts(r, "OnHit")[0]).toBe(10); // basic attack damage only
    expect(
      amounts(run([hexoptics], { champion: short }), "basic")[0],
    ).toBeCloseTo(63, 9);
  },
);

describe("Fiendhunter Bolts", () => {
  const r: SimAbility = { id: "R", castTime: 0, cooldown: 100, cost: 0 };
  const q: SimAbility = { id: "Q", castTime: 0, cooldown: 100, cost: 0 };

  it("adds ultimate haste to R only", { tags: ["ITEM-028"] }, () => {
    const result = run([fiendhunter], {
      abilities: [r, q],
      rotation: [{ action: "R" }, { action: "Q" }, { action: "attack" }],
      sim: { maxDuration: 90 },
    });
    const at = (id: string) =>
      result.actions.filter((a) => a.action === id).map((a) => a.time);
    expect(at("R")).toHaveLength(2);
    expect(at("R")[1]).toBeCloseTo(hastedCooldown(100, 30), 9);
    expect(at("Q")).toEqual([0]);
  });

  it(
    "after R, the next 3 attacks gain attack speed and always crit",
    { tags: ["ITEM-029"] },
    () => {
      const rotation: Rotation = [{ action: "R" }, { action: "attack" }];
      const noCrit = run([fiendhunter], {
        abilities: [{ ...r, cooldown: 10 }],
        rotation,
        sim: { maxDuration: 14 },
      });
      // The 3 empowered attacks run at 0.6 + 0.5 × 0.9 = 1.05 attacks/s, then 0.8.
      const starts = noCrit.actions
        .filter((a) => a.action === "attack")
        .map((a) => a.time);
      const gaps = starts.slice(1, 5).map((t, i) => t - (starts[i] ?? 0));
      expect(round(gaps)).toEqual(round([1 / 1.05, 1 / 1.05, 1 / 1.05, 1.25]));
      // 0% crit: 60 × (1 + 1 × 0.8); then plain attacks. R again at 10 is on the item's cooldown.
      const basic = amounts(noCrit, "basic");
      expect(round(basic.slice(0, 4))).toEqual([108, 108, 108, 60]);
      expect(basic.slice(4).every((a) => a === 60)).toBe(true);
      expect(amounts(noCrit, "FiendhunterBolts")).toEqual([]);

      // 100% crit: full crits (120) plus 15% of 120 as true damage
      const crit = run([fiendhunter], {
        abilities: [r],
        rotation,
        bonus: { critChance: 1 },
        sim: { maxDuration: 3 },
      });
      expect(round(amounts(crit, "basic").slice(0, 3))).toEqual([
        120, 120, 120,
      ]);
      expect(round(amounts(crit, "FiendhunterBolts"))).toEqual([18, 18, 18]);
    },
  );
});

it(
  "Essence Reaver: the attack after an ability deals Spellblade damage",
  { tags: ["ITEM-030"] },
  () => {
    // Q after each attack (cd 1). 125% of 60 base AD (+ 50 × 0% crit) = 75.
    // Procs at 1.5; its 1.5 s cooldown skips the Qs at 1.5 and 2.75; Q at 4.0 → proc at 5.25.
    const r = run([essenceReaver], {
      abilities: [{ id: "Q", castTime: 0, cooldown: 1, cost: 0 }],
      rotation: [
        { action: "Q", when: [{ kind: "afterAttack" }] },
        { action: "attack" },
      ],
    });
    expect(hits(r, "EssenceReaver").map((h) => h.time)).toEqual([1.5, 5.25]);
    expect(amounts(r, "EssenceReaver")).toEqual([75, 75]);
  },
);
