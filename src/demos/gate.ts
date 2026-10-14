// gate(): ask your organisation's policy before a consequential action. A rule
// answers at once, or a person decides when no rule settles it.
// Docs: https://deliverd.dev/docs/developers/gate
//
// Try DELIVERD_DEV_OUTCOME=approved | denied | rejected
// `denied` is a rule's refusal (instant, nobody asked); `approved` and
// `rejected` go to a person first. Development mode doesn't check the input
// against a schema.
//
// Live, it also needs:
//   - the action registered first (`deliverd actions push`, or
//     POST /api/v1/actions with an owner or admin key). See ACTION below.
//   - Business or Enterprise plan for rules to apply; otherwise every gated
//     action goes to a person.
import { DeliverdError } from "@deliverd/sdk";
import { deliverd } from "../client.js";

// The definition this demo expects to be registered.
export const ACTION = {
  actionId: "demo.refund",
  name: "Issue customer refund (demo)",
  displayTitle: "Refund {{amount}} {{currency}} to {{customer_id}}",
  editableFields: ["amount"],
  inputSchema: {
    type: "object",
    required: ["customer_id", "amount", "currency"],
    properties: {
      customer_id: { type: "string" },
      amount: { type: "number", minimum: 0 },
      currency: { type: "string", enum: ["GBP", "EUR", "USD"] },
    },
  },
};

const orderId = "ord_8812";
try {
  const decision = await deliverd.gate({
    action: ACTION.actionId,
    // Required: a retry with the same externalId gets the same decision back.
    externalId: `refund:${orderId}`,
    input: { customer_id: "cus_1", amount: 1240, currency: "GBP" },
    reason: "Customer reported a duplicate charge",
    timeout: deliverd.development ? 5000 : 10 * 60_000,
  });

  // A refusal is a normal answer (200), not an error.
  if (!decision.allowed) {
    console.log(`Not refunding (${decision.status}): ${decision.reason ?? "no reason given"}`);
  } else {
    // Run with decision.input: what the schema validated and the approver saw.
    console.log(`Allowed${decision.rule ? ` by rule ${decision.rule}` : ""}. Refunding with:`, decision.input);
  }
} catch (error) {
  // Thrown for an unregistered action, input that fails the schema, or a failed wait.
  if (error instanceof DeliverdError && error.code === "unknown_action") {
    console.error(`Register ${ACTION.actionId} first (owner or admin key):\n${JSON.stringify(ACTION, null, 2)}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
