# Quickstart: Actionable Domain Re-Setup

**Feature**: 005-domain-resetup-flow | **Date**: 2026-08-13

End-to-end validation guide. API contract in `contracts/api.md`; data rules
in `data-model.md`; implementation in `tasks.md`.

## Prerequisites

- Repo root: `ionos-domain-connect`
- Docker (final gate) and Node (webui lint/build)
- A `config.json` with at least one configured domain (see 002 quickstart)

## Build & static checks

```bash
cd webui
npm run lint
npm run build

cd ..
docker build -t ionos-domain-connect .
```

Expected: lint and build pass; image builds (Constitution V).

## Scenario 1 — Re-setup completes and the dialog closes (the bug fix)

1. Start the container with web UI + config mounted
   (`ENABLE_WEBUI=true`).
2. Add a NEW domain via "Add domain": complete the authorization (open
   the link, enter the access code, "Finish setup").
3. Expected (regression check for the fixed bug): the dialog **closes
   automatically**, a success toast `X configured.` appears, and the list
   shows the new domain — no "Done" click needed (FR-012, FR-013, SC-006).

## Scenario 2 — NOTFOUND_SESSION row offers re-setup

1. Write the known message into a domain's `last_error` in `config.json`
   (e.g. `"Failed to get async token: 400 invalid_request NOTFOUND_SESSION"`)
   and reload the list.
2. Expected: the row shows the failure reason AND the actionable button
   `Run setup again for this domain.` (FR-001).
3. Click it: the dialog opens pre-targeted to that domain (no domain
   field) with the explanation block (FR-002, FR-004): why it failed and
   that re-authorizing does not remove the domain or change DNS records.

## Scenario 3 — Re-setup end-to-end with real authorization

1. From a NOTFOUND_SESSION row, click `Run setup again for this domain.`
2. Open the authorization link, approve the domain, paste the code,
   "Finish setup".
3. Expected: dialog closes with success toast; a per-domain update runs
   automatically; the row returns to "Up to date" with no failure hint
   (US3, SC-004).
4. Verify the domain is still in the list and its DNS records unchanged.

## Scenario 4 — Conflicts and errors

1. Start a re-setup, close the dialog, reopen the trigger.
2. Expected: 409 conflict message ("setup already in progress"), the
   running session is undisturbed (FR-009).
3. Submit a wrong code: the dialog shows the provider's failure and lets
   the user close/retry (edge case).

## Scenario 5 — Contract checks (API)

1. `POST /api/domains/<unmanaged>/setup` → 404 (domain not managed).
2. `POST /api/domains/<managed>/setup` with invalid path chars → 400.
3. `POST /api/domains` with an already-managed domain → still 409 (add
   flow unchanged).
4. `GET /api/domains/<domain>/setup` still returns the live session while
   authorization is pending (polling path).

## Scenario 6 — No trigger for healthy rows

1. View a domain whose last update succeeded (no signature).
2. Expected: no re-setup button, no explanation (FR-004).

## Scenario 7 — Sensitive values

1. Complete a failed authorization with an error containing a token.
2. Expected: no credentials appear anywhere in the dialog, toasts, or row.
