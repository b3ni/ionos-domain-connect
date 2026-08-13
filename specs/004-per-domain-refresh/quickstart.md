# Quickstart: Per-Domain Refresh

**Feature**: 004-per-domain-refresh | **Date**: 2026-08-13

End-to-end validation guide. API contract in `contracts/api.md`; data rules
in `data-model.md`; implementation in `tasks.md`.

## Prerequisites

- Repo root: `ionos-domain-connect`
- Docker (final gate) and Node (webui lint/build)
- A `config.json` with at least **two** configured domains (see
  `specs/002-update-failure-reason/quickstart.md` for setup via CLI or web
  UI)

## Build & static checks

```bash
cd webui
npm run lint
npm run build

cd ..
docker build -t ionos-domain-connect .
```

Expected: lint and build pass; image builds (Constitution V).

## Scenario 1 — Refresh only one domain

1. Start the container with the web UI and config mounted
   (`ENABLE_WEBUI=true`, `-v "$PWD/config.json:/config.json"`).
2. Note each domain's "Last update" time in the list.
3. Click the refresh icon of domain A.
4. Expected:
   - a spinner shows on domain A's refresh button while it runs;
   - a toast reports domain A's outcome;
   - after the list refreshes, only domain A's "Last update" time changed;
     domains B/C times and statuses are identical to before (FR-002,
     SC-002).

## Scenario 2 — Per-domain failure reason lifecycle

1. Corrupt domain A's token in `config.json`, refresh domain A.
2. Expected: domain A shows "Update failed" + reason; domain B is
   untouched.
3. Restore the token, refresh domain A again.
4. Expected: domain A is "Up to date", no reason text; `last_error` absent
   from its entry.

## Scenario 3 — No concurrent updates

1. Trigger the global "Update now" and immediately click a row's refresh
   button (or vice versa).
2. Expected: the second trigger gets a toast with the "already running"
   message and the first run completes undisturbed (FR-004, SC-003).

## Scenario 4 — Refresh a domain that no longer exists

1. Remove domain B from `config.json` directly, keep the list stale (or
   refresh the page first so the row disappears — use the API directly if
   the row is gone).
2. Expected: the endpoint answers 404 with a clear error; nothing else
   changes (FR-008).

## Scenario 5 — NOTFOUND_SESSION hint

1. Give domain A a real failing session: the simplest reliable path is a
   genuine expired/replaced OAuth session (re-setup the same domain from a
   different container while the first keeps its config, then refresh
   domain A). Alternatively, for a UI-only check, write the known message
   into the domain's `last_error` in `config.json` and reload.
2. Expected: the row shows the failure reason AND the muted hint
   `Run setup again for this domain.` (FR-009).
3. Give another failed domain an unrelated `last_error` (e.g. "HTTP 500").
   Expected: no hint (FR-010).
4. Confirm the hint contains no credentials.

## Scenario 6 — Re-setup fixes the session (real fix for the user)

1. With domain A failing with NOTFOUND_SESSION, run the domain setup again
   via the web UI (authorize, enter the code).
2. Refresh domain A.
3. Expected: update succeeds; reason and hint disappear.

## Scenario 7 — Global update still works

1. Click the global "Update now".
2. Expected: all domains update, one toast reports the outcome (SC-005);
   row refresh buttons remain functional afterwards.
