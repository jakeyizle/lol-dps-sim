import {
  abilityRanks,
  DEFAULT_RUNES,
  jinx,
  pageProblem,
  simulate,
  type Effect,
} from "@lol/engine";
import { describe, expect, it } from "vitest";

import { loadLatest } from "../data";
import {
  movedItem,
  newBuild,
  rankProblem,
  ranksOf,
  totalGold,
  withItem,
  withoutItem,
  type Build,
} from "./build";
import { defaultSettings, toSimulation, type DummyTarget } from "./simulation";
import { createAppStore } from "./store";

const patch = loadLatest();
const champion = patch.champions.Jinx;
if (!champion) throw new Error("no Jinx");
const ids = () => {
  let n = 0;
  return () => `b${String(++n)}`;
};
const dummy: DummyTarget = {
  kind: "dummy",
  health: 2000,
  armor: 80,
  magicResist: 40,
  damageReduction: 0,
};

const IE = "3031";
const LDR = "3036";
const MORTAL_REMINDER = "3033";
const BERSERKERS = "3006";

describe("builds", () => {
  it(
    "start at level 18 with skill-order ranks, no items, empty runes, default rotation",
    { tags: ["BUILD-001"] },
    () => {
      const store = createAppStore(ids());
      const build = store.getState().addBuild("Jinx");
      expect(build).toMatchObject({
        champion: "Jinx",
        level: 18,
        items: [],
        healthFraction: 1,
      });
      expect(build.runes).toEqual(DEFAULT_RUNES.Jinx);
      if (!build.runes) throw new Error("no default rune page");
      expect(
        pageProblem(build.runes, patch.trees, patch.shards),
      ).toBeUndefined();
      expect(ranksOf(build, champion)).toEqual(abilityRanks(champion, 18));
      const { attacker } = toSimulation(build, dummy, patch, defaultSettings);
      expect(attacker.rotation).toEqual(jinx(champion, 18).rotation);
    },
  );

  it(
    "duplicate as 'X (copy)', independent of the original",
    { tags: ["BUILD-002"] },
    () => {
      const store = createAppStore(ids());
      const original = store.getState().addBuild("Jinx");
      store.getState().updateBuild(original.id, (b) => ({
        ...b,
        items: [IE],
        stacks: { "3032": 40 },
      }));
      store.getState().duplicateBuild(original.id);
      const [a, copy] = store.getState().builds;
      expect(copy).toMatchObject({
        name: "Jinx (copy)",
        items: [IE],
        stacks: { "3032": 40 },
      });
      if (!a || !copy) throw new Error("missing builds");
      store.getState().updateBuild(copy.id, (b) => ({
        ...b,
        items: [...b.items, LDR],
        stacks: { ...b.stacks, "3032": 99 },
      }));
      expect(store.getState().builds[0]).toEqual(a);
    },
  );

  it("can be renamed everywhere they're shown", { tags: ["BUILD-010"] }, () => {
    const store = createAppStore(ids());
    const build = store.getState().addBuild("Jinx");
    store.getState().renameBuild(build.id, "Crit Jinx");
    const shown = store
      .getState()
      .compared.map((id) => store.getState().builds.find((b) => b.id === id));
    expect(shown.map((b) => b?.name)).toEqual(["Crit Jinx"]);
  });

  it(
    "are removed from the list and every comparison when deleted",
    { tags: ["BUILD-011"] },
    () => {
      const store = createAppStore(ids());
      const a = store.getState().addBuild("Jinx");
      const b = store.getState().addBuild("Jinx");
      store.getState().deleteBuild(a.id);
      expect(store.getState().builds.map((x) => x.id)).toEqual([b.id]);
      expect(store.getState().compared).toEqual([b.id]);
    },
  );
});

