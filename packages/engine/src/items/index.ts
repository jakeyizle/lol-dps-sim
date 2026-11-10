import type { ItemData } from "@lol/data";

import type { Effect } from "../core/effects";
import type { StatBonuses } from "../core/stats";

const STAT_KEYS = [
  "attackDamage",
  "abilityPower",
  "health",
  "mana",
  "armor",
  "magicResist",
  "attackSpeed",
  "critChance",
  "critDamage",
  "lethality",
  "armorPenPercent",
  "magicPenFlat",
  "magicPenPercent",
  "abilityHaste",
  "moveSpeed",
] as const satisfies readonly (keyof StatBonuses)[];

/** Item ids with passives or actives the engine models. Filled in by the item tickets. */
const EFFECTS: Partial<Record<string, (item: ItemData) => Effect>> = {};

/** The item's stats as engine bonuses (STAT-002). */
export function itemStats(item: ItemData): StatBonuses {
  const bonuses: StatBonuses = {};
  for (const key of STAT_KEYS) {
    const value = item.stats[key];
    if (value !== undefined) bonuses[key] = value;
  }
  return bonuses;
}

/** The item's modelled effects; none for stat-only items (ITEM-001). */
export function itemEffects(item: ItemData): Effect[] {
  const make = EFFECTS[item.id];
  return make ? [make(item)] : [];
}

/** Stats and effects of a build's items, in build order (SIM-024). */
export function equip(items: readonly ItemData[]) {
  return {
    bonuses: items.map(itemStats),
    effects: items.flatMap(itemEffects),
  };
}
