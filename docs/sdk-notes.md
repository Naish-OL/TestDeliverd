# Deliverd SDK notes

Condensed from https://deliverd.dev/docs/developers and its subpages. **Last checked: 2026-10-15.** Where these notes and the live docs disagree, the docs win; update this file.

## Package

- `npm install @deliverd/sdk`. Node 20+, no dependencies.
- `import { deliverd, Deliverd, constructEvent, constructCallback, DeliverdError, DeliverdTimeoutError } from "@deliverd/sdk"`
- Adapters: `@deliverd/sdk/adapters` (Claude Agent SDK `canUseTool`, AI SDK tool approval, OpenAI Agents SDK interruptions, LangGraph). Each tool call becomes one request keyed by its call ID.
- `deliverd` is a default instance that reads `DELIVERD_API_KEY`. Alternatively `new Deliverd({ apiKey, mode: "development", development: { outcome } })`.
- Retries: up to 3 attempts, honours `Retry-After`. Retries 429 and 5xx, not other 4xx. Every POST carries an idempotency key that is reused across retries.

## Environment

| Variable | Meaning |
|---|---|
| `DELIVERD_API_KEY` | Key used when none is passed (`dlv_…`) |
| `DELIVERD_BASE_URL` | Non-hosted deployments |
| `DELIVERD_MODE=development` | No key, no network; an imaginary approver answers |
| `DELIVERD_DEV_OUTCOME` | `approved` (default), `rejected`, `denied`, `timeout`, `question`. `denied` is for the gate; on an approval it acts as `rejected` |
| `DELIVERD_URL`, `DELIVERD_TOKEN` | CLI only |

Development mode (checked in SDK 0.25.0 source) simulates approvals, reviews, collections, flows, tasks and the gate. Everything else, including publish and reports, fails with `501 not_in_development_mode`. Gate outcomes: `denied` settles instantly as a rule refusal; `approved` and `rejected` go through `pending` to a person. The simulated gate doesn't validate input against a schema, and `externalId` reuse works within one process. Flow evidence packs come back empty. Options: `outcome` (or a function of the request), `delay`, `note`, `edits` (the approver's corrections, for approve-with-changes), `question`, `log`.

**Don't leave optional variables blank.** The SDK uses `??`, so `DELIVERD_BASE_URL=` gives an empty base URL (`Invalid URL`) and `DELIVERD_DEV_OUTCOME=` gives the outcome `""`. Comment unused lines out instead.

## approve(options) → decision

Options: `title` (required, ≤200 chars), `description`, `risk` (`low`|`medium`|`high`|`critical`, default `medium`), `approvers` (names, emails or groups, ≤20; default: org owners and admins), `externalId`, `reuse` (default true), `input`, `editableFields`, `expiresIn` (`"30m"`, `"4h"`, `"2d"`; default 1 day) or `expiresAt`, `timeout`, `onQuestion(q: { id, question, answer, askedAt, answeredAt }) => string | null`, `onPoll`, `signal`, `callbackUrl`. In 0.25.0 `approve()` still waits when given a `callbackUrl` and drops the secret; for callbacks use `approvals.create()` (below). The REST API also accepts `factors`, `links`, `reportId`, `flowId` and `metadata`.

Decision: `approved`, `status`, `decidedBy`, `decidedById`, `decidedAt`, `note`, `id`, `url`, `input` (null unless approved; **use this**), `changes: { field, from, to }[]`, `approval` (the raw request).

Statuses: `pending`, `approved`, `rejected`, `changes_requested`, `expired`, `cancelled`. A personal key can't ask its own owner: `403 self_approval`. Resolves on rejection; throws only on timeout, abort or an unreachable API. Editable fields must be flat values and work only on single-approver requests. Matching ethics rules appear in `concerns`.

## Other calls

- `review({ title, reportId, instructions, reviewers })` returns `approved`, `verdicts`, and comment-thread counts. Statuses: `approved`, `changes_requested`, `expired`, `cancelled`.
- `collect({ title, instructions?, questions: [{ prompt, kind, options?, required? }], respondents })` returns `complete` and `answers` (keyed by prompt). Kinds: `text`, `long_text`, `number`, `date`, `choice`, `multi_choice`, `boolean`. Limits: ≤40 questions, ≤50 respondents.
- `confirm({ title, ... })` returns a boolean.
- `gate({ action, externalId, input, wait? })` returns `allowed`, `status`, `canExecute`, `input`, `reason`, `rule`, `basis`, `approvalUrl`, `changes`.
  - Statuses: `allowed`, `denied`, `pending`, `approved`, `rejected`, `expired`, `cancelled`, `changes_requested` (resubmit with `supersedesGateId`), `revoked`, `used`.
  - Actions are registered with `deliverd actions push` or `POST /api/v1/actions` (owner/admin key only).
  - Rules apply only on Business and Enterprise plans. Test rules with `deliverd policy simulate`.
