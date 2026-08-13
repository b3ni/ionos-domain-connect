---

description: "Task list for Actionable Domain Re-Setup"
---

# Tasks: Actionable Domain Re-Setup

**Input**: Design documents from `/specs/005-domain-resetup-flow/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md

**Tests**: No test tasks — the feature spec does not request tests and this project has no test framework; verification gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Web UI: `webui/src/components/`, `webui/src/app/api/domains/[domain]/setup/`
- Headless updater: `src/updater.py` (UNCHANGED in this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean starting state and the mandated skills — no project init is needed (existing codebase)

- [X] T001 Run `npm run lint` and `npm run build` in `webui/` to confirm a clean baseline before any changes
- [X] T002 Load the frontend skills mandated by the constitution (Principle IV) for all UI work in this feature: `shadcn` (Dialog/Button patterns), `nextjs-best-practices` (App Router), `web-design-guidelines` (a11y review of the new trigger and dialog)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared re-setup endpoint and the shared authorization dialog (with the completion-detection fix) that BOTH user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Add a `POST` handler to `webui/src/app/api/domains/[domain]/setup/route.ts`: awaited `params` (`Promise<{ domain: string }>`), `domainParamSchema` validation (400), `isManaged(domain)` guard (404 NOT_FOUND — re-setup only for managed domains), body `{ code?: string }` — absent → `startSetupSession(domain)`, present → `submitAccessCode(domain, code)` (mirrors `POST /api/domains`); return the `SetupSessionView` JSON; `startSetupSession` already raises 409 CONFLICT for in-progress sessions; catch → `errorResponse` (contracts/api.md §1; research.md §3)
- [X] T004 [P] Create `webui/src/components/authorization-dialog.tsx` — the SHARED authorization journey extracted from `add-domain-form.tsx` with the completion-detection bug fixed: props `{ domain, open, onOpenChange, explanation?, onCompleted }`; start the session (POST `[domain]/setup`) on open; phases waiting-for-URL → auth URL + code input → submit → poll; the poll after code submission MUST keep polling every 1500 ms until `state !== "awaiting_authorization"` (parameterized `until(session)` predicate — NEVER return early while `authUrl` is set, research.md §1); on `completed`: `toast.success(\`${domain} configured.\`)` + auto-close + `onCompleted()` (FR-012/FR-013, SC-006); on `failed`: show the error in the dialog; `Dialog` with `DialogTitle` (a11y); button loading via `Loader2` + `disabled` (research.md §7)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Re-Authorize a Domain from the List (Priority: P1) 🎯 MVP

**Goal**: Rows with the NOTFOUND_SESSION failure show an actionable "Run setup again" button that opens the pre-targeted re-setup dialog; the add-domain flow uses the same fixed dialog.

**Independent Test**: Add a NEW domain end-to-end (dialog auto-closes + success toast — bug fix regression, quickstart scenario 1); a row with the signature shows the button and opens the dialog pre-targeted (scenarios 2–3, 5).

### Implementation for User Story 1

- [X] T005 [US1] Refactor `webui/src/components/add-domain-form.tsx` to use `AuthorizationDialog` (T004): keep the domain-input step ("Start setup" → POST `/api/domains`), then render the dialog for the started session; `onCompleted` → `onAdded()` (list refresh); remove the now-duplicated URL/code/poll logic and the old "Done" button flow (FR-012/FR-013 delivered to the add flow; depends on T004)
- [X] T006 [US1] Create `webui/src/components/reauthorize-domain-button.tsx` — per-row component (pattern of `RemoveDomainButton`): reset-styled trigger (muted text button, hover + focus-visible ring, matching the error-line trigger style) labelled `Run setup again for this domain.`; on click opens `AuthorizationDialog` pre-targeted (`domain` prop — no input) with `onCompleted` → refresh list via `onFinished` (FR-001, FR-002, FR-011; depends on T003, T004)
- [X] T007 [US1] In `webui/src/components/domain-table.tsx`, replace the plain `<p>` hint (rendered when `lastError` matches the NOTFOUND_SESSION signature via `needsResync`) with the `ReauthorizeDomainButton` trigger (pass `onFinished` through; the component renders nothing for rows without the signature — FR-004; depends on T006)

**Checkpoint**: User Story 1 fully functional and testable independently (quickstart scenarios 1–3, 5)

---

## Phase 4: User Story 2 - Understand What "Setup" Means and Why It Happens (Priority: P1)

**Goal**: The re-setup dialog explains in plain language why the failure happened and that re-authorizing does not remove the domain or change DNS records.

**Independent Test**: Open the re-setup dialog from a signature row and verify the explanation text is visible and accurate (quickstart scenario 2, step 3).

### Implementation for User Story 2

- [X] T008 [US2] Pass the explanation block to `AuthorizationDialog` via its `explanation` prop from `webui/src/components/reauthorize-domain-button.tsx` (re-setup mode only — the add flow shows no explanation): "This domain's connection authorization has expired or was replaced on the provider side, so updates now fail." and "Re-authorizing reconnects the domain. It does not remove the domain and does not change its DNS records." (FR-004, FR-010; research.md §5; depends on T006, same file — sequential)

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: User Story 3 - Domain Back to "Up to Date" Right After Re-Setup (Priority: P2)

**Goal**: After a successful re-setup, a per-domain update runs immediately so the row returns to "Up to date" without waiting for the next scheduled tick.

**Independent Test**: Re-authorize a failing domain and verify the auto-update runs (row shows success, hint gone) right after the dialog closes (quickstart scenarios 3).

### Implementation for User Story 3

- [X] T009 [US3] In `webui/src/components/reauthorize-domain-button.tsx`, extend the completion handler: after `onCompleted` (list refresh), POST `/api/domains/${encodeURIComponent(domain)}/update` (the 004 endpoint) and toast the outcome, reusing the same fetch/response handling as `RefreshDomainButton` (409 surfaces the existing "already running" message) (FR-007, SC-004; research.md §6; depends on T008, same file — sequential)

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates and documentation

- [X] T010 [P] Run `npm run lint` in `webui/` and fix any issues
- [X] T011 [P] Run `npm run build` in `webui/` (must pass; `webui/AGENTS.md` block: read `node_modules/next/dist/docs/` if build errors reference breaking changes)
- [X] T012 [P] Run `docker build -t ionos-domain-connect .` at repo root (Constitution V gate)
- [X] T013 [P] Update README: document the re-setup action on NOTFOUND_SESSION rows (opens the authorization dialog pre-targeted; re-authorizing does not remove the domain or change DNS records) and that the setup dialog now closes automatically with a success message

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (T003, T004)
- **US2 (Phase 4)**: Depends on US1 (T006 provides the re-setup component)
- **US3 (Phase 5)**: Depends on US2 (same component, sequential)
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3 — MVP (includes the shared dialog fix for both add and re-setup flows)
- **User Story 2 (P1)**: Builds on US1's re-setup component (explanation prop)
- **User Story 3 (P2)**: Builds on US2 (same file; completion handler extension)

### Within Each User Story

- Endpoint and dialog before integration (US1); dialog before add-form refactor; component before table wiring
- Component before explanation (US2); explanation before auto-update (US3)
- No tests in this feature (see header note)

### Parallel Opportunities

- T003 and T004 are different files — can run in parallel
- T005 and T006 both depend on T004 — can run in parallel after Foundation (different files; T006 also needs T003)
- T007 depends on T006; T008/T009 are sequential in the same file
- T010–T013 all independent — run in parallel

---

## Parallel Example: User Story 1 after Foundation

```bash
# Launch the add-form refactor and the new trigger component together:
Task: "Refactor add-domain-form.tsx to use AuthorizationDialog"
Task: "Create reauthorize-domain-button.tsx"
# Then wire the trigger into the table:
Task: "Replace the hint in domain-table.tsx with ReauthorizeDomainButton"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline)
2. Complete Phase 2: Foundational (POST setup route + AuthorizationDialog with the fix)
3. Complete Phase 3: User Story 1 (add-form refactor → trigger component → table wiring)
4. **STOP and VALIDATE**: quickstart scenarios 1–3, 5 (bug fix on add flow, trigger appears, end-to-end re-setup, contract checks)
5. Deploy/demo if ready — the core request ("que salga una acción para reconfigurar el dominio") is delivered

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP (actionable re-setup) ✓ core value
3. US2 → validate (explanation copy)
4. US3 → validate (auto-update after re-setup)
5. Polish → gates + README

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (T005 add-form refactor)
   - Developer B: US1 (T006 trigger component + T007 table wiring)
   - Then Developer A/B: US2 + US3 sequentially (same component)
3. Stories integrate cleanly (shared component is the only coordination point)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts (T006 → T008 → T009 are sequential in `reauthorize-domain-button.tsx`; T004 must exist before T005/T006), cross-story dependencies that break independence
- Verification gates (Constitution V): `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .` must all pass before completion
