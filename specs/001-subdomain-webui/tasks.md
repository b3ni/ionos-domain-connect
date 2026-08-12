---

description: "Task list for the Web UI for Subdomain Management feature — web-gating delta"
---

# Tasks: Web UI for Subdomain Management (delta: web gating)

**Input**: Design documents from `/specs/001-subdomain-webui/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md

**Tests**: No test tasks are included — the spec does not request a test
framework and the constitution (Principle V) forbids inventing one;
verification is the Docker build gate plus the quickstart.md smoke checks.

**Organization**: The web-mode feature (US1–US4) is already implemented and
container-verified. These tasks cover the clarification delta (spec
Clarifications session 2026-08-12; FR-001 gated, FR-012 headless mode,
FR-013 documented variable) and the regression gate for web mode.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Headless updater: `src/updater.py` (repository root)
- Entrypoint: `docker-entrypoint.sh` (repository root)
- Web app: `webui/` (unchanged in this delta)

---

## Phase 1: Foundational (Mode Infrastructure)

**Purpose**: The opt-in mode switch and the headless updater. Blocks every
mode-related verification.

**⚠️ CRITICAL**: No mode verification can begin until this phase is complete

- [X] T001 Create `src/updater.py` (headless updater): APScheduler
  `BlockingScheduler` running `domain-connect-dyndns --config /config.json
  update --all` every `INTERVAL_UPDATE` seconds (env var, default 60), with
  a SIGTERM handler that stops the scheduler and exits 0 (research.md
  decision 4 — protects config.json writes)
- [X] T002 [P] Create `docker-entrypoint.sh` at repository root: if
  `ENABLE_WEBUI` equals `true` → `exec node server.js` (web mode, in-process
  scheduler); otherwise → `exec python3 /src/updater.py` (headless mode)
- [X] T003 Update `Dockerfile`: `RUN chmod +x` the entrypoint, add
  `COPY docker-entrypoint.sh ./`, `COPY src/ /src/`, add `apscheduler` to
  the `pip install` line, and set `CMD ["./docker-entrypoint.sh"]`

**Checkpoint**: `docker build -t ionos-domain-connect .` succeeds with the
new entrypoint.

---

## Phase 2: Web Mode — Regression Gate (Priority: P1)

**Goal**: With `ENABLE_WEBUI=true`, the existing web feature keeps working
exactly as before (US1–US4).

**Independent Test**: Run with `ENABLE_WEBUI=true` and execute the
quickstart.md web-mode smoke checks.

- [X] T004 [US1] Verify web mode serves the UI: run container with
  `ENABLE_WEBUI=true`, open `http://localhost:3000` — "Managed domains"
  renders, `GET /api/domains` returns the domain list (quickstart.md US1)
- [X] T005 [US2] Verify add-domain flow in web mode: POST /api/domains
  starts a setup session and the session endpoint responds (quickstart.md US2)
- [X] T006 [US3] Verify remove flow in web mode: DELETE /api/domains/{d}
  removes the domain and writes a backup under /backups/ (quickstart.md US3)
- [X] T007 [US4] Verify manual update in web mode: POST /api/update returns
  per-domain results (quickstart.md US4)

**Checkpoint**: Web mode fully functional — no regressions from the entrypoint change.

---

## Phase 3: Headless Mode (Priority: P1)

**Goal**: Without `ENABLE_WEBUI`, the container runs updates headless: no
web server, no port bound (spec FR-012).

**Independent Test**: Run without the variable and execute the
quickstart.md headless checks.

- [X] T008 Run container WITHOUT `ENABLE_WEBUI`: verify port 3000 is NOT
  listening (curl fails / connection refused) and logs show the updater
  started (FR-012; quickstart.md headless)
- [X] T009 Verify scheduled updates run headless: with `INTERVAL_UPDATE=5`,
  wait ~15 s and check `/config.json` gains fresh `last_attempt`/
  `last_success` timestamps (FR-010, FR-012)
- [X] T010 Verify graceful shutdown: `docker stop` the headless container —
  exits 0 within the stop timeout and `/config.json` stays valid JSON
  (research.md decision 4)

**Checkpoint**: Headless mode proven — the container preserves the original
image's update-only behavior.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final gate (FR-013).

- [X] T011 [P] Update `README.md`: document `ENABLE_WEBUI` in the compose
  snippet and add a "Web on/off" note stating the headless default and that
  no port is bound when disabled (FR-013)
- [X] T012 Final gate: `docker build -t ionos-domain-connect .` + full
  quickstart.md run in both modes; confirm `.github/workflows/
  docker-image.yml` remains untouched

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately
- **Web Mode Regression (Phase 2)**: Depends on Phase 1 (entrypoint
  change) — re-validates the implemented US1–US4
- **Headless Mode (Phase 3)**: Depends on Phase 1
- **Polish (Phase 4)**: Depends on Phases 2 and 3

### User Story Dependencies

- US1–US4 (web mode): already implemented; only regression-verified here
- Headless mode: new capability; independent of web-mode stories

### Parallel Opportunities

- T001 and T002 are file-independent ([P])
- Phase 2 and Phase 3 verifications can run in parallel after Phase 1
- T011 is file-independent ([P])

---

## Parallel Example: Phase 1

```bash
# Launch Phase 1 tasks together:
Task: "Create src/updater.py (headless updater)"
Task: "Create docker-entrypoint.sh"
# then: update Dockerfile (depends on both)
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 (mode infrastructure) — image builds with the switch
2. Verify Phase 3 (headless) — the original image behavior, now opt-out
3. Verify Phase 2 (web mode regression)
4. Polish: documentation + final gate

### Incremental Delivery

1. Phase 1 → build gate passes
2. Phase 3 → headless mode proven
3. Phase 2 → web mode proven unregressed
4. Phase 4 → docs + final gate

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verification gate: `docker build -t ionos-domain-connect .` (constitution
  Principle V) — run after each phase
- Commit after each task or logical group
- Stop at any checkpoint to validate independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that
  break independence
