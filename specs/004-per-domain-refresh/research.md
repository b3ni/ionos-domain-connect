# Research: Per-Domain Refresh

**Feature**: 004-per-domain-refresh | **Date**: 2026-08-13

## 1. Single-domain update: CLI support and output format

**Decision**: Use the CLI's built-in single-domain mode
(`update --domain <name>`) instead of filtering `update --all` output.

**Rationale**: Verified in-container (`domain-connect-dyndns update --help`
shows `--domain DOMAIN` vs `--all`) and in the upstream source
(`domain_update.py`): `main(domain, ...)` runs the same per-domain block
(`Read <domain> config.` marker, same status strings, same config writes)
whether invoked via `--all` loop or `--domain`. Therefore the existing
`outcomeForDomain` / `failureReasonForDomain` marker-slicing logic works
unchanged for a single-domain run: with one domain the block is everything
after the `Read X config.` marker. If the CLI exits early without the
marker (e.g. `Domain X not configured.` on stdout), the whole stdout is
the block and the "not configured" outcome is detected as today.

**Alternatives considered**:

- `update --all` + ignore other domains: rejected — touches every domain's
  tokens/records; exactly what the user wants to avoid.
- Filtering domains client-side in `runUpdateAll`: rejected — same cost as
  `--all`, and the CLI re-checks all domains' DNS/IP state.

**Caveats**:

- A domain absent from the config is best detected in the web layer
  (`isManaged()`, `webui/src/lib/domains.ts`) BEFORE spawning the CLI, so
  `POST /api/domains/[domain]/update` returns a clear 404 instead of a
  generic failure (FR-008). The CLI's own "not configured" path remains as
  the fallback if the config changes between check and run.

## 2. Persist logic sharing between global and single-domain runs

**Decision**: Extract the per-domain persist loop from `runUpdateAll`
(`webui/src/lib/dyndns.ts:167-189`) into a shared helper
`persistOutcome(config, domain, outcome, stdout, stderr): boolean`
(writes/clears `last_error`, returns whether config changed), used by both
`runUpdateAll` and the new `runUpdateOne(domain)`.

**Rationale**: The reason extraction, redaction, fallback and clear-on-success
semantics (feature 002) must be byte-identical between global and per-domain
runs — a second copy would drift (Constitution I).

**Decision details**: `runUpdateOne(domain)` runs
`runCli(["update", "--domain", domain])`, reads config (empty on read
error), computes `outcomeForDomain(domain, stdout)`, applies
`persistOutcome`, writes config only if changed, and returns the same
`UpdateSummary` shape with a single entry: `{ domains: { [domain]:
outcome }, raw: stdout }`.

## 3. Concurrency: one shared lock

**Decision**: Add `runUpdateOneNow(domain)` to `webui/src/lib/scheduler.ts`
behind the SAME module-level `running` lock as `runUpdateNow()`, extracted
into a small shared `withLock(label, fn)` helper.

**Rationale**: Both CLI runs read-modify-write the same `config.json`
(verified: CLI writes with `json.load` → mutate → `json.dump`); running two
concurrently would lose one run's `last_*` writes and interleave token
exchanges. The spec's assumption (FR-004) is a clear rejection message, not
a queue — matches the existing `CONFLICT` behavior.

**Alternatives considered**: per-domain locks / queues — rejected: added
complexity with no user need (single user, manual clicks); the lock is held
for seconds, not minutes.

## 4. Endpoint design

**Decision**: New route file
`webui/src/app/api/domains/[domain]/update/route.ts` with `POST` handler:
validate `isManaged(domain)` → 404 (`appError("NOT_FOUND", ...)` via
`errorResponse`); call `runUpdateOneNow(domain)`; return
`{ started: true, results: { [domain]: outcome } }` (same shape as
`POST /api/update`). Lock conflict surfaces as the existing `409 CONFLICT`
AppError.

**Rationale**: Follows the existing `api/domains/[domain]` folder
convention (DELETE already lives there); a body-less `POST` to a
domain-scoped path is the most natural REST shape and needs no request
validation. Alternative: extending `POST /api/update` with a body —
rejected: would overload the global endpoint and require body parsing for
a per-resource action.

## 5. UI: per-row refresh button

