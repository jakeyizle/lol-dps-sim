import { abilityRanks, DEFAULT_RUNES } from "@lol/engine";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadLatest } from "../data";
import {
  movedItem,
  newBuild,
  rankProblem,
  ranksOf,
  timelineSteps,
  totalGold,
  type Build,
} from "./build";
import {
  addedRule,
  CONDITION_KINDS,
  movedRule,
  newCondition,
  withoutRule,
  withRule,
} from "./rotation";
import { decodeShare, encodeShare, shareFromHash, shareUrl } from "./share";
import { defaultSettings, toSimulation } from "./simulation";
import { createAppStore } from "./store";
import {
  championTarget,
  championTargetStats,
  defaultDummy,
  firstPage,
  shippedPresets,
  targetName,
  toSimTarget,
} from "./target";

const patch = loadLatest();
const jinx = patch.champions.Jinx;
if (!jinx) throw new Error("no Jinx");

describe("builds", () => {
  it("get their own copy of the default page", { tags: ["BUILD-001"] }, () => {
    const b = newBuild("b", "Jinx");
    expect(b.runes).toEqual(DEFAULT_RUNES.Jinx);
    expect(b.runes).not.toBe(DEFAULT_RUNES.Jinx);
    expect(newBuild("g", "Garen").runes).toBeUndefined();
  });

  it(
    "rank rules: no negative ranks, R needs its level",
    { tags: ["BUILD-004"] },
    () => {
      expect(
        rankProblem({ Q: -1, W: 0, E: 0, R: 0 }, 5, jinx, [6, 11, 16]),
      ).toBe("Q rank must be 0 to 5");
      expect(
        rankProblem({ Q: 1, W: 1, E: 1, R: 2 }, 9, jinx, [6, 11, 16]),
      ).toBe("R rank 2 needs level 11");
      expect(
        rankProblem(
          { Q: 1, W: 1, E: 1, R: 4 },
          18,
          {
            ...jinx,
            abilities: {
              ...jinx.abilities,
              R: { ...jinx.abilities.R, maxRank: 4 },
            },
          },
          [6, 11, 16],
        ),
      ).toBe("R rank 4 needs level ?");
    },
  );

  it(
    "moving an item that isn't there changes nothing; unknown items cost nothing",
    { tags: ["BUILD-005", "BUILD-006"] },
    () => {
      const b: Build = { ...newBuild("b", "Jinx"), items: ["3031"] };
      expect(movedItem(b, 3, 0)).toBe(b);
      expect(totalGold({ ...b, items: ["3031", "99999"] }, patch.items)).toBe(
        patch.items["3031"]?.cost,
      );
    },
  );

  it(
    "timeline steps at the build's level keep its edited ranks",
    { tags: ["CMP-010"] },
    () => {
      const ranks = { Q: 1, W: 5, E: 5, R: 3 };
      const b: Build = { ...newBuild("b", "Jinx"), ranks, items: ["3031"] };
      const [step] = timelineSteps(b);
      expect(step && ranksOf(step, jinx)).toEqual(ranks);
      expect(abilityRanks(jinx, 18)).not.toEqual(ranks);
    },
  );
});

describe("rotation edits", { tags: ["ROT-008", "ROT-009"] }, () => {
  it("offer every condition kind with starting values", () => {
    expect(CONDITION_KINDS).toEqual([
      { kind: "afterAttack", label: "after an attack" },
      { kind: "targetHealthBelow", label: "target health below" },
      { kind: "wouldKill", label: "would kill" },
      { kind: "minStacks", label: "at least … stacks" },
      { kind: "minMana", label: "mana at least" },
    ]);
    const buff = { id: "B", max: 4 };
    expect(newCondition("afterAttack", buff)).toEqual({ kind: "afterAttack" });
    expect(newCondition("wouldKill", buff)).toEqual({ kind: "wouldKill" });
    expect(newCondition("targetHealthBelow", buff)).toEqual({
      kind: "targetHealthBelow",
      fraction: 0.5,
    });
    expect(newCondition("minMana", buff)).toEqual({
      kind: "minMana",
      amount: 100,
    });
    expect(newCondition("minStacks", buff)).toEqual({
      kind: "minStacks",
      buff: "B",
      stacks: 4,
    });
    expect(newCondition("minStacks", undefined)).toBeUndefined();
  });

  it("move only within the list", () => {
    const r = [{ action: "Q" }, { action: "W" }, { action: "attack" }];
    expect(movedRule(r, 0, -1)).toBe(r);
    expect(movedRule(r, 2, 3)).toBe(r);
    expect(movedRule(r, 0, 2).map((x) => x.action)).toEqual([
      "W",
      "attack",
      "Q",
    ]);
    expect(withRule(r, 1, { action: "E" }).map((x) => x.action)).toEqual([
      "Q",
      "E",
      "attack",
    ]);
    expect(withoutRule(r, 0).map((x) => x.action)).toEqual(["W", "attack"]);
    expect(addedRule(r, { action: "R" })).toHaveLength(4);
  });
});

