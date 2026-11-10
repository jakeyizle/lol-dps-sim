import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { comparePatches, latestPatch, parsePatch } from "./load";

const generated = join(import.meta.dirname, "../generated");
const file = (patch: string, name: string): unknown =>
  JSON.parse(readFileSync(join(generated, patch, `${name}.json`), "utf8"));
const files = (patch: string) => ({
  champions: file(patch, "champions"),
  items: file(patch, "items"),
  runes: file(patch, "runes"),
  constants: file(patch, "constants"),
  targets: file(patch, "targets"),
});

describe("latest patch", { tags: ["DATA-009"] }, () => {
  it("is the newest by number, not by text", () => {
    expect(latestPatch(["26.9", "26.10", "25.24"])).toBe("26.10");
    expect(latestPatch(["26.22"])).toBe("26.22");
    expect(comparePatches("27.1", "26.24")).toBeGreaterThan(0);
  });

  it("requires at least one patch", () => {
    expect(() => latestPatch([])).toThrow(/no generated patch data/);
  });
});

describe("parsePatch", () => {
  it("loads the committed 26.22 data", () => {
    const data = parsePatch(files("26.22"));
    expect(data.patch).toBe("26.22");
    expect(Object.keys(data.champions)).toContain("Jinx");
    // BUILD-009: every champion can be a target
    expect(data.targets.Garen?.stats.armor.base).toBeGreaterThan(0);
    expect(data.items["6672"]?.name).toBe("Kraken Slayer");
    expect(data.constants.attackSpeedCap).toBeGreaterThan(2);
  });

  it("rejects files from different patches", () => {
    const mixed = files("26.22");
    mixed.constants = { ...(mixed.constants as object), patch: "26.21" };
    expect(() => parsePatch(mixed)).toThrow(/disagree: 26.22, 26.21/);
  });
});
