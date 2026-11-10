import { round6 } from "./round";

interface RawPerk {
  __type?: string;
  mPerkId?: number;
  mPerkName?: string;
  mScript?: { mSpellScriptData?: { mEffectAmount?: Record<string, number> } };
}

interface RawPerkName {
  id: number;
  name: string;
}

interface RawTree {
  id: number;
  key: string;
  name: string;
  slots: { runes: { id: number }[] }[];
}

/** Raw sources → rune data, unvalidated. Stat shards are runes too (e.g. 5005). */
export function normalizeRune(bin: unknown, names: unknown, id: number) {
  const perk = Object.values(bin as Record<string, RawPerk>).find(
    (o) => o.__type === "Perk" && o.mPerkId === id,
  );
  if (!perk) throw new Error(`game file has no rune ${String(id)}`);
  const name = (names as RawPerkName[]).find((p) => p.id === id)?.name;
  if (!name) throw new Error(`no display name for rune ${String(id)}`);
  const amounts = perk.mScript?.mSpellScriptData?.mEffectAmount ?? {};
  return {
    id,
    key: perk.mPerkName ?? String(id),
    name,
    values: Object.fromEntries(
      Object.entries(amounts).map(([k, v]) => [k, round6(v)]),
    ),
  };
}

/** Rune trees and their slots (rune ids per row; row 0 is the keystone row). */
export function normalizeTrees(runesReforged: unknown) {
  return (runesReforged as RawTree[]).map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    slots: t.slots.map((s) => s.runes.map((r) => r.id)),
  }));
}
