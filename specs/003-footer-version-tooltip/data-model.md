# Data Model: Footer App Version and Tooltip Sync Errors

**Feature**: 003-footer-version-tooltip | **Date**: 2026-08-13

## Entities

No new persistent entities. The tooltip consumes the existing
`DomainView.lastError` (feature 002); the footer consumes a runtime
configuration value, not stored data.

### Application Version (runtime configuration value)

The version label of the GitHub release that produced the running image.
**Not persisted anywhere in the app** — it travels release → CI build arg →
container env var → server-rendered footer.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `APP_VERSION` (build arg) | string, optional | GitHub release tag, e.g. `v1.2.3` | passed by workflow on `release: published`; default `dev` |
| `APP_VERSION` (runtime env) | string | set by `ENV APP_VERSION=$APP_VERSION` in Dockerfile runner stage | read at request time by the footer |
| Display value | string | `process.env.APP_VERSION?.trim() \|\| "dev"` | never empty (FR-003); rendered as `Version <value>` |

Rules:

- The value is shown **as released** (leading `v` preserved, no
  normalization) — FR-002, spec assumption.
- Missing/empty/malformed value can only produce the `dev` fallback — it
  can never break rendering (FR-004).
- Not part of any API response; not in the client bundle (server component
  only).

### Managed Domain / Failure Reason (existing, unchanged)

`DomainView.lastError` (already implemented in feature 002) is the content
of the new tooltip. No schema change:

- `lastError: string | null` — non-null exactly when
  `lastResult === "error"` (fallback text included); the tooltip trigger
  renders only then (FR-007).
- The stored `last_error` value rules from 002 (≤ 500 chars, token-redacted,
  cleared on success/removal) are inherited unchanged.

## State transitions

| Transition | Trigger | Effect |
|------------|---------|--------|
| release published | GitHub UI | workflow runs with `APP_VERSION=<tag>`; image rebuilt and pushed |
| container starts | entrypoint | `APP_VERSION` env present (or `dev`) — no app-side state |
| domain error state | update run (existing) | `lastError` set — tooltip trigger appears (existing 002 flow) |
| domain success/removed | update run / remove (existing) | `lastError` null/removed — tooltip disappears (existing 002 flow) |

No transitions are introduced by this feature.

## Consistency & concurrency

None new. The footer value is immutable per container lifetime (set at
image build); the tooltip content is owned by the existing
`last_error`/`toView` flow and refreshed by the existing `refresh()`
re-fetch.
