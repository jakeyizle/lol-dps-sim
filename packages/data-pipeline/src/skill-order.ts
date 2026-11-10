import type { AbilityKey } from "@lol/data";

type Basic = Exclude<AbilityKey, "R">;

/** Levels 1–3 take `start`; later levels follow `max` priority (DATA-016). */
export interface SkillPlan {
  start: [Basic, Basic, Basic];
  max: [Basic, Basic, Basic];
}

const ULT_LEVELS = new Set([6, 11, 16]);
const MAX_RANK = 5;

/**
 * Expands a plan into the ability levelled at each of levels 1–18.
 * A basic ability's rank n needs champion level 2n − 1.
 */
export function expandSkillOrder(plan: SkillPlan): AbilityKey[] {
  const ranks: Record<Basic, number> = { Q: 0, W: 0, E: 0 };
  const order: AbilityKey[] = [];
  for (let level = 1; level <= 18; level++) {
    if (ULT_LEVELS.has(level)) {
      order.push("R");
      continue;
    }
    const pick =
      level <= 3
        ? plan.start[level - 1]
        : plan.max.find(
            (a) => ranks[a] < MAX_RANK && 2 * (ranks[a] + 1) - 1 <= level,
          );
    if (!pick)
      throw new Error(`no ability can be levelled at ${String(level)}`);
    ranks[pick]++;
    order.push(pick);
  }
  return order;
}
