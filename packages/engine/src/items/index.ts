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
import {
  ESSENCE_REAVER,
  essenceReaver,
  FIENDHUNTER_BOLTS,
  fiendhunterBolts,
  HEXOPTICS_C44,
  hexopticsC44,
  NASHORS_TOOTH,
  nashorsTooth,
  STORMRAZOR,
  stormrazor,
  WITS_END,
  witsEnd,
  YUN_TAL_WILDARROWS,
  yunTalWildarrows,
} from "./batch3";

/** Items that use the Energized meter (ITEM-018). */
const ENERGIZED_ITEMS: ReadonlySet<string> = new Set([
  STATIKK_SHIV,
  RAPID_FIRECANNON,
  STORMRAZOR,
]);

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

/** `stacks`: the item's long-term stacks from the build (SIM-010), e.g. Yun Tal's crit. */
type MakeEffect = (
  item: ItemData,
  owner: ChampionData,
  stacks: number,
) => Effect;

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
  [NASHORS_TOOTH]: nashorsTooth,
  [WITS_END]: witsEnd,
  [YUN_TAL_WILDARROWS]: yunTalWildarrows,
  [STORMRAZOR]: stormrazor,
  [HEXOPTICS_C44]: hexopticsC44,
  [FIENDHUNTER_BOLTS]: fiendhunterBolts,
  [ESSENCE_REAVER]: essenceReaver,
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
export function itemEffects(
  item: ItemData,
  owner: ChampionData,
  stacks = 0,
): Effect[] {
  const make = EFFECTS[item.id];
  return make ? [make(item, owner, stacks)] : [];
}

/**
 * Stats and effects of a build's items, in build order (SIM-024). Builds with Energized
 * items get one shared meter (ITEM-018), which needs the patch constants.
 */
export function equip(
  items: readonly ItemData[],
  owner: ChampionData,
  constants?: GameConstants,
  /** Long-term stacks by item id (SIM-010). */
  stacks: Readonly<Record<string, number>> = {},
) {
  const effects = items.flatMap((item) =>
    itemEffects(item, owner, stacks[item.id] ?? 0),
  );
  if (items.some((i) => ENERGIZED_ITEMS.has(i.id))) {
    if (!constants) throw new Error("Energized items need the patch constants");
    const bonus = items.reduce((sum, i) => sum + bonusEnergizeStacks(i), 0);
    effects.push(energizeMeter(constants, bonus));
  }
  return { bonuses: items.map(itemStats), effects };
}
