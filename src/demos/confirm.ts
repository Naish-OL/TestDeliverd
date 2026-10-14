// confirm(): a quick yes or no on something small. Low risk and an hour to
// answer by default; anything weightier deserves approve().
// Docs: https://deliverd.dev/docs/developers/sdk
//
// Try DELIVERD_DEV_OUTCOME=approved | rejected
import { approvers, deliverd } from "../client.js";

const ok = await deliverd.confirm({
  title: "Clear the staging cache?",
  description: "Pages will be slower for a few minutes while it rebuilds.",
  approvers,
});

console.log(ok ? "Clearing the staging cache." : "Leaving the cache alone.");
