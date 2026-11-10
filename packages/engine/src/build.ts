import type { ItemData } from "@lol/data";

export const MAX_ITEMS = 6;
const BOOTS = "Boots";

export type AddItemResult =
  { ok: true; items: string[] } | { ok: false; reason: string };

/**
 * Adds an item to a build (attacker or target), enforcing the 6-item limit (ITEM-003),
 * one pair of boots (ITEM-010) and exclusive groups (ITEM-002, DATA-017).
 */
export function addItem(
  items: readonly string[],
  itemId: string,
  catalog: Readonly<Record<string, ItemData>>,
): AddItemResult {
  const item = catalog[itemId];
  if (!item) return { ok: false, reason: `Unknown item ${itemId}` };
  if (items.length >= MAX_ITEMS)
    return {
      ok: false,
      reason: `A build holds at most ${String(MAX_ITEMS)} items`,
    };

  for (const ownedId of items) {
    const owned = catalog[ownedId];
    if (!owned) continue;
    const shared = item.groups.filter((g) => owned.groups.includes(g));
    if (shared.includes(BOOTS))
      return {
        ok: false,
        reason: `The build already has boots: ${owned.name}`,
      };
    if (shared.length)
      return {
        ok: false,
        reason: `${item.name} can't be combined with ${owned.name}`,
      };
  }
  return { ok: true, items: [...items, itemId] };
}
