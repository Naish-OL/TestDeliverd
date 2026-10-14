// Runs every demo in development mode, the way `npm run demo` does, and checks
// it ends the way it should. Nothing here touches the live API.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

async function demo(name: string, outcome?: string) {
  // Shell variables win over .env, so this forces development mode.
  const env: NodeJS.ProcessEnv = { ...process.env, DELIVERD_MODE: "development", DELIVERD_DEV_OUTCOME: outcome ?? "approved" };
  try {
    const { stdout } = await run("npx", ["tsx", "src/demo.ts", name], { env });
    return { code: 0, out: stdout };
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string };
    return { code: e.code, out: e.stdout + e.stderr };
  }
}

const cases: [demo: string, outcome: string, expected: string][] = [
  ["approve", "approved", "Deploying"],
  ["approve", "rejected", "Not deploying (rejected)"],
  ["approve", "question", "answered:"],
  ["approve", "timeout", "Nobody answered in time"],
  ["approve-with-changes", "approved", "amount: 1200"],
  ["confirm", "rejected", "Leaving the cache alone"],
  ["collect", "approved", "Headcount at 30 September: 42"],
  ["collect", "rejected", "Incomplete"],
  ["review", "rejected", "changes_requested"],
  ["flow", "approved", "Filing."],
  ["flow", "rejected", "cancelling the flow"],
  ["gate", "approved", "Refunding with"],
  ["gate", "denied", "Not refunding (denied)"],
  ["adapters", "rejected", "→ deny"],
  ["errors", "approved", "code=not_in_development_mode"],
  ["webhook-receiver", "approved", "duplicate dlv_1"],
];

describe("demos in development mode", () => {
  it.each(cases)("%s with %s", async (name, outcome, expected) => {
    const { code, out } = await demo(name, outcome);
    expect(out).toContain(expected);
    expect(code).toBe(0);
  });

  it("publish says it needs a live key", async () => {
    const { code, out } = await demo("publish");
    expect(out).toContain("isn't simulated");
    expect(code).toBe(1);
  });
});
