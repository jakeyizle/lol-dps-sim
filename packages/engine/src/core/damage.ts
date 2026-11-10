import type { StatBlock } from "./stats";

export type DamageType = "physical" | "magic" | "true";
export type DamageSource = "attack" | "ability" | "item" | "rune" | "passive";

/** One hit of damage before mitigation (DMG-011). */
export interface DamageInstance {
  type: DamageType;
  amount: number;
  source: DamageSource;
  /** What dealt it, e.g. `basic`, `JinxW`, `KrakenSlayer`. */
  sourceId: string;
  autoAttack?: boolean;
  onHit?: boolean;
  ability?: boolean;
  /** Only critable instances are affected by crits; on-hit effects never set it (DMG-013). */
  critable?: boolean;
}

/** Expected value averages crits (DMG-009); a roll is decided by the caller's seeded RNG. */
export type CritMode = { kind: "expected" } | { kind: "roll"; crit: boolean };
export type CritOutcome = "crit" | "noCrit" | "averaged" | "notCritable";

export interface Shield {
  amount: number;
  /** `all`, or the one damage type it absorbs (DMG-015). */
  blocks: "all" | DamageType;
}

export interface DamageReduction {
  appliesTo: "all" | "autoAttack";
  /** Fraction of damage removed, e.g. 0.1 for 10%. */
  fraction: number;
}

export interface Defender {
  armor: number;
  magicResist: number;
  armorReductionFlat?: number;
  /** Fraction. */
  armorReductionPercent?: number;
  magicResistReductionFlat?: number;
  /** Fraction. */
  magicResistReductionPercent?: number;
  /** Fraction of crit damage removed (e.g. Randuin's Omen, DMG-014). */
  critDamageReduction?: number;
  reductions?: readonly DamageReduction[];
}

export type Attacker = Pick<
  StatBlock,
  | "critChance"
  | "critDamage"
  | "lethality"
  | "armorPenPercent"
  | "magicPenFlat"
  | "magicPenPercent"
>;

export interface ResolvedDamage {
  instance: DamageInstance;
  crit: CritOutcome;
  /** After crit and amplifiers, before resistances. */
  preMitigation: number;
  /** After resistances and target reductions, before shields. */
  postMitigation: number;
}

/**
 * DMG-005–007: flat reduction → % reduction → % penetration → flat penetration.
 * Reductions can take a resistance below 0; penetration cannot.
 */
export function effectiveResistance(opts: {
  base: number;
  reductionFlat?: number;
  reductionPercent?: number;
  penPercent?: number;
  penFlat?: number;
}) {
  let r = opts.base - (opts.reductionFlat ?? 0);
  if (r <= 0) return r;
  r *= 1 - (opts.reductionPercent ?? 0);
  r *= 1 - (opts.penPercent ?? 0);
  return Math.max(0, r - (opts.penFlat ?? 0));
}

/** DMG-001–003. */
export function resistanceMultiplier(r: number) {
  return r >= 0 ? 100 / (100 + r) : 2 - 100 / (100 - r);
}

/** DMG-008, DMG-009, DMG-014. */
export function critMultiplier(
  mode: CritMode,
  critChance: number,
  critDamage: number,
  critDamageReduction = 0,
) {
  const onCrit = critDamage * (1 - critDamageReduction);
  if (mode.kind === "roll") return mode.crit ? onCrit : 1;
  return 1 + critChance * (onCrit - 1);
}

function resistanceFor(
  type: DamageType,
  attacker: Attacker,
  defender: Defender,
) {
  if (type === "true") return 0;
  return type === "physical"
    ? effectiveResistance({
        base: defender.armor,
        reductionFlat: defender.armorReductionFlat,
        reductionPercent: defender.armorReductionPercent,
        penPercent: attacker.armorPenPercent,
        penFlat: attacker.lethality,
      })
    : effectiveResistance({
        base: defender.magicResist,
        reductionFlat: defender.magicResistReductionFlat,
        reductionPercent: defender.magicResistReductionPercent,
        penPercent: attacker.magicPenPercent,
        penFlat: attacker.magicPenFlat,
      });
}

/**
 * Raw → crit → amplifiers (multiplied together, DMG-010) → resistances → target reductions.
 * Shields are applied separately by `absorb`.
 */
export function resolveDamage(opts: {
  instance: DamageInstance;
  attacker: Attacker;
  defender: Defender;
  critMode: CritMode;
  /** Fractions of the amplifiers that apply to this instance. */
  amplifiers?: readonly number[];
}): ResolvedDamage {
  const { instance, attacker, defender, critMode } = opts;

  let amount = instance.amount;
  let crit: CritOutcome = "notCritable";
  if (instance.critable) {
    amount *= critMultiplier(
      critMode,
      attacker.critChance,
      attacker.critDamage,
      defender.critDamageReduction,
    );
    crit =
      critMode.kind === "expected"
        ? "averaged"
        : critMode.crit
          ? "crit"
          : "noCrit";
  }
  for (const amp of opts.amplifiers ?? []) amount *= 1 + amp;
  const preMitigation = amount;

  if (instance.type !== "true")
    amount *= resistanceMultiplier(
      resistanceFor(instance.type, attacker, defender),
    );
  for (const r of defender.reductions ?? [])
    if (r.appliesTo === "all" || instance.autoAttack) amount *= 1 - r.fraction;

  return { instance, crit, preMitigation, postMitigation: amount };
}

/** DMG-012, DMG-015: shields absorb in order; typed shields only their type. */
export function absorb<S extends Shield>(
  shields: readonly S[],
  amount: number,
  type: DamageType,
) {
  let remaining = amount;
  const after = shields.map((s) => {
    if (s.blocks !== "all" && s.blocks !== type) return s;
    const taken = Math.min(s.amount, remaining);
    remaining -= taken;
    return { ...s, amount: s.amount - taken };
  });
  return {
    shields: after.filter((s) => s.amount > 0),
    absorbed: amount - remaining,
    toHealth: remaining,
  };
}
