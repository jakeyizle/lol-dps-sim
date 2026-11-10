import type { PatchData } from "@lol/data";
import { z } from "zod";

import type { Build } from "./build";
import {
  createAppStore,
  savedFields,
  type AppStore,
  type SavedFields,
} from "./store";
import { defaultSettings } from "./simulation";
import { DEFAULT_ZHONYA_BELOW } from "./target";

/** localStorage key for the saved state. */
export const STORAGE_KEY = "lol-dps-sim";
/** Bump with a migration below whenever the saved shape changes (SAVE-002). */
export const SCHEMA_VERSION = 2;

const Condition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("targetHealthBelow"), fraction: z.number() }),
  z.object({ kind: z.literal("wouldKill") }),
  z.object({
    kind: z.literal("minStacks"),
    buff: z.string(),
    stacks: z.number(),
  }),
  z.object({ kind: z.literal("afterAttack") }),
  z.object({ kind: z.literal("minMana"), amount: z.number() }),
]);
const Rotation = z.array(
  z.object({ action: z.string(), when: z.array(Condition).optional() }),
);
const RunePage = z.object({
  primary: z.number(),
  keystone: z.number(),
  primaryRunes: z.array(z.number()),
  secondary: z.number(),
  secondaryRunes: z.array(z.number()),
  shards: z.array(z.number()),
});
const Ranks = z.object({
  Q: z.number(),
  W: z.number(),
  E: z.number(),
  R: z.number(),
});
const BuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  champion: z.string(),
  level: z.number().int().min(1).max(18),
  ranks: Ranks.optional(),
  items: z.array(z.string()),
  stacks: z.record(z.string(), z.number()),
  runes: RunePage.optional(),
  rotation: Rotation.optional(),
  healthFraction: z.number(),
  timelineLevels: z.array(z.number()).optional(),
  patch: z.string().optional(),
});
const Target = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dummy"),
    health: z.number(),
    armor: z.number(),
    magicResist: z.number(),
    damageReduction: z.number(),
  }),
  z.object({
    kind: z.literal("champion"),
    champion: z.string(),
    level: z.number(),
    items: z.array(z.string()),
    runes: RunePage.optional(),
    overrides: z.object({
      health: z.number().optional(),
      armor: z.number().optional(),
      magicResist: z.number().optional(),
    }),
    zhonyaBelow: z.number().nullable(),
  }),
]);
const Saved = z.object({
  builds: z.array(BuildSchema),
  compared: z.array(z.string()),
  target: Target,
  matrixTargets: z.array(
    z.object({ id: z.string(), name: z.string(), target: Target }),
  ),
  targetPresets: z.array(z.object({ name: z.string(), target: Target })),
  settings: z.object({
    gameTime: z.number(),
    maxDuration: z.number(),
    critMode: z.enum(["expected", "rng"]),
    runs: z.number(),
    dpsWindows: z.array(z.number()),
  }),
});
/** What is saved; the schema above checks loaded data against it. */
export type SavedState = SavedFields;

