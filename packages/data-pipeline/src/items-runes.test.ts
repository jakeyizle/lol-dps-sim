import { ItemsFile, RunesFile } from "@lol/data";
import { describe, expect, it } from "vitest";

import { fakeFetch, read } from "../test/fixtures";
import { normalizeItem } from "./item";
import { manifest } from "./manifest";
import { runPipeline } from "./run";
import { normalizeRune, normalizeTrees } from "./rune";

const item = (id: string) =>
  normalizeItem(read("item.ddragon.json"), read("items.bin.json"), id);
const rune = (id: number) =>
  normalizeRune(read("perks.bin.json"), read("perks.names.json"), id);

async function generate() {
  const written = new Map<string, string>();
  await runPipeline({
    fetchJson: fakeFetch(),
    manifest,
    writeFile: (path, contents) => {
      written.set(path, contents);
      return Promise.resolve();
    },
  });
  const json = (name: string) =>
    JSON.parse(written.get(`26.22/${name}`) ?? "") as unknown;
  return {
    items: ItemsFile.parse(json("items.json")),
    runes: RunesFile.parse(json("runes.json")),
  };
}

describe("generated files", { tags: ["DATA-001"] }, () => {
  it("hold exactly the manifest's items and runes, with the patch", async () => {
    const { items, runes } = await generate();
    expect(items.patch).toBe("26.22");
    expect(runes.patch).toBe("26.22");
    expect(Object.keys(items.items).sort()).toEqual([...manifest.items].sort());
    expect(Object.keys(runes.runes).sort()).toEqual(
      manifest.runes.map(String).sort(),
    );
  });
});

describe("items", () => {
  it("take name and gold from Data Dragon", () => {
    expect(item("6672")).toMatchObject({ name: "Kraken Slayer", cost: 3000 });
  });

  it("map game-file stats to engine stat names", () => {
    // 45 AD, 40% AS, 4% move speed (not modelled)
    const kraken = item("6672");
    expect(kraken.stats).toEqual({ attackDamage: 45, attackSpeed: 0.4 });
    expect(kraken.otherStats).toEqual({ mPercentMovementSpeedMod: 0.04 });
    // Infinity Edge: crit chance and crit damage as fractions
    expect(item("3031").stats).toMatchObject({
      critChance: 0.25,
      critDamage: 0.3,
    });
    expect(item("3036").stats.armorPenPercent).toBe(0.35);
  });

  it("keep passive values by name", () => {
    expect(item("6672").values).toMatchObject({
      AttackCount: 3,
      RangedDamageMultiplier: 0.8,
    });
  });

  it("reject ids missing from either source", () => {
    expect(() => item("999999")).toThrow(/no item 999999/);
  });
});

describe("exclusive groups", { tags: ["DATA-017"] }, () => {
  it("are recorded by name", () => {
    expect(item("3036").groups).toContain("LastWhisper");
    expect(item("3033").groups).toContain("LastWhisper");
    expect(item("3053").groups).toContain("LifelineItems");
    expect(item("3156").groups).toContain("LifelineItems");
    expect(item("3006").groups).toContain("Boots");
    expect(item("3047").groups).toContain("Boots");
  });

  it("leave out groups without an ownership limit", () => {
    expect(item("6672").groups).not.toContain("Default");
  });
});

describe("runes", () => {
  it("keep values by name and the display name", () => {
    expect(rune(8008)).toMatchObject({
      key: "LethalTempo",
      name: "Lethal Tempo",
      values: { MaxStacks: 6, Duration: 6, TTASPerStackRanged: 0.04 },
    });
  });

  it("include stat shards", () => {
    expect(rune(5005)).toMatchObject({
      name: "Attack Speed",
      values: { StatGain: 10 },
    });
  });

  it("list trees with keystone row first", () => {
    const precision = normalizeTrees(read("runes.ddragon.json")).find(
      (t) => t.key === "Precision",
    );
    expect(precision?.slots[0]).toEqual(
      expect.arrayContaining([8005, 8008, 8010]),
    );
    expect(precision?.slots).toHaveLength(4);
  });
});
