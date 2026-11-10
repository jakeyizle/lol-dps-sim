import type { AttackSlot } from "@lol/data";

/** Removes float32 noise from game values (DATA-014). */
export const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** The engine's default windup when a slot gives only a cast offset (DATA-011). */
const BASE_WINDUP = 0.3;

interface RawSlot {
  mAttackName?: string;
  mAttackCastTime?: number;
  mAttackTotalTime?: number;
  mAttackDelayCastOffsetPercent?: number;
  mAttackDelayCastOffsetPercentAttackSpeedRatio?: number;
}

type RawFloat = number | { baseValue?: number } | undefined;

interface RawCharacterRecord {
  __type: "CharacterRecord";
  baseHPModifiable?: RawFloat;
  hpPerLevelModifiable?: RawFloat;
  baseStaticHPRegenModifiable?: RawFloat;
  hpRegenPerLevelModifiable?: RawFloat;
  baseDamageModifiable?: RawFloat;
  damagePerLevelModifiable?: RawFloat;
  baseArmorModifiable?: RawFloat;
  armorPerLevelModifiable?: RawFloat;
  baseMR?: RawFloat;
  mrPerLevel?: RawFloat;
  baseMoveSpeedModifiable?: RawFloat;
  attackRangeModifiable?: RawFloat;
  attackSpeedModifiable?: RawFloat;
  attackSpeedRatioModifiable?: RawFloat;
  attackSpeedPerLevelModifiable?: RawFloat;
  critDamageMultiplier?: number;
  basicAttack?: RawSlot;
  extraAttacks?: RawSlot[];
  critAttacks?: RawSlot[];
}

/** Data Dragon gives regen per 5 seconds. */
interface RawDdragonStats {
  hp: number;
  hpperlevel: number;
  hpregen: number;
  hpregenperlevel: number;
  mp: number;
  mpperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackrange: number;
  movespeed: number;
}

interface RawDdragonChampion {
  data: Record<
    string,
    { id: string; key: string; name: string; stats: RawDdragonStats }
  >;
}

const float = (v: RawFloat) => (typeof v === "number" ? v : v?.baseValue);
const maybeRound = (v: number | undefined) =>
  v === undefined ? undefined : round6(v);

function findRecord(bin: unknown): RawCharacterRecord {
  const record = Object.values(bin as Record<string, { __type?: string }>).find(
    (o) => o.__type === "CharacterRecord",
  );
  if (!record) throw new Error("game file has no CharacterRecord");
  return record as RawCharacterRecord;
}

/**
 * A slot uses its own timing format, taking any field it lacks from the basic attack (DATA-018);
 * a slot with no timing of its own copies the basic attack's.
 */
function resolveSlot(slot: RawSlot, basic: RawSlot): AttackSlot {
  const windupModifier =
    slot.mAttackDelayCastOffsetPercentAttackSpeedRatio ??
    basic.mAttackDelayCastOffsetPercentAttackSpeedRatio ??
    1;
  const ownCastTotal =
    slot.mAttackCastTime !== undefined || slot.mAttackTotalTime !== undefined;
  const ownOffset = slot.mAttackDelayCastOffsetPercent !== undefined;
  const timing = ownCastTotal || ownOffset ? slot : basic;

  let windupPercent: number;
  if (timing.mAttackDelayCastOffsetPercent !== undefined && !ownCastTotal) {
    windupPercent = BASE_WINDUP + timing.mAttackDelayCastOffsetPercent;
  } else {
    const cast = timing.mAttackCastTime ?? basic.mAttackCastTime;
    const total = timing.mAttackTotalTime ?? basic.mAttackTotalTime;
    if (cast === undefined || total === undefined)
      throw new Error(
        `attack slot ${slot.mAttackName ?? "basic"} has no resolvable windup`,
      );
    windupPercent = cast / total;
  }
  return {
    windupPercent: round6(windupPercent),
    windupModifier: round6(windupModifier),
  };
}

