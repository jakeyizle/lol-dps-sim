import { defineConfig, devices } from "@playwright/test";

const port = 4173;

/** E2E against the production build (`vite preview`), served under the Pages base path. */
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${String(port)}/lol-dps-sim/` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}/lol-dps-sim/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
