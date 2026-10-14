// approve(): ask a person before acting, and branch on their answer.
// Docs: https://deliverd.dev/docs/developers/sdk
//
// Try every outcome:
//   DELIVERD_DEV_OUTCOME=approved | rejected | timeout | question
//
// Live: a personal key can't send a request to its own owner (403
// self_approval). Use an agent key, or set DEMO_APPROVER to someone else.
import { DeliverdError, DeliverdTimeoutError } from "@deliverd/sdk";
import { approvers, deliverd } from "../client.js";

try {
  const decision = await deliverd.approve({
    title: "Deploy TestDeliverd to production",
    description: "Ship 14 commits to the live site.",
    risk: "high",
    approvers,
    expiresIn: "30m",
    // Stop waiting after five minutes (five seconds in development mode, so the
    // timeout outcome is quick to try). The request stays open until it expires.
    timeout: deliverd.development ? "5s" : "5m",
    // The approver can ask a question. Return a string to answer it here, or
    // null to leave it for a person.
    onQuestion: (question) => {
      console.log(`Approver asked: ${question.question}`);
      return "It's the release that went through staging this morning.";
    },
  });

  // A rejection is an answer, not an error: approve() resolves either way.
  if (decision.approved) {
    console.log(`Approved by ${decision.decidedBy}. Deploying...`);
  } else {
    console.log(`Not deploying (${decision.status}): ${decision.note ?? "no reason given"}`);
  }
  console.log(`Decision page: ${decision.url}`);
} catch (error) {
  // approve() throws only when the wait itself failed. Branch on `code`.
  if (error instanceof DeliverdTimeoutError) {
    console.log("Nobody answered in time. The request stays open until it expires.");
  } else if (error instanceof DeliverdError && error.code === "self_approval") {
    console.error("You can't approve your own request. Use an agent key, or set DEMO_APPROVER to someone else.");
    process.exitCode = 1;
  } else if (error instanceof DeliverdError) {
    console.error(`Deliverd error ${error.code} (${error.status}): ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
