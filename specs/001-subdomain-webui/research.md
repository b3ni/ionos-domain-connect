# Research Notes — Web UI for Subdomain Management (delta: web gating)

**Date**: 2026-08-12
**Scope**: Phase 0 of the `/speckit.plan` re-plan after `/speckit.clarify`.
Resolves the unknowns introduced by FR-001 (opt-in activation), FR-012
(headless mode) and FR-013 (documented variable).

## 1. Where can a headless updater run from, given the scheduler lives inside the Next.js process?

**Decision**: Headless mode runs the original-style Python updater
(`src/updater.py`, APScheduler + `update --all` + `INTERVAL_UPDATE`), and
web mode keeps the existing in-process Node scheduler. A tiny `sh`
entrypoint (`docker-entrypoint.sh`) selects the mode on `ENABLE_WEBUI` and
`exec`s the chosen process.

**Rationale**: The requirement "web disabled ⇒ no web server, no port bound"
(FN-012) means the Next.js process must not start at all in headless mode —
so its in-process scheduler cannot serve that mode. The image already ships
Python + the CLI; the original `src/main.py` (in this repo's git history)
was exactly this updater and is proven. Bundling a second Node entrypoint
for headless mode would fight Next's standalone tracing. Mode exclusivity
guarantees exactly one scheduler is ever alive, so the two implementations
never race or double-update.

**Alternatives considered**:
- One Node entrypoint serving both modes (web on/off flag) — rejected:
  the Next server would still listen on the port in "disabled" mode,
  violating FR-012, and stopping it would kill the scheduler it hosts.
- Python updater as a sidecar in BOTH modes (single scheduler
  implementation) — rejected: web mode would need a second process with
  PID-1 supervision, and the manual-update API would need cross-process
  locking with the Python loop to avoid concurrent `update --all` runs.

## 2. Activation semantics and variable shape

**Decision**: `ENABLE_WEBUI=true` enables web mode; any other value or an
absent variable ⇒ headless. Comparison is exact (`"true"`), case-sensitive,
matching common Docker conventions.

**Rationale**: Opt-in per the clarified spec; the web has no authentication
(FR-011), so the safe default is off. Exact `true` comparison avoids the
"false-y string is truthy" footgun.

**Alternatives considered**: `1`/`0` (rejected: less readable), any
non-empty value (rejected: surprising semantics), opt-out `DISABLE_WEBUI`
(rejected by user in clarification).

## 3. Container process management (CMD vs supervisor)

**Decision**: `CMD ["./docker-entrypoint.sh"]`; the script ends with
`exec node server.js` or `exec python3 /src/updater.py`.

**Rationale**: `exec` makes the app PID 1, so `docker stop` delivers
SIGTERM directly to the right process. No supervisor (tini/s6) needed for
two mutually exclusive single-process modes.

**Alternatives considered**: `sh -c "if ..."` inline CMD (works, but the
script is easier to read and test), tini (rejected: added dependency with
no benefit for single-process modes).

## 4. Graceful shutdown of the headless updater

**Decision**: `src/updater.py` registers a SIGTERM handler that stops the
scheduler and exits 0.

**Rationale**: `domain-connect-dyndns update` rewrites `/config.json` as a
plain file write; killing the process mid-write could corrupt the file
(which holds credentials). A 5-line handler makes `docker stop` clean.
The original `main.py` lacked this; it is a deliberate small hardening.

**Alternatives considered**: relying on default SIGTERM death (rejected:
config-corruption risk), write-locking in the CLI wrapper (rejected: we do
not control the CLI).

## 5. Documentation placement (FR-013)

**Decision**: `README.md` gets an `ENABLE_WEBUI` row in the compose snippet
plus a short "Web on/off" note stating the headless default and that no
port is bound in headless mode.

**Rationale**: FR-013 requires the variable and its values be documented
with deployment instructions; README is the deployment surface.

## Consolidated decisions

| Unknown | Decision |
|---------|----------|
| Headless updater | `src/updater.py` (APScheduler, original logic resurrected) |
| Web-mode scheduler | unchanged (in-process Node) — modes are exclusive |
| Activation | `ENABLE_WEBUI=true` opt-in; absent = headless (exact `true` compare) |
| Entrypoint | `docker-entrypoint.sh`, `exec` mode selection, PID 1 = app |
| Shutdown | SIGTERM handler in `src/updater.py` (config-write safety) |
| Docs | README compose snippet + web on/off note |
