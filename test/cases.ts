// The development-mode test cases, shared by vitest and the UI's test matrix.
import type { RunResult } from "../src/runner.js";

export interface TestCase {
  demo: string;
  outcome: string;
  /** Text the output must contain. */
  expect: string;
  /** Expected exit code; 0 when omitted. */
  exitCode?: number;
}

export const cases: TestCase[] = [
  { demo: "approve", outcome: "approved", expect: "Deploying" },
  { demo: "approve", outcome: "rejected", expect: "Not deploying (rejected)" },
  { demo: "approve", outcome: "question", expect: "answered:" },
  { demo: "approve", outcome: "timeout", expect: "Nobody answered in time" },
  { demo: "approve-with-changes", outcome: "approved", expect: "amount: 1240 → 1200" },
  { demo: "approve-with-changes", outcome: "rejected", expect: "No refund (rejected)" },
  { demo: "approve-callback", outcome: "approved", expect: "changed amount: 1240 → 1200" },
  { demo: "approve-callback", outcome: "rejected", expect: "No refund (rejected)" },
  { demo: "approve-callback", outcome: "question", expect: "Answered the approver's question" },
  { demo: "approve-callback", outcome: "timeout", expect: "No callback yet" },
  { demo: "confirm", outcome: "approved", expect: "Clearing the staging cache" },
  { demo: "confirm", outcome: "rejected", expect: "Leaving the cache alone" },
  { demo: "collect", outcome: "approved", expect: "Headcount at 30 September: 42" },
  { demo: "collect", outcome: "rejected", expect: "Incomplete" },
  { demo: "collect", outcome: "timeout", expect: "No answers yet" },
  { demo: "review", outcome: "approved", expect: "Approved: sending the pack" },
  { demo: "review", outcome: "rejected", expect: "changes_requested" },
  { demo: "flow", outcome: "approved", expect: "Filing." },
  { demo: "flow", outcome: "rejected", expect: "cancelling the flow" },
  { demo: "gate", outcome: "approved", expect: "Refunding with" },
  { demo: "gate", outcome: "denied", expect: "Not refunding (denied)" },
  { demo: "gate", outcome: "rejected", expect: "Not refunding (rejected)" },
  { demo: "adapters", outcome: "approved", expect: "Bash {\"command\":\"npm publish\"} → allow" },
  { demo: "adapters", outcome: "rejected", expect: "→ deny" },
  { demo: "publish", outcome: "approved", expect: "isn't simulated", exitCode: 1 },
  { demo: "errors", outcome: "approved", expect: "code=not_in_development_mode" },
  { demo: "webhook-receiver", outcome: "approved", expect: "duplicate dlv_1" },
];

export function passed(testCase: TestCase, result: RunResult): boolean {
  return result.output.includes(testCase.expect) && result.code === (testCase.exitCode ?? 0);
}
