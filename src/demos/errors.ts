// Errors: what the SDK throws, and how to branch on it.
// Docs: https://deliverd.dev/docs/developers/errors
//
// Runs offline. Every failure is a DeliverdError carrying the API's `code`;
// branch on that (or the isAuth / isRateLimit / isNotFound / isConflict
// helpers), never on the message.
import { Deliverd, DeliverdError, DeliverdTimeoutError } from "@deliverd/sdk";

function explain(label: string, error: unknown) {
  if (!(error instanceof DeliverdError)) throw error;
  const flags = (["isAuth", "isRateLimit", "isNotFound", "isConflict"] as const).filter((f) => error[f]);
  console.log(`${label}\n  ${error.constructor.name} code=${error.code} status=${error.status} ${flags.join(" ")}`);
  if (error.hint) console.log(`  hint: ${error.hint}`);
}

// 1. A wait that runs out: DeliverdTimeoutError, code "timeout".
const silent = new Deliverd({ mode: "development", development: { outcome: "timeout", log: false } });
try {
  await silent.approve({ title: "Nobody will answer this", timeout: 1000 });
} catch (error) {
  explain("1. Timeout", error);
  console.log(`  instanceof DeliverdTimeoutError: ${error instanceof DeliverdTimeoutError}`);
}

// 2. A call development mode doesn't simulate: 501 not_in_development_mode.
try {
  await silent.publish({ title: "Not simulated", content: "<p>Hi</p>" });
} catch (error) {
  explain("2. Not simulated", error);
}

// 3. No response at all: status 0. Points at a closed local port, so no
// request leaves the machine. `mode: "live"` overrides DELIVERD_MODE in .env.
const unreachable = new Deliverd({ mode: "live", apiKey: "dlv_not_a_real_key", baseUrl: "http://127.0.0.1:9" });
try {
  await unreachable.approve({ title: "Never sent" });
} catch (error) {
  explain("3. API unreachable", error);
}

// 4. A rejection is not an error at all.
const no = new Deliverd({ mode: "development", development: { outcome: "rejected", log: false } });
const decision = await no.approve({ title: "Rejected, not thrown" });
console.log(`4. Rejection\n  resolved normally: approved=${decision.approved} status=${decision.status}`);
