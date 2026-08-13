# Contracts: Actionable Domain Re-Setup

**Feature**: 005-domain-resetup-flow | **Date**: 2026-08-13

## 1. POST /api/domains/[domain]/setup (NEW)

Starts a setup session for an already-managed domain, or submits the
access code. Body-less or empty body = start; `{ "code": "..." }` = submit
code (mirrors `POST /api/domains`).

| Case | Status | Response body |
|------|--------|---------------|
| session started / code accepted | 200 | `SetupSessionView` (`domain`, `authUrl`, `state`, `startedAt`, `error`) |
| invalid domain path (fails `domainParamSchema`) | 400 | `{ "error": { "code": "VALIDATION", ... } }` |
| domain not managed | 404 | `{ "error": { "code": "NOT_FOUND", "message": "<domain> is not managed." } }` |
| setup already in progress for the domain | 409 | `{ "error": { "code": "CONFLICT", "message": "A setup for <domain> is already in progress." } }` |
| code submitted with no active session | 404 | `{ "error": { "code": "NOT_FOUND", "message": "No setup session for <domain>..." } }` |

- Handler follows the repo pattern: awaited `params: Promise<{ domain:
  string }>`, `domainParamSchema`, `isManaged`, `appError`/`errorResponse`.
- `GET /api/domains/[domain]/setup` (polling) unchanged.
- `POST /api/domains` (add flow) unchanged: still rejects managed domains.

## 2. Authorization dialog behaviour (shared, add + re-setup)

- Phases: waiting for URL → authorization link + code input → submit →
  poll until terminal → auto-close on success.
- Completion detection polls every 1.5 s until `state !==
  "awaiting_authorization"` AFTER the code is submitted (never returns
  early while `authUrl` is set) — fixes the stuck-dialog bug (FR-013).
- On `completed`: `toast.success("<domain> configured.")` + dialog
  auto-closes (no extra click, FR-012) + `onCompleted()` runs.
- On `failed`: dialog shows the error with a close/retry path.
- Re-setup mode shows the explanation block (US2) above the link.

## 3. Domain list UI

- Rows whose `lastError` matches the NOTFOUND_SESSION signature show an
  actionable button `Run setup again for this domain.` (reset-styled,
  keyboard-reachable, focused/hover states) instead of plain text; other
  rows show nothing (FR-001, FR-004, FR-011).
- Clicking the button opens the re-setup dialog pre-targeted to that
  domain (no domain input, FR-002); the row's refresh/remove buttons stay
  usable.
- After a successful re-setup: refresh + automatic per-domain update
  (US3) with the outcome toast.

## 4. Headless mode

`src/updater.py` unchanged. The re-setup flow exists only in the web UI.
