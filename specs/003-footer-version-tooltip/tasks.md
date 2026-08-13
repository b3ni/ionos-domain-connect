---

description: "Task list for Footer App Version and Tooltip Sync Errors"
---

# Tasks: Footer App Version and Tooltip Sync Errors

**Input**: Design documents from `/specs/003-footer-version-tooltip/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/deployment.md

**Tests**: No test tasks — the feature spec does not request tests and this project has no test framework; verification gates are `npm run lint`, `npm run build` (in `webui/`) and `docker build -t ionos-domain-connect .` (root), plus manual validation from quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- Web UI: `webui/src/components/`, `webui/src/app/`
- Infrastructure: `Dockerfile`, `.github/workflows/docker-image.yml`
- Headless updater: `src/updater.py` (UNCHANGED in this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean starting state and the mandated skills — no project init is needed (existing codebase)

- [X] T001 Run `npm run lint` and `npm run build` in `webui/` to confirm a clean baseline before any changes
- [X] T002 Load the frontend skills mandated by the constitution (Principle IV) for all UI work in this feature: `shadcn` (component patterns), `nextjs-best-practices` (App Router), `web-design-guidelines` (UI/a11y review of `webui/src/components/footer.tsx` and `webui/src/components/domain-table.tsx` once written)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared tooltip infrastructure that BOTH the footer (layout) and the error tooltip depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add the shadcn `tooltip` component via the CLI in `webui/` (`npx shadcn@latest add tooltip`) — creates `webui/src/components/ui/tooltip.tsx`; verify it adds no new npm dependencies (`radix-ui@^1.6.7` already in `webui/package.json`) and that the generated file matches the project's radix base (`style: radix-nova`); fix icon imports if the registry item uses any
- [X] T004 Wrap the app with `TooltipProvider` in `webui/src/app/layout.tsx` (inside the existing `ThemeProvider`, around `{children}` and `<Toaster />`) — per shadcn docs, one provider at the app root (contracts/deployment.md §4); keep default `delayDuration`

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - See the Running App Version in the Footer (Priority: P1) 🎯 MVP

**Goal**: The page footer shows the application version — exactly the GitHub release tag that produced the running image — falling back to `dev` when no release version exists.

**Independent Test**: Run the web UI in dev (footer shows `Version dev`); `docker build --build-arg APP_VERSION=test-1` and run (footer shows `Version test-1`); after a real GitHub release, the published image's footer shows the release tag (quickstart scenarios 1–3).

### Implementation for User Story 1

- [X] T005 [US1] Create `webui/src/components/footer.tsx` — a Server Component that renders a muted, small, centered footer line `Version {version}` where `version = process.env.APP_VERSION?.trim() || "dev"`; per Next.js 16 docs (research.md §2) call `await connection()` from `next/server` before reading the env var to guarantee runtime evaluation (FR-003, FR-004; data-model.md "Application Version")
- [X] T006 [US1] Mount `<Footer />` in `webui/src/app/layout.tsx` after `{children}` inside the flex column body (main already has `flex-1`, so the footer sits at the bottom without layout changes and never overlaps content — FR-005); task runs after T004 (same file, sequential)
- [X] T007 [P] [US1] Edit `Dockerfile` runner stage: add `ARG APP_VERSION=dev` and `ENV APP_VERSION=$APP_VERSION` right after the existing `ENV` block (research.md §5, contracts/deployment.md §1); builder stage stays version-agnostic
- [X] T008 [P] [US1] Edit `.github/workflows/docker-image.yml` — add `build-args: |` with `APP_VERSION=${{ github.event.release.tag_name }}` to the existing `docker/build-push-action@v6` step (contracts/deployment.md §2); nothing else in the workflow changes

**Checkpoint**: User Story 1 fully functional and testable independently (quickstart scenarios 1–3)

---

## Phase 4: User Story 2 - Read a Domain's Full Sync Error via Tooltip (Priority: P1)

**Goal**: The truncated error line under a failed domain opens an accessible shadcn Tooltip with the full error text on hover AND keyboard focus; healthy rows show no tooltip.

**Independent Test**: Hover the error line of a failed domain (full text in tooltip, no native `title` in the DOM); Tab to the error line (tooltip opens on focus); check a successful domain (no trigger); long/multi-line errors keep the layout intact (quickstart scenarios 4–7).

### Implementation for User Story 2

- [X] T009 [US2] In `webui/src/components/domain-table.tsx`, replace the native `title` attribute on the error line (currently at lines 60–67) with the shadcn `Tooltip` composition: `<Tooltip><TooltipTrigger asChild><button type="button">…truncated text…</button></TooltipTrigger><TooltipContent>…full lastError…</TooltipContent></Tooltip>` — the trigger button must be reset-styled to look identical to the current muted truncated text (inherit font/size/color, `text-left`, `p-0`, transparent background, `cursor-pointer`; keep the `mt-0.5 max-w-72 truncate` wrapper on the button itself); `TooltipContent` gets a `max-w` and word-wrap (`break-words`) so long/multi-line errors stay fully readable without breaking the row layout (FR-006, FR-008; contracts/deployment.md §4)
- [X] T010 [US2] Keep the render condition exact: the tooltip trigger renders only when `lastResult === "error" && lastError` is non-null; rows with `ok`/`pending`/`null` render nothing (FR-007, SC-004); verify after a list refresh (`refresh()` re-fetch) no stale tooltip remains open for removed/updated domains (FR-010)
- [X] T011 [US2] Run the `web-design-guidelines` review on `webui/src/components/domain-table.tsx` and `webui/src/components/footer.tsx`: confirm the tooltip is keyboard-reachable (FR-009), trigger has a visible focus state, content contrast is sufficient, and no `title` attributes remain on the error line

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates and documentation

- [X] T012 [P] Run `npm run lint` in `webui/` and fix any issues
- [X] T013 [P] Run `npm run build` in `webui/` (must pass; `webui/AGENTS.md` block: read `node_modules/next/dist/docs/` if build errors reference breaking changes)
- [X] T014 [P] Run `docker build -t ionos-domain-connect .` at repo root (Constitution V gate), then re-run with `--build-arg APP_VERSION=test-1` and verify `docker run` shows `Version test-1` in the footer (quickstart scenario 2)
- [X] T015 [P] Update README: document that the footer shows the version from the GitHub release tag that published the image (version is created only by creating a release; local/dev builds show `dev`; optional `APP_VERSION` build arg) and that sync errors are read via tooltip in the domain list

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS both user stories
- **US1 (Phase 3)**: Depends on Foundational (T006 edits `layout.tsx` after T004)
- **US2 (Phase 4)**: Depends on Foundational (T003 tooltip component)
- **Polish (Phase 5)**: Depends on both user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 — MVP
- **User Story 2 (P1)**: No dependency on US1 — fully independent (different files; only `layout.tsx` is shared with US1, and both edits are covered by the Foundational/US1 ordering above)

### Within Each User Story

- Footer component before layout mount; layout mount before build gates (US1)
- Tooltip composition before a11y review (US2)
- No tests in this feature (see header note)

### Parallel Opportunities

- T005/T007/T008 are different files — can run in parallel (T006 mounts after T004 in the same file)
- T009–T011 sequential in `domain-table.tsx` — no parallel split
- T012–T015 all independent — run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch the footer component and both infra edits together:
Task: "Create footer.tsx in webui/src/components/"
Task: "Add ARG/ENV APP_VERSION to Dockerfile"
Task: "Add APP_VERSION build-arg to .github/workflows/docker-image.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline)
2. Complete Phase 2: Foundational (tooltip component + provider)
3. Complete Phase 3: User Story 1 (footer + Dockerfile + workflow)
4. **STOP and VALIDATE**: quickstart scenarios 1–3 (dev fallback, build-arg version, release flow)
5. Deploy/demo if ready — the footer version is delivered

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → validate → MVP (footer version) ✓ core value
3. US2 → validate (tooltip scenarios 4–7)
4. Polish → gates + README

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (footer component; then Dockerfile/workflow edits)
   - Developer B: US2 (domain-table tooltip)
3. Stories complete and integrate independently (all edits are in separate modules; only `layout.tsx` is shared, handled by the Foundational → US1 ordering)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts (only `layout.tsx` is shared, sequenced via T004 → T006), cross-story dependencies that break independence
- Verification gates (Constitution V): `npm run lint`, `npm run build`, `docker build -t ionos-domain-connect .` must all pass before completion
