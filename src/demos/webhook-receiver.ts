// Webhooks: verify a signed delivery before trusting it.
// Docs: https://deliverd.dev/docs/developers/webhooks
//
// Runs offline: starts a local receiver, signs deliveries the way Deliverd does
// (HMAC-SHA256 over "<t>.<raw body>"), and shows which ones verify.
// Real deliveries need a public HTTPS URL, so put a tunnel in front of this
// server to receive them. Set DELIVERD_WEBHOOK_SECRET to the endpoint's secret.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { constructEvent, DELIVERY_HEADER, SIGNATURE_HEADER } from "@deliverd/sdk";

const secret = process.env.DELIVERD_WEBHOOK_SECRET ?? "whsec_demo_only";
const seen = new Set<string>();

const server = createServer(async (req, res) => {
  // Read the raw body. A parsed and re-serialised object won't verify.
  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const event = constructEvent(secret, body, req.headers[SIGNATURE_HEADER] as string | undefined);

    // Deliveries can repeat; the delivery id tells you which you've handled.
    const delivery = req.headers[DELIVERY_HEADER] as string;
    if (seen.has(delivery)) {
      res.writeHead(204).end();
      console.log(`  duplicate ${delivery}, ignored`);
      return;
    }
    seen.add(delivery);

    // Acknowledge first (Deliverd waits 10 seconds), then do the slow work.
    res.writeHead(204).end();
    console.log(`  verified ${event.event}${event.test ? " (test)" : ""}:`, event.data);
  } catch (error) {
    res.writeHead(400).end();
    console.log(`  rejected: ${(error as Error).message.split("\n")[0]}`);
  }
});

await new Promise<void>((resolve) => server.listen(Number(process.env.PORT ?? 0), resolve));
const url = `http://localhost:${(server.address() as AddressInfo).port}`;
console.log(`Receiver listening on ${url}\n`);

if (process.env.PORT) {
  console.log("PORT is set, so the receiver keeps running. Point a tunnel at it.");
} else {
  // Offline walkthrough: send ourselves signed and tampered deliveries.
  const sign = (body: string, at = Math.floor(Date.now() / 1000), key = secret) =>
    `t=${at},v1=${createHmac("sha256", key).update(`${at}.${body}`).digest("hex")}`;
  const body = JSON.stringify({
    event: "approval.approved",
    sentAt: new Date().toISOString(),
    data: { id: "apr_123", decidedBy: "Sam" },
  });
  const send = (label: string, payload: string, signature: string, delivery = "dlv_1") => {
    console.log(label);
    return fetch(url, {
      method: "POST",
      body: payload,
      headers: { [SIGNATURE_HEADER]: signature, [DELIVERY_HEADER]: delivery, "content-type": "application/json" },
    });
  };

  await send("1. Correctly signed:", body, sign(body));
  await send("2. Same delivery again:", body, sign(body));
  await send("3. Body changed after signing:", body.replace("Sam", "Mallory"), sign(body), "dlv_2");
  await send("4. Signed with the wrong secret:", body, sign(body, undefined, "whsec_wrong"), "dlv_3");
  await send("5. Older than five minutes (replay):", body, sign(body, Math.floor(Date.now() / 1000) - 600), "dlv_4");
  server.close();
}
