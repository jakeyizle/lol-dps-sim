import {
  ChampionsFile,
  Constants,
  ItemsFile,
  RunesFile,
  TargetsFile,
  type ChampionData,
  type ItemData,
  type RuneData,
  type RuneTree,
  type TargetChampion,
} from "./schema";

export interface PatchData {
  patch: string;
  champions: Record<string, ChampionData>;
  /** Every champion as a target (defensive stats; game-file stats for kit champions). */
  targets: Record<string, TargetChampion>;
  items: Record<string, ItemData>;
  runes: Record<string, RuneData>;
  trees: RuneTree[];
  shards: number[][];
  constants: Constants;
}

const parts = (patch: string) => patch.split(".").map(Number);

/** Orders public patch numbers (`26.9` < `26.10` < `27.1`). */
export function comparePatches(a: string, b: string) {
  const [a1 = 0, a2 = 0] = parts(a);
  const [b1 = 0, b2 = 0] = parts(b);
  return a1 - b1 || a2 - b2;
}

/** DATA-009: the newest generated patch. */
export function latestPatch(patches: readonly string[]) {
  const latest = [...patches].sort(comparePatches).at(-1);
  if (!latest) throw new Error("no generated patch data");
  return latest;
}

/** Validates one patch folder's files (as parsed JSON) into typed data. */
export function parsePatch(files: {
  champions: unknown;
  items: unknown;
  runes: unknown;
  constants: unknown;
  targets: unknown;
}): PatchData {
  const champions = ChampionsFile.parse(files.champions);
  const items = ItemsFile.parse(files.items);
  const runes = RunesFile.parse(files.runes);
  const constants = Constants.parse(files.constants);
  const targets = TargetsFile.parse(files.targets);
  const patches = new Set([
    champions.patch,
    targets.patch,
    items.patch,
    runes.patch,
    constants.patch,
  ]);
  if (patches.size !== 1)
    throw new Error(`patch files disagree: ${[...patches].join(", ")}`);
  return {
    patch: constants.patch,
    champions: champions.champions,
    targets: targets.champions,
    items: items.items,
    runes: runes.runes,
    trees: runes.trees,
    shards: runes.shards,
    constants,
  };
}