describe("skill ranks", () => {
  it("follow the skill order by default", { tags: ["BUILD-003"] }, () => {
    // Jinx: Q W E Q Q R …
    const build: Build = { ...newBuild("b", "Jinx"), level: 6 };
    expect(ranksOf(build, champion)).toEqual({ Q: 3, W: 1, E: 1, R: 1 });
    expect(
      ranksOf({ ...build, ranks: { Q: 1, W: 3, E: 1, R: 1 } }, champion),
    ).toEqual({ Q: 1, W: 3, E: 1, R: 1 });
  });

  it(
    "are limited by level, max rank and R's levels",
    { tags: ["BUILD-004"] },
    () => {
      const levels = patch.constants.ultimateLevels;
      const problem = (ranks: Build["ranks"] & object, level: number) =>
        rankProblem(ranks, level, champion, levels);
      expect(problem({ Q: 3, W: 2, E: 1, R: 1 }, 6)).toMatch(/7 skill points/);
      expect(problem({ Q: 6, W: 5, E: 5, R: 2 }, 18)).toMatch(/Q rank/);
      expect(problem({ Q: 5, W: 3, E: 0, R: 2 }, 10)).toMatch(
        /R rank 2 needs level 11/,
      );
      expect(problem({ Q: 5, W: 3, E: 1, R: 2 }, 11)).toBeUndefined();
    },
  );
});

describe("items", () => {
  const base = newBuild("b", "Jinx");

  it(
    "keep their order through add, remove and move",
    { tags: ["BUILD-005"] },
    () => {
      let build = base;
      for (const id of [BERSERKERS, IE, LDR]) {
        const result = withItem(build, id, patch.items);
        if (!result.ok) throw new Error(result.reason);
        build = result.build;
      }
      expect(build.items).toEqual([BERSERKERS, IE, LDR]);
      expect(movedItem(build, 2, 0).items).toEqual([LDR, BERSERKERS, IE]);
      expect(withoutItem(build, 1).items).toEqual([BERSERKERS, LDR]);
      const blocked = withItem(
        { ...base, items: [LDR] },
        MORTAL_REMINDER,
        patch.items,
      );
      expect(blocked.ok).toBe(false);
    },
  );

  it("total gold is the sum of item costs", { tags: ["BUILD-006"] }, () => {
    const cost = (id: string) => patch.items[id]?.cost ?? NaN;
    expect(totalGold({ ...base, items: [IE, LDR] }, patch.items)).toBe(
      cost(IE) + cost(LDR),
    );
  });
});

describe("fight settings", () => {
  const probe = () => {
    const seen: { health: number; time: number }[] = [];
    const effect: Effect = {
      id: "Probe",
      onHit: (ctx) =>
        seen.push({ health: ctx.attackerHealthFraction, time: ctx.gameTime }),
    };
    return { seen, effect };
  };
  const run = (build: Build, gameTime = 30) => {
    const sim = toSimulation(build, dummy, patch, {
      ...defaultSettings,
      gameTime,
      maxDuration: 3,
    });
    const { seen, effect } = probe();
    simulate(
      { ...sim.attacker, items: [...(sim.attacker.items ?? []), effect] },
      sim.target,
      sim.options,
    );
    return seen;
  };

  it(
    "attacker health is constant and reaches effects",
    { tags: ["BUILD-012"] },
    () => {
      const seen = run({ ...newBuild("b", "Jinx"), healthFraction: 0.4 });
      expect(seen.length).toBeGreaterThan(1);
      expect(seen.every((s) => s.health === 0.4)).toBe(true);
    },
  );

  it(
    "game time reaches effects (default 30 minutes)",
    { tags: ["BUILD-013"] },
    () => {
      expect(defaultSettings.gameTime).toBe(30);
      expect(run(newBuild("b", "Jinx"), 25).every((s) => s.time === 25)).toBe(
        true,
      );
    },
  );
});

it("a dummy target uses its entered stats", { tags: ["TGT-002"] }, () => {
  const { target } = toSimulation(
    newBuild("b", "Jinx"),
    dummy,
    patch,
    defaultSettings,
  );
  expect(target).toMatchObject({
    maxHealth: 2000,
    defender: { armor: 80, magicResist: 40 },
  });
});