- `flows.resume({ title, externalId })` returns a handle with `.id`, `.collect()`, `.review()`, `.close()`.
- `publish({ title, slug, content, audience, living, flowId? })` returns `{ report }` with `report.url`. HTML ≤2 MB inline, or `files: [{ path, content }]`. A held publish returns `status: "pending_approval"`.
- `reports.versions(slug)` returns `latestVersion`. `reports.update(slug, { content, changeSummary, expectedVersion })`.
- Resource namespaces `approvals`, `reviews`, `collections` and `gates` each offer create-without-waiting, `list()` (follows all pages) / `listPage()` (returns the cursor), and cancel.

## Webhooks and callbacks

- `constructEvent(signingSecret, rawBody, signatureHeader)` and `constructCallback(callbackSecret, rawBody, signature)` return the envelope or throw. Timestamp tolerance is 5 minutes.
- Headers: `Deliverd-Event`, `Deliverd-Delivery` (use it to drop duplicates), `Deliverd-Signature: t=…,v1=…` (HMAC-SHA256 over `<t>.<raw body>`).
- Callbacks: pass `callbackUrl` to `approvals.create()` (also reviews, collections, gates). The secret is per request and only on that response: `handle.callbackSecret`. `approvals.get(id)` re-reads the request (`approvedInput`, `changes`, `openQuestions`); `handle.answer(questionId, text)` answers a question.
- Callback events (approval): `approval.approved`, `.rejected`, `.changes_requested`, `.expired`, `.question` (nobody decides until you answer). Retries: 5 attempts, 1, 4, 16 and 64 minutes apart. The docs don't list the fields of `data` (the same object the organisation's webhook carries).
- Development mode never POSTs callbacks and returns no `callbackSecret`; it does serve `approvals.get`, answers and cancel.
- Envelope: `{ event, sentAt, data }`; callbacks add `requestType` and `requestId`; test sends add `test: true`.
- Respond 2xx within 10 s. Endpoints must be public HTTPS; loopback and private addresses are refused.
- Events: `approval.*` (requested, approved, rejected, expired, escalated, question, answered, changes_requested), `review.*`, `collection.requested|completed`, `flow.completed`, `gate.*` (denied by default; others opt-in), `task.*`, `report.*`, `comment.created`, `access.requested`, `schedule.due`, `publish.held`.

## Errors

`DeliverdError { code, status, details, hint, isAuth, isRateLimit, isNotFound, isConflict }`. `DeliverdTimeoutError` has `code: "timeout"`.

| Status | Codes |
|---|---|
| 400 | `validation_error`, `unknown_approver`, `ambiguous_approver`, `invalid_input`, `invalid_cursor` |
| 401 | `auth_error` |
| 402 | `feature_unavailable`, `plan_required`, `plan_limit`, `storage_limit`, `seat_limit`, `limit_reached` |
| 403 | `insufficient_scope`, `self_approval`, `refused_by_rule`, `action_not_permitted`, `agent_not_permitted`, `not_permitted`, `public_sharing_denied` |
| 404 | `agent_not_found`, `unknown_action`, `question_not_found`, `upload_not_found` |
| 409 | `already_answered`, `version_conflict`, `approval_pending`, `idempotency_in_progress` |
| 422 | `scan_blocked`, `idempotency_key_reused` |
| 429 | `rate_limited` (120 requests/min per key) |

## Scopes

`approvals:*`, `reviews:*`, `collections:*`, `flows:*`, `tasks:*`, `gates:read|write|execute`, `reports:read|write|share`, `actions:*`, `policies:*`, `webhooks:manage`, `comments:*`, `schedules:*`, `audiences:read`, `workspaces:read`, `agents:read`. Agent keys can't hold `actions:*`, `policies:*`, `webhooks:manage` or `schedules:write`.

## Adapters (checked in 0.25.0)

`deliverdCanUseTool({ deliverd, approvers?, when?(tool, input), describe?, editable?(tool, input), expiresIn? (default 1h), timeout?, flowId? })` returns `(toolName, input, { signal, toolUseID }) => { behavior: "allow", updatedInput } | { behavior: "deny", message }`. Calls not matched by `when` are allowed unchanged. A refusal is a deny with a message telling the model not to retry, never a throw. The others: `deliverdToolApproval` (AI SDK), `runWithDeliverdApprovals` / `resolveInterruptions` (OpenAI Agents), `approveInGraph` / `resumeFromCallback` (LangGraph). Adapters match each framework by type shape, so they need no extra dependencies.

## Webhook verification details

`constructEvent` throws the same "signature did not verify" message for a tampered body, a wrong secret and an expired timestamp. Header constants: `SIGNATURE_HEADER`, `EVENT_HEADER`, `DELIVERY_HEADER` (lowercase). `verifySignature(secret, body, header)` returns a boolean instead of throwing.
