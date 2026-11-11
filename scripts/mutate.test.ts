import { describe, expect, it } from "vitest";

import {
  addedDisables,
  changedRanges,
  isMutable,
  mutateArgs,
} from "./mutate.ts";

const diff = [
  "diff --git a/packages/engine/src/a.ts b/packages/engine/src/a.ts",
  "--- a/packages/engine/src/a.ts",
  "+++ b/packages/engine/src/a.ts",
  "@@ -3 +3 @@ export",
  "-old",
  "+new",
  "@@ -10,2 +10,0 @@",
  "-gone",
  "-gone",
  "@@ -20,0 +19,3 @@",
  "+// Stryker disable next-line StringLiteral: label only",
  "+// Stryker disable next-line all",
  "+x",
  "diff --git a/packages/engine/src/a.test.ts b/packages/engine/src/a.test.ts",
  "+++ b/packages/engine/src/a.test.ts",
  "@@ -1 +1,2 @@",
  "+// Stryker disable next-line all",
  "diff --git a/packages/engine/src/new.ts b/packages/engine/src/new.ts",
  "--- /dev/null",
  "+++ b/packages/engine/src/new.ts",
  "@@ -0,0 +1,4 @@",
  "diff --git a/packages/engine/src/old.ts b/packages/engine/src/old.ts",
  "--- a/packages/engine/src/old.ts",
  "+++ /dev/null",
  "@@ -1,4 +0,0 @@",
].join("\n");

describe("isMutable", () => {
  it("covers engine source, not tests, types or other packages", () => {
    expect(isMutable("packages/engine/src/core/sim.ts")).toBe(true);
    expect(isMutable("packages/engine/src/core/sim.test.ts")).toBe(false);
    expect(isMutable("packages/engine/src/x.d.ts")).toBe(false);
    expect(isMutable("packages/engine/test/champions.ts")).toBe(false);
    expect(isMutable("scripts/mutate.ts")).toBe(false);
  });

  it("covers web logic, not components or its tests", () => {
    expect(isMutable("apps/web/src/model/persist.ts")).toBe(true);
    expect(isMutable("apps/web/src/ui/useAnalysis.ts")).toBe(true);
    expect(isMutable("apps/web/src/ui/context.ts")).toBe(false);
    expect(isMutable("apps/web/src/ui/Matrix.tsx")).toBe(false);
    expect(isMutable("apps/web/src/model/persist.test.ts")).toBe(false);
  });
});

describe("changedRanges", () => {
  it("maps hunks to new-side ranges, skipping deletions and unmutated files", () => {
    expect(mutateArgs(changedRanges(diff))).toEqual([
      "packages/engine/src/a.ts:3-3",
      "packages/engine/src/a.ts:19-21",
      "packages/engine/src/new.ts:1-4",
    ]);
  });

  it("is empty for an empty diff", () => {
    expect(changedRanges("").size).toBe(0);
  });
});

describe("addedDisables", () => {
  it("finds added disables in mutable files and whether each has a reason", () => {
    expect(addedDisables(diff)).toEqual([
      {
        file: "packages/engine/src/a.ts",
        text: "// Stryker disable next-line StringLiteral: label only",
        reason: true,
      },
      {
        file: "packages/engine/src/a.ts",
        text: "// Stryker disable next-line all",
        reason: false,
      },
    ]);
  });
});
