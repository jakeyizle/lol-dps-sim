import type { AbilityKey, ChampionData } from "@lol/data";

import type { RunePage } from "../runes";
import { ashe } from "./ashe";
import { caitlyn } from "./caitlyn";
import { jinx, type ChampionKit } from "./jinx";
import { kaisa } from "./kaisa";

export * from "./ashe";
export * from "./caitlyn";
export * from "./jinx";
export * from "./kaisa";

export type KitFactory = (
  champion: ChampionData,
  level: number,
  ranks?: Record<AbilityKey, number>,
) => ChampionKit;

/** Champions with an implemented kit, by id; only these can be attackers (BUILD-009). */
export const KITS: Readonly<Record<string, KitFactory>> = {
  Jinx: jinx,
  Caitlyn: caitlyn,
  Ashe: ashe,
  Kaisa: kaisa,
};

/** Each kit's default rune page for new builds (BUILD-001). */
export const DEFAULT_RUNES: Readonly<Record<string, RunePage>> = {
  // Precision: Lethal Tempo, Triumph, Legend: Alacrity, Coup de Grace;
  // Sorcery: Absolute Focus, Gathering Storm; attack speed, adaptive, health.
  Jinx: {
    primary: 8000,
    keystone: 8008,
    primaryRunes: [9111, 9104, 8014],
    secondary: 8200,
    secondaryRunes: [8233, 8236],
    shards: [5005, 5008, 5011],
  },
  // Lethal Tempo (as Jinx).
  Kaisa: {
    primary: 8000,
    keystone: 8008,
    primaryRunes: [9111, 9104, 8014],
    secondary: 8200,
    secondaryRunes: [8233, 8236],
    shards: [5005, 5008, 5011],
  },
  // Lethal Tempo (as Jinx).
  Ashe: {
    primary: 8000,
    keystone: 8008,
    primaryRunes: [9111, 9104, 8014],
    secondary: 8200,
    secondaryRunes: [8233, 8236],
    shards: [5005, 5008, 5011],
  },
  // Press the Attack, Triumph, Legend: Alacrity, Coup de Grace; Absolute Focus,
  // Gathering Storm; attack speed, adaptive, health.
  Caitlyn: {
    primary: 8000,
    keystone: 8005,
    primaryRunes: [9111, 9104, 8014],
    secondary: 8200,
    secondaryRunes: [8233, 8236],
    shards: [5005, 5008, 5011],
  },
};
