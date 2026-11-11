import { describe, expect, it } from "vitest";

import { loadLatest } from "../data";
import { newBuild } from "./build";
import {
  browserStorage,
  createPersistentStore,
  loadSaved,
  restore,
  save,
  SCHEMA_VERSION,
  serialize,
  STORAGE_KEY,
  type SavedState,
} from "./persist";
import { defaultSettings } from "./simulation";
import { championTarget, defaultDummy } from "./target";

const patch = loadLatest();
const page = {
  primary: 8000,
  keystone: 8008,
  primaryRunes: [9111, 9104, 8014],
  secondary: 8200,
  secondaryRunes: [8233, 8236],
  shards: [5005, 5008, 5011],
};

/** Every saved field, with every condition kind and both target kinds. */
const rich: SavedState = {
  builds: [
    {
      ...newBuild("b1", "Caitlyn", "Cait"),
      level: 13,
      ranks: { Q: 5, W: 3, E: 3, R: 2 },
      items: ["3031", "6672"],
      stacks: { "9104": 7 },
      runes: page,
      rotation: [
        { action: "R", when: [{ kind: "targetHealthBelow", fraction: 0.4 }] },
        { action: "Q", when: [{ kind: "wouldKill" }, { kind: "afterAttack" }] },
        {
          action: "W",
          when: [
            { kind: "minStacks", buff: "CaitlynHeadshotStacks", stacks: 3 },
          ],
        },
        { action: "E", when: [{ kind: "minMana", amount: 100 }] },
        { action: "attack" },
      ],
      healthFraction: 0.5,
      timelineLevels: [9, 11],
      patch: patch.patch,
    },
  ],
  compared: ["b1"],
  target: {
    ...championTarget("Garen"),
    items: ["3075"],
    runes: page,
    overrides: { armor: 200, health: 3000, magicResist: 70 },
    zhonyaBelow: null,
  },
  matrixTargets: [
    {
      id: "m1",
      name: "Tank",
      target: { ...championTarget("Ornn"), items: ["3143"] },
    },
    {
      id: "m2",
      name: "Dummy",
      target: { ...defaultDummy, damageReduction: 0.2 },
    },
  ],
  targetPresets: [{ name: "Mine", target: defaultDummy }],
  settings: { ...defaultSettings, critMode: "rng", runs: 50 },
};

describe("saved state", { tags: ["SAVE-001"] }, () => {
  it("round-trips every field", () => {
    const r = restore(serialize(rich, patch), patch);
    expect(r).toEqual({ ok: true, state: rich, notices: [] });
  });

  it("records the names of every item it holds, including targets'", () => {
    const json = JSON.parse(
      serialize(
        {
          ...rich,
          builds: [{ ...rich.builds[0], items: ["3031", "99999"] } as never],
        },
        patch,
      ),
    ) as { version: number; itemNames: Record<string, string>; patch: string };
    expect(json.version).toBe(SCHEMA_VERSION);
    expect(json.patch).toBe(patch.patch);
    expect(json.itemNames).toEqual({
      "3031": "Infinity Edge",
      "3075": "Thornmail",
      "3143": "Randuin's Omen",
    });
  });

  it(
    "stamps builds without a patch with the current one",
    { tags: ["SAVE-005"] },
    () => {
      const unstamped = {
        ...(rich.builds[0] ?? newBuild("x", "Jinx")),
        patch: undefined,
      };
      const r = restore(
        serialize({ ...rich, builds: [unstamped] }, patch),
        patch,
      );
      expect(r.ok && r.state.builds[0]?.patch).toBe(patch.patch);
    },
  );

  it("uses the key everyone's saved data is under", () => {
    expect(STORAGE_KEY).toBe("lol-dps-sim");
  });
});

