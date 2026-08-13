# Contracts: Footer App Version and Tooltip Sync Errors

**Feature**: 003-footer-version-tooltip | **Date**: 2026-08-13

No HTTP API changes: `GET /api/domains`, `POST /api/update`,
`DELETE /api/domains/[domain]` and `GET /api/domains/[domain]/setup`
response shapes are unchanged. This feature adds two contracts: the
image-build version handoff and the web UI behaviour.

## 1. Docker image build — `APP_VERSION` build arg

| Item | Value |
|------|-------|
| Build arg | `APP_VERSION` |
| Default (no arg) | `dev` |
| Runtime env | `APP_VERSION` (exported via `ENV` in the runner stage) |
| Consumer | web UI footer (server component, runtime read) |
| Semantics | exact release label as published, e.g. `v1.2.3`; shown as-is |

```dockerfile
# runner stage
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
```

Plain `docker build -t ionos-domain-connect .` (local, CI-on-push) yields
`APP_VERSION=dev`. The publish workflow is the only place the arg is set
to a real release label.

## 2. Release workflow contract (`.github/workflows/docker-image.yml`)

Triggered only by `release: published` (unchanged). New wiring on the
existing `build-push-action` step:

```yaml
build-args: |
  APP_VERSION=${{ github.event.release.tag_name }}
```

Image tags (via `metadata-action`) remain `:latest` + `:vX.Y.Z` from the
release ref — the tag and the in-app version therefore always agree
(SC-001). The version value is created **only** by creating a GitHub
release; nothing else can bump it.

## 3. Footer (web UI)

- Rendered by the root layout on every page; server-side, not in the
  client bundle.
- Text: `Version <APP_VERSION>`; when `APP_VERSION` is missing, empty or
  whitespace-only → `Version dev`. Never empty, never crashes (FR-003,
  FR-004).
- Styling: muted (`text-muted-foreground`), small text, bottom of the
  page; must not overlap content (FR-005).

## 4. Domain error tooltip (web UI)

- Trigger: the truncated error line under a failed domain name. Rendered
  only when `lastResult === "error"` and `lastError` is non-null (FR-007).
- Component: shadcn `Tooltip` (Radix base) — `TooltipTrigger asChild` on a
  reset-styled keyboard-focusable element; `TooltipContent` shows the full
  `lastError` text (word-wrapped, width-capped so the page layout stays
  intact — FR-008).
- Behaviour: tooltip opens on hover **and** on keyboard focus (FR-009);
  `TooltipProvider` wraps the app in the root layout.
- Content contract: exactly the `lastError` string; no truncation inside
  the tooltip; stale tooltip must not survive a list refresh (FR-010 —
  React remount/refresh semantics handle this; verified in tasks).
