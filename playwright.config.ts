import { defineConfig } from "@playwright/test";

const port = 4399;

// End-to-end tests for the UI (`npm run test:ui`). They start their own server
// with UI_DEV_ONLY set, so nothing they do can send a live request.
export default defineConfig({
  testDir: "e2e",
  // The matrix test runs all 23 demo cases.
  timeout: 120_000,
  // One worker: the matrix already runs four demo processes at a time.
  workers: 1,
  // Terse output: a dot per test when piped (CI, Claude), a live line in a terminal.
  reporter: process.stdout.isTTY ? "line" : "dot",
  use: {
    baseURL: `http://localhost:${port}`,
    // The installed Chrome, so there's no browser download.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx tsx src/ui/server.ts",
    url: `http://localhost:${port}/api/status`,
    env: { UI_PORT: String(port), UI_DEV_ONLY: "1" },
    reuseExistingServer: false,
  },
});
