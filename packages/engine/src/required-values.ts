import { jinxRequiredValues } from "./champions/jinx";
import { batch1RequiredValues } from "./items/batch1";

/**
 * Data paths each effect reads, by entity id (e.g. `Jinx: ["abilities.W.values.Damage"]`).
 * The data pipeline fails when a patch drops one (DATA-007). Add an entry with every effect.
 */
export const requiredValues: Record<string, readonly string[]> = {
  Jinx: jinxRequiredValues,
  ...batch1RequiredValues,
};
