import type { ChampionData, ItemData } from "@lol/data";

import type { Effect } from "../core/effects";
import type { GameConstants, StatBonuses } from "../core/stats";
import {
  BLADE_OF_THE_RUINED_KING,
  bladeOfTheRuinedKing,
  KRAKEN_SLAYER,
  krakenSlayer,
  LORD_DOMINIKS_REGARDS,
  lordDominiksRegards,
} from "./batch1";
import {
  bonusEnergizeStacks,
  ENERGIZED_ITEMS,
  energizeMeter,
  GUINSOOS_RAGEBLADE,
  guinsoosRageblade,
  NAVORI_FLICKERBLADE,
  navoriFlickerblade,
  RAPID_FIRECANNON,
  rapidFirecannon,
  STATIKK_SHIV,
  statikkShiv,
  TERMINUS,
  terminus,
  THE_COLLECTOR,
  theCollector,
} from "./batch2";

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
  [THE_COLLECTOR]: theCollector,
  [GUINSOOS_RAGEBLADE]: guinsoosRageblade,
  [NAVORI_FLICKERBLADE]: navoriFlickerblade,
  [STATIKK_SHIV]: statikkShiv,
  [RAPID_FIRECANNON]: rapidFirecannon,
  [TERMINUS]: terminus,
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
/**
 * Stats and effects of a build's items, in build order (SIM-024). Builds with Energized
 * items get one shared meter (ITEM-018), which needs the patch constants.
 */
export function equip(
  items: readonly ItemData[],
  owner: ChampionData,
  constants?: GameConstants,
) {
  const effects = items.flatMap((item) => itemEffects(item, owner));
  if (items.some((i) => ENERGIZED_ITEMS.has(i.id))) {
    if (!constants) throw new Error("Energized items need the patch constants");
    const bonus = items.reduce((sum, i) => sum + bonusEnergizeStacks(i), 0);
    effects.push(energizeMeter(constants, bonus));
  }
  return { bonuses: items.map(itemStats), effects };
}
