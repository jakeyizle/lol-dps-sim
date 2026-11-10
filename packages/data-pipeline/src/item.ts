import { round6 } from "./round";

/** Game-file stat fields → engine `StatBonuses` names (percents are already fractions). */
const STAT_FIELDS: Record<string, string> = {
  mFlatPhysicalDamageMod: "attackDamage",
  mFlatMagicDamageMod: "abilityPower",
  mFlatHPPoolMod: "health",
  flatMPPoolMod: "mana",
  mFlatArmorMod: "armor",
  mFlatSpellBlockMod: "magicResist",
  mPercentAttackSpeedMod: "attackSpeed",
  mFlatCritChanceMod: "critChance",
  mFlatCritDamageMod: "critDamage",
  mFlatArmorPenetrationMod: "lethality",
  mPercentArmorPenetrationMod: "armorPenPercent",
  mFlatMagicPenetrationMod: "magicPenFlat",
  mPercentMagicPenetrationMod: "magicPenPercent",
  mAbilityHasteMod: "abilityHaste",
  mFlatMovementSpeedMod: "moveSpeed",
};

interface RawItem {
  __type?: string;
  mItemGroups?: string[];
  mDataValues?: { mName: string; mValue?: number }[];
  mItemCalculations?: Record<string, unknown>;
  [field: string]: unknown;
}

interface RawGroup {
  __type?: string;
  mItemGroupID?: string;
  mMaxGroupOwnable?: number;
}

interface RawDdragonItems {
  data: Record<string, { name: string; gold: { total: number } }>;
}

/** DATA-017: groups a build may hold only one item from (e.g. LastWhisper, Boots). */
function exclusiveGroups(item: RawItem, bin: Record<string, unknown>) {
  return (item.mItemGroups ?? []).flatMap((ref) => {
    const group = bin[ref] as RawGroup | undefined;
    return group?.mMaxGroupOwnable === 1 && group.mItemGroupID
      ? [group.mItemGroupID]
      : [];
  });
}

/** Raw sources → item data, unvalidated. */
export function normalizeItem(ddragon: unknown, bin: unknown, id: string) {
  const dd = (ddragon as RawDdragonItems).data[id];
  if (!dd) throw new Error(`Data Dragon has no item ${id}`);
  const binRecord = bin as Record<string, unknown>;
  const item = binRecord[`Items/${id}`] as RawItem | undefined;
  if (item?.__type !== "ItemData")
    throw new Error(`game file has no item ${id}`);

  const stats: Record<string, number> = {};
  const otherStats: Record<string, number> = {};
  for (const [field, value] of Object.entries(item)) {
    if (!field.endsWith("Mod") || typeof value !== "number") continue;
    const name = STAT_FIELDS[field];
    if (name) stats[name] = round6(value);
    else otherStats[field] = round6(value);
  }

  return {
    id,
    name: dd.name,
    cost: dd.gold.total,
    stats,
    /** Stats the engine doesn't model yet (lifesteal, tenacity, …). */
    otherStats,
    values: Object.fromEntries(
      (item.mDataValues ?? []).map((v) => [v.mName, round6(v.mValue ?? 0)]),
    ),
    calculations: item.mItemCalculations ?? {},
    groups: exclusiveGroups(item, binRecord),
  };
}
