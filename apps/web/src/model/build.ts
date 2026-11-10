import type { AbilityKey, ChampionData, ItemData, PatchData } from "@lol/data";
import {
  abilityRanks,
  addItem,
  DEFAULT_RUNES,
  type RunePage,
  type Rotation,
} from "@lol/engine";

export type Ranks = Record<AbilityKey, number>;

export interface Build {
  id: string;
  name: string;
  champion: string;
  level: number;
  /** Edited skill ranks; undefined follows the skill order (BUILD-003). */
  ranks?: Ranks;
  /** Item ids in build order (BUILD-005). */
  items: string[];
  /** Long-term stacks by item id or champion passive (SIM-010). */
  stacks: Record<string, number>;
  /** Undefined: no runes. */
  runes?: RunePage;
  /** Undefined uses the champion's default rotation (ROT-007). */
  rotation?: Rotation;
  /** Attacker health, fraction of max (BUILD-012). */
  healthFraction: number;
}

export const MAX_LEVEL = 18;

/** BUILD-001: level 18, skill-order ranks, no items, default rune page and rotation. */
export function newBuild(id: string, champion: string, name = champion): Build {
  return {
    id,
    name,
    champion,
    level: MAX_LEVEL,
    items: [],
    stacks: {},
    runes: DEFAULT_RUNES[champion] && structuredClone(DEFAULT_RUNES[champion]),
    healthFraction: 1,
  };
}

/** BUILD-002: an independent copy named "X (copy)". */
export function duplicateBuild(build: Build, id: string): Build {
  return { ...structuredClone(build), id, name: `${build.name} (copy)` };
}

/** BUILD-003: edited ranks, or the skill order's ranks at the build's level. */
export function ranksOf(build: Build, champion: ChampionData): Ranks {
  return build.ranks ?? abilityRanks(champion, build.level);
}

/**
 * BUILD-004: points ≤ level, no ability above its max rank, and each R rank only from
 * its level requirement. Returns a message, or undefined when the ranks are valid.
 */
export function rankProblem(
  ranks: Ranks,
  level: number,
  champion: ChampionData,
  ultimateLevels: readonly number[],
): string | undefined {
  const keys = ["Q", "W", "E", "R"] as const;
  const total = keys.reduce((sum, k) => sum + ranks[k], 0);
  if (total > level)
    return `${String(total)} skill points at level ${String(level)}`;
  for (const k of keys) {
    const max = champion.abilities[k].maxRank;
    if (ranks[k] < 0 || ranks[k] > max)
      return `${k} rank must be 0 to ${String(max)}`;
  }
  const allowed = ultimateLevels.filter((l) => l <= level).length;
  if (ranks.R > allowed)
    return `R rank ${String(ranks.R)} needs level ${String(ultimateLevels[ranks.R - 1] ?? "?")}`;
  return undefined;
}

/** ITEM-002 / ITEM-003 / ITEM-010 via the engine's validation. */
export function withItem(
  build: Build,
  itemId: string,
  catalog: PatchData["items"],
): { ok: true; build: Build } | { ok: false; reason: string } {
  const result = addItem(build.items, itemId, catalog);
  return result.ok
    ? { ok: true, build: { ...build, items: result.items } }
    : result;
}

/** BUILD-005: remove the item at an index, keeping the rest in order. */
export const withoutItem = (build: Build, index: number): Build => ({
  ...build,
  items: build.items.filter((_, i) => i !== index),
});

/** BUILD-005: move the item at `from` to `to`. */
export function movedItem(build: Build, from: number, to: number): Build {
  const items = [...build.items];
  const [moved] = items.splice(from, 1);
  if (moved === undefined) return build;
  items.splice(to, 0, moved);
  return { ...build, items };
}

/** BUILD-006. */
export const totalGold = (
  build: Build,
  catalog: Readonly<Record<string, ItemData>>,
) => build.items.reduce((sum, id) => sum + (catalog[id]?.cost ?? 0), 0);
