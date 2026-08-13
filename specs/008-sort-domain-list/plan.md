# Implementation Plan: Sortable Domain List

**Branch**: `008-sort-domain-list` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-sort-domain-list/spec.md`

## Summary

The domain table in the web UI (currently always sorted alphabetically by
name server-side in `webui/src/lib/domains.ts:62`) must become sortable by
clicking the four data column headers — Domain, Last update, Current IP,
Status — with ascending/descending toggle, a visible sort indicator, and
missing values pinned to the end of the list in both directions. The sort is
a purely client-side display concern: no new dependencies, no API changes,
no persistence (resets to alphabetical by name on reload, per spec
Assumptions).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19.2.8, Next.js 16.3.0 (App Router)

**Primary Dependencies**: none added — existing `lucide-react` (sort icons)
and shadcn/ui `Table` components (`webui/src/components/ui/table.tsx`).
TanStack Table (`@tanstack/react-table`, the library behind shadcn's data
table example) was evaluated via context7 and rejected — see research.md.

**Storage**: N/A — sort state is ephemeral React state (`useState`), reset
on reload by design (spec Assumptions).

**Testing**: No test framework in the project. Verification is
`npm run lint` and `npm run build` (ESLint + typecheck) in `webui/`, plus
the constitution's gate `docker build -t ionos-domain-connect .` at repo
root; functional validation is manual via `npm run dev` (quickstart.md).

**Target Platform**: Modern browsers served by the container's Node server;
Linux amd64/arm64 images.

**Project Type**: Web application (Next.js App Router, client component)

**Performance Goals**: Instant reorder for 50+ rows (spec FR-011/SC-003).
A client-side comparator over ≤ 50 items is trivially O(n log n); `useMemo`
avoids re-sorting on unrelated renders.

**Constraints**: No new dependencies (constitution Principle I); no changes
to `config.json` or the API routes; sortable headers must be keyboard-
operable and expose `aria-sort` (web-design-guidelines, spec Assumptions).

**Scale/Scope**: Single table, ≤ 50 domains, no pagination/filtering/multi-
sort; the actions column is not sortable.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status |
|-----------|--------|
| I. Simplicity (Minimum Engineering) | **PASS** — hand-rolled comparator + `useState`; no library, no new files beyond one small pure module. Complexity Tracking table not needed. |
| II. Code-Grounded Specs (codebase-memory-mcp) | **PASS** — project indexed (`home-b3-workspace-ionos-domain-connect`); graph and file reads grounded the design in `domain-table.tsx`, `domain-list.tsx`, `domains.ts`. |
| III. Library-Aware Plans (context7) | **PASS** — context7 consulted on TanStack Table (`/tanstack/table`) before rejecting it; findings in research.md. |
| IV. Frontend Design Standards | **PASS** — `web-design-guidelines`, `nextjs-best-practices`, `shadcn-ui` skills loaded; sort header a11y (button + `aria-sort`) and shadcn Table patterns honored. |
| V. Direct Verification | **PASS** — verification commands stated below (lint, build, docker build). |

## Project Structure

### Documentation (this feature)

```text
specs/008-sort-domain-list/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
webui/
└── src/
    ├── components/
    │   ├── domain-table.tsx   # MODIFY: sortable headers, sort state, indicator
    │   └── domain-list.tsx    # unchanged — DomainTable stays self-contained
    └── lib/
        ├── sort.ts            # NEW: SortState type + pure comparator/toggle helpers
        └── domains.ts         # unchanged — server-side name sort stays as default
```

**Structure Decision**: The change is confined to the existing table view.
`DomainList` (webui/src/components/domain-list.tsx:19) already holds the
data state and passes `data.domains` into `DomainTable`; the table is used
in exactly one place, so sort state lives inside `DomainTable` (already a
client component) and no props change. The comparator logic is extracted
into `webui/src/lib/sort.ts` as pure functions so the sort semantics are a
single testable unit. `getDomains()` keeps its alphabetical default sort —
it defines the initial row order (default state is `name`/asc), and the
client sort merely preserves it deterministically. `lucide-react` icons
(`ArrowUp`, `ArrowDown`, `ArrowUpDown`) are already a project dependency.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — Complexity Tracking table not needed.

## Phase 0: Research Summary

See [research.md](research.md). Key resolution: **hand-rolled sort instead
of TanStack Table** (simplicity), with the sort-key mapping for Status and
null-pinning semantics defined precisely (see data-model.md).

## Phase 1: Design Summary

- **Data model** — [data-model.md](data-model.md): `SortState`, per-column
  sort semantics, null handling, tie-breaking, default state.
- **Contracts** — [contracts/ui-sorting.md](contracts/ui-sorting.md): the
  sortable-table UI contract (click semantics, `aria-sort`, indicator,
  what never changes: config, API, row actions).
- **Validation guide** — [quickstart.md](quickstart.md): manual validation
  scenarios with a stub `config.json` and the exact verification commands.

## Re-Check After Phase 1 Design

Constitution Check re-evaluated post-design: all five principles still PASS.
The design adds no dependencies (I), follows the real component wiring (II),
documents the rejected library choice from context7 (III), honors the loaded
frontend skills (IV), and states concrete verification commands (V).

## Verification

```bash
cd webui && npm run lint
cd webui && npm run build
docker build -t ionos-domain-connect .
```

Plus manual functional validation per quickstart.md (sort every column both
directions with mixed-state domains, verify indicator, null rows pinned).
