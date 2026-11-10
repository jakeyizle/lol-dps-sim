import type { AbilityKey } from "@lol/data";

import { round6 } from "./round";

interface RawSpell {
  DataValues?: { name: string; values?: number[] }[];
  /** Older-style numbered values, read by `EffectValueCalculationPart` (1-based). */
  mEffectAmount?: { value?: number[] }[];
  mSpellCalculations?: Record<string, unknown>;
  cooldownTime?: number[];
  mana?: number[];
  mCastTime?: number;
}

type RawBin = Record<string, { __type?: string; mSpell?: RawSpell }>;

const KEYS: AbilityKey[] = ["Q", "W", "E", "R"];

/** Game files don't store max ranks; these hold for every MVP champion. */
const maxRankOf = (key: AbilityKey) => (key === "R" ? 3 : 5);

function findSpell(bin: RawBin, path: string): RawSpell {
  const entry = Object.entries(bin).find(
    ([key, o]) =>
      o.__type === "SpellObject" &&
      (key === path || key.endsWith(`/Spells/${path}`)),
  );
  if (!entry?.[1].mSpell) throw new Error(`game file has no spell ${path}`);
  return entry[1].mSpell;
}

function valuesOf(
  spell: RawSpell,
  pick: (v: number[]) => number[],
): Record<string, number[]> {
  const entries: [string, number[]][] = [
    ...(spell.DataValues ?? []).map((v): [string, number[]] => [
      v.name,
      // a value with no list is zero at every rank
      pick(v.values ?? Array<number>(7).fill(0)).map(round6),
    ]),
    // Effect amounts as `Effect1`, `Effect2`, … (empty slots skipped).
    ...(spell.mEffectAmount ?? []).flatMap((e, i): [string, number[]][] =>
      e.value ? [[`Effect${String(i + 1)}`, pick(e.value).map(round6)]] : [],
    ),
  ];
  return Object.fromEntries(entries);
}

/**
 * DATA-004. Value and cooldown lists start at rank 0 (index 0 is unused);
 * mana lists start at rank 1.
 */
function normalizeAbility(spell: RawSpell, key: AbilityKey) {
  const maxRank = maxRankOf(key);
  const ranks = (list: number[]) => list.slice(1, maxRank + 1);
  return {
    maxRank,
    cooldown: ranks(spell.cooldownTime ?? []).map(round6),
    cost: (spell.mana ?? Array<number>(maxRank).fill(0))
      .slice(0, maxRank)
      .map(round6),
    castTime: round6(spell.mCastTime ?? 0),
    values: valuesOf(spell, ranks),
    calculations: spell.mSpellCalculations ?? {},
  };
}

/** Abilities named by the record's `spellNames` (Q, W, E, R order) and its passive spell. */
export function normalizeAbilities(
  bin: unknown,
  spellNames: readonly string[] | undefined,
  passivePath: string | undefined,
) {
  const raw = bin as RawBin;
  if (spellNames?.length !== 4)
    throw new Error("game file does not list 4 spells");
  const abilities = Object.fromEntries(
    KEYS.map((key, i) => [
      key,
      normalizeAbility(findSpell(raw, spellNames[i] ?? ""), key),
    ]),
  );
  const passive = passivePath ? findSpell(raw, passivePath) : {};
  return {
    abilities,
    passive: {
      values: valuesOf(passive, (v) => v),
      calculations: passive.mSpellCalculations ?? {},
    },
  };
}