const Envelope = z.object({
  version: z.number().int().positive(),
  patch: z.string(),
  /** Item names at save time, so a notice can name items a later patch removed. */
  itemNames: z.record(z.string(), z.string()),
  state: z.unknown(),
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * SAVE-002: migrations from each older version to the next, on plain JSON.
 * v1 (before T-032–T-037): no matrix targets or presets, dummies without damage
 * reduction, settings without RNG runs.
 */
const MIGRATIONS: Record<number, (state: Record<string, unknown>) => unknown> =
  {
    1: (s) => ({
      ...s,
      matrixTargets: [],
      targetPresets: [],
      target: withTargetDefaults(s.target),
      settings: {
        ...defaultSettings,
        ...(isRecord(s.settings) ? s.settings : {}),
      },
    }),
  };

function withTargetDefaults(target: unknown): unknown {
  if (!isRecord(target)) return target;
  return target.kind === "champion"
    ? { zhonyaBelow: DEFAULT_ZHONYA_BELOW, overrides: {}, ...target }
    : { damageReduction: 0, ...target };
}

/** The JSON stored for `state` on `patch`. */
export function serialize(state: SavedState, patch: PatchData): string {
  const ids = new Set([
    ...state.builds.flatMap((b) => b.items),
    ...[state.target, ...state.matrixTargets.map((t) => t.target)].flatMap(
      (t) => (t.kind === "champion" ? t.items : []),
    ),
  ]);
  const itemNames = Object.fromEntries(
    [...ids].flatMap((id) => {
      const name = patch.items[id]?.name;
      return name ? [[id, name]] : [];
    }),
  );
  return JSON.stringify({
    version: SCHEMA_VERSION,
    patch: patch.patch,
    itemNames,
    state: {
      ...state,
      // SAVE-005: each build keeps the patch it was made on.
      builds: state.builds.map((b) => ({
        ...b,
        patch: b.patch ?? patch.patch,
      })),
    },
  });
}

export type Restored =
  | { ok: true; state: SavedState; notices: string[] }
  | { ok: false; error: string };

/** SAVE-001, SAVE-002, SAVE-005, SAVE-006: parses, migrates and checks saved JSON. */
export function restore(json: string, patch: PatchData): Restored {
  let envelope: z.infer<typeof Envelope>;
  try {
    envelope = Envelope.parse(JSON.parse(json));
  } catch {
    return { ok: false, error: "Saved data couldn't be read." };
  }
  if (envelope.version > SCHEMA_VERSION)
    return { ok: false, error: "Saved data is from a newer version." };
  let raw = envelope.state;
  for (let v = envelope.version; v < SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate || !isRecord(raw))
      return { ok: false, error: "Saved data couldn't be migrated." };
    raw = migrate(raw);
  }
  const parsed = Saved.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Saved data couldn't be read." };

  const notices: string[] = [];
  const itemName = (id: string) => envelope.itemNames[id] ?? `item ${id}`;
  const builds = parsed.data.builds.flatMap((b): Build[] => {
    if (!patch.champions[b.champion]) {
      notices.push(`${b.name} was removed: ${b.champion} isn't available.`);
      return [];
    }
    const gone = b.items.filter((id) => !patch.items[id]);
    if (gone.length > 0)
      notices.push(
        `${b.name}: removed ${gone.map(itemName).join(", ")} (not in patch ${patch.patch}).`,
      );
    const from = b.patch ?? envelope.patch;
    if (from !== patch.patch)
      notices.push(`${b.name} was made on patch ${from}.`);
    return [{ ...b, items: b.items.filter((id) => patch.items[id]) }];
  });
  const kept = new Set(builds.map((b) => b.id));
  return {
    ok: true,
    state: {
      ...parsed.data,
      builds,
      compared: parsed.data.compared.filter((id) => kept.has(id)),
    },
    notices,
  };
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

/** The saved state, or undefined when there is none or storage is unavailable. */
export function loadSaved(
  storage: ReadStorage | undefined,
  patch: PatchData,
): Restored | undefined {
  let json: string | null;
  try {
    json = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return undefined;
  }
  return json === null ? undefined : restore(json, patch);
}

/** Writes the state; a full or blocked storage is ignored. */
export function save(
  storage: WriteStorage | undefined,
  state: SavedState,
  patch: PatchData,
) {
  try {
    storage?.setItem(STORAGE_KEY, serialize(state, patch));
  } catch {
    // the app keeps working without storage
  }
}

/** The browser's localStorage, or undefined where it is blocked. */
export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** SAVE-001: a store restored from `storage` that saves itself after changes settle. */
export function createPersistentStore(
  storage: (ReadStorage & WriteStorage) | undefined,
  patch: PatchData,
  makeId?: () => string,
  delayMs = 300,
): AppStore {
  const loaded = loadSaved(storage, patch);
  const store = createAppStore(makeId, {
    patch: patch.patch,
    saved: loaded?.ok ? loaded.state : undefined,
    notices: loaded ? (loaded.ok ? loaded.notices : [loaded.error]) : [],
  });
  // Unreadable data stays in storage until the user saves something new.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = savedFields(store.getState());
  store.subscribe((state) => {
    const next = savedFields(state);
    const unchanged =
      next.builds === last.builds &&
      next.compared === last.compared &&
      next.target === last.target &&
      next.matrixTargets === last.matrixTargets &&
      next.targetPresets === last.targetPresets &&
      next.settings === last.settings;
    if (unchanged) return;
    last = next;
    clearTimeout(timer);
    timer = setTimeout(() => {
      save(storage, next, patch);
    }, delayMs);
  });
  return store;
}
