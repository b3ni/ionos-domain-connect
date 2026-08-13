---

description: "Task list for Per-Domain Refresh"
---

# Tasks: Per-Domain Refresh

**Input**: Design documents from `/specs/004-per-domain-refresh/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md

**Tests**: No test tasks — the feature spec does not request tests and this project has no test framework; verification gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Web UI: `webui/src/lib/`, `webui/src/app/api/domains/[domain]/update/`, `webui/src/components/`
- Headless updater: `src/updater.py` (UNCHANGED in this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean starting state and the mandated skills — no project init is needed (existing codebase)

- [X] T001 Run `npm run lint` and `npm run build` in `webui/` to confirm a clean baseline before any changes
- [X] T002 Load the frontend skills mandated by the constitution (Principle IV) for all UI work in this feature: `shadcn` (component patterns), `nextjs-best-practices` (App Router), `web-design-guidelines` (a11y review of the new button and hint)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared plumbing that US1's per-domain run depends on — no schema or storage changes

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Extract `persistOutcome(config, domain, outcome, stdout, stderr): boolean` in `webui/src/lib/dyndns.ts` from the persist loop of `runUpdateAll()` (lines 167–189): set `last_error` (redacted reason or `FALLBACK_REASON`) for `error`, delete it for `ok`/`unchanged`, touch nothing for `unknown`, return whether the config changed; refactor `runUpdateAll()` to use it with byte-identical semantics (research.md §2)
- [X] T004 [P] Extract a shared `withLock<T>(label: string, fn: () => Promise<T>): Promise<T>` helper in `webui/src/lib/scheduler.ts` from `runUpdateNow()` — same module-level `running` flag, same `CONFLICT` AppError on busy, same log lines; refactor `runUpdateNow()` to use it (research.md §3)

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Refresh a Single Domain (Priority: P1) 🎯 MVP

**Goal**: Each domain row has its own update action that runs the updater for that domain only; the global button keeps working; both share the execution lock.

**Independent Test**: With ≥2 managed domains, click one row's refresh: only that domain's last-update time advances (others unchanged), a per-domain toast appears, and the list refreshes (quickstart scenarios 1–4, 7).

### Implementation for User Story 1

- [X] T005 [US1] Add `runUpdateOne(domain: string): Promise<UpdateSummary>` to `webui/src/lib/dyndns.ts` — `runCli(["update", "--domain", domain])`, read config (empty object on read error), `outcomeForDomain(domain, stdout)`, apply `persistOutcome` (T003), `writeConfig` only if changed, return `{ domains: { [domain]: outcome }, raw: stdout }` (FR-002, FR-005; research.md §2)
- [X] T006 [US1] Add `runUpdateOneNow(domain: string): Promise<UpdateSummary>` to `webui/src/lib/scheduler.ts` — delegates to `runUpdateOne(domain)` through `withLock` (T004) so per-domain and global runs share one lock (FR-004, SC-003; depends on T004, T005)
- [X] T007 [US1] Create `webui/src/app/api/domains/[domain]/update/route.ts` with a `POST` handler mirroring `webui/src/app/api/domains/[domain]/route.ts`: `{ params }: { params: Promise<{ domain: string }> }` awaited; validate with `domainParamSchema` from `@/lib/validation` (400 VALIDATION); guard `isManaged` (404 NOT_FOUND); call `runUpdateOneNow(domain)`; return `{ started: true, results: { [domain]: outcome } }`; catch → `errorResponse(error)` (contracts/api.md §1; depends on T006)
- [X] T008 [US1] Create `webui/src/components/refresh-domain-button.tsx` — client component; `Button variant="ghost" size="icon"` with `aria-label={`Refresh ${domain}`}` and `RefreshCw` (or `Loader2 animate-spin` while running, `disabled={running}` — no loading prop, shadcn composition per research.md §8); on click `POST /api/domains/[domain]/update` (encodeURIComponent), toast per-domain outcome on success (`toast.success`/`toast.error` with the domain name, matching `update-now-button.tsx` style), call `onFinished`; handle 409 with the server message (depends on T007)
- [X] T009 [US1] In `webui/src/components/domain-list.tsx`, render `<RefreshDomainButton domain={domain.name} onFinished={refresh} />` next to `RemoveDomainButton` in the `actions` render prop of `DomainTable` (wrap in a `flex gap-1` container); the global `UpdateNowButton` stays unchanged (FR-001, FR-003; depends on T008)

**Checkpoint**: User Story 1 fully functional and testable independently (quickstart scenarios 1–4, 7)

---

## Phase 4: User Story 2 - Know What to Do About the Token Error (Priority: P2)

**Goal**: Domains failing with the known NOTFOUND_SESSION error show a short hint telling the user to re-run the domain setup.

**Independent Test**: Force the known error text into a failing domain's reason and verify the hint line appears; verify no hint for unrelated errors (quickstart scenarios 5–6).

### Implementation for User Story 2

- [X] T010 [US2] In `webui/src/components/domain-table.tsx`, under the existing error tooltip trigger (rendered when `lastResult === "error"` and `lastError`), render an additional muted hint line `Run setup again for this domain.` (`text-xs text-muted-foreground`) only when `lastError` contains `"Failed to get async token"` or `"NOTFOUND_SESSION"`; never for other reasons, never with credentials (FR-009, FR-010, FR-011; research.md §6)
- [X] T011 [US2] Run the `web-design-guidelines` review on `webui/src/components/refresh-domain-button.tsx` and `webui/src/components/domain-table.tsx`: icon-only button has `aria-label`, visible focus states, hint has sufficient contrast and no layout break for long content (FR-011)

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates and documentation

- [X] T012 [P] Run `npm run lint` in `webui/` and fix any issues
- [X] T013 [P] Run `npm run build` in `webui/` (must pass; `webui/AGENTS.md` block: read `node_modules/next/dist/docs/` if build errors reference breaking changes)
- [X] T014 [P] Run `docker build -t ionos-domain-connect .` at repo root (Constitution V gate)
- [X] T015 [P] Update README: document the per-row refresh action (updates only that domain; shares the update lock) and the "Run setup again for this domain." hint shown when a domain's session is no longer valid on the provider side (NOTFOUND_SESSION)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **US1 (Phase 3)**: Depends on Foundational (T003, T004)
- **US2 (Phase 4)**: Depends on Foundational only — independent of US1 (different files)
- **Polish (Phase 5)**: Depends on both user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 — MVP
- **User Story 2 (P2)**: No dependency on US1 — fully independent (only `domain-table.tsx`, untouched by US1)

### Within Each User Story

- Persist helper before single-domain runner; runner before scheduler wrapper; scheduler before route; route before button; button before list wiring (US1)
- Implementation before a11y review (US2)
- No tests in this feature (see header note)

### Parallel Opportunities

- T003 and T004 are different files — can run in parallel
- T005 → T006 → T007 → T008 → T009 form a strict chain (same dependency flow) — sequential
- T010/T011 (US2) are fully independent of US1 — can be implemented in parallel with T005–T009
- T012–T015 all independent — run in parallel

---

## Parallel Example: User Story 1 and User Story 2

```bash
# Developer A (US1 chain):
Task: "Add runUpdateOne to webui/src/lib/dyndns.ts"
Task: "Add runUpdateOneNow to webui/src/lib/scheduler.ts"
Task: "Create POST route at webui/src/app/api/domains/[domain]/update/route.ts"
Task: "Create refresh-domain-button.tsx in webui/src/components/"
Task: "Wire button into domain-list.tsx actions"

# Developer B (US2, independent):
Task: "Add NOTFOUND_SESSION hint to webui/src/components/domain-table.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline)
2. Complete Phase 2: Foundational (persistOutcome + withLock)
3. Complete Phase 3: User Story 1 (runner → scheduler → route → button → list)
4. **STOP and VALIDATE**: quickstart scenarios 1–4, 7 (single-domain isolation, failure lifecycle, lock conflict, 404, global regression)
5. Deploy/demo if ready — the core request ("refresh individual por dominio") is delivered

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP (per-domain refresh) ✓ core value
3. US2 → validate (NOTFOUND_SESSION hint, scenarios 5–6)
4. Polish → gates + README

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (strict chain T005–T009)
   - Developer B: US2 (domain-table.tsx hint)
3. Stories complete and integrate independently (no shared files between the two stories)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts (T005 edits `dyndns.ts` after T003; T006 edits `scheduler.ts` after T004 — sequential within each file), cross-story dependencies that break independence
- Verification gates (Constitution V): `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .` must all pass before completion
