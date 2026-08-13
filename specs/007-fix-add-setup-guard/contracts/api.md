# API Contract: Setup Endpoint Decision Rule

**Feature**: 007-fix-add-setup-guard
**Date**: 2026-08-13

Affects the existing endpoint `POST /api/domains/[domain]/setup`
(`webui/src/app/api/domains/[domain]/setup/route.ts`). GET is unchanged.
Error envelope, status codes, and `errorResponse` conventions unchanged.

## POST /api/domains/[domain]/setup — new decision order

**Before (regression, feature 005):**

1. validate domain param
2. `isManaged(domain)` → else **404** "<domain> is not managed." ← blocks the add flow
3. session branch (submit code / start session)

**After (the fix):**

1. validate domain param
2. `session = getSession(domain)`; if **no session and not managed** →
   **404** "<domain> is not managed." (guard narrowed to the no-session case)
3. session branch — unchanged:
   - body has a non-empty `code` → `submitAccessCode`
   - otherwise → `startSetupSession`

## Observable behavior matrix (unchanged responses)

| Request | Response |
|---------|----------|
| Add flow: session awaiting + code | 200 session (code reaches the CLI) — **fixed** |
| Re-setup: no session + managed + no code | 200 session (new session) |
| No session + not managed (any body) | 404 `"<domain> is not managed."` — **protection kept** |
| No session + managed + code | 404 `"No setup session for <domain>."` (existing, from `submitAccessCode`) |
| Session not awaiting (failed/completed) + code | 409 `"Setup for <domain> is not awaiting an access code."` |
| Session already awaiting + no code (duplicate start) | 409 `"A setup for <domain> is already in progress."` |
| Invalid domain param / invalid code | 400 (existing validation) |

## Client impact

`AuthorizationDialog` (`webui/src/components/authorization-dialog.tsx`)
needs no changes: it already handles 200/404/409 via the standard error
envelope; with the fix the add-flow code submission returns 200.
