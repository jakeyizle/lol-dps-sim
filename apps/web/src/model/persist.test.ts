import { describe, expect, it } from "vitest";

import { loadLatest } from "../data";
import { withItem } from "./build";
import {
  createPersistentStore,
  restore,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "./persist";
import { shippedPresets } from "./target";

const patch = loadLatest();

/** An in-memory Storage. */
function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    raw: () => data.get(STORAGE_KEY),
  };
}
const ids = () => {
  let n = 0;
  return () => `b${String(++n)}`;
};
const settle = () => new Promise((r) => setTimeout(r, 5));
const reload = (storage: ReturnType<typeof memory>) =>
  createPersistentStore(storage, patch, ids(), 0).getState();

describe("saving", () => {
  it(
    "restores builds, targets and settings after a reload",
    { tags: ["SAVE-001"] },
    async () => {
      const storage = memory();
      const store = createPersistentStore(storage, patch, ids(), 0);
      const s = store.getState();
      const build = s.addBuild("Jinx");
      s.updateBuild(build.id, (b) => {
        const r = withItem(b, "3031", patch.items);
        return r.ok ? r.build : b;
      });
      s.setTarget({
        kind: "dummy",
        health: 3000,
        armor: 150,
        magicResist: 50,
        damageReduction: 0,
      });
      s.setSettings({ gameTime: 25 });
      s.addMatrixTarget("Tank", shippedPresets[2]?.target ?? s.target);
      await settle();

      const again = reload(storage);
      expect(again.builds).toEqual([
        { ...store.getState().builds[0], patch: patch.patch },
      ]);
      expect(again.compared).toEqual(["b1"]);
      expect(again.target).toEqual(store.getState().target);
      expect(again.settings.gameTime).toBe(25);
      expect(again.matrixTargets.map((t) => t.name)).toEqual(["Tank"]);
      expect(again.notices).toEqual([]);
    },
  );

  it(
    "keeps user target presets across reloads",
    { tags: ["TGT-005"] },
    async () => {
      const storage = memory();
      const store = createPersistentStore(storage, patch, ids(), 0);
      store.getState().setTarget({
        kind: "dummy",
        health: 4000,
        armor: 90,
        magicResist: 60,
        damageReduction: 0.1,
      });
      store.getState().saveTargetPreset("Practice dummy");
      await settle();
      expect(reload(storage).targetPresets).toEqual([
        { name: "Practice dummy", target: store.getState().target },
      ]);
    },
  );

  it("unreadable data is reported and left alone", () => {
    const storage = memory("{not json");
    const state = reload(storage);
    expect(state.builds).toEqual([]);
    expect(state.notices).toEqual(["Saved data couldn't be read."]);
    expect(storage.raw()).toBe("{not json");
  });
});

/** Saved by schema v1: no matrix targets, presets, damage reduction or RNG runs. */
const v1 = {
  version: 1,
  patch: patch.patch,
  itemNames: {},
  state: {
    builds: [
      {
        id: "old",
        name: "Old Jinx",
        champion: "Jinx",
        level: 13,
        items: ["3031"],
        stacks: {},
        healthFraction: 1,
      },
    ],
    compared: ["old"],
    target: { kind: "dummy", health: 2500, armor: 70, magicResist: 40 },
    settings: {
      gameTime: 20,
      maxDuration: 20,
      critMode: "expected",
      dpsWindows: [3, 6, 10],
    },
  },
};

it(
  "migrates data saved by older schema versions",
  { tags: ["SAVE-002"] },
  () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(1);
    const r = restore(JSON.stringify(v1), patch);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.builds.map((b) => [b.name, b.items])).toEqual([
      ["Old Jinx", ["3031"]],
    ]);
    expect(r.state.target).toEqual({
      kind: "dummy",
      health: 2500,
      armor: 70,
      magicResist: 40,
      damageReduction: 0,
    });
    expect(r.state.settings).toMatchObject({ gameTime: 20, runs: 200 });
    expect(r.state.matrixTargets).toEqual([]);
    expect(r.notices).toEqual([]);
  },
);

it(
  "says when a build was made on another patch",
  { tags: ["SAVE-005"] },
  () => {
    const old = { ...v1, patch: "26.20" };
    const r = restore(JSON.stringify(old), patch);
    expect(r.ok && r.notices).toEqual(["Old Jinx was made on patch 26.20."]);
  },
);

it(
  "drops items the current patch doesn't have, naming them",
  { tags: ["SAVE-006"] },
  () => {
    const removed = {
      ...v1,
      itemNames: { "9999": "Old Blade" },
      state: {
        ...v1.state,
        builds: [{ ...v1.state.builds[0], items: ["3031", "9999"] }],
      },
    };
    const r = restore(JSON.stringify(removed), patch);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.builds[0]?.items).toEqual(["3031"]);
    expect(r.notices).toEqual([
      `Old Jinx: removed Old Blade (not in patch ${patch.patch}).`,
    ]);
  },
);
