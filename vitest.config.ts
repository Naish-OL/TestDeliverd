import { defineConfig } from "vitest/config";

// Each case starts a demo process, so give them more than the 5s default.
export default defineConfig({ test: { testTimeout: 60_000 } });