**Decision**: New client component `RefreshDomainButton` (lucide
`RefreshCw`/`Loader2`), rendered in the row actions slot
(`domain-list.tsx` `actions(domain)`), next to the existing remove button.
Per-row `running` state disables the button and shows a spinner during the
request; on completion it toasts the per-domain outcome (success / failure
message) and calls `onFinished` to refresh the list.

**Rationale**: The `actions` render prop of `DomainTable` is the established
extension point for row-level actions (remove button uses it) — no table
API change needed. The global button's pattern (fetch → toast → refresh)
is copied 1:1 for consistency.

**Alternatives considered**: refresh icon inside the status cell — rejected
(breaks the actions-slot convention and the remove-button alignment);
automatic retry — rejected (spec: manual action only).

## 6. NOTFOUND_SESSION guidance (display-time hint)

**Decision**: In `domain-table.tsx`, when the row renders a failure reason
(`lastResult === "error"`), check the stored `lastError` for the known
signature — `"Failed to get async token"` or `"NOTFOUND_SESSION"` — and
render an additional muted hint line under the error text:
`Run setup again for this domain.` No storage, no new API.

**Rationale**: Diagnosis grounded in upstream source (`domainconnect.py`
`get_async_token` + `domain_update.py`): before each update the CLI
exchanges the stored OAuth session (`access_token`/`refresh_token`/`code`)
with the provider's `/v2/oauth/access_token` endpoint; the provider answers
`400 invalid_request` + `NOTFOUND_SESSION` when the session no longer
exists on its side (expired, or replaced by a re-setup from another
device/container). The stored reason text (feature 002) already carries
this exact message, so a display-time text match is robust and adds zero
state. Re-running setup for that domain (existing flow) restores the
session — the hint states exactly that (FR-009).

**Alternatives considered**: capture-time enrichment of `last_error`
(append hint into config) — rejected: mutates stored data and would
require re-migration of existing configs; classification at a new helper
`needsResync(lastError): boolean` used by the UI only.

**Caveats**: the CLI may also surface this error with different wording
after upstream bumps (AGENTS.md warns about this brittle coupling) — the
hint degrades gracefully: unknown wording simply shows no hint, nothing
breaks.

## 7. Verification gates

**Decision**: `npm run lint`, `npm run build` in `webui/`, `docker build -t
ionos-domain-connect .` at root (Constitution V); manual validation per
`quickstart.md` (per-domain isolation, lock conflict, NOTFOUND_SESSION
hint).

## 8. Library documentation consulted (context7) — Constitution III

Verified against current docs (context7 `/vercel/next.js`,
`/shadcn-ui/ui`) AND the installed code before finalizing the design:

### Next.js 16 — Route Handlers with dynamic segments

- **Decision**: `POST /api/domains/[domain]/update` follows the documented
  Next.js pattern: second handler arg is
  `{ params }: { params: Promise<{ domain: string }> }` and MUST `await
  params` (Next 15+ breaking change, confirmed in the v15 upgrade guide and
  route.mdx). The existing `api/domains/[domain]/route.ts` already does
  this — the new route mirrors it 1:1, including `domainParamSchema`
  validation (`webui/src/lib/validation.ts`) and the
  `appError`/`errorResponse` try/catch shape (documented pattern: catch →
  safe message, never leak internals).
- **Rationale**: matches the version installed (Next 16.3) and the repo's
  own route conventions; the validation/error plumbing is reused, not
  rewritten.

### shadcn/ui — Button composition

- **Decision**: the row refresh button uses `variant="ghost" size="icon"`
  (project button variants: `size-8` icon size) with `aria-label`
  (`Refresh {domain}`) — the exact composition `RemoveDomainButton`
  already uses. Loading state follows the documented shadcn pattern: NO
  loading prop on Button; compose `Loader2` + `animate-spin` (or `Spinner`)
  and `disabled` — as `UpdateNowButton`/`RemoveDomainButton` already do.
  Icons get no sizing classes (the button variant adds
  `[&_svg:not([class*='size-'])]:size-4`); existing repo buttons do not use
  `data-icon`, so the new button stays consistent with the repo.
- **Alternatives considered**: `size="icon-sm"` (smaller, used by tooltip
  examples) — rejected: the remove button next to it uses `size="icon"`;
  the two actions must align.

### sonner — toast feedback

- **Decision**: outcome feedback reuses the existing `toast.success` /
  `toast.error` calls and `UpdateResponse`-style body parsing from
  `update-now-button.tsx`; no new API surface.
