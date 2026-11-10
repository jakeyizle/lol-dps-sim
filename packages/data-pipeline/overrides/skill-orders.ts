import type { SkillPlan } from "../src/skill-order";

/**
 * Standard skill orders (DATA-016): the first three levels, then max priority.
 * Verify against current stats sites when each champion's ticket starts.
 */
export const skillOrders: Record<string, SkillPlan> = {
  Jinx: { start: ["Q", "W", "E"], max: ["Q", "W", "E"] },
  Caitlyn: { start: ["Q", "W", "E"], max: ["Q", "W", "E"] },
  Ashe: { start: ["W", "Q", "E"], max: ["W", "Q", "E"] },
  Kaisa: { start: ["Q", "W", "E"], max: ["Q", "E", "W"] },
  Vayne: { start: ["Q", "W", "E"], max: ["Q", "W", "E"] },
};
