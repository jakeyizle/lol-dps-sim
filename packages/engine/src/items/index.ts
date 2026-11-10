import type { ChampionData, ItemData } from "@lol/data";

import type { Effect } from "../core/effects";
import type { StatBonuses } from "../core/stats";
import {
  BLADE_OF_THE_RUINED_KING,
  bladeOfTheRuinedKing,
  KRAKEN_SLAYER,
  krakenSlayer,
  LORD_DOMINIKS_REGARDS,
  lordDominiksRegards,
} from "./batch1";

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

type MakeEffect = (item: ItemData, owner: ChampionData) => Effect;

/** Item ids with passives or actives the engine models. */
const EFFECTS: Partial<Record<string, MakeEffect>> = {
  [KRAKEN_SLAYER]: krakenSlayer,
  [BLADE_OF_THE_RUINED_KING]: bladeOfTheRuinedKing,
  [LORD_DOMINIKS_REGARDS]: lordDominiksRegards,
};

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
export function itemEffects(item: ItemData, owner: ChampionData): Effect[] {
  const make = EFFECTS[item.id];
  return make ? [make(item, owner)] : [];
}

/** Stats and effects of a build's items, in build order (SIM-024). */
export function equip(items: readonly ItemData[], owner: ChampionData) {
  return {
    bonuses: items.map(itemStats),
    effects: items.flatMap((item) => itemEffects(item, owner)),
  };
}
