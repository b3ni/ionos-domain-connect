---

description: "Task list for sortable domain list feature"
---

# Tasks: Sortable Domain List

**Input**: Design documents from `/specs/008-sort-domain-list/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No test tasks generated — the project has no test framework and the feature spec did not request tests; validation is manual per quickstart.md plus the lint/build/docker gates (constitution Principle V).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `webui/src/` (Next.js App Router, client components)
- All design decisions: `specs/008-sort-domain-list/{plan,research,data-model}.md` and `contracts/ui-sorting.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing toolchain is ready; this feature adds NO new dependencies (plan.md, constitution Principle I)

- [X] T001 Confirm `webui/` toolchain is ready: `node_modules` present (`npm install` only if missing), `npm run lint` and `npm run build` pass BEFORE any changes, and `docker build -t ionos-domain-connect .` succeeds at repo root — record baseline so regressions are attributable

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core sort logic that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create pure sort module `webui/src/lib/sort.ts` with: `SortKey` (`name | lastUpdatedAt | currentIp | lastResult`), `SortDirection` (`asc | desc`), `SortState` type, `DEFAULT_SORT = { key: "name", direction: "asc" }` (spec FR-004), `toggleSortState(current, key)` implementing the toggle rule (click new column → asc; click active column → flip; spec FR-002), and `sortDomains(domains, sort)` applying direction negation + stable tie fallback (rely on `Array.prototype.sort` stability; spec FR-005 tie rule) — per data-model.md "Sort semantics per column" and research.md R1/R5/R6. Comparators included here: case-insensitive name (lowercased `localeCompare`, raw-name tie-break) and Status rank on non-null values (`ok=0, pending=1, error=2`, research.md R2). Do NOT yet implement null pinning for timestamps/IPs or the `lastResult ?? "pending"` fallback — those belong to US2. Include `getSortedDomains`-style exports only as needed by T003.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sort the Domain List by Any Column (Priority: P1) 🎯 MVP

**Goal**: The user can click any of the four data column headers to reorder the domain table ascending/descending, with a visible sort indicator on the active column; default order on load is alphabetical by name (spec US1).

**Independent Test**: With 3+ managed domains in mixed state (quickstart.md fixture), click each column header and verify rows reorder in both directions, the indicator follows the active column, and on load the order is alphabetical by name (quickstart.md scenarios 1–3, 5).

### Implementation for User Story 1

- [X] T003 [US1] Wire sorting into `webui/src/components/domain-table.tsx`: add `useState<SortState>(DEFAULT_SORT)` (default `name`/asc per FR-004), sort `domains` with `useMemo(() => sortDomains(domains, sort), [domains, sort])` so the sort survives data refreshes (FR-009), render the sorted rows, and make the four data column headers sortable: each `<TableHead>` contains a focusable `<button>` (Enter/Space operable, per contracts/ui-sorting.md accessibility contract) that calls `toggleSortState`; set `aria-sort="ascending"`/`"descending"` on the active `<th>`, `aria-sort="none"` on inactive sortable headers, nothing on the actions header; add the lucide-react indicator icon (`ArrowUpDown` inactive, `ArrowUp`/`ArrowDown` active, `aria-hidden`) next to each header label. Keep `TableHeader`/`TableBody`/row rendering otherwise unchanged so per-row actions (refresh/remove/reauthorize) stay bound to the correct domain (FR-010). Do not touch the actions column or `webui/src/components/domain-list.tsx`.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (quickstart.md scenarios 1–3, 5)

---

## Phase 4: User Story 2 - Empty and Unavailable Values Stay Deterministic (Priority: P2)

**Goal**: Rows without a last update time or current IP, and rows with inconclusive status, always land at a fixed position (end of the list) regardless of sort direction, so ordering never looks random (spec US2).

**Independent Test**: With ≥1 domain that has never been updated and ≥1 without a recorded IP (quickstart.md fixture: `staging.example.com`, `never.example.com`), sort "Last update" and "Current IP" in both directions and verify the value-less rows always appear last; verify the Pending group stays together when sorting Status (quickstart.md scenarios 3, 4, 5).

### Implementation for User Story 2

- [X] T004 [US2] Add null pinning to `webui/src/lib/sort.ts` for the `lastUpdatedAt` and `currentIp` comparators: if exactly one side is null the non-null side sorts first, applied BEFORE direction negation so nulls stay at the end in both ascending and descending (spec FR-006, FR-007; data-model.md null-pinning rule; research.md R3). Timestamp comparison stays lexicographic on the ISO 8601 UTC strings (research.md R4).
- [X] T005 [US2] Make the Status sort key `lastResult ?? "pending"` in `webui/src/lib/sort.ts` so rows without recorded state (null `lastResult`, displayed as "Pending" badge by `RESULT_META` in webui/src/components/domain-table.tsx) sort with the Pending group in the fixed rank order `ok → pending → error` (spec FR-008; research.md R2). Verify ties in any column keep a stable, non-jittering relative order (spec Edge Cases).
- [X] T006 [US2] Verify graceful degradation with edge-case lists in `webui/src/components/domain-table.tsx`: single-row list (sorting has no visible effect, no errors) and empty list (page shows the existing empty-state card, no sort errors) — spec FR-012; adjust only if the sort wiring breaks these cases.

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T007 [P] Accessibility review of the sortable headers in `webui/src/components/domain-table.tsx` against the contracts/ui-sorting.md accessibility contract (focusable button, `aria-sort` on active and inactive headers, icon `aria-hidden`) using the web-design-guidelines skill — fix any findings
- [X] T008 Run the full verification gates: `cd webui && npm run lint`, `cd webui && npm run build`, and `docker build -t ionos-domain-connect .` at repo root (constitution Principle V); report results
- [X] T009 Run quickstart.md manual validation: scenarios 1–10 against the fixture `config.json` (default order, direction toggle, per-column sorts, null pinning, sort surviving refresh, stable ties, keyboard/screen-reader check, single/empty config, row-action integrity) — all scenarios must pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - touches the same files as US1 (`webui/src/lib/sort.ts`, `webui/src/components/domain-table.tsx`) so it is best run AFTER US1 to avoid same-file conflicts; it remains independently testable once its comparator additions are in

### Within Each User Story

- Core implementation (sort module) before UI integration
- UI integration before verification
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (independent files: no code file changes vs. `webui/src/lib/sort.ts`)
- T003 [US1] and T004 [US2] touch different parts but T004 edits the same module T002 created — after T002 completes, T003 (domain-table.tsx) and T004 (sort.ts) CAN run in parallel because they edit different files
- T007, T008, T009 in the Polish phase can run in parallel (review / gates / manual validation)

---

## Parallel Example: User Story 1

```bash
# Launch core sort logic and UI wiring together (different files):
Task: "T002 Create pure sort module in webui/src/lib/sort.ts"
Task: "T003 Wire sorting into webui/src/components/domain-table.tsx"
```

> Note: T003 depends on T002's exports (`SortState`, `toggleSortState`, `sortDomains`), so in practice run T002 first, then T003 — or define the module's API signature up front as specified in T002 and implement both together.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md scenarios 1–3, 5)
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T003, domain-table.tsx)
   - Developer B: User Story 2 (T004, T005 — sort.ts comparators)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No test tasks: project has no test framework and the spec did not request tests; manual validation per quickstart.md is the test strategy
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- CONSTITUTION: no new dependencies (Principle I), verification gates are lint + build + docker build (Principle V)
