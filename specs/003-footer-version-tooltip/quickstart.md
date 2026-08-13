# Quickstart: Footer App Version and Tooltip Sync Errors

**Feature**: 003-footer-version-tooltip | **Date**: 2026-08-13

End-to-end validation guide. Wiring details in `contracts/deployment.md`;
version/error data rules in `data-model.md`; implementation in `tasks.md`.

## Prerequisites

- Repo root: `ionos-domain-connect`
- Docker (final gate) and Node (webui lint/build)
- A `config.json` with at least one configured domain (see
  `specs/002-update-failure-reason/quickstart.md` for how to produce one
  and how to force a failing domain)

## Build & static checks

```bash
cd webui
npm run lint
npm run build

cd ..
docker build -t ionos-domain-connect .
```

Expected: lint and build pass; image builds (Constitution V).

## Scenario 1 — Footer version in local dev ("dev" fallback)

1. `cd webui && npm run dev` (with `config.json` mounted/available).
2. Open `http://localhost:3000`, scroll to the bottom.
3. Expected: footer shows `Version dev` (no release version available —
   FR-003), page renders normally, footer does not overlap content
   (FR-005).

## Scenario 2 — Footer version with a custom build arg

1. Build with an explicit version:
   ```bash
   docker build -t ionos-domain-connect:test --build-arg APP_VERSION=test-1 .
   docker run --rm -p 8080:3000 -e ENABLE_WEBUI=true \
     -v "$PWD/config.json:/config.json" ionos-domain-connect:test
   ```
2. Open `http://localhost:8080`.
3. Expected: footer shows `Version test-1` — exactly the value passed, no
   transformation (FR-002, FR-004).
4. Re-run the same command **without** `--build-arg`: footer shows
   `Version dev`.

## Scenario 3 — Full release flow (GitHub → Docker Hub)

1. Create a GitHub release tagged `v1.2.3` on the repo (this is the only
   way a version is created).
2. Wait for the Docker Hub workflow (`release: published`) to finish.
3. Pull the published image and run it with `ENABLE_WEBUI=true` and the
   config mounted.
4. Expected: footer shows `Version v1.2.3`, identical to the release tag
   and to the `b3ni/ionos-domain-connect:v1.2.3` image tag (SC-001).

## Scenario 4 — Sync error tooltip on hover

1. With a failed domain visible (corrupt its token, then "Update now" —
   see 002 quickstart Scenario 1), hover the muted truncated error line
   under the domain name.
2. Expected: a tooltip appears with the full error text (no native browser
   tooltip, no `title` attribute in the DOM), page layout unchanged
   (FR-006, FR-008).

## Scenario 5 — Sync error tooltip by keyboard

1. Without touching the mouse, `Tab` through the page until the error line
   of the failed domain receives focus (visible focus ring).
2. Expected: the same tooltip appears on focus (FR-009); the truncated
   text is fully readable in it.
3. `Tab` away: tooltip closes.

## Scenario 6 — No tooltip for healthy domains

1. View a domain whose last sync succeeded (or a failed domain after a
   successful "Update now").
2. Expected: no error line, no tooltip trigger anywhere in the row
   (FR-007, SC-004).

## Scenario 7 — Long/multi-line errors keep layout intact

1. Set a long multi-line `last_error` (or let the updater produce one) in
   the config entry of a failed domain, refresh the list.
2. Expected: the row height/table layout is not broken; the tooltip shows
   the full text word-wrapped (FR-008, SC-005).
3. Trigger a list refresh ("Update now" or another action) while the
   tooltip is open: no stale tooltip remains (FR-010).
