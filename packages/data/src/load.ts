import {
  ChampionsFile,
  Constants,
  ItemsFile,
  RunesFile,
  type ChampionData,
  type ItemData,
  type RuneData,
  type RuneTree,
} from "./schema";

export interface PatchData {
  patch: string;
  champions: Record<string, ChampionData>;
  items: Record<string, ItemData>;
  runes: Record<string, RuneData>;
  trees: RuneTree[];
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
}): PatchData {
  const champions = ChampionsFile.parse(files.champions);
  const items = ItemsFile.parse(files.items);
  const runes = RunesFile.parse(files.runes);
  const constants = Constants.parse(files.constants);
  const patches = new Set([
    champions.patch,
    items.patch,
    runes.patch,
    constants.patch,
  ]);
  if (patches.size !== 1)
    throw new Error(`patch files disagree: ${[...patches].join(", ")}`);
  return {
    patch: constants.patch,
    champions: champions.champions,
    items: items.items,
    runes: runes.runes,
    trees: runes.trees,
    constants,
  };
}
