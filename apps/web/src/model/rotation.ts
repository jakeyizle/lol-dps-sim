import type { Condition, Rotation, Rule } from "@lol/engine";

/** ROT-009: the condition kinds a rule can use, with labels. */
export const CONDITION_KINDS: readonly {
  kind: Condition["kind"];
  label: string;
}[] = [
  { kind: "afterAttack", label: "after an attack" },
  { kind: "targetHealthBelow", label: "target health below" },
  { kind: "wouldKill", label: "would kill" },
  { kind: "minStacks", label: "at least … stacks" },
  { kind: "minMana", label: "mana at least" },
];

/** A condition of `kind` with starting parameters; `buff` is the first stack buff, if any. */
export function newCondition(
  kind: Condition["kind"],
  buff: { id: string; max: number } | undefined,
): Condition | undefined {
  switch (kind) {
    // Stryker disable next-line ConditionalExpression: without this label it falls through to wouldKill's identical return
    case "afterAttack":
      return { kind };
    case "wouldKill":
      return { kind };
    case "targetHealthBelow":
      return { kind, fraction: 0.5 };
    case "minMana":
      return { kind, amount: 100 };
    case "minStacks":
      return buff ? { kind, buff: buff.id, stacks: buff.max } : undefined;
  }
}

/** ROT-008: rotation edits; each returns a new rotation. */
export const withRule = (rotation: Rotation, index: number, rule: Rule) =>
  rotation.map((r, i) => (i === index ? rule : r));

export const withoutRule = (rotation: Rotation, index: number) =>
  rotation.filter((_, i) => i !== index);

export function movedRule(rotation: Rotation, from: number, to: number) {
  if (to < 0 || to >= rotation.length) return rotation;
  const next = [...rotation];
  const [rule] = next.splice(from, 1);
  // Stryker disable next-line ConditionalExpression: callers move an existing rule, so splice always returns one
  if (rule) next.splice(to, 0, rule);
  return next;
}

export const addedRule = (rotation: Rotation, rule: Rule) => [
  ...rotation,
  rule,
];
