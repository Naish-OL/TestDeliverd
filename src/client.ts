// The one Deliverd client every demo shares.
//
// `new Deliverd()` with no options reads DELIVERD_MODE, DELIVERD_API_KEY and
// DELIVERD_BASE_URL from the environment, so switching between development
// mode and a real organisation is a change to .env, not to code.
import { Deliverd } from "@deliverd/sdk";

export const deliverd = new Deliverd();

/** Who live demos ask. Undefined means the organisation's owners and admins. */
export const approvers = process.env.DEMO_APPROVER ? [process.env.DEMO_APPROVER] : undefined;

console.log(
  deliverd.development
    ? `[development mode] imaginary approver, outcome: ${process.env.DELIVERD_DEV_OUTCOME ?? "approved"}\n`
    : `[live] requests go to ${approvers?.join(", ") ?? "your organisation's owners and admins"}\n`,
);
