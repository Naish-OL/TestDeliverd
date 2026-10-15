import { defineConfig } from "vitest/config";

// Each case starts a demo process, so give them more than the 5s default.
// Only test/: the Playwright specs in e2e/ run with `npm run test:ui`.
export default defineConfig({ test: { include: ["test/**/*.test.ts"], testTimeout: 60_000 } });
