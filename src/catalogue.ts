// What each demo shows and what running it live does. The UI reads this; keep
// it in step with the Demos table in README.md when you add a demo.

/** Whether development mode can run it: simulated, needs no API at all, or live only. */
export type DevSupport = "yes" | "offline" | "no";

export interface DemoInfo {
  name: string;
  title: string;
  shows: string;
  dev: DevSupport;
  /** DELIVERD_DEV_OUTCOME values worth trying, first is the default. */
  outcomes: string[];
  /** What a live run needs to succeed. */
  liveNeeds: string;
  /** What a live run does in the real organisation. Null when it touches nothing. */
  liveEffect: string | null;
}

const asksAPerson = "Sends a real request to DEMO_APPROVER (or your owners and admins), who gets an email.";
const notTheOwner = "An approver who isn't the key's owner. A personal key asking itself gets 403 self_approval.";

export const catalogue: DemoInfo[] = [
  {
    name: "approve",
    title: "Ask before acting",
    shows: "approve(), answering an approver's question with onQuestion, and timeouts",
    dev: "yes",
    outcomes: ["approved", "rejected", "question", "timeout"],
    liveNeeds: notTheOwner,
    liveEffect: asksAPerson,
  },
  {
    name: "approve-with-changes",
    title: "Approve with changes",
    shows: "editableFields, then acting on decision.input rather than the proposal",
    dev: "yes",
    outcomes: ["approved", "rejected"],
    liveNeeds: notTheOwner,
    liveEffect: asksAPerson,
  },
  {
    name: "approve-callback",
    title: "Hear back by callback",
    shows: "approvals.create() with callbackUrl, then constructCallback() on each signed answer, with nothing polling",
    dev: "yes",
    outcomes: ["approved", "rejected", "question", "timeout"],
    liveNeeds: "DEMO_CALLBACK_URL set to a public HTTPS tunnel (e.g. ngrok) to PORT (default 4567), and " +
      "an approver who isn't the key's owner.",
    liveEffect: asksAPerson,
  },
  {
    name: "confirm",
    title: "Quick yes or no",
    shows: "confirm(): low risk, an hour to answer, returns a boolean",
    dev: "yes",
    outcomes: ["approved", "rejected"],
    liveNeeds: notTheOwner,
    liveEffect: asksAPerson,
  },
  {
    name: "collect",
    title: "Ask typed questions",
    shows: "collect(): number, boolean, choice and long-text answers, checking complete first",
    dev: "yes",
    outcomes: ["approved", "rejected", "timeout"],
    liveNeeds: "Named respondents in DEMO_APPROVER.",
    liveEffect: asksAPerson,
  },
  {
    name: "review",
    title: "Review finished work",
    shows: "review(): each reviewer's verdict and the comment threads they opened",
    dev: "yes",
    outcomes: ["approved", "rejected"],
    liveNeeds: "DEMO_REPORT_ID set to a report from the publish demo.",
    liveEffect: asksAPerson,
  },
  {
    name: "flow",
    title: "Group a job's requests",
    shows: "flows.resume(), collect then approve, close or cancel, and the evidence pack",
    dev: "yes",
    outcomes: ["approved", "rejected"],
    liveNeeds: notTheOwner,
    liveEffect: "Starts the flow \"Q3 close\" and sends real requests to DEMO_APPROVER.",
  },
  {
    name: "gate",
    title: "Ask policy first",
    shows: "gate(): a rule allows or denies at once, or a person decides",
    dev: "yes",
    outcomes: ["approved", "denied", "rejected"],
    liveNeeds: "The demo.refund action registered with an owner or admin key (definition in src/demos/gate.ts).",
    liveEffect: "Evaluates demo.refund against your organisation's policy; may send it to a person.",
  },
  {
    name: "publish",
    title: "Publish a report",
    shows: "publish(), reports.versions(), and reports.update() with expectedVersion",
    dev: "no",
    outcomes: [],
    liveNeeds: "A live key.",
    liveEffect: "Creates or updates the report testdeliverd/demo in your organisation.",
  },
  {
    name: "webhook-receiver",
    title: "Verify webhooks",
    shows: "constructEvent() on valid, duplicate, tampered, wrong-secret and replayed deliveries",
    dev: "offline",
    outcomes: [],
    liveNeeds: "Nothing: it runs offline in both modes.",
    liveEffect: null,
  },
  {
    name: "adapters",
    title: "Agent framework adapter",
    shows: "deliverdCanUseTool for the Claude Agent SDK, called as the Agent SDK would",
    dev: "yes",
    outcomes: ["approved", "rejected"],
    liveNeeds: notTheOwner,
    liveEffect: asksAPerson,
  },
  {
    name: "errors",
    title: "Errors",
    shows: "DeliverdError codes and flags, DeliverdTimeoutError, and why a rejection isn't an error",
    dev: "offline",
    outcomes: [],
    liveNeeds: "Nothing: it runs offline in both modes.",
    liveEffect: null,
  },
];