/** Game files give regen per second; we store it per 5 seconds like the game's UI. */
const per5 = (v: number | undefined) =>
  v === undefined ? undefined : round6(v * 5);

/** Game-file stats (DATA-019), paired with Data Dragon's value for DATA-020. */
function gameStats(r: RawCharacterRecord, s: RawDdragonStats) {
  const g = (v: RawFloat) => maybeRound(float(v));
  return {
    health: [
      g(r.baseHPModifiable),
      s.hp,
      g(r.hpPerLevelModifiable),
      s.hpperlevel,
    ],
    healthRegen: [
      per5(float(r.baseStaticHPRegenModifiable)),
      s.hpregen,
      per5(float(r.hpRegenPerLevelModifiable)),
      s.hpregenperlevel,
    ],
    attackDamage: [
      g(r.baseDamageModifiable),
      s.attackdamage,
      g(r.damagePerLevelModifiable),
      s.attackdamageperlevel,
    ],
    armor: [
      g(r.baseArmorModifiable),
      s.armor,
      g(r.armorPerLevelModifiable),
      s.armorperlevel,
    ],
    magicResist: [
      g(r.baseMR),
      s.spellblock,
      g(r.mrPerLevel),
      s.spellblockperlevel,
    ],
    moveSpeed: [g(r.baseMoveSpeedModifiable), s.movespeed, 0, 0],
    attackRange: [g(r.attackRangeModifiable), s.attackrange, 0, 0],
  } as const;
}

export interface NormalizedChampion {
  /** Unvalidated; the pipeline validates it with zod. */
  data: unknown;
  /** Source disagreements (DATA-020). */
  warnings: string[];
}

export function normalizeChampion(
  ddragon: unknown,
  bin: unknown,
  id: string,
): NormalizedChampion {
  const dd = (ddragon as RawDdragonChampion).data[id];
  if (!dd) throw new Error(`Data Dragon file has no champion ${id}`);
  const record = findRecord(bin);
  const basic = record.basicAttack ?? {};
  const s = dd.stats;

  const warnings: string[] = [];
  const stats: Record<string, { base?: number; perLevel?: number }> = {};
  for (const [stat, [base, ddBase, perLevel, ddPerLevel]] of Object.entries(
    gameStats(record, s),
  )) {
    stats[stat] = { base, perLevel };
    for (const [field, game, dragon] of [
      ["base", base, ddBase],
      ["perLevel", perLevel, ddPerLevel],
    ] as const) {
      if (game !== undefined && game !== round6(dragon))
        warnings.push(
          `${id}: ${stat}.${field}: game file ${String(game)}, Data Dragon ${String(dragon)}`,
        );
    }
  }

  const slots: Record<string, AttackSlot> = {
    basic: resolveSlot(basic, basic),
  };
  for (const slot of [
    ...(record.extraAttacks ?? []),
    ...(record.critAttacks ?? []),
  ]) {
    if (slot.mAttackName && !(slot.mAttackName in slots))
      slots[slot.mAttackName] = resolveSlot(slot, basic);
  }
  const critSlot =
    record.critAttacks?.find((c) => c.mAttackName)?.mAttackName ?? "basic";

  const data = {
    id: dd.id,
    key: Number(dd.key),
    name: dd.name,
    stats: {
      ...stats,
      mana: { base: s.mp, perLevel: s.mpperlevel },
      manaRegen: { base: s.mpregen, perLevel: s.mpregenperlevel },
    },
    attack: {
      baseAttackSpeed: maybeRound(float(record.attackSpeedModifiable)),
      attackSpeedRatio: maybeRound(float(record.attackSpeedRatioModifiable)),
      attackSpeedPerLevel: maybeRound(
        float(record.attackSpeedPerLevelModifiable),
      ),
      critMultiplier: maybeRound(record.critDamageMultiplier),
      slots,
      critSlot,
    },
  };
  return { data, warnings };
}