describe("share links", { tags: ["SAVE-003", "SAVE-004"] }, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const state = (name: string) => ({
    builds: [{ ...newBuild("b", "Jinx", name), patch: patch.patch }],
    compared: ["b"],
    target: defaultDummy,
    matrixTargets: [],
    settings: defaultSettings,
  });

  it("round-trip any length, compressed or not", async () => {
    // names change the payload's length mod 3, so every base64 padding case comes up
    for (const name of ["a", "ab", "abc", "abcd"]) {
      const z = await encodeShare(state(name), patch);
      expect(z.startsWith("z.")).toBe(true);
      const back = await decodeShare(z, patch);
      expect(back.ok && back.state.builds[0]?.name).toBe(name);
    }
    vi.stubGlobal("CompressionStream", undefined);
    for (const name of ["a", "ab", "abc"]) {
      const j = await encodeShare(state(name), patch);
      expect(j.startsWith("j.")).toBe(true);
      const back = await decodeShare(j, patch);
      expect(back.ok && back.state.builds[0]?.name).toBe(name);
    }
  });

  it("can't open compressed links without decompression, or unknown kinds", async () => {
    const z = await encodeShare(state("a"), patch);
    vi.stubGlobal("DecompressionStream", undefined);
    expect((await decodeShare(z, patch)).ok).toBe(false);
    // and without it, new links aren't compressed
    expect((await encodeShare(state("a"), patch)).startsWith("j.")).toBe(true);
    vi.unstubAllGlobals();
    expect((await decodeShare(`x.${z.slice(2)}`, patch)).ok).toBe(false);
    // a readable payload under an unknown prefix is still refused
    vi.stubGlobal("CompressionStream", undefined);
    const j = await encodeShare(state("a"), patch);
    expect((await decodeShare(`x.${j.slice(2)}`, patch)).ok).toBe(false);
  });

  it("live in the hash, keeping the page's path and query", () => {
    expect(shareFromHash("#s=abc")).toBe("abc");
    expect(shareFromHash("s=abc")).toBe("abc");
    expect(shareFromHash("#other=1")).toBeUndefined();
    expect(shareUrl("https://x.dev/app/?q=1#old", "z.v")).toBe(
      "https://x.dev/app/?q=1#s=z.v",
    );
  });
});

describe("simulation inputs", () => {
  it(
    "need a champion with a kit and skip unknown items",
    { tags: ["BUILD-009"] },
    () => {
      expect(() =>
        toSimulation(
          newBuild("b", "Garen"),
          defaultDummy,
          patch,
          defaultSettings,
        ),
      ).toThrow(/Garen has no implemented kit/);
      expect(() =>
        toSimulation(
          newBuild("b", "Nobody"),
          defaultDummy,
          patch,
          defaultSettings,
        ),
      ).toThrow(/no implemented kit/);
      const sim = toSimulation(
        { ...newBuild("b", "Jinx"), items: ["3031", "99999"] },
        defaultDummy,
        patch,
        defaultSettings,
      );
      expect(sim.attacker.bonuses?.[0]).toMatchObject({ attackDamage: 75 });
    },
  );

  it(
    "adaptive shards follow the build's larger bonus",
    { tags: ["RUNE-002"] },
    () => {
      const adaptive = (items: string[]) =>
        toSimulation(
          { ...newBuild("b", "Jinx"), items },
          defaultDummy,
          patch,
          defaultSettings,
        ).attacker.bonuses?.slice(items.length);
      // the default page's adaptive shard: Nashor's Tooth (80 AP), Infinity Edge (75 AD)
      const ap = (items: string[]) =>
        adaptive(items)?.some((b) => (b.abilityPower ?? 0) > 0);
      expect(ap(["3115"])).toBe(true);
      expect(ap(["3031"])).toBe(false);
      expect(ap(["3031", "3115"])).toBe(true);
      // 75 + 35 AD beats 80 AP; LDR 35 + Kraken 45 = 80 AD ties, and ties go to AD
      expect(ap(["3031", "3036", "3115"])).toBe(false);
      expect(ap(["3036", "6672", "3115"])).toBe(false);
    },
  );
});

