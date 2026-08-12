# Quickstart — Web UI for Subdomain Management

**Date**: 2026-08-12 (updated: mode-switch validation for `ENABLE_WEBUI`)
**Purpose**: Runnable end-to-end validation of the feature. Per the
constitution (Principle V), the verification gate is a successful Docker
build plus these smoke checks; no test framework exists.

## Prerequisites

- Docker (with BuildKit — standard on modern Docker Desktop/Engine).
- A `config.json` with at least one already-provisioned domain
  (provisioned today via the CLI `setup`; credentials are required for
  real DNS operations).
- A browser on the same trusted network as the container.

## 1. Build the image (the gate)

```bash
docker build -t ionos-domain-connect .
```

**Expected**: build succeeds (builder stage compiles the Next.js app with
standalone output; runner stage installs Python + `domain-connect-dyndns`).

## 2. Run the container

Web mode (opt-in, spec FR-001):

```bash
docker run -d --name webui \
  -p 3000:3000 \
  -v "$(pwd)/config.json:/config.json" \
  -e INTERVAL_UPDATE=60 \
  -e ENABLE_WEBUI=true \
  ionos-domain-connect
```

**Expected**: logs show the Next.js server on `0.0.0.0:3000`.

Headless mode (default — no variable):

```bash
docker run -d --name headless \
  -v "$(pwd)/config.json:/config.json" \
  -e INTERVAL_UPDATE=60 \
  ionos-domain-connect
```

**Expected**: logs show the updater started; port 3000 is NOT listening
(`curl` fails / connection refused); scheduled updates run (check
`docker exec headless cat /config.json` for fresh `last_success`/
`last_attempt` timestamps after an interval) — spec FR-012.

## 3. Smoke checks (map to spec user stories)

### US1 — View managed domains (spec FR-002)

1. Open `http://localhost:3000`.
2. Expected: every domain from `config.json` is listed with name, last
   update time, and result badge (ok/error/never-updated); empty state with
   a hint if none; page loads in < 5 s (SC-001).

### US4 — Trigger an immediate update (spec FR-008)

1. Click "Update now".
2. Expected: statuses turn pending, then refresh to fresh timestamps with
   results; `status.json` in the container reflects the run:
   `docker exec webui cat /status.json`.

### US3 — Remove a subdomain (spec FR-005, FR-006)

1. Click remove on one listed domain, confirm in the dialog.
2. Expected: the domain disappears from the list; the other domains remain
   (FR-006); the container shows the CLI backup file:
   `docker exec webui ls /backups/`.

### US2 — Add a subdomain with embedded authorization (spec FR-003, FR-004)

1. Click "Add domain", enter a new subdomain + provider + email, submit.
2. Expected: the dialog shows the provider authorization link.
3. Open the link, approve in the provider portal, return.
4. Expected: the new subdomain appears in the managed list and receives
   updates (poll endpoint transitions to `completed`).

**Note**: step 3 needs real provider credentials — for a no-credentials dry
run, verify only that the authorization link is surfaced (flow starts,
URL rendered, poll shows `awaiting_authorization`).

### Edge cases (spec)

- Add an invalid domain (`http://x`): 400 + inline form error.
- Add a duplicate: 409 + message.
- Delete a non-managed domain: 404 + message.
- Corrupt/missing `config.json` (mount a bad file): UI shows the config
  error state and refuses mutations.

## Artifacts referenced

- API shape: [contracts/api.md](contracts/api.md)
- Entities/status file: [data-model.md](data-model.md)
- Technical decisions: [research.md](research.md)
