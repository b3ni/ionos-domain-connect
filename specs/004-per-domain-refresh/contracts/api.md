# Contracts: Per-Domain Refresh

**Feature**: 004-per-domain-refresh | **Date**: 2026-08-13

## 1. POST /api/domains/[domain]/update (NEW)

Per-domain update trigger. Body-less `POST`; `domain` is the path segment.

| Case | Status | Response body |
|------|--------|---------------|
| success | 200 | `{ "started": true, "results": { "<domain>": "ok" \| "error" \| "unchanged" \| "unknown" } }` |
| invalid domain path param (fails `domainParamSchema`, `webui/src/lib/validation.ts`) | 400 | `{ "error": { "code": "VALIDATION", "message": "..." } }` |
| domain not in config | 404 | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` (AppError via `errorResponse`) |
| another update running | 409 | `{ "error": { "code": "CONFLICT", "message": "An update is already running." } }` |

- No request body; no query params.
- Handler follows the repo's Next.js 16 route pattern (context7-verified,
  research.md §8): `params` is awaited (`Promise<{ domain: string }>`),
  validated with `domainParamSchema`, guarded with `isManaged`, errors via
  `appError`/`errorResponse` — mirroring `api/domains/[domain]/route.ts`.
- Runs the CLI in single-domain mode (`update --domain <domain>`) behind
  the shared update lock; persists the domain's `last_error` exactly as the
  global run does (same helper).
- `GET /api/domains`, `POST /api/update`, `DELETE /api/domains/[domain]`
  and the setup endpoints are unchanged.

## 2. Update lock contract

Global (`POST /api/update`), per-domain (`POST /api/domains/[domain]/update`)
and scheduled runs share ONE lock. While held, every other trigger returns
`409 CONFLICT` — no queuing. The lock is held for the duration of one CLI
run (seconds).

## 3. config.json

Unchanged schema. A per-domain run may set `last_attempt`/`last_success`
(CLI) and set/delete `last_error` (web UI) for its own entry only. The CLI
round-trip preserves unknown keys (verified in 002 research) — no migration.

## 4. Domain list UI

- Every row has a refresh action (icon button, `RefreshCw`,
  `variant="ghost" size="icon"`, `aria-label="Refresh <domain>"`), shown
  for all statuses (FR-001), next to the remove action in the actions
  column.
- While a row's refresh runs: that button shows a spinner and is disabled
  (FR-007); other rows and the global button stay usable.
- Outcome feedback: toast for that domain on completion (success or
  failure), then the list refreshes (FR-005, FR-006).
- Hint (FR-009/FR-010): when the row shows a failure reason and
  `lastError` contains `"Failed to get async token"` or
  `"NOTFOUND_SESSION"`, a muted hint line `Run setup again for this
  domain.` is rendered under the error text. Not shown for any other
  reason. Never contains credentials.

## 5. Headless mode

`src/updater.py` unchanged: scheduled `update --all` keeps running and
printing to container logs; the per-domain button exists only in the web UI.
