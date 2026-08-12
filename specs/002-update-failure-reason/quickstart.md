# Quickstart: Update Failure Reason + Domain Link

**Feature**: 002-update-failure-reason | **Date**: 2026-08-12

End-to-end validation guide. Implementation details live in `tasks.md`;
data shape in `data-model.md`; exact fields in `contracts/api.md`.

## Prerequisites

- Repo root: `ionos-domain-connect`
- Docker (for the final verification) and Node (for webui lint/build)
- A writable `config.json` with at least one configured domain (run the
  image once with `ENABLE_WEBUI=false` and complete `setup` via the CLI,
  or reuse an existing config)

## Build & static checks

```bash
# Web UI
cd webui
npm run lint
npm run build

# Full image (final gate, Constitution V)
cd ..
docker build -t ionos-domain-connect .
```

Expected: lint and build pass; image builds.

## Scenario 1 — Reason shown for a failed domain

1. Start the container with the web UI enabled and the config mounted:
   ```bash
   docker run --rm -p 8080:3000 \
     -e ENABLE_WEBUI=true -e INTERVAL_UPDATE=60 \
     -v "$PWD/config.json:/config.json" \
     ionos-domain-connect
   ```
2. Open `http://localhost:8080`. If no domain is currently failing,
   force one: corrupt the entry's token (e.g. set
   `access_token` to garbage) in the mounted `config.json`, then click
   "Update now".
3. Expected: the domain's row shows the red "Update failed" badge and a
   muted single-line reason text under the domain name (e.g. an
   authorization/token error), full text readable on hover.
4. The reason text must not contain any token value.

## Scenario 2 — Reason persists across restart

1. With the domain still failed (Scenario 1), stop the container and
   start it again with the same config volume.
2. Expected: the badge is still "Update failed" and the same reason text
   is still displayed (SC-003).

## Scenario 3 — Reason clears on success

1. Restore the valid token in `config.json` and click "Update now".
2. Expected: badge becomes "Up to date", no reason text is displayed
   (FR-005, SC-004), and `last_error` is absent from the config entry.

## Scenario 4 — Clicking a domain opens its website

1. From the domain list, click the domain name.
2. Expected: the domain's live website opens in a **new browser tab**
   (URL `https://<domain>`), the list stays open in the original tab
   (FR-010, FR-011).
3. Repeat with a domain whose last update failed: the link must still
   open.

## Scenario 5 — Edge: failure without parseable detail

1. Stop the web UI and run headless (`ENABLE_WEBUI=false`); cause a
   failure there (e.g. invalid token) so `last_attempt` advances.
2. Start the web UI again.
3. Expected: badge is "Update failed" and the row shows the generic
   fallback text `Update failed. No error details reported by the
   updater.` — never an empty field (FR-007).

## Scenario 6 — Cleanup on remove

1. Remove the failed domain via the UI ("Remove" button + confirm).
2. Expected: domain disappears; its entry (including `last_error`) is
   gone from `config.json` (FR-006).
