# Implementation Plan: Fix "is not managed" Error When Adding a Domain

**Branch**: `007-fix-add-setup-guard` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-fix-add-setup-guard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

The shared setup endpoint `POST /api/domains/[domain]/setup` rejects
access-code submission for the add-domain flow with "<domain> is not
managed." because feature 005 added an `isManaged` config check to the
endpoint, and during the add flow the domain is legitimately absent from
the config (the CLI writes it only when setup completes). Fix: make the
guard session-aware — an active setup session for the domain bypasses the
config check; without a session the config check still applies (feature
005's protection preserved). One route file changes; no new libraries, no
UI changes.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Next.js 16 App Router route handlers

**Primary Dependencies**: none new — only existing modules: `getSession`
(`webui/src/lib/setup-session.ts`), `isManaged` (`webui/src/lib/domains.ts`),
`appError`/`errorResponse` (`webui/src/lib/errors.ts`)

**Storage**: none (in-memory setup sessions only; config file read-only for
the guard)

**Testing**: No test framework exists. Verification gates: `npm run lint`
(webui/) and `docker build -t ionos-domain-connect .` (repo root) plus
manual scenario checks from quickstart.md (Constitution V)

**Target Platform**: Linux server, Node runtime (web UI standalone server)

**Project Type**: web application (single page + API routes)

**Performance Goals**: none specific — the guard adds one in-memory map
lookup; no measurable impact

**Constraints**: feature 005's protection must remain (no session + not
managed → still 404 "is not managed"); session error messages must never be
masked by the domain guard (FR-004); the change is confined to the decision
logic of one endpoint (Assumptions in spec)

**Scale/Scope**: single-user admin UI; sessions are in-memory, one per
domain

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS. The fix is a few lines in one route handler
  (reorder: session lookup first, guard only when no session). No new
  abstractions, dependencies, or files beyond the feature's design docs.
- **II. Code-Grounded Specs**: PASS. Diagnosis traced through the real
  code: the guard at `webui/src/app/api/domains/[domain]/setup/route.ts`
  was introduced by commit `dabe2d2` (feature 005); the add flow's code
  submission goes through this same endpoint (`AuthorizationDialog.submitCode`
  → POST) while `isManaged` reads the config where the domain is absent by
  design (`startSetupSession` spawns the CLI; the CLI writes the entry on
  completion).
- **III. Library-Aware Plans**: PASS (no libraries used or added — nothing
  to verify via context7; the plan only reorders existing module calls
  whose signatures are already in use in this codebase).
- **IV. Frontend Design Standards**: PASS (no frontend work — server-side
  route logic only; no skills required).
- **V. Direct Verification**: PASS. Gates stated in quickstart.md:
  `npm run lint`, `docker build -t ionos-domain-connect .`, plus runtime
  checks of the endpoint's three decision branches.

## Project Structure

### Documentation (this feature)

```text
specs/007-fix-add-setup-guard/
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
└── app/api/domains/[domain]/setup/
    └── route.ts         # ONLY file changed: session-aware guard in POST
```

**Structure Decision**: Single-file fix in the existing route handler.
The endpoint already imports everything needed (`getSession`,
`isManaged`); no new modules, directories, or routes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations — no complexity table needed.
