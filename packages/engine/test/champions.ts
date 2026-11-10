import type { ChampionData } from "@lol/data";

import type { GameConstants } from "../src/core/stats";

const flat = (base: number) => ({ base, perLevel: 0 });
const slot = { windupPercent: 0.2, windupModifier: 1 };

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
};

/** Jinx's real 16.22 stats (game file), for checks against the wiki. */
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
