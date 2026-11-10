import { describe, expect, it } from "vitest";

import { fakeFetch } from "../test/fixtures";
import { resolvePatch, toPublicPatch } from "./patch";

describe("public patch numbers", { tags: ["DATA-021"] }, () => {
  it("are the game version's major + 10", () => {
    expect(toPublicPatch("16.22")).toBe("26.22");
    expect(toPublicPatch("16.1")).toBe("26.1");
  });

  it("name the newest game version by default", async () => {
    expect(await resolvePatch(fakeFetch(["16.22.1", "16.21.1"]))).toEqual({
      ddragonVersion: "16.22.1",
      gamePatch: "16.22",
      patch: "26.22",
    });
  });

  it("map a requested public patch to its game version", async () => {
    const r = await resolvePatch(fakeFetch(["16.22.1", "16.21.1"]), "26.21");
    expect(r).toMatchObject({ ddragonVersion: "16.21.1", gamePatch: "16.21" });
  });

  it("reject a game version given as the requested patch", async () => {
    await expect(resolvePatch(fakeFetch(["16.22.1"]), "16.22")).rejects.toThrow(
      /no version for patch 16\.22/,
    );
  });
});
