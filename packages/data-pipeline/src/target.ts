import type { ChampionData } from "@lol/data";

import { round6 } from "./round";

interface RawSummary {
  id: string;
  name: string;
  stats: Record<string, number>;
}

const growth = (
  stats: Record<string, number>,
  base: string,
  perLevel: string,
) => {
  const b = stats[base];
  const p = stats[perLevel];
  if (b === undefined || p === undefined)
    throw new Error(`no ${base}/${perLevel}`);
  return { base: round6(b), perLevel: round6(p) };
};

/**
 * BUILD-009: every champion as a target, defensive stats only. Data Dragon's summary for
 * most; kit champions keep their game-file stats.
 */
export function normalizeTargets(
  championList: unknown,
  kitChampions: Readonly<Record<string, ChampionData>>,
) {
  const list = (championList as { data: Record<string, RawSummary> }).data;
  return Object.fromEntries(
    Object.values(list).map((c) => {
      const kit = kitChampions[c.id];
      const stats = kit
        ? {
            health: kit.stats.health,
            armor: kit.stats.armor,
            magicResist: kit.stats.magicResist,
          }
        : {
            health: growth(c.stats, "hp", "hpperlevel"),
            armor: growth(c.stats, "armor", "armorperlevel"),
            magicResist: growth(c.stats, "spellblock", "spellblockperlevel"),
          };
      const range = kit ? kit.stats.attackRange.base : c.stats.attackrange;
      if (range === undefined) throw new Error(`${c.id}: no attack range`);
      return [c.id, { id: c.id, name: c.name, ranged: range > 250, stats }];
    }),
  );
}
