import type { ItemData, PatchData, RuneTree } from "@lol/data";
import {
  defenderStats,
  itemStats,
  targetDefenses,
  type DefenderStats,
  type DefensiveStat,
  type RunePage,
  type SimTarget,
} from "@lol/engine";

/** TGT-002: a custom dummy with entered stats. */
export interface DummyTarget {
  kind: "dummy";
  health: number;
  armor: number;
  magicResist: number;
  /** Fraction of all damage removed, e.g. 0.1 for 10%. */
  damageReduction: number;
}

/** TGT-001: any champion (BUILD-009) with its level, items, runes and stat overrides. */
export interface ChampionTarget {
  kind: "champion";
  champion: string;
  level: number;
  items: string[];
  runes?: RunePage;
  /** TGT-003: replaces the stat's total. */
  overrides: Partial<Record<DefensiveStat, number>>;
  /** TGT-010, TGT-011: Zhonya's activates below this fraction of health; null for never. */
  zhonyaBelow: number | null;
}

export const DEFAULT_ZHONYA_BELOW = 0.3;

export type Target = DummyTarget | ChampionTarget;

export interface TargetPreset {
  name: string;
  target: Target;
}

export const defaultDummy: DummyTarget = {
  kind: "dummy",
  health: 3000,
  armor: 100,
  magicResist: 50,
  damageReduction: 0,
};

const champion = (
  id: string,
  level: number,
  items: string[],
): ChampionTarget => ({
  kind: "champion",
  champion: id,
  level,
  items,
  overrides: {},
  zhonyaBelow: DEFAULT_ZHONYA_BELOW,
});

/** A new champion target with no items. */
export const championTarget = (id: string) => champion(id, 13, []);

/**
 * TGT-004: shipped presets, mid-game (level 13) champions with defensive items
 * (Plated Steelcaps, Sterak's Gage, Spirit Visage, Randuin's Omen, Thornmail, Frozen Heart).
 */
export const shippedPresets: readonly TargetPreset[] = [
  { name: "Squishy", target: champion("Lux", 13, []) },
  { name: "Bruiser", target: champion("Garen", 13, ["3047", "3053", "3065"]) },
  {
    name: "Tank",
    target: champion("Ornn", 13, ["3047", "3143", "3075", "3110"]),
  },
];

/** A valid page from the first options of each row (a target's starting page). */
export function firstPage(
  trees: readonly RuneTree[],
  shards: readonly (readonly number[])[],
): RunePage | undefined {
  const [primary, secondary] = trees;
  if (!primary || !secondary) return undefined;
  // Stryker disable next-line OptionalChaining: firstPage only reads rows that exist
  const first = (row: readonly number[] | undefined) => row?.[0] ?? 0;
  return {
    primary: primary.id,
    keystone: first(primary.slots[0]),
    primaryRunes: primary.slots.slice(1).map(first),
    secondary: secondary.id,
    secondaryRunes: secondary.slots.slice(1, 3).map(first),
    shards: shards.map(first),
  };
}

/** The champion target's defensive stats. */
export function championTargetStats(
  target: ChampionTarget,
  patch: PatchData,
  gameTime: number,
): DefenderStats {
  const data = patch.targets[target.champion];
  if (!data) throw new Error(`${target.champion} is not in the patch data`);
  return defenderStats(
    {
      champion: data,
      level: target.level,
      bonuses: targetItems(target, patch).map(itemStats),
      runes: target.runes,
      gameTime,
      overrides: target.overrides,
    },
    patch.runes,
  );
}

const targetItems = (target: ChampionTarget, patch: PatchData) =>
  target.items
    .map((id) => patch.items[id])
    .filter((i): i is ItemData => i !== undefined);

/** The engine's target for either kind. */
export function toSimTarget(
  target: Target,
  patch: PatchData,
  gameTime: number,
): SimTarget {
  if (target.kind === "dummy")
    return {
      maxHealth: target.health,
      defender: {
        armor: target.armor,
        magicResist: target.magicResist,
        reductions:
          target.damageReduction > 0
            ? [{ appliesTo: "all", fraction: target.damageReduction }]
            : [],
      },
      // Practice Tool dummies count as champions (Kraken Slayer, keystones).
      champion: true,
    };
  const stats = championTargetStats(target, patch, gameTime);
  const items = targetItems(target, patch);
  const { critDamageReduction, reductions, ...defenses } = targetDefenses(
    items,
    {
      stats,
      bonusAttackDamage: items.reduce(
        (sum, i) => sum + (itemStats(i).attackDamage ?? 0),
        0,
      ),
      // Stryker disable next-line LogicalOperator,OptionalChaining,BooleanLiteral: championTargetStats has already thrown for unknown champions
      ranged: patch.targets[target.champion]?.ranged ?? false,
      zhonyaBelow: target.zhonyaBelow,
    },
  );
  return {
    maxHealth: stats.health.total,
    bonusHealth: Math.max(0, stats.health.bonus),
    defender: {
      armor: stats.armor.total,
      magicResist: stats.magicResist.total,
      critDamageReduction,
      reductions,
    },
    ...defenses,
    champion: true,
  };
}

/** A display name: the champion's, or "Target dummy". */
export function targetName(target: Target, patch: PatchData) {
  return target.kind === "dummy"
    ? "Target dummy"
    : (patch.targets[target.champion]?.name ?? target.champion);
}
