import { describe, expect, it } from "vitest";

import { fakeFetch } from "../test/fixtures";
import { diff, formatDrift, missingValues, previousPatch } from "./drift";
import { manifest } from "./manifest";
import { runPipeline } from "./run";

describe("drift report", { tags: ["DATA-008"] }, () => {
  it("lists changed values, added and removed keys", () => {
    const before = {
      Jinx: { stats: { armor: { base: 26, perLevel: 4.2 } }, old: 1 },
      Gone: { a: 1 },
    };
    const after = {
      Jinx: { stats: { armor: { base: 28, perLevel: 4.2 } }, fresh: [1, 2] },
      New: { a: 1 },
    };
    expect(formatDrift(diff(before, after))).toEqual([
      "changed Jinx.stats.armor.base: 26 → 28",
      "added Jinx.fresh",
      "added New",
      "removed Gone",
      "removed Jinx.old",
    ]);
  });

  it("compares arrays as whole values", () => {
    expect(diff({ cd: [8, 7, 6] }, { cd: [8, 7, 5] }).changed).toEqual([
      { path: "cd", from: [8, 7, 6], to: [8, 7, 5] },
    ]);
    expect(diff({ cd: [8, 7, 6] }, { cd: [8, 7, 6] }).changed).toEqual([]);
  });

  it("compares against the newest older patch", () => {
    expect(
      previousPatch(["26.9", "26.21", "26.10", "26.22", "x"], "26.22"),
    ).toBe("26.21");
    expect(previousPatch(["26.22", "26.23"], "26.22")).toBeUndefined();
    expect(previousPatch([], "26.22")).toBeUndefined();
  });

  it("is reported by a pipeline run, ignoring the patch field", async () => {
    const first = new Map<string, string>();
    const run = (
      readPrevious?: Parameters<typeof runPipeline>[0]["readPrevious"],
    ) =>
      runPipeline({
        fetchJson: fakeFetch(),
        manifest,
        readPrevious,
        writeFile: (path, contents) => {
          first.set(path, contents);
          return Promise.resolve();
        },
      });
    await run();
    const parse = (name: string) =>
      JSON.parse(first.get(`26.22/${name}`) ?? "") as Record<string, unknown>;
    const champions = parse("champions.json") as {
      champions: { Jinx: { stats: { armor: { base: number } } } };
    };
    champions.champions.Jinx.stats.armor.base = 20;

    const result = await run(() =>
      Promise.resolve({
        patch: "26.21",
        files: {
          "champions.json": { ...champions, patch: "26.21" },
          "constants.json": { ...parse("constants.json"), patch: "26.21" },
        },
      }),
    );
    expect(result.previousPatch).toBe("26.21");
    expect(result.drift).toEqual([
      "champions.json: changed champions.Jinx.stats.armor.base: 20 → 26",
    ]);
  });
});

describe("required values", { tags: ["DATA-007"] }, () => {
  const entities = { KrakenSlayer: { values: { damagePerStack: 50 } } };

  it("pass when every path exists", () => {
    expect(
      missingValues(entities, { KrakenSlayer: ["values.damagePerStack"] }),
    ).toEqual([]);
  });

  it("name the entity and key that are missing", () => {
    expect(
      missingValues(entities, {
        KrakenSlayer: ["values.damagePerStack", "values.bonusPerStack"],
        Gone: ["values.x"],
      }),
    ).toEqual([
      "KrakenSlayer: missing value values.bonusPerStack",
      "Gone: required by effect code but not generated",
    ]);
  });

  it("fail the pipeline run and write nothing", async () => {
    const written = new Map<string, string>();
    await expect(
      runPipeline({
        fetchJson: fakeFetch(),
        manifest,
        requiredValues: {
          Jinx: ["abilities.W.values.Damage", "abilities.W.values.Gone"],
        },
        writeFile: (path, contents) => {
          written.set(path, contents);
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow(/Jinx: missing value abilities\.W\.values\.Gone/);
    expect(written.size).toBe(0);
  });
});

it("shortens long values in the report", { tags: ["DATA-008"] }, () => {
  const long = "x".repeat(200);
  const [line] = formatDrift(diff({ a: long }, { a: "y" }));
  expect(line).toBe(`changed a: ${JSON.stringify(long).slice(0, 120)}… → "y"`);
});
