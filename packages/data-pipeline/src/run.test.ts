import { ChampionsFile, Constants } from "@lol/data";
import { describe, expect, it } from "vitest";

import { fakeFetch, fixture } from "../test/fixtures";
import { manifest } from "./manifest";
import {
  defaultOverrides,
  PipelineError,
  runPipeline,
  type Overrides,
} from "./run";

function setup(fetchJson = fakeFetch(), patch?: string, overrides?: Overrides) {
  const written = new Map<string, string>();
  const run = () =>
    runPipeline({
      fetchJson,
      manifest,
      patch,
      overrides,
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
        patch: "26.22",
        ddragonVersion: "16.22.1",
      });
      expect([...written.keys()]).toEqual([
        "26.22/champions.json",
        "26.22/constants.json",
      ]);
    },
  );

  it("can target a requested patch", { tags: ["DATA-002"] }, async () => {
    const { run } = setup(fakeFetch(["16.23.1", "16.22.1"]), "26.22");
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
      /CommunityDragon has no folder for game version 16\.23/,
    );
    expect(written.size).toBe(0);
  });
});

describe("invalid data", { tags: ["DATA-006"] }, () => {
  it("fails naming the entity and field, and writes nothing", async () => {
    const vayne = fixture("Vayne");
    const [key, record] = Object.entries(vayne.bin)[0] ?? [];
    if (!key || !record) throw new Error("fixture has no record");
    const broken = {
      ...vayne.bin,
      [key]: { ...record, critDamageMultiplier: undefined },
    };
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

describe("overrides", () => {
  const overrides = (over: Partial<Overrides> = {}): Overrides => ({
    ...defaultOverrides,
    ...over,
  });
  const champion = async (o: Overrides, id = "Vayne") => {
    const { run, written } = setup(fakeFetch(), undefined, o);
    await run();
    return ChampionsFile.parse(
      JSON.parse(written.get("26.22/champions.json") ?? ""),
    ).champions[id];
  };

  it("replace generated values", { tags: ["DATA-005"] }, async () => {
    const c = await champion(
      overrides({
        values: { Vayne: { attack: { attackSpeedRatio: 0.7 } } },
      }),
    );
    expect(c?.attack.attackSpeedRatio).toBe(0.7);
    // untouched siblings survive the merge
    expect(c?.attack.baseAttackSpeed).toBe(0.658);
  });

  it("write game constants for the patch", { tags: ["DATA-015"] }, async () => {
    const { run, written } = setup();
    await run();
    expect(
      Constants.parse(JSON.parse(written.get("26.22/constants.json") ?? "")),
    ).toEqual({ patch: "26.22", ...defaultOverrides.constants });
  });

  it("add each champion's skill order", { tags: ["DATA-016"] }, async () => {
    const c = await champion(defaultOverrides, "Jinx");
    expect(c?.skillOrder.join(" ")).toBe("Q W E Q Q R Q W Q W R W W E E R E E");
  });

  it(
    "fail the run when a champion has no skill order",
    { tags: ["DATA-016"] },
    async () => {
      const rest = Object.fromEntries(
        Object.entries(defaultOverrides.skillOrders).filter(
          ([id]) => id !== "Vayne",
        ),
      );
      const { run, written } = setup(
        fakeFetch(),
        undefined,
        overrides({ skillOrders: rest }),
      );
      await expect(run()).rejects.toThrow(/Vayne: no skill order/);
      expect(written.size).toBe(0);
    },
  );
});

it("writes a valid champions file for every manifest champion", async () => {
  const { run, written } = setup();
  await run();
  const file = ChampionsFile.parse(
    JSON.parse(written.get("26.22/champions.json") ?? ""),
  );
  expect(Object.keys(file.champions)).toEqual(
    manifest.champions.map((c) => c.id),
  );
});
