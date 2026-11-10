import {
  ChampionData,
  ChampionsFile,
  Constants,
  ItemData,
  ItemsFile,
  RuneData,
  RunesFile,
  TargetsFile,
  RuneTree,
} from "@lol/data";
import { requiredValues } from "@lol/engine/required-values";
import type { z } from "zod";

import { constants } from "../overrides/constants";
import { skillOrders } from "../overrides/skill-orders";
import { valueOverrides } from "../overrides/values";
import { normalizeChampion } from "./champion";
import { diff, formatDrift, missingValues } from "./drift";
import { normalizeItem } from "./item";
import type { Manifest } from "./manifest";
import { deepMerge } from "./merge";
import { normalizeRune, normalizeTrees } from "./rune";
import { normalizeTargets } from "./target";
import { expandSkillOrder, type SkillPlan } from "./skill-order";
import { resolvePatch } from "./patch";
import {
  cdragonCharacterUrl,
  cdragonItemsUrl,
  cdragonPerkNamesUrl,
  cdragonPerksUrl,
  ddragonChampionListUrl,
  ddragonChampionUrl,
  ddragonItemsUrl,
  ddragonRunesUrl,
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

/** The `patch` field always differs between patches; drift ignores it. */
const withoutPatch = (file: unknown) =>
  Object.fromEntries(
    Object.entries((file ?? {}) as Record<string, unknown>).filter(
      ([key]) => key !== "patch",
    ),
  );

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
        `CommunityDragon has no folder for game version ${patch} (${e.url})`,
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
  /** Value paths effect code reads (DATA-007); defaults to the engine's. */
  requiredValues?: Record<string, readonly string[]>;
  /** Generated files of the newest older patch, by file name, for the drift report. */
  readPrevious?: (
    patch: string,
  ) => Promise<{ patch: string; files: Record<string, unknown> } | undefined>;
}) {
  const overrides = opts.overrides ?? defaultOverrides;
  const { ddragonVersion, gamePatch, patch } = await resolvePatch(
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
    const bin = await fetchGameFile(opts.fetchJson, gamePatch, gameName);
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

  /** Normalizes, applies value overrides, validates; records problems by entity. */
  function collect<T>(
    entityId: string,
    schema: { safeParse: (v: unknown) => z.ZodSafeParseResult<T> },
    normalize: () => unknown,
  ): T | undefined {
    let raw: unknown;
    try {
      raw = deepMerge(normalize(), overrides.values[entityId] ?? {});
    } catch (e) {
      problems.push(`${entityId}: ${(e as Error).message}`);
      return undefined;
    }
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    problems.push(...issues(entityId, parsed.error));
    return undefined;
  }

  const ddItems = await opts.fetchJson(ddragonItemsUrl(ddragonVersion));
  const itemsBin = await opts.fetchJson(cdragonItemsUrl(gamePatch));
  const items: Record<string, ItemData> = {};
  for (const id of opts.manifest.items) {
    const item = collect(id, ItemData, () =>
      normalizeItem(ddItems, itemsBin, id),
    );
    if (item) items[id] = item;
  }

  const perksBin = await opts.fetchJson(cdragonPerksUrl(gamePatch));
  const perkNames = await opts.fetchJson(cdragonPerkNamesUrl(gamePatch));
  const runes: Record<string, RuneData> = {};
  for (const id of opts.manifest.runes) {
    const rune = collect(String(id), RuneData, () =>
      normalizeRune(perksBin, perkNames, id),
    );
    if (rune) runes[String(id)] = rune;
  }
  const runeTrees = RuneTree.array().safeParse(
    normalizeTrees(await opts.fetchJson(ddragonRunesUrl(ddragonVersion))),
  );
  if (!runeTrees.success) problems.push(...issues("trees", runeTrees.error));

  let targets: Record<string, unknown> = {};
  try {
    targets = normalizeTargets(
      await opts.fetchJson(ddragonChampionListUrl(ddragonVersion)),
      champions,
    );
  } catch (e) {
    problems.push(`targets: ${(e as Error).message}`);
  }

  const constantsFile = Constants.safeParse({ patch, ...overrides.constants });
  if (!constantsFile.success)
    problems.push(...issues("constants", constantsFile.error));

  problems.push(
    ...missingValues(
      { ...champions, ...items, ...runes },
      opts.requiredValues ?? requiredValues,
    ),
  );

  if (problems.length || !constantsFile.success || !runeTrees.success)
    throw new PipelineError(problems);

  const files: Record<string, unknown> = {
    "champions.json": ChampionsFile.parse({ patch, champions }),
    "items.json": ItemsFile.parse({ patch, items }),
    "runes.json": RunesFile.parse({
      patch,
      runes,
      trees: runeTrees.data,
      shards: opts.manifest.shardRows,
    }),
    "constants.json": constantsFile.data,
    "targets.json": TargetsFile.parse({ patch, champions: targets }),
  };
  const previous = await opts.readPrevious?.(patch);
  const drift = previous
    ? Object.entries(files).flatMap(([name, file]) => {
        const lines = formatDrift(
          diff(withoutPatch(previous.files[name]), withoutPatch(file)),
        );
        return lines.map((l) => `${name}: ${l}`);
      })
    : [];

  for (const [name, file] of Object.entries(files))
    await opts.writeFile(
      `${patch}/${name}`,
      `${JSON.stringify(file, null, 2)}\n`,
    );
  return {
    patch,
    ddragonVersion,
    champions: Object.keys(champions),
    items: Object.keys(items).length,
    runes: Object.keys(runes).length,
    warnings,
    previousPatch: previous?.patch,
    drift,
  };
}