describe("broken saved data", { tags: ["SAVE-002"] }, () => {
  const envelope = (over: Record<string, unknown>) =>
    JSON.stringify({
      version: SCHEMA_VERSION,
      patch: patch.patch,
      itemNames: {},
      state: rich,
      ...over,
    });

  it("is reported, never half-loaded", () => {
    expect(restore(envelope({ version: SCHEMA_VERSION + 1 }), patch)).toEqual({
      ok: false,
      error: "Saved data is from a newer version.",
    });
    expect(restore(envelope({ version: 1, state: [] }), patch)).toEqual({
      ok: false,
      error: "Saved data couldn't be migrated.",
    });
    expect(restore(envelope({ version: 0 }), patch)).toEqual({
      ok: false,
      error: "Saved data couldn't be read.",
    });
    for (const state of [
      { ...rich, builds: "nope" },
      { ...rich, settings: { ...rich.settings, critMode: "x" } },
    ])
      expect(restore(envelope({ state }), patch)).toEqual({
        ok: false,
        error: "Saved data couldn't be read.",
      });
    // a v1 target that isn't an object stays invalid after migrating
    expect(
      restore(envelope({ version: 1, state: { ...rich, target: 5 } }), patch)
        .ok,
    ).toBe(false);
  });

  it("migrates v1 champion targets with their new defaults", () => {
    const old: Record<string, unknown> = { ...championTarget("Garen") };
    delete old.zhonyaBelow;
    delete old.overrides;
    const r = restore(
      envelope({ version: 1, state: { ...rich, target: old } }),
      patch,
    );
    expect(r.ok && r.state.target).toEqual(championTarget("Garen"));
  });

  it(
    "drops builds of champions the patch doesn't have",
    { tags: ["SAVE-006"] },
    () => {
      const gone = {
        ...newBuild("b2", "Teemo", "Shrooms"),
        patch: patch.patch,
      };
      const r = restore(
        serialize(
          { ...rich, builds: [...rich.builds, gone], compared: ["b1", "b2"] },
          patch,
        ),
        patch,
      );
      if (!r.ok) throw new Error(r.error);
      expect(r.state.builds.map((b) => b.id)).toEqual(["b1"]);
      expect(r.state.compared).toEqual(["b1"]);
      expect(r.notices).toEqual([
        "Shrooms was removed: Teemo isn't available.",
      ]);
    },
  );

  it(
    "names removed items it has no saved name for by id",
    { tags: ["SAVE-006"] },
    () => {
      const r = restore(
        envelope({
          state: { ...rich, builds: [{ ...rich.builds[0], items: ["99999"] }] },
        }),
        patch,
      );
      expect(r.ok && r.notices).toEqual([
        `Cait: removed item 99999 (not in patch ${patch.patch}).`,
      ]);
    },
  );
});

describe("storage", { tags: ["SAVE-001"] }, () => {
  it("is optional and may refuse to work", () => {
    expect(loadSaved(undefined, patch)).toBeUndefined();
    expect(loadSaved({ getItem: () => null }, patch)).toBeUndefined();
    expect(
      loadSaved(
        {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        patch,
      ),
    ).toBeUndefined();
    expect(() => {
      save(undefined, rich, patch);
      save(
        {
          setItem: () => {
            throw new Error("full");
          },
        },
        rich,
        patch,
      );
    }).not.toThrow();
    expect(browserStorage()).toBe(window.localStorage);
  });

  it("writes once after changes settle, and not for notices", async () => {
    const writes: string[] = [];
    const storage = {
      getItem: () => null,
      setItem: (_k: string, v: string) => {
        writes.push(v);
      },
    };
    const store = createPersistentStore(storage, patch, undefined, 10);
    store.setState({ notices: ["x"] });
    await new Promise((r) => setTimeout(r, 30));
    expect(writes).toHaveLength(0);

    const s = store.getState();
    s.addBuild("Jinx");
    s.setTarget({ ...defaultDummy, armor: 1 });
    s.setSettings({ gameTime: 5 });
    s.addMatrixTarget("A", defaultDummy);
    s.saveTargetPreset("P");
    s.toggleCompared(store.getState().builds[0]?.id ?? "");
    await new Promise((r) => setTimeout(r, 30));
    expect(writes).toHaveLength(1);
    const back = restore(writes[0] ?? "", patch);
    expect(back.ok && back.state.targetPresets.map((p) => p.name)).toEqual([
      "P",
    ]);
    expect(back.ok && back.state.compared).toEqual([]);
  });

  it("each saved field on its own triggers a write", async () => {
    const changes: ((
      s: ReturnType<ReturnType<typeof createPersistentStore>["getState"]>,
    ) => void)[] = [
      (s) => s.addBuild("Jinx"),
      (s) => {
        s.setTarget({ ...defaultDummy, armor: 2 });
      },
      (s) => {
        s.setSettings({ gameTime: 6 });
      },
      (s) => {
        s.addMatrixTarget("A", defaultDummy);
      },
      (s) => {
        s.saveTargetPreset("P");
      },
    ];
    for (const change of changes) {
      let n = 0;
      const store = createPersistentStore(
        { getItem: () => null, setItem: () => (n += 1) },
        patch,
        undefined,
        1,
      );
      change(store.getState());
      await new Promise((r) => setTimeout(r, 15));
      expect(n).toBe(1);
    }
  });
});
