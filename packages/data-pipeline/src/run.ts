import { ChampionData, ChampionsFile, Constants } from "@lol/data";
import type { z } from "zod";

import { constants } from "../overrides/constants";
import { skillOrders } from "../overrides/skill-orders";
import { valueOverrides } from "../overrides/values";
import { normalizeChampion } from "./champion";
import type { Manifest } from "./manifest";
import { deepMerge } from "./merge";
import { expandSkillOrder, type SkillPlan } from "./skill-order";
import { resolvePatch } from "./patch";
import {
  cdragonCharacterUrl,
  ddragonChampionUrl,
  HttpError,
  type FetchJson,
} from "./sources";

export type WriteFile = (path: string, contents: string) => Promise<void>;

/** Hand-authored data (PLAN §5); tests pass their own. */
export interface Overrides {
  constants: Omit<Constants, "patch">;
  skillOrders: Record<string, SkillPlan>;
  values: Record<string, Record<string, unknown>>;
}

export const defaultOverrides: Overrides = {
  constants,
  skillOrders,
  values: valueOverrides,
};

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
  overrides?: Overrides;
}) {
  const overrides = opts.overrides ?? defaultOverrides;
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
    const plan = overrides.skillOrders[id];
    if (!plan) {
      problems.push(`${id}: no skill order in overrides/skill-orders.ts`);
      continue;
    }
    let raw: unknown;
    try {
      const normalized = normalizeChampion(ddragon, bin, id);
      raw = deepMerge(
        { ...(normalized.data as object), skillOrder: expandSkillOrder(plan) },
        overrides.values[id] ?? {},
      );
      warnings.push(...normalized.warnings);
    } catch (e) {
      problems.push(`${id}: ${(e as Error).message}`);
      continue;
    }
    const parsed = ChampionData.safeParse(raw);
    if (parsed.success) champions[id] = parsed.data;
    else problems.push(...issues(id, parsed.error));
  }

  const constantsFile = Constants.safeParse({ patch, ...overrides.constants });
  if (!constantsFile.success)
    problems.push(...issues("constants", constantsFile.error));

  if (problems.length || !constantsFile.success)
    throw new PipelineError(problems);
  const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
  await opts.writeFile(
    `${patch}/champions.json`,
    json(ChampionsFile.parse({ patch, champions })),
  );
  await opts.writeFile(`${patch}/constants.json`, json(constantsFile.data));
  return {
    patch,
    ddragonVersion,
    champions: Object.keys(champions),
    warnings,
  };
}
