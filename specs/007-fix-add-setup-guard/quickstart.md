# Quickstart: Fix "is not managed" Error

**Feature**: 007-fix-add-setup-guard
**Date**: 2026-08-13

Runnable end-to-end validation guide. Contracts: [contracts/api.md](contracts/api.md) ·
Decision rule: [data-model.md](data-model.md).

## Prerequisites

- Dev environment with `CONFIG_PATH` set and the web UI runnable
  (`npm run dev` in `webui/` with a writable `config.json`, or the built
  standalone server).
- Verification gates (Constitution V): `npm run lint` (webui/),
  `docker build -t ionos-domain-connect .` (repo root).
- A stub CLI for the setup child process if the real
  `domain-connect-dyndns` is unavailable: a script that prints an
  authorization URL, reads a line from stdin, and exits — set
  `DYNDNS_CLI` to it (see `webui/src/lib/dyndns.ts` `startSetup`).

## Scenario 1 — Add flow accepts the access code (the fix)

1. `POST /api/domains` `{ "domain": "new.example.com" }` → 201 session
   (do NOT put the domain in `config.json` — this simulates the add flow).
2. `POST /api/domains/new.example.com/setup` `{ "code": "abc123" }`.
3. **Expected**: 200 with the session view — **not** 404 "is not
   managed." (The stub CLI consumed the code on stdin.)

## Scenario 2 — Protection preserved (no session + not managed)

1. With no active session for `ghost.example.com` and the domain absent
   from `config.json`:
   `POST /api/domains/ghost.example.com/setup` (no code).
2. **Expected**: 404 `"ghost.example.com is not managed."` — unchanged
   005 behavior.

## Scenario 3 — Re-setup still works (no session + managed)

1. Add `old.example.com` to `config.json` (any valid entry), no session.
2. `POST /api/domains/old.example.com/setup` (no code) → 200 new session
   awaiting authorization; complete it with the stub (URL + code) and
   confirm state becomes "completed".

## Scenario 4 — Session errors stay truthful (FR-004)

1. Start an add flow for `new.example.com`, submit a code → 200 (Scenario 1).
2. Submit the same code again → **Expected**: 409 "not awaiting an access
   code" (session state), never "is not managed".
3. Complete the session (state `completed`), then restart the web server
   (sessions are in-memory) and submit a code → **Expected**: 404 "No
   setup session for … Start the setup again." — never "is not managed".

## Scenario 5 — Full UI walk-through (no regressions)

1. Open the page; add a brand-new subdomain; open the authorization link;
   enter the access code; click **Finish setup**.
2. **Expected**: no "is not managed" error; dialog auto-closes with
   "configured" success toast; the domain appears in the list; per-domain
   refresh works.
3. From a row with the re-setup entry point (NOTFOUND_SESSION), run the
   re-authorization: opens, completes, closes automatically.

## Final gates

- `npm run lint` (webui/) — no new warnings.
- `docker build -t ionos-domain-connect .` — build passes.
- Scenario sweep above (1–5) green.
