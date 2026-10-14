# TestDeliverd

A TypeScript app that tests and showcases the [Deliverd](https://deliverd.dev) SDK (`@deliverd/sdk`).

Deliverd lets an agent ask a person for an approval, review, answer or decision, then carry on based on what they said. It also lets agents publish reports to a secure, persistent address. Each demo in this repo exercises one SDK capability in a small, readable script.

> **Status:** all demos built and tested in development mode. Not yet run against a live organisation.

## Prerequisites

- Node.js 20 or later (required by `@deliverd/sdk`)
- npm

## Quick start (no account needed)

```bash
npm install
cp .env.example .env
npm run demo approve
```

`.env.example` sets `DELIVERD_MODE=development`. In development mode the SDK makes no network calls: an imaginary approver answers and the SDK prints what a real approver would see. Only the network is swapped out; your code runs as it would in production.

Choose how the imaginary approver answers with `DELIVERD_DEV_OUTCOME`:

| Outcome | What happens |
|---|---|
| `approved` (default) | The request is approved |
| `rejected` | Resolves normally with `approved: false`. A rejection is an answer, not an error |
| `denied` | Refused |
| `timeout` | Throws `DeliverdTimeoutError` |
| `question` | The approver asks a question; needs an `onQuestion` handler |

```bash
DELIVERD_DEV_OUTCOME=rejected npm run demo approve
```

## Running against a real organisation

1. Sign up at [deliverd.dev](https://deliverd.dev) and copy your API key (it starts with `dlv_` and is shown only once).
2. In `.env`, remove `DELIVERD_MODE=development`, set `DELIVERD_API_KEY`, and set `DEMO_APPROVER` to who should be asked.
3. Run a demo. Real approvers get an email and an inbox item, so only send requests to people who expect them.

Deliverd never lets you approve your own request. With a personal key, a request sent to your own email fails with `403 self_approval`. To approve demo requests yourself, create an agent key (Admin → Agents) so the agent is the requester. Keep a personal key for owner-only setup, such as registering gate actions.

Personal keys carry every scope your role has. Agent keys (Admin → Agents) are narrower: they can't register actions, manage policy or webhooks, or decide anything.

## Demos

Run any of these with `npm run demo <name>`. "Outcomes" are the `DELIVERD_DEV_OUTCOME` values worth trying.

| Demo | Shows | Dev mode | Outcomes | Live needs |
|---|---|---|---|---|
| `approve` | `deliverd.approve()`, `onQuestion`, timeouts | Yes | `approved` `rejected` `question` `timeout` | An approver who isn't the key's owner |
| `approve-with-changes` | `editableFields`, acting on `decision.input`, `decision.changes` | Yes | `approved` `rejected` | Same |
| `confirm` | `deliverd.confirm()`: a quick yes/no | Yes | `approved` `rejected` | Same |
| `collect` | `deliverd.collect()`: typed questions, checking `complete` | Yes | `approved` `rejected` `timeout` | Named respondents (`DEMO_APPROVER`) |
| `review` | `deliverd.review()`: verdicts and comment threads | Yes | `approved` `rejected` | `DEMO_REPORT_ID` from the `publish` demo |
| `flow` | `flows.resume()`, `flow.collect/approve/close/cancel`, evidence pack | Yes | `approved` `rejected` | The evidence pack is empty in dev mode |
| `gate` | `deliverd.gate()`: policy decides, or a person | Yes | `approved` `denied` `rejected` | `demo.refund` registered with an owner/admin key (the definition is in the demo) |
| `publish` | `deliverd.publish()`, `reports.versions()`, `reports.update()` with `expectedVersion` | No (501) | n/a | A live key. Publishes `testdeliverd/demo` |
| `webhook-receiver` | `constructEvent()`: valid, duplicate, tampered, wrong-secret and replayed deliveries | Offline | n/a | `PORT` set, a public HTTPS tunnel and `DELIVERD_WEBHOOK_SECRET` |
| `adapters` | `deliverdCanUseTool` for the Claude Agent SDK, called as the Agent SDK would | Yes | `approved` `rejected` | Same as `approve` |
| `errors` | `DeliverdError` codes and flags, `DeliverdTimeoutError`, rejection isn't an error | Offline | n/a | Nothing |

Development mode simulates approvals, reviews, collections, flows, tasks and the gate. Publishing and the rest of the API return `501 not_in_development_mode`. It doesn't validate gate input against the action's schema.

## Scripts

| Script | Purpose |
|---|---|
| `npm run demo <name>` | Run a demo with `tsx` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `vitest`: runs every demo in development mode and checks its output |

## Layout

```
src/
  demo.ts          loads .env, then runs src/demos/<name>.ts
  client.ts        shared Deliverd client setup
  demos/<name>.ts  one self-contained demo per SDK feature
test/
  demos.test.ts    smoke tests for every demo (development mode only)
docs/
  sdk-notes.md     condensed SDK reference (with a last-checked date)
.env.example       environment variables
CLAUDE.md          instructions for Claude Code
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DELIVERD_MODE` | `development` runs with no key or network |
| `DELIVERD_DEV_OUTCOME` | The imaginary approver's answer in development mode |
| `DELIVERD_API_KEY` | API key; the SDK reads it when none is passed |
| `DELIVERD_BASE_URL` | SDK address for non-hosted deployments |
| `DELIVERD_WEBHOOK_SECRET` | Webhook signing secret (this repo's name; the SDK doesn't define one) |
| `DEMO_APPROVER` | Who live demos ask (this repo's name). Unset means your organisation's owners and admins |
| `DEMO_REPORT_ID` | The report the live `review` demo asks about (printed by the `publish` demo) |

Comment out variables you don't use rather than leaving them blank: the SDK treats an empty value as set.

## Deliverd docs

- [Developer overview](https://deliverd.dev/docs/developers) · [Quickstart](https://deliverd.dev/quickstart) · [SDKs](https://deliverd.dev/docs/developers/sdk)
- [Authentication](https://deliverd.dev/docs/developers/authentication) · [Approvals, reviews and requests](https://deliverd.dev/docs/developers/approvals) · [The gate](https://deliverd.dev/docs/developers/gate)
- [Webhooks and callbacks](https://deliverd.dev/docs/developers/webhooks) · [Publishing](https://deliverd.dev/docs/developers/publishing) · [Errors and limits](https://deliverd.dev/docs/developers/errors)
- [API reference](https://deliverd.dev/docs/api)

## License

See [LICENSE](LICENSE).
