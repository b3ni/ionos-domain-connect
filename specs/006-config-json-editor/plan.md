# Implementation Plan: Config JSON Viewer/Editor

**Branch**: `006-config-json-editor` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-config-json-editor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Add a "Configuración" section to the web UI that shows the domain
configuration JSON (`/config.json`, the file shared with the
`domain-connect-dyndns` CLI) as an editable, expandable tree with token
fields masked by default, plus a raw-text repair mode when the file is
corrupt. Saves are validated server-side (valid JSON + flat domain map),
preceded by a backup into the existing backups directory, written
atomically, and guarded against concurrent disk changes via an optimistic
base-raw comparison. Two new API routes (`GET`/`PUT /api/config`), one new
client component (`config-editor.tsx`), and extensions to
`webui/src/lib/config-store.ts`; the JSON tree component is
`@textea/json-viewer` (verified via context7, see `research.md`).

## Technical Context

**Language/Version**: TypeScript 5 (strict) — Next.js 16.3 App Router, React 19.2

**Primary Dependencies**: `@textea/json-viewer` (new, tree view/edit +
custom data-type renderers for token masking); existing: zod 4, sonner,
next-themes, radix-ui (unified), shadcn components (card/button/textarea),
lucide-react

**Storage**: single JSON file at `CONFIG_PATH` (default `/config.json`),
plus timestamped backup copies under `BACKUP_DIR` (default `/backups`)

**Testing**: No test framework exists. Verification gates: `docker build -t
ionos-domain-connect .` (repo root) and `npm run lint` (webui/) — per
Constitution Principle V and AGENTS.md

**Target Platform**: Linux server; Node runtime (web UI standalone server,
`node server.js`)

**Project Type**: web application (single page + API routes) inside a Docker
image

**Performance Goals**: config section renders within 2 clicks and loads
without perceptible delay for typical configs (≤ ~100 KB); the JSON library
chunk must not inflate the initial page load (lazy-load on first open)

**Constraints**: on-disk format is an external contract with the CLI —
flat domain map, 1-space indent, unknown fields preserved; tokens must
never be shown unmasked unless explicitly revealed; file writes must never
leave a half-written file the scheduler can read; the UI remains
unauthenticated (trusted network only)

**Scale/Scope**: single-node Docker container, ~dozens of domains max;
single-user admin UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS. Exactly one new runtime dependency
  (`@textea/json-viewer`, ~50 KB gz, lazy-loaded). A hand-rolled JSON tree
  editor is explicitly rejected (more code, more bugs); a plain textarea is
  rejected because it cannot satisfy FR-003 (token masking per value).
  Backups reuse the existing `BACKUP_DIR` constant; no new infra.
- **II. Code-Grounded Specs**: PASS. Project indexed in codebase-memory-mcp;
  spec and plan reference the real modules (`config-store.ts`, `errors.ts`,
  `domains.ts`, existing API routes).
- **III. Library-Aware Plans**: PASS. `@textea/json-viewer` API surface
  (editable/enableAdd/enableDelete/onChange/defineDataType/theme) verified
  via context7 in Phase 0. `jsoneditor` evaluated and rejected (see
  research.md). Next.js 16 breaking-changes warning checked (AGENTS.md);
  this plan only adds routes/components mirroring existing working patterns
  (`appError` → `errorResponse`, sonner toasts), no new Next.js features.
- **IV. Frontend Design Standards**: PASS. `web-design-guidelines`,
  `nextjs-best-practices`, `shadcn-ui` skills loaded in Phase 0; UI built
  from existing shadcn components (Card, Button, Textarea, sonner); the JSON
  tree is an external library component (no shadcn equivalent exists), not a
  hand-rolled replacement.
- **V. Direct Verification**: PASS. Verification gates stated in
  quickstart.md: `docker build` + `npm run lint`; implementation MUST run
  them and report results.

## Project Structure

### Documentation (this feature)

```text
specs/006-config-json-editor/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
webui/src/
├── app/
│   ├── api/
│   │   ├── config/
│   │   │   └── route.ts         # NEW: GET /api/config, PUT /api/config
│   │   └── (existing routes unchanged)
│   └── page.tsx                 # ADD: <ConfigEditor /> section under <DomainList />
├── components/
│   ├── config-editor.tsx        # NEW: "use client" Configuración section
│   │                            # (tree viewer, raw-text repair mode, save flow)
│   └── (existing components unchanged)
└── lib/
    ├── config-store.ts          # EXTEND: readConfigRaw / parseConfig /
    │                            #         validateConfigShape / saveConfig
    └── (existing lib modules unchanged)
```

**Structure Decision**: Single Next.js app — the repo already has one
`webui/src` layout with `app/`, `components/`, `lib/`. This feature adds one
route file, one component, and extends the existing config-store module
(the natural home for file IO; `readConfig`/`writeConfig` already live
there). No new directories or frameworks.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations — no complexity table needed. (One dependency is
justified under Principle I; a justification block is included in
research.md instead.)
