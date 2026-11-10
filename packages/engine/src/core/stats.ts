import type { ChampionData, StatGrowth } from "@lol/data";

/** Game-wide rules a patch can change (DATA-015). */
export interface GameConstants {
  attackSpeedCap: number;
}

/**
 * Flat stats granted by items, runes, shards and buffs. Percent stats are fractions:
 * `attackSpeed: 0.4` is +40% attack speed, `critChance: 0.25` is 25%.
 */
export interface StatBonuses {
  attackDamage?: number;
  abilityPower?: number;
  health?: number;
  mana?: number;
  armor?: number;
  magicResist?: number;
  attackSpeed?: number;
  critChance?: number;
  critDamage?: number;
  lethality?: number;
  armorPenPercent?: number;
  magicPenFlat?: number;
  magicPenPercent?: number;
  abilityHaste?: number;
  moveSpeed?: number;
}

/** A stat split into its level-based part and everything added on top (STAT-003). */
export interface SplitStat {
  base: number;
  bonus: number;
  total: number;
}

export interface StatBlock {
  level: number;
  attackDamage: SplitStat;
  health: SplitStat;
  mana: SplitStat;
  armor: SplitStat;
  magicResist: SplitStat;
  moveSpeed: SplitStat;
  abilityPower: number;
  /** Attacks per second, after the cap (STAT-004, STAT-005). */
  attackSpeed: number;
  /** Bonus attack speed as a fraction, including level growth. */
  bonusAttackSpeed: number;
  /** Fraction, capped at 1 (STAT-007). */
  critChance: number;
  /** Champion multiplier + bonuses (STAT-009). */
  critDamage: number;
  /** Bonuses only (STAT-010). */
  bonusCritDamage: number;
  lethality: number;
  armorPenPercent: number;
  magicPenFlat: number;
  magicPenPercent: number;
  abilityHaste: number;
}

export const MAX_LEVEL = 18;

/** STAT-001: base + growth × (L − 1) × (0.7025 + 0.0175 × (L − 1)). */
export function levelValue(base: number, perLevel: number, level: number) {
  const n = level - 1;
  return base + perLevel * n * (0.7025 + 0.0175 * n);
}

const grown = (stat: StatGrowth, level: number) =>
  levelValue(stat.base, stat.perLevel, level);

function sumBonuses(bonuses: readonly StatBonuses[]) {
  const total: Required<StatBonuses> = {
    attackDamage: 0,
    abilityPower: 0,
    health: 0,
    mana: 0,
    armor: 0,
    magicResist: 0,
    attackSpeed: 0,
    critChance: 0,
    critDamage: 0,
    lethality: 0,
    armorPenPercent: 0,
    magicPenFlat: 0,
    magicPenPercent: 0,
    abilityHaste: 0,
    moveSpeed: 0,
  };
  for (const b of bonuses)
    for (const key of Object.keys(b) as (keyof StatBonuses)[])
      total[key] += b[key] ?? 0;
  return total;
}

const split = (base: number, bonus: number): SplitStat => ({
  base,
  bonus,
  total: base + bonus,
});

export function computeStats(opts: {
  champion: ChampionData;
  level: number;
  constants: GameConstants;
  bonuses?: readonly StatBonuses[];
}): StatBlock {
  const { champion, level, constants } = opts;
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL)
    throw new RangeError(
      `level must be an integer from 1 to 18: ${String(level)}`,
    );

  const b = sumBonuses(opts.bonuses ?? []);
  const s = champion.stats;
  const { attack } = champion;

  const bonusAttackSpeed =
    levelValue(0, attack.attackSpeedPerLevel / 100, level) + b.attackSpeed;
  const uncappedAttackSpeed =
    attack.baseAttackSpeed + attack.attackSpeedRatio * bonusAttackSpeed;

  return {
    level,
    attackDamage: split(grown(s.attackDamage, level), b.attackDamage),
    health: split(grown(s.health, level), b.health),
    mana: split(grown(s.mana, level), b.mana),
    armor: split(grown(s.armor, level), b.armor),
    magicResist: split(grown(s.magicResist, level), b.magicResist),
    moveSpeed: split(grown(s.moveSpeed, level), b.moveSpeed),
    abilityPower: b.abilityPower,
    attackSpeed: Math.min(uncappedAttackSpeed, constants.attackSpeedCap),
    bonusAttackSpeed,
    critChance: Math.min(b.critChance, 1),
    critDamage: attack.critMultiplier + b.critDamage,
    bonusCritDamage: b.critDamage,
    lethality: b.lethality,
    armorPenPercent: b.armorPenPercent,
    magicPenFlat: b.magicPenFlat,
    magicPenPercent: b.magicPenPercent,
    abilityHaste: b.abilityHaste,
  };
}
