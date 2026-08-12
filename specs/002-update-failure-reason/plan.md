# Implementation Plan: Show Failure Reason for Failed Domain Updates

**Branch**: `002-update-failure-reason` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-update-failure-reason/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

When a domain shows "Update failed" in the web UI, the user can read what
went wrong: the web UI captures the failure reason from the CLI's per-domain
output after every update run, persists it as a `last_error` key inside the
existing `config.json` (preserved by the CLI, verified in research.md), and
renders it inline under the domain name. Long/absent reasons fall back to a
generic message; tokens are redacted. Additionally, clicking the domain name
opens its live website (`https://<domain>`) in a new browser tab via a plain
external anchor. No new dependencies, no new endpoints, no headless-mode
changes.

## Technical Context

**Language/Version**: TypeScript (Next.js 16 App Router, Node runtime), Python 3 (container entrypoint, unchanged)

**Primary Dependencies**: Next.js 16 (existing), `domain-connect-dyndns` CLI 0.0.9 (upstream, pinned in Dockerfile; config round-trip and output verified from source)

**Storage**: `config.json` (`CONFIG_PATH`, default `/config.json`) — existing CLI-owned file; web UI adds the optional per-domain `last_error` key

**Testing**: No test framework in this project — verification gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (repo root); manual validation via `quickstart.md`

**Target Platform**: Linux container (Docker image), amd64 + arm64; browser web UI

**Project Type**: Docker utility image + optional Next.js web UI

**Performance Goals**: Single small JSON read/write per update run; no measurable latency impact on the update schedule (interval ≥ 60 s)

**Constraints**: `config.json` must stay valid for the CLI (JSON object, keys preserved); no new mounts; reasons ≤ 500 chars; token values never stored in reasons; web UI unchanged for non-error rows

**Scale/Scope**: Single user, handful of managed domains; latest reason only (no history)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS — no new dependencies, no new files/mounts; reason rides in the existing config file; extraction reuses the existing block-slicing logic.
- **II. Code-Grounded Specs**: PASS — project indexed with codebase-memory-mcp; design grounded in `dyndns.ts`, `domains.ts`, `config-store.ts`, `domain-table.tsx` and upstream CLI source.
- **III. Library-Aware Plans**: PASS — context7 consulted for Next.js external-link pattern; `domain-connect-dyndns` 0.0.9 source downloaded and verified (config round-trip, error output).
- **IV. Frontend Design Standards**: PASS — plan touches only an existing client-component table cell; implementation phase MUST load `web-design-guidelines`, `nextjs-best-practices`, `shadcn-ui` skills (tracked as a task dependency).
- **V. Direct Verification**: PASS — gates: `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .`.

No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-update-failure-reason/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── api.md           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
webui/
├── src/
│   ├── lib/
│   │   ├── config-store.ts   # NEW helper: writeConfig() preserving CLI keys + indent=1
│   │   ├── dyndns.ts         # EDIT: per-domain reason extraction + persist last_error in runUpdateAll()
│   │   ├── domains.ts        # EDIT: DomainView.lastError; toView() reads entry.last_error
│   │   └── errors.ts         # unchanged
│   └── components/
│       ├── domain-table.tsx  # EDIT: reason line under name; domain name as external <a target="_blank">
│       └── domain-list.tsx   # unchanged (refresh flow already re-reads)
│   └── app/api/domains/route.ts  # unchanged (flows through getDomains())
src/
└── updater.py            # UNCHANGED (headless mode keeps printing CLI output to logs)
```

**Structure Decision**: All changes live in the existing webui modules —
no new directories, no new files outside `webui/src/lib`/`webui/src/components`.
Headless mode intentionally untouched (no UI there; spec assumption).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations.
