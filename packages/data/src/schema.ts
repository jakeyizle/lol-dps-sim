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

/** `<major>.<minor>`, e.g. `16.22`. */
export const Patch = z.string().regex(/^\d+\.\d+$/);

export const ChampionsFile = z.object({
  patch: Patch,
  champions: z.record(z.string(), ChampionData),
});
export type ChampionsFile = z.infer<typeof ChampionsFile>;
