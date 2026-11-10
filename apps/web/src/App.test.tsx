import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { loadLatest } from "./data";

describe("patch data", { tags: ["DATA-009"] }, () => {
  it("shows the newest generated patch", () => {
    render(<App />);
    expect(screen.getByText("Patch 26.22")).toBeDefined();
  });

  it("picks the newest patch folder", () => {
    const real = loadLatest();
    const file = (patch: string, name: string, json: object) => ({
      [`/x/generated/${patch}/${name}.json`]: { ...json, patch },
    });
    const files = (patch: string) => ({
      ...file(patch, "champions", { champions: real.champions }),
      ...file(patch, "items", { items: real.items }),
      ...file(patch, "runes", {
        runes: real.runes,
        trees: real.trees,
        shards: real.shards,
      }),
      ...file(patch, "constants", real.constants),
    });
    expect(loadLatest({ ...files("26.9"), ...files("26.10") }).patch).toBe(
      "26.10",
    );
  });
});
