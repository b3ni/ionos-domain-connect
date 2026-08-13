# Implementation Plan: Footer App Version and Tooltip Sync Errors

**Branch**: `003-footer-version-tooltip` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-footer-version-tooltip/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Two small web UI changes, no new data:

1. **Version in the footer**: the version is created only when a GitHub
   release is published (which is also what publishes the Docker image).
   The CI workflow passes the release tag (`github.event.release.tag_name`,
   e.g. `v1.2.3`) to the image build as `APP_VERSION` build arg; the
   Dockerfile exports it as a runtime env var; a small server component
   footer reads it at request time and renders `Version <v>`, falling back
   to `dev` when unset (local/dev builds). No new API, no build-time
   coupling to Next.js.
2. **Sync errors via shadcn Tooltip**: the truncated error line under a
   failed domain (feature 002, currently using the native `title` attr)
   becomes a `Tooltip` from the shadcn UI kit — full text on hover **and**
   keyboard focus (FR-009). Tooltip component is added via the shadcn CLI;
   `radix-ui` is already a dependency, so no new npm packages.

## Technical Context

**Language/Version**: TypeScript (Next.js 16.3 App Router, Node 22), YAML (GitHub Actions), Dockerfile

**Primary Dependencies**: Next.js 16.3 (existing), shadcn CLI 4.x / Radix UI `radix-ui@^1.6.7` (existing; `tooltip` component to be added via CLI — no new package), `docker/metadata-action@v5` + `docker/build-push-action@v6` (existing workflow)

**Storage**: none new — version is a runtime env var; error text already stored (`config.json` `last_error`, feature 002)

**Testing**: No test framework — gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (repo root); manual validation via `quickstart.md`

**Target Platform**: Linux container (Docker image, amd64 + arm64); browser web UI

**Project Type**: Docker utility image + optional Next.js web UI

**Performance Goals**: footer is static text — no measurable impact; tooltip adds a Radix primitives wrapper around an existing text node

**Constraints**: version must match the GitHub release label exactly (keep `v` prefix); unset version must never break rendering (fallback `dev`); tooltip must be keyboard-reachable; no changes to headless mode or the CLI contract

**Scale/Scope**: single user, handful of domains; one release tag per publish

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS — no new dependencies (Radix already present), no new endpoints, no new storage; the version rides a single env var + build arg; tooltip replaces one native attribute with the standard kit component.
- **II. Code-Grounded Specs**: PASS — project indexed with codebase-memory-mcp; design grounded in `domain-table.tsx` (native `title` at lines 60–67), `layout.tsx`, `page.tsx` (flex column layout), `domains.ts` (`DomainView.lastError`), Dockerfile and `.github/workflows/docker-image.yml`.
- **III. Library-Aware Plans**: PASS — context7 consulted for shadcn/Radix Tooltip API and docs (radix base, `TooltipProvider` in root layout, `asChild` triggers), `docker/metadata-action` outputs/JSON build-arg pattern, and Next.js 16 env-var docs (`connection()` for runtime reads). shadcn CLI queried in-project (`docs tooltip`, `info`).
- **IV. Frontend Design Standards**: PASS — `shadcn`, `nextjs-best-practices`, `web-design-guidelines` skills loaded during planning; implementation MUST load them again and run the a11y/UI review (tracked as a task dependency).
- **V. Direct Verification**: PASS — gates: `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .`; end-to-end release-flow check in `quickstart.md`.

No violations → Complexity Tracking not required.

Post-design re-check (Phase 1 complete): all five principles still PASS —
the design introduced nothing beyond the plan: one build arg + env var,
one new server component, one shadcn CLI component, and a native-attr →
Tooltip swap in the existing table cell.

## Project Structure

### Documentation (this feature)

```text
specs/003-footer-version-tooltip/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── deployment.md    # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
webui/
├── src/
│   ├── components/
│   │   ├── footer.tsx        # NEW server component: renders "Version <v>" (env APP_VERSION, fallback "dev")
│   │   ├── domain-table.tsx  # EDIT: replace native title attr with Tooltip (shadcn)
│   │   └── ui/tooltip.tsx    # NEW via `npx shadcn@latest add tooltip` (no new npm deps)
│   └── app/
│       └── layout.tsx        # EDIT: mount <Footer /> after {children}; wrap app in TooltipProvider
Dockerfile                    # EDIT: ARG APP_VERSION=dev + ENV APP_VERSION=$APP_VERSION (runner stage)
.github/workflows/docker-image.yml  # EDIT: pass APP_VERSION build arg from release tag
src/updater.py                # UNCHANGED (headless mode has no footer/tooltip)
```

**Structure Decision**: All app changes stay in existing `webui/` modules; the
footer is a single new component following the existing
`webui/src/components/*` conventions. Infrastructure changes are two
one-line edits (Dockerfile, workflow).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations.
