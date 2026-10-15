// Callbacks: ask for approval without holding a process open, and hear the
// answer when Deliverd POSTs it, signed, to your callbackUrl.
// Docs: https://deliverd.dev/docs/developers/webhooks#callbacks
//
// Try every outcome:
//   DELIVERD_DEV_OUTCOME=approved | rejected | question | timeout
// `approved` includes the approver lowering the amount, so you see a
// correction arrive. A real approver can also request changes or let it expire.
//
// Development mode sends no callbacks, so here this demo plays Deliverd's part
// (see `playDeliverd` below): it watches the simulated request and POSTs a
// signed callback to the local receiver, just as Deliverd would.
//
// Live: Deliverd only calls public HTTPS addresses, so put a tunnel in front of
// the receiver, e.g. `ngrok http 4567`, then set DEMO_CALLBACK_URL to the https
// URL it prints (and PORT if you didn't use 4567). Needs an approver who isn't
// the key's owner (403 self_approval otherwise).
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  Deliverd,
  DeliverdError,
  DELIVERY_HEADER,
  EVENT_HEADER,
  SIGNATURE_HEADER,
  constructCallback,
  type Approval,
  type CallbackEnvelope,
} from "@deliverd/sdk";
import { approvers, deliverd as liveClient } from "../client.js";

// In development the imaginary approver lowers the amount, as in the
// approve-with-changes demo. Live, it uses the shared client.
const deliverd = liveClient.development
  ? new Deliverd({ mode: "development", development: { edits: { amount: 1200 } } })
  : liveClient;

const live = !deliverd.development;
const port = Number(process.env.PORT ?? (live ? 4567 : 0));

if (live && !process.env.DEMO_CALLBACK_URL?.startsWith("https://")) {
  console.error(
    "Live callbacks need a public HTTPS address. Run `ngrok http " + port + "` and set\n" +
      "DEMO_CALLBACK_URL to the https URL it prints.",
  );
  process.exit(1);
}

// 1. Start the receiver first, so it's listening before anyone can answer.
let approval: Approval;
let secret: string;
let finish: (summary: string) => void;
let done = false;
const finished = new Promise<string>((resolve) => (finish = resolve)).finally(() => (done = true));
const seen = new Set<string>();

const server = createServer(async (req, res) => {
  // Read the raw body. A parsed and re-serialised object won't verify.
  let body = "";
  for await (const chunk of req) body += chunk;

  let envelope: CallbackEnvelope;
  try {
    envelope = constructCallback(secret, body, req.headers[SIGNATURE_HEADER] as string | undefined);
  } catch (error) {
    res.writeHead(400).end();
    console.log(`Rejected a callback: ${(error as Error).message.split("\n")[0]}`);
    return;
  }

  // Failed deliveries are retried, so the same one can arrive twice.
  const delivery = req.headers[DELIVERY_HEADER] as string | undefined;
  if (delivery && seen.has(delivery)) {
    res.writeHead(204).end();
    return;
  }
  if (delivery) seen.add(delivery);

  // Acknowledge first (Deliverd waits ten seconds), then do the work.
  res.writeHead(204).end();
  console.log(`Callback verified: ${envelope.event}`);

  try {
    await handle(envelope);
  } catch (error) {
    console.error("Handling the callback failed:", error);
  }
});

await new Promise<void>((resolve) => server.listen(port, resolve));
const localUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
console.log(`Receiver listening on ${localUrl}`);

// 2. Ask. `approve()` waits for the answer and doesn't hand back the callback
// secret, so create the request instead: the handle carries `callbackSecret`.
const proposed = { customer_id: "cus_1", amount: 1240, currency: "GBP" };
try {
  approval = await deliverd.approvals.create({
    title: "Refund £1,240 to cus_1",
    description: "Customer reported a duplicate charge.",
    risk: "medium",
    approvers,
    input: proposed,
    editableFields: ["amount"],
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    callbackUrl: live ? process.env.DEMO_CALLBACK_URL : localUrl,
    // No externalId: the secret comes back once, so a restarted run couldn't
    // verify an earlier request's callbacks. A real job would store the secret
    // with its own record, and could then reuse the request by externalId.
  });
} catch (error) {
  server.close();
  if (error instanceof DeliverdError && error.code === "self_approval") {
    console.error("You can't approve your own request. Use an agent key, or set DEMO_APPROVER to someone else.");
  } else if (error instanceof DeliverdError) {
    console.error(`Deliverd error ${error.code} (${error.status}): ${error.message}`);
  } else {
    throw error;
  }
  process.exit(1);
}

// Only the response to create() carries the secret. Keep it with the receiver.
secret = live ? approval.callbackSecret! : `whsec_dev_${randomBytes(16).toString("hex")}`;
console.log(`Asked: ${approval.url}\nNothing is polling. Waiting for Deliverd to call back...\n`);
if (!live) void playDeliverd();

// 3. Act on what the callback says, using the request as Deliverd has it now.
async function handle(envelope: CallbackEnvelope) {
  if (envelope.requestId !== approval.id) return;

  // The callback is the signal; re-reading gives the typed, current request.
  const current = await deliverd.approvals.get(envelope.requestId);

  switch (envelope.event) {
    case "approval.question":
      // Nobody decides until the question is answered.
      for (const question of current.openQuestions) {
        console.log(`Approver asked: ${question.question}`);
        await current.answer(question.id, "The customer was charged twice on 3 October.");
        console.log("Answered the approver's question. Waiting for their decision...\n");
      }
      return;
    case "approval.approved":
      for (const change of current.changes) {
        console.log(`${current.decidedBy} changed ${change.field}: ${change.from} → ${change.to}`);
      }
      // Run with approvedInput. Using `proposed` here would refund the wrong amount.
      finish(`Refunding with: ${JSON.stringify(current.approvedInput)}`);
      return;
    default:
      // Rejected, changes requested or expired: all mean don't act.
      finish(`No refund (${current.status}): ${current.note ?? "no reason given"}`);
  }
}

// How long this demo listens. The request outlives it either way: Deliverd
// sends `approval.expired` when it expires, if nobody has answered.
const listenFor = live ? 30 * 60_000 : 5_000;
const timer = setTimeout(
  () => finish("No callback yet. The request stays open until it expires, and Deliverd will call when it settles."),
  listenFor,
);
console.log(await finished);
clearTimeout(timer);
server.close();
server.closeAllConnections();

// Development mode only: stand in for Deliverd. It watches the simulated
// request and, when something happens, POSTs the callback Deliverd would
// send, signed with the request's secret. Live, none of this runs.
async function playDeliverd() {
  const sent = new Set<string>();
  let deliveries = 0;
  const send = async (event: CallbackEnvelope["event"]) => {
    const body = JSON.stringify({
      event,
      sentAt: new Date().toISOString(),
      requestType: "approval",
      requestId: approval.id,
      data: approval.toJSON(),
    });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
    await fetch(localUrl, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        [SIGNATURE_HEADER]: `t=${t},v1=${v1}`,
        [EVENT_HEADER]: event,
        [DELIVERY_HEADER]: `dlv_dev_${++deliveries}`,
      },
    });
  };

  while (approval.pending && !done) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await approval.refresh();
    for (const question of approval.openQuestions) {
      if (!sent.has(question.id)) {
        sent.add(question.id);
        await send("approval.question");
      }
    }
  }
  // Development mode settles as approved or rejected.
  if (approval.approved || approval.rejected) await send(`approval.${approval.approved ? "approved" : "rejected"}`);
}
