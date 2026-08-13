# Implementation Plan: Actionable Domain Re-Setup

**Branch**: `005-domain-resetup-flow` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-domain-resetup-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

1. **Actionable re-setup (US1)**: rows failing with the known NOTFOUND_SESSION
   signature replace the inert text hint with a button that opens the
   authorization dialog pre-targeted to that domain. New endpoint
   `POST /api/domains/[domain]/setup` (start + submit code) because the add
   flow's `POST /api/domains` rejects already-managed domains.
2. **Dialog completion fix (Q1/Q2 clarifications)**: the shared
   authorization dialog's polling returns early while `authUrl` is set, so
   the UI never sees the "completed" state (verified bug in
   `add-domain-form.tsx`). The dialog is extracted into a shared
   `AuthorizationDialog` component; after submitting the access code it
   polls until the session finishes, then auto-closes with a success toast
   (FR-012/FR-013) — fixing both the add and re-setup flows in one
   delivery.
3. **Explanation (US2)**: the re-setup dialog explains why the failure
   happened and that re-authorizing does not remove the domain or touch
   DNS records.
4. **Back to "Up to date" (US3, P2)**: after a successful re-setup, a
   per-domain update is triggered automatically and the list refreshes.

No storage changes; the setup-session plumbing is reused unchanged.

## Technical Context

**Language/Version**: TypeScript (Next.js 16.3 App Router, Node 22), Python 3 CLI (upstream, unchanged)

**Primary Dependencies**: Next.js 16 (existing), shadcn/ui Dialog + Button + sonner (all existing in repo), lucide-react (existing)

**Storage**: none new — re-setup replaces the domain's entry in `config.json` (CLI behavior, fresh start; `last_error` cleared)

**Testing**: No test framework — gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation via `quickstart.md`

**Target Platform**: Linux container (Docker image, amd64 + arm64); browser web UI

**Project Type**: Docker utility image + optional Next.js web UI

**Performance Goals**: polling at 1.5 s interval (existing); one extra per-domain update after re-setup (seconds)

**Constraints**: add flow keeps rejecting duplicates; re-setup only for managed domains; no credentials displayed; setup-session concurrency model unchanged; dialog auto-closes with success toast on completion (no extra click)

**Scale/Scope**: single user, handful of domains; one trigger per affected row

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Simplicity**: PASS — no new dependencies; the setup-session plumbing (`setup-session.ts`, CLI child handling) is reused as-is; the "new" dialog is an extraction of the existing one; one new POST on an existing route path.
- **II. Code-Grounded Specs**: PASS — project indexed with codebase-memory-mcp; the dialog-stuck bug was reproduced and localized in `webui/src/components/add-domain-form.tsx` (early return in `pollSession` when `authUrl` is set + effect that skips polling while the URL is present); `api/domains/route.ts` CONFLICT on managed domains verified.
- **III. Library-Aware Plans**: PASS — context7 consulted for sonner (`toast.success`/`duration`, API reference); Next.js route-handler patterns (async `params`) verified via context7 in the previous feature; shadcn Dialog composition follows the repo's existing usage and the loaded shadcn skill.
- **IV. Frontend Design Standards**: PASS — `shadcn`, `nextjs-best-practices`, `web-design-guidelines` skills loaded this session; implementation MUST load them again and run the a11y review on the new trigger/dialog (tracked as a task dependency).
- **V. Direct Verification**: PASS — gates: `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .`; end-to-end checks in `quickstart.md` (including the bug-fix validation on the add flow).

No violations → Complexity Tracking not required.

Post-design re-check (Phase 1 complete): all five principles still PASS —
the design adds no dependencies or storage: one shared dialog extraction,
one POST on an existing route, one per-row trigger component, and a
parameterized polling predicate; the bug fix and the new flow land in the
same delivery (clarification Q2).

## Project Structure

### Documentation (this feature)

```text
specs/005-domain-resetup-flow/
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
│   ├── components/
│   │   ├── authorization-dialog.tsx    # NEW (extracted): shared dialog — start session, auth URL, code, poll-until-done, auto-close + success toast
│   │   ├── add-domain-form.tsx         # EDIT: domain input + start, then delegates to AuthorizationDialog; polling bug fixed
│   │   ├── reauthorize-domain-button.tsx  # NEW: per-row trigger + AuthorizationDialog with explanation + auto per-domain update on completion
│   │   └── domain-table.tsx            # EDIT: NOTFOUND_SESSION hint becomes an actionable button (replaces plain <p>)
│   └── app/api/domains/[domain]/setup/route.ts  # EDIT: add POST handler (start session / submit code for managed domains)
src/
└── updater.py           # UNCHANGED
```

**Structure Decision**: extraction over duplication — the authorization
journey (URL → code → poll → complete) moves into one shared component
used by add and re-setup. Backend change is a single POST on the existing
setup route. No new directories, no new storage.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None — no constitution violations.
