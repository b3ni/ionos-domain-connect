---

description: "Task list for Show Failure Reason for Failed Domain Updates"
---

# Tasks: Show Failure Reason for Failed Domain Updates

**Input**: Design documents from `/specs/002-update-failure-reason/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md

**Tests**: No test tasks — the feature spec does not request tests and this project has no test framework; verification gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Web UI: `webui/src/lib/`, `webui/src/components/`
- Headless updater: `src/updater.py` (UNCHANGED in this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean starting state — no project init is needed (existing codebase)

- [x] T001 Run `npm run lint` and `npm run build` in `webui/` to confirm a clean baseline before any changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared config-file plumbing that BOTH the reason feature and its lifecycle depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `writeConfig(config: DomainConfig): void` to `webui/src/lib/config-store.ts` — writes the whole config object as JSON with `indent=1` (CLI-compatible formatting per research.md §1), preserving every existing key; must not touch anything outside the passed object
- [x] T003 Add optional `last_error?: string` field to `DomainConfigEntry` in `webui/src/lib/config-store.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - See Why a Domain Update Failed (Priority: P1) 🎯 MVP

**Goal**: After every update run, the web UI captures each failing domain's failure reason from the CLI output, persists it in `config.json`, and displays it under the domain name.

**Independent Test**: Force a failure (corrupt `access_token` in config), trigger "Update now", and verify the row shows the red badge plus a readable reason line; restart the container and verify the reason is still displayed.

### Implementation for User Story 1

- [x] T004 [P] [US1] Add `failureReasonForDomain(domain, stdout, stderr): string | null` to `webui/src/lib/dyndns.ts` — slice the block after the `Read <domain> config.` marker (reuse `outcomeForDomain` slicing logic), collect meaningful lines (trimmed, non-empty, excluding `***` banners, `Traceback`, `File `, `^` frames; stderr before stdout like `lastMeaningfulLine`), exclude the status classifier strings (`DNS records successfully updated.`, `All records up to date`, `Could not update DNS records.`, `not configured`, `configured incorrectly`), return the last remaining line truncated to 500 chars, or `null` when nothing remains (contracts/api.md §4)
- [x] T005 [US1] Add token redaction: in `webui/src/lib/dyndns.ts`, before storing a reason, replace the exact `access_token` and `refresh_token` values of that domain (from `readConfig()`) with `[redacted]` (FR-008)
- [x] T006 [US1] In `runUpdateAll()` (`webui/src/lib/dyndns.ts`), persist `last_error` via `writeConfig`: set it for `error` outcomes (using `failureReasonForDomain` + redaction, fallback text `Update failed. No error details reported by the updater.` when extraction returns `null`), delete it for `ok`/`unchanged` outcomes, touch nothing for `unknown`; write only when something changed (FR-001, FR-002, FR-004, FR-005)
- [x] T007 [P] [US1] Add `lastError: string | null` to `DomainView` and map `entry.last_error` in `toView()` in `webui/src/lib/domains.ts` (data-model.md read model; flows through `GET /api/domains` unchanged)
- [x] T008 [US1] In `webui/src/components/domain-table.tsx`, render the reason for rows with `lastResult === "error"` as a muted, single-line truncated detail (CSS line-clamp/truncate + `title` attribute with full text) below the domain name; render the generic fallback text when `lastError` is `null`; never break the row layout (FR-003, FR-007, FR-009)

**Checkpoint**: User Story 1 fully functional and testable independently (quickstart scenarios 1–3)

---

## Phase 4: User Story 2 - Reason Always Matches Reality (Priority: P2)

**Goal**: The displayed reason is never stale: it reflects the latest attempt, survives restarts, and disappears on success or removal.

**Independent Test**: Cause a failure (reason appears), restart (reason persists), fix the token and update (reason gone, badge "Up to date"), remove the domain (entry incl. `last_error` gone from `config.json`).

### Implementation for User Story 2

- [x] T009 [US2] Validate the full lifecycle of `last_error` per quickstart scenarios 2, 3 and 6: restart persistence, replace-on-latest-failure, clear-on-success (T006), and cleanup on domain removal (CLI `remove` pops the entry — verify no extra code is needed); check the mixed-mode case (headless success after web UI failure) never displays a stale reason because `lastError` is only rendered on `error` status

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: User Story 3 - Reason Even When Nothing to Parse (Priority: P3)

