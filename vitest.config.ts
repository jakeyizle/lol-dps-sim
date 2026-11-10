import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "engine", include: ["packages/engine/src/**/*.test.ts"] },
      },
    ],
  },
});
