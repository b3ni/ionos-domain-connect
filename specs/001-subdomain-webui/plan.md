# Implementation Plan: Web UI for Subdomain Management (delta: web gating)

**Branch**: `001-subdomain-webui` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-subdomain-webui/spec.md` —
re-plan after `/speckit.clarify` (session 2026-08-12): the web must activate
only when a configuration variable is enabled (opt-in), with scheduled
updates continuing headless when it is not.

**Status**: The core feature is implemented and container-verified (US1–US4,
scheduler, Docker build gate). This plan covers the web-gating delta
(FR-001 amendment, FR-012, FR-013) on top of that working implementation.

## Summary

Add an opt-in switch (`ENABLE_WEBUI=true`) that decides the container's
mode at startup:
- **Web mode** (variable enabled): Next.js standalone server (UI + API +
  in-process scheduler) — the current, verified implementation, unchanged.
- **Headless mode** (variable absent/false): no web server, no port bound;
  scheduled updates keep running via the original-style Python updater
  script (`src/updater.py`, APScheduler) — the exact shape of the original
  image.

The two modes are mutually exclusive; each runs exactly one scheduler.

## Technical Context

**Language/Version**: TypeScript 5 + Node.js 22 (web mode, unchanged);
Python 3 (headless mode: a ~20-line APScheduler updater script resurrected
from the original `src/main.py`).

**Primary Dependencies**: unchanged, plus `apscheduler` back on the
Dockerfile pip line (needed only by the headless updater).

**Storage**: unchanged — `/config.json` (CLI-owned, source of truth) only.
No new entities or files.

**Testing**: unchanged — verification gate is `docker build` plus the
mode-switch smoke checks in [quickstart.md](quickstart.md).

**Target Platform**: Linux container (multi-arch amd64/arm64); in headless
mode nothing listens on port 3000.

**Project Type**: Web application + headless daemon (mode-selected entrypoint).

**Performance Goals**: unchanged (US1 list < 5 s); headless mode adds no
runtime cost beyond the original updater.

**Constraints**: `ENABLE_WEBUI` opt-in semantics (absent/false = headless,
spec Clarifications session 2026-08-12); scheduled updates MUST keep running
in both modes (FR-010, FR-012); no port bound in headless mode (FR-012);
variable documented with deployment instructions (FR-013); container CMD
must exec so signals reach the app process.

**Scale/Scope**: 1 user, a handful of subdomains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Verdict |
|------|---------|
| I. Simplicity — no unjustified deps/abstractions | PASS (re-checked): the headless entrypoint reuses the proven original Python updater rather than bundling a second Node script; no new abstractions. |
| II. Code-Grounded Specs | PASS: delta grounded in the implemented code (`webui/src/instrumentation.ts`, `Dockerfile` CMD) and in the CLI source. |
| III. Library-Aware Plans | PASS: scheduler/CLI behavior verified against installed package source; no new libraries beyond `apscheduler` (previously used by this repo). |
| IV. Frontend Design Standards | PASS (unchanged, no new UI work in this delta). |
| V. Direct Verification | PASS: gate remains `docker build` + smoke checks; no test framework added. |
| Constraints — deps, secrets, publishing | PASS: `config.json` still never committed; publishing flow unchanged; pip deps stay declared in the Dockerfile. |

**Complexity Tracking** (one justified tradeoff):

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two scheduler implementations (Node in web mode, Python in headless mode) | Headless mode has no Node process by definition, so it needs its own updater; the Python one is the original, git-history-proven code | Unifying on one scheduler requires either a second process in web mode (PID-1 supervision complexity) or cross-process locking for the manual update API — more moving parts than two mode-exclusive ~20-line loops |

## Project Structure

### Documentation (this feature)

```text
specs/001-subdomain-webui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output (updated with mode-switch checks)
├── contracts/           # Phase 1 output (API unchanged; headless note)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root) — delta

```text
src/
└── updater.py              # NEW (headless mode): APScheduler, INTERVAL_UPDATE,
                            #   domain-connect-dyndns --config /config.json
                            #   update --all; SIGTERM handler for clean stop
                            #   (resurrects the original main.py logic)

docker-entrypoint.sh        # NEW: ENABLE_WEBUI=true → exec node server.js
                            #   (web mode, in-process scheduler); else →
                            #   exec python3 /src/updater.py (headless)

Dockerfile                  # UPDATED: CMD → ["./docker-entrypoint.sh"];
                            #   pip line += apscheduler; COPY src + entrypoint

webui/src/instrumentation.ts # UNCHANGED (web mode keeps its scheduler)
README.md                    # UPDATED: document ENABLE_WEBUI (FR-013)
```

**Structure Decision**: Mode selection lives in a tiny POSIX-sh entrypoint
script (no supervisor dependency); `exec` makes the app process PID 1 so
signals and docker stop behave. Web mode keeps the verified Node scheduler;
headless mode runs the original Python updater — mutually exclusive, exactly
one scheduler per mode.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

See the single justified tradeoff in the Constitution Check table above.
