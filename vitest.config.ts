import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { scenarioTags } from "./scripts/scenarios.ts";

export default defineConfig({
  test: {
    tags: scenarioTags(),
    projects: [
      {
        extends: true,
        test: {
          name: "engine",
          include: ["packages/engine/src/**/*.test.ts"],
          exclude: ["packages/engine/src/bench.test.ts"],
        },
      },
      // CMP-005 times the engine, so it runs on its own (`pnpm test:bench`).
      {
        extends: true,
        test: { name: "bench", include: ["packages/engine/src/bench.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "data",
          include: [
            "packages/data/src/**/*.test.ts",
            "packages/data-pipeline/src/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: { name: "scripts", include: ["scripts/**/*.test.ts"] },
      },
    ],
  },
});
