import type { ChampionData, RuneData, RuneTree } from "@lol/data";

import { flatValues, levelInterpolation } from "../core/calc";
import type { Effect } from "../core/effects";
import type { StatBonuses } from "../core/stats";
import {
  CONQUEROR,
  conqueror,
  HAIL_OF_BLADES,
  hailOfBlades,
  LETHAL_TEMPO,
  lethalTempo,
  PRESS_THE_ATTACK,
  pressTheAttack,
} from "./keystones";
import type { LongTermStack } from "../items";
import {
  ABSOLUTE_FOCUS,
  absoluteFocus,
  COUP_DE_GRACE,
  coupDeGrace,
  CUT_DOWN,
  cutDown,
  GATHERING_STORM,
  gatheringStorm,
  LAST_STAND,
  lastStand,
  LEGEND_ALACRITY,
  legendAlacrity,
} from "./minor";

/** A rune page: primary tree (keystone + one rune per other row), secondary tree (2), 3 shards. */
export interface RunePage {
  primary: number;
  keystone: number;
  /** One per primary row after the keystone row, in row order. */
  primaryRunes: number[];
  secondary: number;
  /** Two runes from different non-keystone rows of the secondary tree. */
  secondaryRunes: number[];
  /** Offense, flex, defense. */
  shards: number[];
}

/** RUNE-001: returns a message, or undefined for a valid page. */
export function pageProblem(
  page: RunePage,
  trees: readonly RuneTree[],
  shardRows: readonly (readonly number[])[],
): string | undefined {
  const primary = trees.find((t) => t.id === page.primary);
  const secondary = trees.find((t) => t.id === page.secondary);
  if (!primary || !secondary) return "Pick a primary and a secondary tree";
  if (primary.id === secondary.id)
    return "The secondary tree must differ from the primary";
  const [keystones = [], ...rows] = primary.slots;
  if (!keystones.includes(page.keystone)) return "Pick one keystone";
  if (
    page.primaryRunes.length !== rows.length ||
    rows.some((row, i) => !row.includes(page.primaryRunes[i] ?? NaN))
  )
    return "Pick one rune per row of the primary tree";
  const secondaryRows = page.secondaryRunes.map((id) =>
    secondary.slots.findIndex((row, i) => i > 0 && row.includes(id)),
  );
  if (
    secondaryRows.length !== 2 ||
    secondaryRows.some((r) => r < 0) ||
    secondaryRows[0] === secondaryRows[1]
  )
    return "Pick two runes from different rows of the secondary tree";
  if (
    page.shards.length !== shardRows.length ||
    shardRows.some((row, i) => !row.includes(page.shards[i] ?? NaN))
  )
    return "Pick one shard per row";
  return undefined;
}

/**
 * RUNE-002: a shard's stats. Adaptive goes to AP only when the build has more bonus AP
 * than bonus AD; health scaling grows linearly from level 1 to 18.
 */
export function shardStats(
  shard: RuneData,
  level: number,
  prefersAP = false,
): StatBonuses {
  const value = flatValues(shard.values);
  switch (shard.key) {
    case "Adaptive":
      return prefersAP
        ? { abilityPower: value("StatGain2") }
        : { attackDamage: value("StatGain1") };
    case "AttackSpeed":
      return { attackSpeed: value("StatGain") / 100 };
    case "CDRScaling":
      return { abilityHaste: value("HasteGain") };
    case "HealthScaling": {
      const min = value("StatGainMin");
      const max = value("StatGainMax");
      return { health: levelInterpolation(min, max, level) };
    }
    case "Health":
      return { health: value("StatGain") };
    case "Armor":
      return { armor: value("StatGain") };
    case "MagicRes":
      return { magicResist: value("StatGain") };
    default:
      // Move speed and tenacity don't change damage against one target.
      return {};
  }
}

/** Stats from a page's shards (keystones and runes add theirs as effects). */
export function runeStats(
  page: RunePage,
  runes: Readonly<Record<string, RuneData>>,
  level: number,
  prefersAP = false,
): StatBonuses[] {
  return page.shards.flatMap((id) => {
    const shard = runes[String(id)];
    return shard ? [shardStats(shard, level, prefersAP)] : [];
  });
}

type MakeRuneEffect = (
  rune: RuneData,
  owner: ChampionData,
  stacks: number,
) => Effect;

/** Rune ids with modelled effects. */
const EFFECTS: Partial<Record<number, MakeRuneEffect>> = {
  [LETHAL_TEMPO]: lethalTempo,
  [PRESS_THE_ATTACK]: pressTheAttack,
  [HAIL_OF_BLADES]: hailOfBlades,
  [CONQUEROR]: conqueror,
  [CUT_DOWN]: cutDown,
  [COUP_DE_GRACE]: coupDeGrace,
  [LAST_STAND]: lastStand,
  [ABSOLUTE_FOCUS]: absoluteFocus,
  [GATHERING_STORM]: gatheringStorm,
  [LEGEND_ALACRITY]: (rune, _owner, stacks) => legendAlacrity(rune, stacks),
};

/** BUILD-007: the rune's long-term stack input (keyed by rune id), if it has one. */
export function runeLongTermStack(rune: RuneData): LongTermStack | undefined {
  if (rune.id !== LEGEND_ALACRITY) return undefined;
  return {
    id: String(rune.id),
    label: `${rune.name} stacks`,
    max: flatValues(rune.values)("MaxLegendStacks"),
  };
}

/** Effects of a page's runes, in page order (SIM-024); `stacks` by rune id (RUNE-009). */
export function runeEffects(
  page: RunePage,
  runes: Readonly<Record<string, RuneData>>,
  owner: ChampionData,
  stacks: Readonly<Record<string, number>> = {},
): Effect[] {
  return [page.keystone, ...page.primaryRunes, ...page.secondaryRunes].flatMap(
    (id) => {
      const rune = runes[String(id)];
      const make = EFFECTS[id];
      return rune && make ? [make(rune, owner, stacks[String(id)] ?? 0)] : [];
    },
  );
}
