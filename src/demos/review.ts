// review(): ask people whether finished work is right, and get their verdicts.
// Docs: https://deliverd.dev/docs/developers/approvals
//
// Try DELIVERD_DEV_OUTCOME=approved | rejected (comes back as changes requested)
//
// Live: reviewers read a published report, so set DEMO_REPORT_ID to one (run
// the publish demo first). Reviewers must already be able to open it.
import { approvers, deliverd } from "../client.js";

const reportId = process.env.DEMO_REPORT_ID;
if (!deliverd.development && !reportId) {
  console.error("Set DEMO_REPORT_ID to a published report's id (see the publish demo).");
  process.exit(1);
}

const outcome = await deliverd.review({
  title: "Q3 board pack",
  reportId,
  instructions: "Check the figures against the ledger.",
  reviewers: approvers ?? ["you@example.com"],
  expiresIn: "1d",
});

// Resolves on changes requested as well as approval: both are answers.
console.log(outcome.approved ? "Approved: sending the pack." : `Not approved (${outcome.status}).`);
for (const v of outcome.verdicts) {
  console.log(`  ${v.by}: ${v.verdict}${v.note ? ` ("${v.note}")` : ""}`);
}
console.log(`Comment threads opened: ${outcome.threadCount}`);
