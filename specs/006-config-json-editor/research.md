# Research: Config JSON Viewer/Editor — Phase 0

**Feature**: 006-config-json-editor
**Date**: 2026-08-13
**Status**: Consolidated (Phase 0 of /speckit.plan)

Resolves all open unknowns from the spec and Technical Context. Library
APIs verified against current context7 docs (Constitution Principle III).

## R1 — JSON view/edit component

**Decision**: `@textea/json-viewer` (React, TypeScript; ~50 KB gz; lazily
loaded via `next/dynamic` with `ssr: false`).

**Rationale**:
- Structured tree view + inline editing out of the box:
  `editable` (bool or per-path fn), `enableAdd`, `enableDelete`,
  `onChange(path, oldVal, newVal)`, and the `applyValue` / `deleteValue`
  helpers for immutable state updates — covers FR-002/FR-004 ("values,
  fields, or whole entries") without writing any tree code.
- Token masking (FR-003) is implemented with `defineDataType` /
  `defineEasyType`: `is(value)` predicate matches the token values captured
  at load time, and a custom `Renderer` shows `••••••` with a lucide
  eye/eye-off toggle that reveals the value locally (the underlying data
  never changes, so saves always write the real tokens).
- Theme matches the existing ThemeToggle via the `theme="light"|"dark"`
  prop driven by `next-themes` `resolvedTheme`; the app toggles the `class`
  attribute, which the viewer honors.
- Verified API surface via context7 (editable / enableAdd / enableDelete /
  onAdd / onDelete / defineEasyType with custom Renderer / theme props);
  docs state SSR compatibility, and we use `ssr: false` anyway to keep the
  initial bundle lean (nextjs-best-practices: dynamic imports for heavy
  components).
- SSR/SSG not needed: the section is a client component fetching
  `GET /api/config`.

**Alternatives considered**:
- `jsoneditor` (josdejong/jsoneditor) — full tree/code/text editor with
  schema + custom `onValidate`. Rejected: (a) no value-masking support —
  token fields would render in plain text, a hard blocker for FR-003 given
  the UI has no auth; (b) own CSS bundle (~100 KB+) that fights Tailwind v4
  theming; (c) vanilla-DOM API needs a wrapper layer.
- `@uiw/react-json-view` — viewer-oriented; editing support secondary;
  rejected in favor of @textea (same lineage, better edit ergonomics).
- `react-json-view` — archived/deprecated; not considered.
- Monaco (`@monaco-editor/react`) — overkill (~2 MB), violates Principle I.
- Hand-rolled tree — violates Principle I (hundreds of lines to reach what
  the library gives) and Principle IV (no shadcn convention for JSON trees).
- Plain `<textarea>` only — zero deps, but cannot mask individual token
  values (FR-003 fails). It remains as the raw-text *repair* mode (US3)
  where the file is not valid JSON and no tree can render.

## R2 — API surface for view/save

**Decision**: `GET /api/config` (read state incl. raw text) and
`PUT /api/config` (validate + backup + atomic write), mirroring the
existing route conventions (`appError`/`errorResponse`,
`export const dynamic = "force-dynamic"`).

**Rationale**: matches the existing `api/domains` route pattern; a
read+write pair is the minimal REST fit. The editor needs the raw text for
the repair mode, so GET returns `raw` plus `parsed` — no client-side file
re-read.

**Alternatives**: server actions — rejected (existing app mutates only via
route handlers; keeping one convention wins). POST vs PUT — PUT is
idempotent overwrite semantics, fits "replace the whole file".

## R3 — Concurrent-modification guard (FR-008)

**Decision**: optimistic check — the client sends `baseRaw` (the raw text
it loaded); the server compares it with the current on-disk content and
answers 409 CONFLICT on mismatch.

**Rationale**: the scheduler/CLI rewrite the file between load and save;
"changed since loaded → reject, tell the user to reload" is the spec's
exact requirement. String comparison is simple, exact, and needs no ETag
plumbing. Both tabs racing produce a 409 for the loser.

## R4 — Backup-before-overwrite (FR-007) and atomic write

**Decision**: before overwriting, copy the current file to
`BACKUP_DIR/config.<unix-ts>.json` (reusing the existing `BACKUP_DIR`
constant; `mkdirSync(..., { recursive: true })`). Write via temp file +
`rename()` in the same directory.

**Rationale**: backup infra already exists (`BACKUP_DIR` in
config-store.ts, used by the CLI's `remove --backup_file`); timestamped
names never collide. Atomic rename guarantees the scheduler never reads a
half-written file (edge case in the spec) — the simpler direct
`writeFileSync` is rejected for exactly that window.

## R5 — Save validation (FR-005)

**Decision**: server-side gate: (1) `JSON.parse` must succeed; (2) result
must be a plain object with non-empty string keys (reject arrays, null,
primitives). The stored file is re-serialized with `JSON.stringify(x, null,
1)` — the CLI's indent-1 contract already used by `writeConfig`.

**Rationale**: keeps the on-disk format contract untouched (unknown fields
pass through `JSON.parse`→re-stringify unchanged). Client shows the
server's message via the standard `errorResponse` shape. Per-value
strictness (entry must be an object, tokens non-empty) is deliberately NOT
added — unknown/edge entries must survive (spec edge cases), and the CLI
itself is the authority on content validity.

## R6 — Masking design (FR-003)

**Decision**: client-side presentation-only masking. On load, walk the
parsed config and collect the string values of `access_token` and
`refresh_token` keys into a `Set`; a `defineDataType` entry whose `is()`
checks membership renders `••••••` + eye toggle. Editing a masked field is
still possible (reveal happens as the editor takes over); data sent to the
server is always the real, unmodified tokens.

**Rationale**: presentation-only masking keeps save payloads truthful and
the file round-trip byte-safe (masking server-side or in the payload would
risk persisting masked placeholders). Matches SC-006.

## R7 — Section placement (FR-001)

**Decision**: a Card section "Configuración" on the existing single page,
below the domain list, opened on demand: header visible always, content
lazy-mounted on first click (triggers the `next/dynamic` chunk + the GET).

**Rationale**: SC-001 ("2 clicks"), keeps the initial page load lean, and
avoids adding routing/navigation to a one-page app. The existing page is a
single `<main>` with `<DomainList />`; adding the section there is the
minimal change.
