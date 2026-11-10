import { caitlynRequiredValues } from "./champions/caitlyn";
import { jinxRequiredValues } from "./champions/jinx";
import { batch1RequiredValues } from "./items/batch1";
import { batch2RequiredValues } from "./items/batch2";
import { batch3RequiredValues } from "./items/batch3";
import { keystoneRequiredValues } from "./runes/keystones";
import { minorRuneRequiredValues } from "./runes/minor";
import { targetRequiredValues } from "./target";

/**
 * Data paths each effect reads, by entity id (e.g. `Jinx: ["abilities.W.values.Damage"]`).
 * The data pipeline fails when a patch drops one (DATA-007). Add an entry with every effect.
 */
export const requiredValues: Record<string, readonly string[]> = {
  Jinx: jinxRequiredValues,
  Caitlyn: caitlynRequiredValues,
  ...batch1RequiredValues,
  ...batch2RequiredValues,
  ...batch3RequiredValues,
  ...keystoneRequiredValues,
  ...minorRuneRequiredValues,
  ...targetRequiredValues,
};
