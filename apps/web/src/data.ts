import { latestPatch, parsePatch, type PatchData } from "@lol/data";

const generated = import.meta.glob<unknown>(
  "../../../packages/data/generated/*/*.json",
  { eager: true, import: "default" },
);

/** Groups generated files by patch folder: `{ "26.22": { champions, items, … } }`. */
function byPatch(files: Record<string, unknown>) {
  const patches: Record<string, Record<string, unknown>> = {};
  for (const [path, json] of Object.entries(files)) {
    const match = /\/generated\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const [, patch = "", name = ""] = match;
    (patches[patch] ??= {})[name] = json;
  }
  return patches;
}

/** DATA-009: the app always uses the newest generated patch. */
export function loadLatest(
  files: Record<string, unknown> = generated,
): PatchData {
  const patches = byPatch(files);
  const patch = latestPatch(Object.keys(patches));
  const f = patches[patch] ?? {};
  return parsePatch({
    champions: f.champions,
    items: f.items,
    runes: f.runes,
    constants: f.constants,
  });
}