**Goal**: Failed attempts without parseable output still show a meaningful explanation, and no reason ever exposes credentials.

**Independent Test**: Simulate an abnormal CLI exit with empty output; verify the fallback text is shown. Confirm token values never appear in any stored/displayed reason.

### Implementation for User Story 3

- [x] T010 [US3] Define the fallback constant `FALLBACK_REASON = "Update failed. No error details reported by the updater."` in `webui/src/lib/dyndns.ts` and use it in T006 (store when extraction is `null`); T008 already renders it when `lastError` is null — verify consistency across both paths (FR-007, FR-008 via T005 redaction)

**Checkpoint**: All user stories independently functional

---

## Phase 6: User Story 4 - Open a Domain's Live Website (Priority: P2)

**Goal**: Clicking the domain name opens its live website in a new browser tab; the list stays put.

**Independent Test**: Click any domain name (including a failed one): the website opens in a new tab, the list remains in the original tab.

### Implementation for User Story 4

- [x] T011 [P] [US4] In `webui/src/components/domain-table.tsx`, render the domain name cell as a plain anchor `<a href={"https://" + domain.name} target="_blank" rel="noopener noreferrer">` (external-link pattern per research.md §4; NOT `next/link`); keep the clickable area limited to the name so the remove action stays unambiguous; styling must remain consistent with the existing `font-medium` cell (FR-010, FR-011)

**Checkpoint**: All user stories complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates and documentation

- [x] T012 [P] Run `npm run lint` in `webui/` and fix any issues
- [x] T013 [P] Run `npm run build` in `webui/` (must pass; `webui/AGENTS.md` block: read `node_modules/next/dist/docs/` if build errors reference breaking changes)
- [x] T014 [P] Run `docker build -t ionos-domain-connect .` at repo root (Constitution V gate)
- [x] T015 [P] Update README: document the failure reason display (and `last_error` in `config.json`, preserved by the CLI) and the click-to-open-domain behavior of the web UI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on US1 (T006 implements the lifecycle it validates)
- **US3 (Phase 5)**: Depends on US1 (fallback used by T006/T008)
- **US4 (Phase 6)**: Depends on Foundational only — independent of US1–US3
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — MVP
- **User Story 2 (P2)**: Depends on US1's capture (T006); independently testable after
- **User Story 3 (P3)**: Depends on US1's extraction (T004) and rendering (T008)
- **User Story 4 (P2)**: No dependency on other stories — fully independent

### Within Each User Story

- Config plumbing before extraction; extraction before persistence; persistence before display (US1)
- Implementation before validation checkpoint (US2)
- No tests in this feature (see header note)

### Parallel Opportunities

- T002 and T003 are separate concerns in the same file — run sequentially
- T004/T005 and T007 are different files — can run in parallel
- T008 depends on T007 (data shape) but not on T004–T006
- T011 is fully independent of US1–US3 — can be implemented in parallel with them
- T012–T015 all independent — run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch extraction + redaction and view model together:
Task: "Add failureReasonForDomain to webui/src/lib/dyndns.ts"
Task: "Add lastError to DomainView in webui/src/lib/domains.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline)
2. Complete Phase 2: Foundational (writeConfig + typing)
3. Complete Phase 3: User Story 1 (capture → persist → display)
4. **STOP and VALIDATE**: quickstart scenarios 1–3 (reason shown, persists across restart, clears on success)
5. Deploy/demo if ready — the core request ("quiero saber cual ha sido el fallo") is delivered

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP (failure reason visible) ✓ core value
3. US2 → validate (lifecycle correctness)
4. US3 → validate (fallback + redaction)
5. US4 → validate (domain link) — fully independent, can be picked up in parallel at any point

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (then US2, US3 sequentially)
   - Developer B: US4 (independent)
3. Stories complete and integrate independently (all edits are in separate modules; only `domain-table.tsx` is touched by both US1's T008 and US4's T011 — coordinate that one file)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts (only `domain-table.tsx` is shared between US1 and US4), cross-story dependencies that break independence
