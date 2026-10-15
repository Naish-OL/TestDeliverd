// Runs every demo in development mode and checks it ends the way it should.
// The cases live in cases.ts so the UI's test matrix runs the same ones.
// Nothing here touches the live API.
import { describe, expect, it } from "vitest";
import { runDemo } from "../src/runner.js";
import { cases } from "./cases.js";

describe("demos in development mode", () => {
  it.each(cases)("$demo with $outcome", async (testCase) => {
    const result = await runDemo(testCase.demo, { mode: "development", outcome: testCase.outcome });
    expect(result.output).toContain(testCase.expect);
    expect(result.code).toBe(testCase.exitCode ?? 0);
  });
});