describe("store", () => {
  const ids = () => {
    let n = 0;
    return () => `b${String(++n)}`;
  };

  it(
    "keeps comparison order, presets by name and notices until dismissed",
    { tags: ["CMP-001", "TGT-005"] },
    () => {
      const store = createAppStore(ids(), { notices: ["hello"] });
      const s = store.getState();
      s.addBuild("Jinx");
      s.addBuild("Ashe");
      s.addBuild("Vayne");
      s.toggleCompared("b1");
      expect(store.getState().compared).toEqual(["b2", "b3"]);
      s.toggleCompared("b1");
      expect(store.getState().compared).toEqual(["b1", "b2", "b3"]);
      // re-adding keeps build-list order and leaves uncompared builds out
      s.toggleCompared("b3");
      s.toggleCompared("b1");
      s.toggleCompared("b1");
      expect(store.getState().compared).toEqual(["b1", "b2"]);
      s.toggleCompared("b3");

      s.duplicateBuild("nope");
      expect(store.getState().builds).toHaveLength(3);
      s.duplicateBuild("b2");
      expect(store.getState().compared).toEqual(["b1", "b2", "b3", "b4"]);

      s.saveTargetPreset("Q");
      s.saveTargetPreset("P");
      s.setTarget({ ...defaultDummy, armor: 1 });
      s.saveTargetPreset("P");
      expect(store.getState().targetPresets).toEqual([
        { name: "Q", target: defaultDummy },
        { name: "P", target: { ...defaultDummy, armor: 1 } },
      ]);

      expect(store.getState().notices).toEqual(["hello"]);
      s.dismissNotices();
      expect(store.getState().notices).toEqual([]);
    },
  );
});

describe("targets", () => {
  it(
    "start from the first options, need two trees",
    { tags: ["TGT-012"] },
    () => {
      expect(firstPage(patch.trees.slice(0, 1), patch.shards)).toBeUndefined();
      const [a, b] = patch.trees;
      expect(firstPage(patch.trees, patch.shards)).toEqual({
        primary: a?.id,
        keystone: a?.slots[0]?.[0],
        primaryRunes: a?.slots.slice(1).map((r) => r[0]),
        secondary: b?.id,
        secondaryRunes: b?.slots.slice(1, 3).map((r) => r[0]),
        shards: patch.shards.map((r) => r[0]),
      });
      expect(championTarget("Garen").items).toEqual([]);
    },
  );

  it(
    "need a known champion and skip unknown items",
    { tags: ["TGT-001"] },
    () => {
      expect(() =>
        championTargetStats(championTarget("Nobody"), patch, 30),
      ).toThrow(/Nobody/);
      const plain = championTargetStats(championTarget("Garen"), patch, 30);
      const odd = championTargetStats(
        { ...championTarget("Garen"), items: ["99999"] },
        patch,
        30,
      );
      expect(odd).toEqual(plain);
      expect(targetName(championTarget("Nobody"), patch)).toBe("Nobody");
      expect(targetName(championTarget("Garen"), patch)).toBe("Garen");
    },
  );

  it(
    "give the engine champion flags, bonus health, item AD and range",
    { tags: ["TGT-014"] },
    () => {
      expect(toSimTarget(defaultDummy, patch, 30)).toMatchObject({
        champion: true,
        defender: { reductions: [] },
      });
      const low = toSimTarget(
        { ...championTarget("Garen"), overrides: { health: 100 } },
        patch,
        30,
      );
      expect(low).toMatchObject({
        champion: true,
        maxHealth: 100,
        bonusHealth: 0,
      });
      // Maw: 200 + 150% bonus AD (melee); with Infinity Edge's 75 AD; ranged ×0.75
      const maw = (champion: string, items: string[]) =>
        toSimTarget({ ...championTarget(champion), items }, patch, 30)
          .lowHealthShields?.[0]?.amount;
      const ie = patch.items["3031"]?.stats.attackDamage ?? 0;
      const mawAD = patch.items["3156"]?.stats.attackDamage ?? 0;
      expect(maw("Garen", ["3156", "3031"])).toBeCloseTo(
        200 + 1.5 * (ie + mawAD),
        6,
      );
      expect(maw("Jinx", ["3156"])).toBeCloseTo((200 + 1.5 * mawAD) * 0.75, 6);
    },
  );

  it("presets carry their defensive items", { tags: ["TGT-004"] }, () => {
    const items = shippedPresets.map((p) =>
      p.target.kind === "champion" ? p.target.items : [],
    );
    expect(items).toEqual([
      [],
      ["3047", "3053", "3065"],
      ["3047", "3143", "3075", "3110"],
    ]);
  });
});
