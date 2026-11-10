import { expect, it } from "vitest";

import { formatReport } from "./report";

const base = { patch: "26.22", ddragonVersion: "16.22.1", warnings: [] };

it("lists drift lines and warnings", () => {
  expect(
    formatReport({
      ...base,
      previousPatch: "26.21",
      drift: ["champions.json: changed a: 1 → 2"],
      warnings: ["Jinx: attackDamage.perLevel: game file 3, Data Dragon 0"],
    }),
  ).toBe(
    [
      "Patch 26.22 (game version 16.22.1).",
      "",
      "### Changes from 26.21",
      "",
      "```",
      "champions.json: changed a: 1 → 2",
      "```",
      "",
      "### Source disagreements",
      "",
      "- Jinx: attackDamage.perLevel: game file 3, Data Dragon 0",
      "",
    ].join("\n"),
  );
});

it("says when nothing changed or there is no earlier patch", () => {
  expect(
    formatReport({ ...base, previousPatch: "26.21", drift: [] }),
  ).toContain("None.");
  expect(formatReport({ ...base, drift: [] })).toContain(
    "No earlier patch to compare with.",
  );
});
