# Implementation Plan: Per-Domain Refresh

**Branch**: `004-per-domain-refresh` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-per-domain-refresh/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

1. **Per-domain refresh**: each managed domain row gets its own update
   action that runs the updater for that domain only
   (`domain-connect-dyndns update --domain <name>`, single-domain mode
   verified in-container). A new `POST /api/domains/[domain]/update`
   endpoint runs it behind the existing single execution lock (concurrent
   triggers → `409 CONFLICT`), persists the per-domain outcome/`last_error`
   exactly like the global run does (shared persist helper), and the UI
   shows per-row loading + result feedback. The global button keeps
   working.
2. **NOTFOUND_SESSION guidance**: rows whose failure reason carries the
   known signature ("Failed to get async token" / "NOTFOUND_SESSION") also
   show a short hint line "Run setup again for this domain." (display-time
   classification, no storage). Diagnosis grounded in upstream source:
   `get_async_token` exchanges the stored OAuth session with the provider;
   `400 invalid_request NOTFOUND_SESSION` means the session no longer
   exists provider-side (expired or replaced by a re-setup elsewhere) —
   re-running setup for that domain is the fix.

## Technical Context

**Language/Version**: TypeScript (Next.js 16.3 App Router, Node 22), Python 3 CLI (upstream, unchanged)

**Primary Dependencies**: Next.js 16 (existing), `domain-connect-dyndns` CLI (upstream, `update --domain <name>` verified from source + in-container `--help`), lucide-react (existing, refresh icon)

**Storage**: `config.json` — no schema change; the per-domain run writes the same fields (`last_success`/`last_attempt`/`last_error`) the global run writes today

**Testing**: No test framework — gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation via `quickstart.md`

**Target Platform**: Linux container (Docker image, amd64 + arm64); browser web UI

**Project Type**: Docker utility image + optional Next.js web UI

**Performance Goals**: single-domain runs are fast (one provider token exchange + one DNS update); no measurable impact on the schedule

**Constraints**: updates never run concurrently (shared config file); no new storage; the NOTFOUND_SESSION hint must not leak credentials; global update unchanged; headless mode (`src/updater.py`) unchanged

**Scale/Scope**: single user, handful of domains; one button per row

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS — no new dependencies; reuses `runCli`, `outcomeForDomain`, `failureReasonForDomain`, `redactSecrets` and the existing scheduler lock; one new endpoint + one small client component; hint is display-time text.
- **II. Code-Grounded Specs**: PASS — project indexed with codebase-memory-mcp; design grounded in `webui/src/lib/dyndns.ts`, `scheduler.ts`, `api/update/route.ts`, `update-now-button.tsx`, `domain-list.tsx`, `domain-table.tsx`, and the upstream `domain_update.py` / `domainconnect.py` source (verified in-container).
- **III. Library-Aware Plans**: PASS — context7 consulted for every library in the plan: `/vercel/next.js` (Route Handler dynamic segments — `params: Promise<{...}>` must be awaited; try/catch error pattern) and `/shadcn-ui/ui` (Button composition: no loading prop, `size="icon"` + `aria-label`, icon sizing rules). Findings verified against the installed code (`api/domains/[domain]/route.ts`, `button.tsx`, `remove-domain-button.tsx`) and consolidated in research.md §8.
- **IV. Frontend Design Standards**: PASS — `shadcn`, `nextjs-best-practices`, `web-design-guidelines` skills loaded this session; implementation MUST load them again and run the a11y/UI review on the new button and hint (tracked as a task dependency).
- **V. Direct Verification**: PASS — gates: `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .`; end-to-end checks in `quickstart.md`.

No violations → Complexity Tracking not required.

Post-design re-check (Phase 1 complete): all five principles still PASS —
the design added nothing beyond the plan: one shared persist helper + one
scheduler wrapper, one new route file, one new button component, a
display-time hint, and zero new storage/dependencies.

## Project Structure

### Documentation (this feature)

```text
specs/004-per-domain-refresh/
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
│   │   ├── dyndns.ts      # EDIT: extract persistOutcome(); add runUpdateOne(domain)
│   │   └── scheduler.ts   # EDIT: shared withLock(); add runUpdateOneNow(domain)
│   ├── app/api/domains/[domain]/update/route.ts  # NEW: POST per-domain update; mirrors [domain]/route.ts (async params + domainParamSchema; 400/404/409 via errorResponse)
│   └── components/
│       ├── refresh-domain-button.tsx  # NEW: per-row icon button (variant="ghost" size="icon", aria-label, Loader2+disabled loading)
│       ├── domain-list.tsx   # EDIT: add RefreshDomainButton to row actions
│       └── domain-table.tsx  # EDIT: NOTFOUND_SESSION hint line under the error text
src/
└── updater.py           # UNCHANGED (headless mode)
```

**Structure Decision**: All changes live in existing `webui/` modules plus
one new route file and one new component, following the existing
`[domain]` route-folder and component conventions. No new directories,
no new storage, no CLI/headless changes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations.
