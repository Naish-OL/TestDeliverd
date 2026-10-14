// Approve with changes: the approver can correct named fields before saying
// yes, and the agent runs with what they approved, not what it proposed.
// Docs: https://deliverd.dev/docs/developers/sdk
//
// In development mode the imaginary approver lowers the amount, so you can see
// the correction offline. Try DELIVERD_DEV_OUTCOME=rejected for the other branch.
import { Deliverd } from "@deliverd/sdk";
import { approvers, deliverd as liveClient } from "../client.js";

// This demo builds its own client in development mode, to pass `edits`: the
// correction the imaginary approver makes. Live, it uses the shared client.
const deliverd = liveClient.development
  ? new Deliverd({ mode: "development", development: { edits: { amount: 1200 } } })
  : liveClient;

const proposed = { customer_id: "cus_1", amount: 1240, currency: "GBP" };

const decision = await deliverd.approve({
  title: "Refund £1,240 to cus_1",
  description: "Customer reported a duplicate charge.",
  risk: "medium",
  approvers,
  input: proposed,
  // Only flat values can be editable, and only on single-approver requests.
  editableFields: ["amount"],
  expiresIn: "30m",
});

if (!decision.approved || !decision.input) {
  console.log(`No refund (${decision.status}): ${decision.note ?? "no reason given"}`);
} else {
  for (const change of decision.changes) {
    console.log(`${decision.decidedBy} changed ${change.field}: ${change.from} → ${change.to}`);
  }
  // Run with decision.input. Using `proposed` here would refund the wrong amount.
  console.log("Refunding with:", decision.input);
}
