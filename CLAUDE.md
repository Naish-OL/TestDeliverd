# CLAUDE.md

## Project

A TypeScript app that tests and showcases `@deliverd/sdk`. Each demo is a teaching example for one SDK capability, so write for clarity over cleverness. This is not production code.

Read `docs/sdk-notes.md` before writing SDK code. If you need an API detail it doesn't cover, check the matching page at https://deliverd.dev/docs/developers (and https://deliverd.dev/docs/api), then add what you learned to `docs/sdk-notes.md` and update its last-checked date. Never guess method names or response fields.

## Stack and commands

- Node 20+, npm, TypeScript (ESM), `tsx` to run, `vitest` to test, `tsc` to type-check
- `npm run demo <name>`: run `src/demos/<name>.ts` (`src/demo.ts` loads `.env` first; shell variables win)
- `npm run typecheck`: run after every change
- `npm test`
- `npm run ui`: local UI at http://localhost:4321 (restart it after changing server code)
- `npm run test:ui`: Playwright end-to-end tests for the UI. After changing anything in `src/ui/`, run this rather than taking screenshots; add a spec for new UI behaviour. Never remove `UI_DEV_ONLY` from `playwright.config.ts`, and mock `/api/run` in any test that uses Live mode.

## Conventions

- One self-contained file per feature in `src/demos/`. Start each with a short comment: what it shows, the docs URL it follows, and which `DELIVERD_DEV_OUTCOME` values are worth trying.
- Create the client in `src/client.ts`. Demos import it rather than constructing their own, unless a demo is specifically about client options.
- Every demo must run in development mode (`DELIVERD_MODE=development`) when the feature supports it. If it needs a real key or a particular plan, say so in the header comment and fail with a clear message rather than a stack trace.
- When you add a demo, update the Demos table in `README.md`, its entry in `src/catalogue.ts`, and its cases in `test/cases.ts`.
- Tests run in development mode only. Never call the live API from tests.

## SDK rules (from the docs; easy to get wrong)

- After an approval or gate decision, act on `decision.input`, never on the input you sent. Approvers can correct `editableFields`.
- A rejection resolves normally with `approved: false`. `approve()` throws only for a timeout, an abort or an unreachable API.
- Check `collect()`'s `complete` before trusting `answers`. Expired requests return partial answers.
- `gate()` requires `externalId`. Use `canExecute` / `allowed`, not `status` alone. `denied` is a normal 200 response, not an error.
- Use a stable `externalId` on requests so a restarted run reuses its request instead of creating a duplicate.
- Branch on `DeliverdError.code` (or `isAuth` / `isRateLimit` / `isNotFound` / `isConflict`), never on `message`.
- Verify webhooks and callbacks against the raw request body (`await request.text()`), never a re-serialised object.
- Updating a report: pass `expectedVersion` from `reports.versions().latestVersion`. On `409 version_conflict`, re-read and retry.
- Never leave an optional `DELIVERD_*` variable blank in `.env`; comment it out. The SDK treats `""` as a value (an empty base URL breaks every call).
- Live: a personal key asking its own owner fails with `403 self_approval`. Live demos that the user approves need an agent key.
- The SDK already retries 429 and 5xx responses and sends idempotency keys. Don't wrap it in your own retry loop.

## Guardrails

- Never commit `.env` or any key. Never hardcode a `dlv_` / `dlvo_` value. Keys come from `DELIVERD_API_KEY` in `.env` (git-ignored). `.env.example` is committed: it must never hold a real value. Keep `DEMO_APPROVER` in `.env` too, never in code.
- Ask before running anything without `DELIVERD_MODE=development`. Live runs email real approvers and count against plan limits (120 requests per minute per key).
- Don't register gate actions, change policies or create webhook endpoints in the user's organisation without asking.
