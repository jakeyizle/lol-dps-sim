/** Rule conditions, as data so the UI and share URLs can carry them (PLAN §6). */
export type Condition =
  /** ROT-003: target health strictly below this fraction of max health. */
  | { kind: "targetHealthBelow"; fraction: number }
  /** ROT-013: the action's expected post-mitigation damage ≥ target health + shields. */
  | { kind: "wouldKill" }
  /** ROT-004. */
  | { kind: "minStacks"; buff: string; stacks: number }
  /** ROT-005: an attack windup has ended since the last action. */
  | { kind: "afterAttack" }
  /** ROT-006: at least this much mana. */
  | { kind: "minMana"; amount: number };

/** `action` is `attack` or an ability id. */
export interface Rule {
  action: string;
  when?: readonly Condition[];
}

/** Rules in priority order; the first usable one is taken (ROT-001). */
export type Rotation = readonly Rule[];

export const attackOnly: Rotation = [{ action: "attack" }];

export interface RotationState {
  time: number;
  afterAttack: boolean;
  mana: number;
  maxMana: number;
  /** Mana per second. */
  manaRegen: number;
  targetHealth: number;
  targetMaxHealth: number;
  buffStacks: (id: string) => number;
  wouldKill: (action: string) => boolean;
}

/**
 * Earliest time the condition holds if nothing else happens: now, a later time for
 * conditions that change on their own (mana), or Infinity until some event changes state.
 */
export function conditionTime(
  condition: Condition,
  action: string,
  s: RotationState,
): number {
  const now = (holds: boolean) => (holds ? s.time : Infinity);
  switch (condition.kind) {
    case "targetHealthBelow":
      return now(s.targetHealth < condition.fraction * s.targetMaxHealth);
    case "wouldKill":
      return now(s.wouldKill(action));
    case "minStacks":
      return now(s.buffStacks(condition.buff) >= condition.stacks);
    case "afterAttack":
      return now(s.afterAttack);
    case "minMana": {
      const missing = condition.amount - s.mana;
      if (missing <= 0) return s.time;
      if (condition.amount > s.maxMana || s.manaRegen <= 0) return Infinity;
      return s.time + missing / s.manaRegen;
    }
  }
}

/** Earliest time all of a rule's conditions hold (see `conditionTime`). */
export function ruleConditionsTime(rule: Rule, s: RotationState) {
  return Math.max(
    s.time,
    ...(rule.when ?? []).map((c) => conditionTime(c, rule.action, s)),
  );
}
