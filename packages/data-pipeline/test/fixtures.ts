import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HttpError, type FetchJson } from "../src/sources";

export const MANIFEST_IDS = {
  Jinx: "jinx",
  Caitlyn: "caitlyn",
  Ashe: "ashe",
  Kaisa: "kaisa",
  Vayne: "vayne",
} as const;
export type FixtureChampion = keyof typeof MANIFEST_IDS;

const read = (name: string): unknown =>
  JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", name), "utf8"));

/** Trimmed real 16.22 files: Data Dragon champion JSON and the game file's CharacterRecord. */
export const fixture = (id: FixtureChampion) => ({
  ddragon: read(`${MANIFEST_IDS[id]}.ddragon.json`) as {
    data: Record<string, { stats: Record<string, number> }>;
  },
  bin: read(`${MANIFEST_IDS[id]}.bin.json`) as Record<
    string,
    Record<string, unknown>
  >,
});

/** A fetch that serves fixtures by URL; unknown URLs 404. */
export function fakeFetch(
  versions: string[] = ["16.22.1", "16.21.1"],
  overrides: Record<string, unknown> = {},
): FetchJson & { urls: string[] } {
  const routes = new Map<string, unknown>([
    ["https://ddragon.leagueoflegends.com/api/versions.json", versions],
  ]);
  for (const [id, name] of Object.entries(MANIFEST_IDS)) {
    const f = fixture(id as FixtureChampion);
    for (const v of versions)
      routes.set(
        `https://ddragon.leagueoflegends.com/cdn/${v}/data/en_US/champion/${id}.json`,
        f.ddragon,
      );
    routes.set(
      `https://raw.communitydragon.org/16.22/game/data/characters/${name}/${name}.bin.json`,
      f.bin,
    );
  }
  for (const [url, body] of Object.entries(overrides)) routes.set(url, body);

  const urls: string[] = [];
  const fn = (url: string) => {
    urls.push(url);
    if (!routes.has(url)) return Promise.reject(new HttpError(url, 404));
    return Promise.resolve(structuredClone(routes.get(url)));
  };
  return Object.assign(fn, { urls });
}
