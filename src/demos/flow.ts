// Flows: group every request for one job into one timeline and one evidence
// pack recording who was asked what, and what they said.
// Docs: https://deliverd.dev/docs/developers/sdk
//
// Try DELIVERD_DEV_OUTCOME=approved | rejected
import { approvers, deliverd } from "../client.js";

// With an externalId, re-running this resumes the same flow instead of
// starting a second one.
const flow = await deliverd.flows.resume({
  title: "Q3 close",
  externalId: "demo:q3-close",
});
console.log(`Flow ${flow.id}: ${flow.url}`);

const figures = await flow.collect({
  title: "Q3 headcount",
  questions: [{ prompt: "Headcount at 30 September", kind: "number" }],
  respondents: approvers ?? ["you@example.com"],
});

if (!figures.complete) {
  // No figures, nothing to file: cancel the flow rather than ask for approval.
  console.log(`No figures (${figures.status}); cancelling the flow.`);
  await flow.cancel();
} else {
  console.log(`Collected: ${JSON.stringify(figures.answers)}`);

  const decision = await flow.approve({
    title: "File the Q3 return",
    risk: "high",
    approvers,
  });
  console.log(decision.approved ? "Filing." : `Not filing (${decision.status}).`);

  // Close means the job is done; allSettled only means nothing is waiting now.
  await flow.close();
}

// In development mode the pack has the right shape but no recorded steps.
const pack = await flow.evidence();
console.log(`\nEvidence pack: ${pack.summary.steps} steps, ${pack.summary.events} events`);
for (const step of pack.steps) console.log(" ", JSON.stringify(step));
console.log(`Integrity: ${pack.integrity.algorithm} ${pack.integrity.digest}`);
