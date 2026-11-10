import { z } from "zod";

/** A stat with a level-1 value and growth per level (PLAN §6, STAT-001). */
export const StatGrowth = z.object({
  base: z.number(),
  perLevel: z.number(),
});
export type StatGrowth = z.infer<typeof StatGrowth>;

export const AttackSlot = z.object({
  /** Fraction of the attack time spent winding up, at base attack speed. */
  windupPercent: z.number().positive().lt(1),
  /** How much windup shrinks with attack speed; 1 = fully (SIM-002). */
  windupModifier: z.number().min(0),
});
export type AttackSlot = z.infer<typeof AttackSlot>;

export const AbilityKey = z.enum(["Q", "W", "E", "R"]);
export type AbilityKey = z.infer<typeof AbilityKey>;

/** Per-rank lists hold ranks 1…maxRank in order (DATA-004). */
export const Ability = z
  .object({
    maxRank: z.number().int().min(1),
    cooldown: z.array(z.number().min(0)),
    cost: z.array(z.number().min(0)),
    castTime: z.number().min(0),
    values: z.record(z.string(), z.array(z.number())),
    /** Raw game formulas (ratios); normalized when the first kit needs them. */
    calculations: z.record(z.string(), z.unknown()),
  })
  .refine(
    (a) =>
      [a.cooldown, a.cost, ...Object.values(a.values)].every(
        (list) => list.length === a.maxRank,
      ),
    { message: "per-rank lists must have maxRank entries" },
  );
export type Ability = z.infer<typeof Ability>;

export const ChampionData = z
  .object({
    id: z.string().min(1),
    key: z.number().int().positive(),
    name: z.string().min(1),
    stats: z.object({
      health: StatGrowth,
      healthRegen: StatGrowth,
      mana: StatGrowth,
      manaRegen: StatGrowth,
      armor: StatGrowth,
      magicResist: StatGrowth,
      attackDamage: StatGrowth,
      attackRange: StatGrowth,
      moveSpeed: StatGrowth,
    }),
    attack: z.object({
      baseAttackSpeed: z.number().positive(),
      attackSpeedRatio: z.number().positive(),
      /** Bonus attack speed % gained per level (grows per STAT-001). */
      attackSpeedPerLevel: z.number().min(0),
      critMultiplier: z.number().min(1),
      /** Attack slots by name; `basic` is the default attack. */
      slots: z.record(z.string(), AttackSlot),
      /** Name of the default crit attack slot. */
      critSlot: z.string(),
    }),
    /** Ability levelled at each champion level 1–18 (DATA-016). */
    skillOrder: z.array(AbilityKey).length(18),
    abilities: z.object({ Q: Ability, W: Ability, E: Ability, R: Ability }),
    passive: z.object({
      /** Raw lists as in the game file (often per champion level). */
      values: z.record(z.string(), z.array(z.number())),
      calculations: z.record(z.string(), z.unknown()),
    }),
  })
  .refine((c) => "basic" in c.attack.slots, {
    message: "missing basic attack slot",
    path: ["attack", "slots", "basic"],
  })
  .refine((c) => c.attack.critSlot in c.attack.slots, {
    message: "critSlot does not name a slot",
    path: ["attack", "critSlot"],
  });
export type ChampionData = z.infer<typeof ChampionData>;

/** Public patch `<major>.<minor>`, e.g. `26.22` (DATA-021). */
export const Patch = z.string().regex(/^\d+\.\d+$/);

export const ChampionsFile = z.object({
  patch: Patch,
  champions: z.record(z.string(), ChampionData),
});
export type ChampionsFile = z.infer<typeof ChampionsFile>;

/** Game-wide rules a patch can change (DATA-015). */
export const Constants = z.object({
  patch: Patch,
  attackSpeedCap: z.number().positive(),
  baseCritMultiplier: z.number().min(1),
  /** Energized stacks per basic attack, and the max (ITEM-018). */
  energizeStacksPerAttack: z.number().positive(),
  energizeMaxStacks: z.number().positive(),
  /** Champion level needed for each rank of R (BUILD-004). */
  ultimateLevels: z.array(z.number().int().min(1).max(18)).min(1),
});
export type Constants = z.infer<typeof Constants>;

export const ItemData = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Total gold. */
  cost: z.number().int().min(0),
  /** Engine `StatBonuses` names; percents as fractions. */
  stats: z.record(z.string(), z.number()),
  otherStats: z.record(z.string(), z.number()),
  values: z.record(z.string(), z.number()),
  calculations: z.record(z.string(), z.unknown()),
  /** Exclusive groups (DATA-017). */
  groups: z.array(z.string()),
});
export type ItemData = z.infer<typeof ItemData>;

export const ItemsFile = z.object({
  patch: Patch,
  items: z.record(z.string(), ItemData),
});
export type ItemsFile = z.infer<typeof ItemsFile>;

export const RuneData = z.object({
  id: z.number().int().positive(),
  key: z.string().min(1),
  name: z.string().min(1),
  values: z.record(z.string(), z.number()),
});
export type RuneData = z.infer<typeof RuneData>;

export const RuneTree = z.object({
  id: z.number().int().positive(),
  key: z.string(),
  name: z.string(),
  slots: z.array(z.array(z.number().int())),
});
export type RuneTree = z.infer<typeof RuneTree>;

export const RunesFile = z.object({
  patch: Patch,
  runes: z.record(z.string(), RuneData),
  trees: z.array(RuneTree),
});
export type RunesFile = z.infer<typeof RunesFile>;
