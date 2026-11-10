import type { AbilityKey, ChampionData } from "@lol/data";

import type { RunePage } from "../runes";
import { jinx, type ChampionKit } from "./jinx";

export * from "./jinx";

export type KitFactory = (
  champion: ChampionData,
  level: number,
  ranks?: Record<AbilityKey, number>,
) => ChampionKit;

/** Champions with an implemented kit, by id; only these can be attackers (BUILD-009). */
export const KITS: Readonly<Record<string, KitFactory>> = { Jinx: jinx };

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
};
