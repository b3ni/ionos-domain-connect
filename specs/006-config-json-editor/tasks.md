---

description: "Task list for the Config JSON Viewer/Editor feature"
---

# Tasks: Config JSON Viewer/Editor

**Input**: Design documents from `/specs/006-config-json-editor/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/ (api.md)

**Tests**: The feature spec does not request automated tests; the project has no test framework. Verification is manual via quickstart.md scenarios plus the project's real gates (`npm run lint` in `webui/`, `docker build -t ionos-domain-connect .` at repo root). Per Constitution Principle V, no test framework may be invented.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js app under `webui/` (App Router): `webui/src/app/`, `webui/src/components/`, `webui/src/lib/`
- Shared file warnings (avoid parallel edits to the same file):
  - `webui/src/app/api/config/route.ts` — GET (US1) then PUT (US2), sequential
  - `webui/src/components/config-editor.tsx` — all UI tasks, strictly sequential
  - `webui/src/lib/config-store.ts` — T002 (foundational) then T008 (US2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the single new runtime dependency (research.md R1)

- [X] T001 Install `@textea/json-viewer` in `webui/` (`npm install @textea/json-viewer` inside `webui/`; verify it lands in `webui/package.json` dependencies)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Server-side config helpers that ALL user stories consume (GET route, PUT route, and repair mode all read raw/parsed config)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Extend `webui/src/lib/config-store.ts` with: (a) `readConfigRaw(): { exists: boolean; raw: string | null }` — `readFileSync` without parsing, `exists` false on ENOENT; (b) `parseConfig(raw: string): { parsed: unknown; error: string | null }` — `JSON.parse` returning a human-readable error message on failure; (c) `validateConfigShape(parsed: unknown): boolean` — plain object, not array/null/primitive, keys non-empty strings. Do NOT modify the existing `readConfig`/`writeConfig` behavior (contract: indent-1 CLI formatting). Reuse `appError` from `webui/src/lib/errors.ts` where I/O fails (per data-model.md §1, FR-005)

**Checkpoint**: Foundation ready - `readConfigRaw`/`parseConfig`/`validateConfigShape` exist and are importable; user story implementation can now begin

---

## Phase 3: User Story 1 - View the Domain Configuration File (Priority: P1) 🎯 MVP

**Goal**: A "Configuración" section on the main page renders the config file as an expandable, masked JSON tree (spec US1)

**Independent Test**: Open the page, click **Configuración**; verify all domains render as expandable JSON, `access_token`/`refresh_token` show `••••••`, the eye button reveals only that one value, and reopening the section re-masks everything (quickstart Scenario 1)

### Implementation for User Story 1

- [X] T003 [P] [US1] Implement the GET handler in `webui/src/app/api/config/route.ts`: `export const dynamic = "force-dynamic"`, return the `ConfigFileView` shape per contracts/api.md (path, exists, raw, parsed, parseError) using `readConfigRaw` + `parseConfig` + `validateConfigShape` from T002. Unreadable/missing content is a 200 *state*, never an error; I/O failures throw `appError` and go through `errorResponse` (pattern from `webui/src/app/api/domains/route.ts`)
- [X] T004 [P] [US1] Create `webui/src/components/config-editor.tsx` ("use client"): Card section with header "Configuración" + description + refresh button; content lazy-mounted on first click via `next/dynamic(() => import("@textea/json-viewer"), { ssr: false })` (keeps the initial bundle lean, research.md R1); on open, `fetch("/api/config", { cache: "no-store" })` and render a loading state (Loader2 spinner per existing components)
- [X] T005 [US1] Implement token masking inside `webui/src/components/config-editor.tsx`: on load, collect the string values of `access_token`/`refresh_token` keys from `parsed` into a `Set`; define a custom data type via `defineDataType` whose `is()` checks membership in that Set and whose `Renderer` shows `••••••` plus a lucide Eye/EyeOff toggle revealing only that value locally (presentation-only — the underlying data never changes, research.md R6); map `theme` prop from next-themes `resolvedTheme` ("light"/"dark")
- [X] T006 [US1] Mount the section: add `<ConfigEditor />` below `<DomainList />` in `webui/src/app/page.tsx` (server component wrapping the client section, matching the existing `DomainList` usage)
- [X] T007 [US1] Handle the missing-file state in `webui/src/components/config-editor.tsx`: when `exists: false`, show a Card explanation ("config file does not exist; created during domain setup") with no editor (spec US1 scenario 4; creation out of scope per Assumptions)

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently (view + masking + missing state; no editing yet)

---

## Phase 4: User Story 2 - Edit and Save Changes (Priority: P1)

**Goal**: Edit values/fields/entries in the tree and save with server-side validation, backup, conflict detection, and atomic writes (spec US2)

**Independent Test**: Edit `ip.IPv4`, click Save; verify the file on disk contains the change with indent-1 formatting, a `config.<ts>.json` backup appears in `BACKUP_DIR`, an invalid-JSON save is rejected with 400 and the file checksum is unchanged, and a disk-side change made mid-edit produces a 409 (quickstart Scenarios 2-5)

### Implementation for User Story 2

- [X] T008 [P] [US2] Add `saveConfig(raw: string, baseRaw: string | null): { backupPath: string | null }` to `webui/src/lib/config-store.ts` (contracts/api.md processing order): (1) `parseConfig`+`validateConfigShape` → throw `appError("VALIDATION", …)`; (2) read current disk content, if it differs from `baseRaw` (and `baseRaw` not null) → throw `appError("CONFLICT", …)`; (3) if the file exists, copy it to `BACKUP_DIR/config.<unix-ts>.json` with `mkdirSync(..., { recursive: true })` (existing `BACKUP_DIR` constant, FR-007); (4) atomic write via temp file + `rename()` in the config directory; (5) re-serialize with `JSON.stringify(parsed, null, 1)` (CLI indent-1 contract, FR-006). Throws `appError("NOT_FOUND", …)` when the file does not exist (data-model.md §5 state transition)
- [X] T009 [US2] Implement the PUT handler in `webui/src/app/api/config/route.ts` (extends T003's route file, same conventions): parse the body with a zod schema (`raw: string`, `baseRaw: string | null`) per contracts/api.md; call `saveConfig`; return the `SaveResult` shape (path, savedAt, backupPath); let `saveConfig`'s `AppError`s flow through `errorResponse` (400/404/409/500 mapping per contracts/api.md)
- [X] T010 [US2] Enable tree editing in `webui/src/components/config-editor.tsx`: `editable` (all values), `enableAdd` and `enableDelete` for non-root nodes; on `onChange`/`onAdd`/`onDelete` update local state via `applyValue`/`deleteValue` (research.md R1); track dirty state (compare against the loaded parsed config); keep masking intact while editing (editing a masked field reveals it as the editor takes over)
- [X] T011 [US2] Add the Save action to `webui/src/components/config-editor.tsx`: serialize `JSON.stringify(state, null, 1)` as `raw`, send `baseRaw` captured at load, `PUT /api/config`; disable the button while saving (Loader2); sonner `toast.success` with the confirmation; on failure keep the user's edits in memory (spec US2 scenario 5) and `toast.error(body.error.message)` (pattern from `webui/src/components/remove-domain-button.tsx`); on success clear dirty and update the stored `baseRaw`
- [X] T012 [US2] Handle the 409 conflict in `webui/src/components/config-editor.tsx`: `toast.error` with the conflict message plus a "Reload" action that refetches GET and discards in-editor edits (spec US2 scenario 4, contracts/api.md client table)

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently (view + masked edit + guarded save)

---

## Phase 5: User Story 3 - Diagnose and Fix an Unreadable Configuration File (Priority: P2)

**Goal**: A corrupt config file (invalid JSON / wrong shape) is shown as raw text with a plain-language explanation and can be repaired and saved from the UI (spec US3)

**Independent Test**: `echo "{ broken json" > config.json`, open **Configuración**: raw content appears in a textarea with a "not valid JSON" message (not the generic read error); fix it to a valid domain map, save; the section switches to the tree and the main list + updater recover (quickstart Scenario 6)

**Story dependency**: US3 reuses the PUT flow from US2 (T009 + T011) — implement after Phase 4

### Implementation for User Story 3

- [X] T013 [US3] Render the repair mode in `webui/src/components/config-editor.tsx`: when GET returns `exists: true` and `parseError != null`, show the raw file content in a monospace `<Textarea>` (`webui/src/components/ui/textarea.tsx` — add it via `npx shadcn@latest add textarea` if absent) plus the plain-language explanation from `parseError`; an empty file shows an "empty file" explanation (spec US3 scenario 1, edge cases)
- [X] T014 [US3] Wire the repair save flow in `webui/src/components/config-editor.tsx`: Save sends the textarea content through the existing PUT flow; on success, refetch GET and switch the section to the tree view; if the saved content is still invalid, show the server's 400 message inline (spec US3 scenario 3: wrong-shape rejection)

**Checkpoint**: All user stories are now independently functional; a corrupt config is recoverable without shell access (SC-005)

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates, docs, and cross-story quality

- [X] T015 [P] Run all quickstart.md scenarios (1-7) against a dev build with a sample `config.json` (see quickstart.md setup); fix any behavior that deviates from the expected outcomes in the scenarios
- [X] T016 [P] Run the project's verification gates and fix all issues: `npm run lint` inside `webui/`; `docker build -t ionos-domain-connect .` at the repository root (Constitution Principle V — build MUST pass)
- [ ] T017 [P] Manual quality sweep per quickstart.md final gates: light/dark theme readability of the tree (ThemeToggle), keyboard navigation of the tree, narrow-viewport layout (no horizontal page overflow), Sonner toasts visible above the section
- [X] T018 [P] Update documentation: add `api/config` (GET/PUT) to the API routes list in `AGENTS.md` (line ~26) and document the "Configuración" section in `README.md` / `webui/README.md` (Web UI feature description)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories (every story consumes T002's helpers)
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - **US1 → US2**: sequential — the PUT handler (T009) extends the same `route.ts` file as the GET handler (T003); the UI edit tasks share `config-editor.tsx` with US1 tasks
  - **US2 → US3**: sequential — US3 reuses the PUT flow (T009/T011)
- **Polish (Final Phase)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 (same `route.ts` and `config-editor.tsx` files) - independently testable once US1 is done
- **User Story 3 (P2)**: Depends on US2 (reuses the PUT flow) - independently testable once US2 is done

### Within Each User Story

- Server lib/endpoints before UI (the UI consumes the contract from contracts/api.md)
- Core implementation before integration (mount in page.tsx last)
- Story complete before moving to next priority

### Parallel Opportunities

- T001 (Setup) can run alone
- T003 and T004 (US1) are parallel: `route.ts` vs `config-editor.tsx`, no imports between them (contract is fixed in contracts/api.md)
- T008 (US2, lib) is parallel-safe against ALL US1 tasks (different file, no dependencies) — a second implementer can start it during US1
- T015–T018 (Polish) can all run in parallel
- Everything inside `webui/src/components/config-editor.tsx` (T004→T005→T007→T010→T011→T012→T013→T014) is strictly sequential — same file, never split
- `webui/src/lib/config-store.ts` is touched by T002 then T008 — sequential

---

## Parallel Example: User Story 1

```bash
# Launch the two independent files for US1 together:
Task: "T003 Implement the GET handler in webui/src/app/api/config/route.ts"
Task: "T004 Create webui/src/components/config-editor.tsx (scaffold + lazy-load)"

