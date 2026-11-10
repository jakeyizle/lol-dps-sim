import type { ChampionData } from "@lol/data";

import type { GameConstants } from "../src/core/stats";

const flat = (base: number) => ({ base, perLevel: 0 });
const slot = { windupPercent: 0.2, windupModifier: 1 };
const ability = (maxRank: number) => ({
  maxRank,
  cooldown: Array<number>(maxRank).fill(10),
  cost: Array<number>(maxRank).fill(50),
  castTime: 0.25,
  values: {},
  calculations: {},
});

/** Round numbers so expected values are easy to work out by hand (PLAN §8). */
export const testChampion: ChampionData = {
  id: "Test",
  key: 1,
  name: "Test",
  stats: {
    health: { base: 600, perLevel: 100 },
    healthRegen: flat(5),
    mana: { base: 300, perLevel: 40 },
    manaRegen: flat(7),
    armor: { base: 30, perLevel: 4 },
    magicResist: { base: 30, perLevel: 1 },
    attackDamage: { base: 60, perLevel: 3 },
    attackRange: flat(550),
    moveSpeed: flat(325),
  },
  attack: {
    baseAttackSpeed: 0.6,
    attackSpeedRatio: 0.5,
    attackSpeedPerLevel: 2,
    critMultiplier: 2,
    slots: { basic: slot },
    critSlot: "basic",
  },
  skillOrder: [
    ...["Q", "W", "E", "Q", "Q", "R", "Q", "W", "Q", "W", "R"],
    ...["W", "W", "E", "E", "R", "E", "E"],
  ] as ChampionData["skillOrder"],
  abilities: { Q: ability(5), W: ability(5), E: ability(5), R: ability(3) },
  passive: { values: {}, calculations: {} },
};

/** Jinx's real patch 26.22 stats (game file), for checks against the wiki. */
export const jinx1622: ChampionData = {
  ...testChampion,
  id: "Jinx",
  key: 222,
  name: "Jinx",
  stats: {
    ...testChampion.stats,
    attackDamage: { base: 59, perLevel: 3 },
  },
  attack: {
    ...testChampion.attack,
    baseAttackSpeed: 0.625,
    attackSpeedRatio: 0.625,
    attackSpeedPerLevel: 1,
  },
};

export const testConstants: GameConstants = { attackSpeedCap: 2.5 };

const one = <T>(value: T) => [value];
const calc = (...parts: Record<string, unknown>[]) => ({
  __type: "GameCalculation",
  mFormulaParts: parts,
});

/**
 * Jinx's kit with round numbers at rank 1 (PLAN §8): no mana regen, Q swap cooldown 100,
 * minigun windup 20%, rocket windup 25%.
 */
export const testJinx: ChampionData = {
  ...testChampion,
  id: "Jinx",
  name: "Jinx",
  stats: { ...testChampion.stats, manaRegen: { base: 0, perLevel: 0 } },
  attack: {
    ...testChampion.attack,
    slots: {
      basic: slot,
      JinxCritAttack: slot,
      JinxQAttack: { windupPercent: 0.25, windupModifier: 1 },
      JinxQCritAttack: { windupPercent: 0.25, windupModifier: 1 },
    },
    critSlot: "JinxCritAttack",
  },
  abilities: {
    Q: {
      maxRank: 1,
      cooldown: one(100),
      cost: one(20),
      castTime: 0,
      values: {
        MinigunAttackSpeedMax: one(40),
        MinigunAttackSpeedStacks: one(3),
        MinigunAttackSpeedDuration: one(2.5),
        MinigunFirstStackWeight: one(2),
        RocketTAD: one(1.5),
        RocketASPDPenalty: one(0.5),
      },
      calculations: {},
    },
    W: {
      maxRank: 1,
      cooldown: one(5),
      cost: one(50),
      castTime: 0.6,
      values: {
        Damage: one(100),
        ADRatio: one(1),
        JinxLowEndWCastTime: one(0.4),
        JinxWASpeedCastTimeScalarPerHundrethSecond: one(0.1),
      },
      calculations: {
        TotalDamage: calc(
          { __type: "NamedDataValueCalculationPart", mDataValue: "Damage" },
          {
            __type: "StatByNamedDataValueCalculationPart",
            mStat: 2,
            mDataValue: "ADRatio",
          },
        ),
      },
    },
    E: ability(1),
    R: {
      maxRank: 1,
      cooldown: one(100),
      cost: one(100),
      castTime: 0.5,
      values: { MaxDamage: one(300), PercentDamage: one(20) },
      calculations: {
        DamageMax: calc(
          { __type: "NamedDataValueCalculationPart", mDataValue: "MaxDamage" },
          {
            __type: "StatByCoefficientCalculationPart",
            mStat: 2,
            mStatFormula: 2,
            mCoefficient: 1,
          },
        ),
      },
    },
  },
};
