import type { ItemData, RuneData, TargetChampion } from "@lol/data";

import { flatValues } from "./core/calc";
import type { DamageReduction } from "./core/damage";
import type { LowHealthShield, SimTarget } from "./core/sim";
import { levelValue, type SplitStat, type StatBonuses } from "./core/stats";
import { runeStats, type RunePage } from "./runes";

export const CONDITIONING = 8429;
export const RANDUINS_OMEN = "3143";
export const PLATED_STEELCAPS = "3047";
export const STERAKS_GAGE = "3053";
export const MAW_OF_MALMORTIUS = "3156";
export const GUARDIAN_ANGEL = "3026";
export const ZHONYAS_HOURGLASS = "3157";

/** Values the target side reads (DATA-012). */
export const targetRequiredValues = {
  [RANDUINS_OMEN]: ["values.PercentCritDamageReduction"],
  [PLATED_STEELCAPS]: ["values.BasicDamageReduction"],
  [STERAKS_GAGE]: [
    "values.LowHealthThreshold",
    "values.BaseShieldRatio",
    "values.ShieldDuration",
    "values.TimeBeforeDecay",
    "values.Cooldown",
  ],
  [MAW_OF_MALMORTIUS]: [
    "values.LowHealthThreshold",
    "values.ShieldSize",
    "values.ShieldADScaling",
    "values.RangedShieldMod",
    "values.ShieldDuration",
    "values.Cooldown",
  ],
  [GUARDIAN_ANGEL]: ["values.ReviveDelay", "values.ReviveBaseHealthRatio"],
  [ZHONYAS_HOURGLASS]: ["values.Duration"],
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
    // Stryker disable next-line ArrayDeclaration: summing bonuses skips a junk element
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

export interface DefenseSetup {
  stats: DefenderStats;
  /** Bonus AD from the target's items (Maw of Malmortius). */
  bonusAttackDamage: number;
  ranged: boolean;
  /** TGT-010, TGT-011: Zhonya's at this fraction of max health, or null for never. */
  zhonyaBelow: number | null;
}

type Defenses = Pick<SimTarget, "lowHealthShields" | "revive" | "stasis"> & {
  critDamageReduction?: number;
  reductions: DamageReduction[];
};

/** TGT-006–011: what the target's items do when it takes damage. */
export function targetDefenses(
  items: readonly ItemData[],
  setup: DefenseSetup,
): Defenses {
  const reductions: DamageReduction[] = [];
  // Stryker disable next-line ArrayDeclaration: a junk shield has no trigger, so it never triggers
  const shields: LowHealthShield[] = [];
  const defenses: Defenses = { reductions };
  for (const item of items) {
    const value = flatValues(item.values);
    switch (item.id) {
      case RANDUINS_OMEN:
        // TGT-006: the whole critical strike (DMG-014).
        defenses.critDamageReduction = value("PercentCritDamageReduction");
        break;
      case PLATED_STEELCAPS:
        // TGT-007: basic attack damage, not on-hit effects.
        reductions.push({
          // Stryker disable next-line StringLiteral: any value but "all" means auto attacks only
          appliesTo: "autoAttack",
          fraction: value("BasicDamageReduction"),
        });
        break;
      case STERAKS_GAGE:
        // TGT-008, TGT-013: a share of bonus health, decaying after a delay.
        shields.push({
          id: "SteraksGage",
          below: value("LowHealthThreshold"),
          trigger: "all",
          amount: value("BaseShieldRatio") * setup.stats.health.bonus,
          blocks: "all",
          duration: value("ShieldDuration"),
          decayAfter: value("TimeBeforeDecay"),
          cooldown: value("Cooldown"),
        });
        break;
      case MAW_OF_MALMORTIUS:
        // TGT-014: triggered by and absorbing magic damage only.
        shields.push({
          id: "MawOfMalmortius",
          below: value("LowHealthThreshold"),
          trigger: "magic",
          amount:
            (value("ShieldSize") +
              value("ShieldADScaling") * setup.bonusAttackDamage) *
            (setup.ranged ? value("RangedShieldMod") : 1),
          blocks: "magic",
          duration: value("ShieldDuration"),
          cooldown: value("Cooldown"),
        });
        break;
      case GUARDIAN_ANGEL:
        defenses.revive = {
          delay: value("ReviveDelay"),
          health: value("ReviveBaseHealthRatio") * setup.stats.health.base,
        };
        break;
      case ZHONYAS_HOURGLASS:
        // Stryker disable next-line ConditionalExpression: a null threshold never triggers (health < 0 never holds)
        if (setup.zhonyaBelow !== null)
          defenses.stasis = {
            below: setup.zhonyaBelow,
            duration: value("Duration"),
          };
        break;
    }
  }
  defenses.lowHealthShields = shields;
  return defenses;
}