# Then, sequentially inside config-editor.tsx:
Task: "T005 Implement token masking"
Task: "T007 Handle the missing-file state"
```

## Parallel Example: US2 lib head-start (while US1 is still in flight)

```bash
Task: "T008 Add saveConfig to webui/src/lib/config-store.ts"
# T008 does not touch route.ts or config-editor.tsx — safe during US1
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002 — CRITICAL, blocks all stories)
3. Complete Phase 3: User Story 1 (T003–T007)
4. **STOP and VALIDATE**: quickstart Scenario 1 — view + masking + missing state
5. Deploy/demo if ready (the user can already inspect the config safely)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (view + masking) → Test independently → Demo (MVP!)
3. Add User Story 2 (edit + guarded save) → Test independently (Scenarios 2-5)
4. Add User Story 3 (repair mode) → Test independently (Scenario 6)
5. Each story adds value without breaking previous stories; T015–T018 close the gates and docs

### Parallel Team Strategy

With two developers:

1. Developer A: Phase 1 + 2, then US1 (T003–T007)
2. Developer B: T008 (saveConfig lib) in parallel during US1, then joins US2 after T009 is unblocked
3. US3 follows US2 sequentially (single shared component file)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable via quickstart.md scenarios
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Avoid: vague tasks, same-file parallel edits, cross-story dependencies that break independence
- No automated tests exist in this project; verification is quickstart scenarios + `npm run lint` + `docker build` (Constitution V — do not invent a test framework)
