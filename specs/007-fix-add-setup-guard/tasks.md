---

description: "Task list for the fix-is-not-managed feature"
---

# Tasks: Fix "is not managed" Error When Adding a Domain

**Input**: Design documents from `/specs/007-fix-add-setup-guard/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (api.md)

**Tests**: The feature spec does not request automated tests; the project has no test framework. Verification is manual via quickstart.md scenarios plus the project's real gates (`npm run lint` in `webui/`, `docker build -t ionos-domain-connect .` at repo root). Per Constitution Principle V, no test framework may be invented.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Single file is touched by implementation: `webui/src/app/api/domains/[domain]/setup/route.ts` (US1 and US2 are the two faces of one decision-rule change — strictly sequential)
- Runtime verification uses the quickstart.md scenarios with a stub CLI (`DYNDNS_CLI`) per quickstart.md Prerequisites

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No setup tasks required — the fix adds no dependencies, no
configuration, and no new files (plan.md: single-file change). Setup phase
is intentionally empty; proceed to the user stories.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational tasks required — all needed modules
(`getSession` in `webui/src/lib/setup-session.ts`, `isManaged` in
`webui/src/lib/domains.ts`, `appError`/`errorResponse` in
`webui/src/lib/errors.ts`) already exist and are imported by the route
(research.md R1–R2).

---

## Phase 3: User Story 1 - Add Flow Accepts the Access Code (Priority: P1) 🎯 MVP

**Goal**: Submitting the access code during the add-domain flow returns 200 and reaches the CLI, even though the domain is not yet in the config (spec US1, contracts/api.md)

**Independent Test**: Start an add flow via `POST /api/domains` (domain NOT in config), then `POST /api/domains/<domain>/setup` with a code → 200, not 404 "is not managed" (quickstart Scenario 1)

### Implementation for User Story 1

- [X] T001 [US1] Reorder the decision logic in `webui/src/app/api/domains/[domain]/setup/route.ts` POST handler per data-model.md decision rule and contracts/api.md: call `getSession(parsed.data.domain)` FIRST; apply the `isManaged` guard (404 `"<domain> is not managed."`) ONLY when no session exists; keep the existing branches unchanged (body code → `submitAccessCode`, otherwise → `startSetupSession`); keep GET handler untouched
- [X] T002 [US1] Runtime-verify quickstart Scenario 1 (add flow: 201 from `POST /api/domains`, then code submission → 200, code consumed by the stub CLI); also verify Scenario 3's session completion still reaches state "completed" (no CLI or dialog regressions)

**Checkpoint**: User Story 1 is fully functional — a new domain can complete its setup end-to-end

---

## Phase 4: User Story 2 - Keep Re-Authorization Protection (Priority: P1)

**Goal**: The re-authorization protection from feature 005 is preserved: no session + not managed → 404 "is not managed"; no session + managed → new session starts; session errors keep their own messages (spec US2, FR-004)

**Independent Test**: (a) no-session POST for an unmanaged domain → 404 "is not managed"; (b) no-session POST for a managed domain → 200 new session; (c) duplicate code submission → 409 session error, never "is not managed" (quickstart Scenarios 2–4)

**Story dependency**: US2 verifies the OTHER face of the same change made in US1 — implement after Phase 3

### Implementation for User Story 2

- [X] T003 [US2] Runtime-verify quickstart Scenarios 2 and 3: no session + domain absent from `config.json` → 404 `"<domain> is not managed."` (unchanged); no session + domain present in `config.json` → 200 awaiting-authorization session (re-setup start works)
- [X] T004 [US2] Runtime-verify quickstart Scenario 4: submitting the same code twice → 409 "not awaiting an access code"; submitting a code after a server restart (sessions are in-memory) → 404 "No setup session … Start the setup again." — neither is ever "is not managed" (FR-004)

**Checkpoint**: User Stories 1 AND 2 are both verified — the add flow works and 005's protection is intact

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates and full-flow regression check

- [X] T005 [P] Run `npm run lint` inside `webui/` and fix any new warnings
- [X] T006 [P] Run `docker build -t ionos-domain-connect .` at the repository root (Constitution Principle V — build MUST pass)
- [ ] T007 [P] Full UI walk-through (quickstart Scenario 5, needs a browser): add a brand-new subdomain through the dialog with the access code — no error, success toast, domain listed; then run a re-authorization from a NOTFOUND_SESSION row — completes and auto-closes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no tasks
- **Foundational (Phase 2)**: no tasks — existing modules already provide everything
- **User Stories (Phase 3+)**: US1 then US2 — strictly sequential, both operate on the decision rule of the same route file
- **Polish (Final Phase)**: depends on US1 and US2 being verified

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies — the implementation task itself
- **User Story 2 (P1)**: Depends on US1 (verifies the preservation face of the same edit)

### Within Each User Story

- Implementation before verification (T001 → T002; T003 → T004)

### Parallel Opportunities

- T005, T006, T007 (Polish) can all run in parallel after US1+US2
- Everything else is sequential (single route file + dependent scenario checks)

---

## Parallel Example: Polish phase

```bash
Task: "T005 Run npm run lint inside webui/"
Task: "T006 Run docker build -t ionos-domain-connect . at the repository root"
Task: "T007 Full UI walk-through (browser)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 (the decision-rule reorder)
2. Complete T002 (Scenario 1 runtime check)
3. **STOP and VALIDATE**: quickstart Scenario 1 — add flow code submission returns 200
4. The core fix is delivered; US2 verification and gates follow

### Incremental Delivery

1. T001 → T002: add flow fixed and verified (MVP)
2. T003 → T004: protection preserved and session errors truthful
3. T005 → T007: gates and full UI regression

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable via quickstart.md scenarios
- Commit after each task or logical group
- Avoid: vague tasks, touching other files (the fix is confined to `route.ts`), inventing a test framework
