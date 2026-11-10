import { ChampionData, ChampionsFile } from "@lol/data";
import type { z } from "zod";

import { normalizeChampion } from "./champion";
import type { Manifest } from "./manifest";
import { resolvePatch } from "./patch";
import {
  cdragonCharacterUrl,
  ddragonChampionUrl,
  HttpError,
  type FetchJson,
} from "./sources";

export type WriteFile = (path: string, contents: string) => Promise<void>;

export class PipelineError extends Error {
  constructor(readonly problems: string[]) {
    super(`data pipeline failed:\n${problems.join("\n")}`);
  }
}

const issues = (entity: string, error: z.ZodError) =>
  error.issues.map(
    (i) => `${entity}: ${i.path.map(String).join(".")}: ${i.message}`,
  );

async function fetchGameFile(
  fetchJson: FetchJson,
  patch: string,
  name: string,
) {
  try {
    return await fetchJson(cdragonCharacterUrl(patch, name));
  } catch (e) {
    if (e instanceof HttpError && e.status === 404)
      throw new PipelineError([
        `CommunityDragon has no folder for patch ${patch} (${e.url})`,
      ]);
    throw e;
  }
}

/**
 * Fetches, normalizes and validates everything in the manifest, then writes it.
 * Nothing is written unless every entity is valid (DATA-006).
 */
export async function runPipeline(opts: {
  fetchJson: FetchJson;
  writeFile: WriteFile;
  manifest: Manifest;
  patch?: string;
}) {
  const { ddragonVersion, patch } = await resolvePatch(
    opts.fetchJson,
    opts.patch,
  );
  const champions: Record<string, ChampionData> = {};
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const { id, gameName } of opts.manifest.champions) {
    const ddragon = await opts.fetchJson(
      ddragonChampionUrl(ddragonVersion, id),
    );
    const bin = await fetchGameFile(opts.fetchJson, patch, gameName);
    let raw: unknown;
    try {
      const normalized = normalizeChampion(ddragon, bin, id);
      raw = normalized.data;
      warnings.push(...normalized.warnings);
    } catch (e) {
      problems.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    const parsed = ChampionData.safeParse(raw);
    if (parsed.success) champions[id] = parsed.data;
    else problems.push(...issues(id, parsed.error));
  }

  if (problems.length) throw new PipelineError(problems);
  const file = ChampionsFile.parse({ patch, champions });
  await opts.writeFile(
    `${patch}/champions.json`,
    `${JSON.stringify(file, null, 2)}\n`,
  );
  return {
    patch,
    ddragonVersion,
    champions: Object.keys(champions),
    warnings,
  };
}
