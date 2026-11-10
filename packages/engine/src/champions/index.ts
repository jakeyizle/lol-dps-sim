import type { AbilityKey, ChampionData } from "@lol/data";

import { jinx, type ChampionKit } from "./jinx";

export * from "./jinx";

export type KitFactory = (
  champion: ChampionData,
  level: number,
  ranks?: Record<AbilityKey, number>,
) => ChampionKit;

/** Champions with an implemented kit, by id; only these can be attackers (BUILD-009). */
export const KITS: Readonly<Record<string, KitFactory>> = { Jinx: jinx };
