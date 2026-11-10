import type { RuneData, TargetChampion } from "@lol/data";

import { flatValues } from "./core/calc";
import { levelValue, type SplitStat, type StatBonuses } from "./core/stats";
import { runeStats, type RunePage } from "./runes";

export const CONDITIONING = 8429;

/** Rune values the target side reads (DATA-012). */
export const targetRequiredValues = {
  [CONDITIONING]: [
    "values.ArmorBase",
    "values.MRBase",
    "values.ExtraResist",
    "values.MinutesRequired",
  ],
} as const;

export type DefensiveStat = "health" | "armor" | "magicResist";

/** A champion target's defensive stats (TGT-001). */
export type DefenderStats = Record<DefensiveStat, SplitStat>;

/**
 * Champions whose own defensive kit (passives, abilities) is modelled as a target.
 * None yet: every champion target is "stats only" (BUILD-009).
 */
const DEFENSIVE_KITS: ReadonlySet<string> = new Set();

export const hasDefensiveKit = (champion: string) =>
  DEFENSIVE_KITS.has(champion);

export interface ChampionTargetSetup {
  champion: TargetChampion;
  level: number;
  /** Item stats, already converted (`itemStats`). */
  bonuses: readonly StatBonuses[];
  runes?: RunePage;
  /** Minutes (BUILD-013), for runes like Conditioning (TGT-012). */
  gameTime: number;
  /** Replace a stat's total (TGT-003). */
  overrides?: Partial<Record<DefensiveStat, number>>;
}

const KEYS: readonly DefensiveStat[] = ["health", "armor", "magicResist"];

/** TGT-001, TGT-003, TGT-012: level growth + items + runes, then overrides. */
export function defenderStats(
  setup: ChampionTargetSetup,
  runes: Readonly<Record<string, RuneData>>,
): DefenderStats {
  const { champion, level, runes: page } = setup;
  const bonuses = [
    ...setup.bonuses,
    ...(page ? runeStats(page, runes, level) : []),
  ];
  const sum = (key: DefensiveStat) =>
    bonuses.reduce((total, b) => total + (b[key] ?? 0), 0);
  const grown = (key: DefensiveStat): SplitStat => {
    const growth = champion.stats[key];
    const base = levelValue(growth.base, growth.perLevel, level);
    const bonus = sum(key);
    return { base, bonus, total: base + bonus };
  };
  const stats: DefenderStats = {
    health: grown("health"),
    armor: grown("armor"),
    magicResist: grown("magicResist"),
  };

  const conditioning = runes[String(CONDITIONING)];
  if (conditioning && page && pageRunes(page).includes(CONDITIONING)) {
    const add = conditioningStats(conditioning, setup.gameTime, stats);
    for (const key of ["armor", "magicResist"] as const) {
      const extra = add[key] ?? 0;
      stats[key] = {
        ...stats[key],
        bonus: stats[key].bonus + extra,
        total: stats[key].total + extra,
      };
    }
  }

  for (const key of KEYS) {
    const value = setup.overrides?.[key];
    if (value === undefined) continue;
    stats[key] = {
      base: stats[key].base,
      bonus: value - stats[key].base,
      total: value,
    };
  }
  return stats;
}

const pageRunes = (page: RunePage) => [
  page.keystone,
  ...page.primaryRunes,
  ...page.secondaryRunes,
];

/** TGT-012: after its minutes, flat armor and MR plus a percent of the totals. */
export function conditioningStats(
  rune: RuneData,
  gameTime: number,
  current: Pick<DefenderStats, "armor" | "magicResist">,
): StatBonuses {
  const value = flatValues(rune.values);
  if (gameTime < value("MinutesRequired")) return {};
  return {
    armor: value("ArmorBase") + value("ExtraResist") * current.armor.total,
    magicResist:
      value("MRBase") + value("ExtraResist") * current.magicResist.total,
  };
}
