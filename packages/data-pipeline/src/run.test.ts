import { ChampionsFile } from "@lol/data";
import { describe, expect, it } from "vitest";

import { fakeFetch, fixture } from "../test/fixtures";
import { manifest } from "./manifest";
import { PipelineError, runPipeline } from "./run";

function setup(fetchJson = fakeFetch(), patch?: string) {
  const written = new Map<string, string>();
  const run = () =>
    runPipeline({
      fetchJson,
      manifest,
      patch,
      writeFile: (path, contents) => {
        written.set(path, contents);
        return Promise.resolve();
      },
    });
  return { run, written, fetchJson };
}

describe("patch selection", () => {
  it(
    "uses the newest Data Dragon version by default",
    { tags: ["DATA-002"] },
    async () => {
      const { run, written } = setup();
      const result = await run();
      expect(result).toMatchObject({
        patch: "16.22",
        ddragonVersion: "16.22.1",
      });
      expect([...written.keys()]).toEqual(["16.22/champions.json"]);
    },
  );

  it("can target a requested patch", { tags: ["DATA-002"] }, async () => {
    const { run } = setup(fakeFetch(["16.23.1", "16.22.1"]), "16.22");
    expect((await run()).ddragonVersion).toBe("16.22.1");
  });
});

describe("game files", { tags: ["DATA-010"] }, () => {
  it("are read from the patch's own CommunityDragon folder", async () => {
    const { run, fetchJson } = setup();
    await run();
    const cdragon = fetchJson.urls.filter((u) => u.includes("communitydragon"));
    expect(cdragon).toHaveLength(manifest.champions.length);
    for (const url of cdragon)
      expect(url).toMatch(/^https:\/\/raw\.communitydragon\.org\/16\.22\//);
  });

  it("fail the run when the patch folder doesn't exist", async () => {
    const { run, written } = setup(fakeFetch(["16.23.1"]));
    await expect(run()).rejects.toThrow(
      /CommunityDragon has no folder for patch 16\.23/,
    );
    expect(written.size).toBe(0);
  });
});

describe("invalid data", { tags: ["DATA-006"] }, () => {
  it("fails naming the entity and field, and writes nothing", async () => {
    const vayne = fixture("Vayne");
    const [key, record] = Object.entries(vayne.bin)[0] ?? [];
    if (!key || !record) throw new Error("fixture has no record");
    const broken = { [key]: { ...record, critDamageMultiplier: undefined } };
    const { run, written } = setup(
      fakeFetch(undefined, {
        "https://raw.communitydragon.org/16.22/game/data/characters/vayne/vayne.bin.json":
          broken,
      }),
    );

    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PipelineError);
    expect((error as PipelineError).problems).toEqual([
      expect.stringMatching(/^Vayne: attack\.critMultiplier: /),
    ]);
    expect(written.size).toBe(0);
  });
});

it("writes a valid champions file for every manifest champion", async () => {
  const { run, written } = setup();
  await run();
  const file = ChampionsFile.parse(
    JSON.parse(written.get("16.22/champions.json") ?? ""),
  );
  expect(Object.keys(file.champions)).toEqual(
    manifest.champions.map((c) => c.id),
  );
});
