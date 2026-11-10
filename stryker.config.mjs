import { MUTATE } from "./scripts/mutate.ts";

/** PLAN §8. A full run audits everything; `pnpm mutate:changed` narrows `mutate` to a diff. */
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // pnpm's layout hides plugins from Stryker's auto-discovery.
  plugins: ["@stryker-mutator/vitest-runner", "./scripts/stryker-noise.ts"],
  ignorers: ["noise"],
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts", related: true },
  mutate: MUTATE,
  coverageAnalysis: "perTest",
  timeoutMS: 30_000,
  reporters: ["clear-text", "json", "html"],
  clearTextReporter: { allowColor: false, logTests: false },
  tempDirName: ".stryker-tmp",
};
