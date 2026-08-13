# Research: Fix "is not managed" Error — Phase 0

**Feature**: 007-fix-add-setup-guard
**Date**: 2026-08-13
**Status**: Consolidated (Phase 0 of /speckit.plan)

No open unknowns remain from the spec. All decisions grounded in the code
(Constitution II); no libraries involved, so no context7 lookups apply
(Constitution III).

## R1 — Where exactly does the error come from?

**Decision**: `webui/src/app/api/domains/[domain]/setup/route.ts` — POST
handler, the `if (!isManaged(parsed.data.domain))` guard that throws
`NOT_FOUND "<domain> is not managed."` (lines 46-49).

**Rationale**: git blame shows the guard was added by commit `dabe2d2`
("feat: actionable domain re-setup", feature 005) together with the POST
handler itself. Before 005 there was no POST on this route (the add flow
submitted the code through `POST /api/domains`). Feature 005 moved code
submission onto this endpoint and added the guard for its own re-setup
entry point — breaking the add flow, whose session is created before the
domain exists in the config.

**Alternatives considered**: none (the string is unique in the repo and
traces to this exact line; `submitAccessCode`'s own "No setup session …"
errors are a different, truthful message).

## R2 — What distinguishes the two legitimate flows at request time?

**Decision**: the in-memory setup session map (`getSession(domain)`,
`webui/src/lib/setup-session.ts`). The add flow creates its session via
`POST /api/domains` before the dialog opens; the re-authorization flow
creates its session via this endpoint's own `startSetupSession` branch.
Both leave a session present while the flow is in progress. Therefore:
session present → the request belongs to a real flow → no config check;
session absent → only a managed domain may start a new session (005's
guard, unchanged).

**Rationale**: the session map is the single source of truth for "a flow
is in progress" (Assumptions in spec); using it cannot weaken 005 because
005's entry point (no session + managed → start) is untouched, and the
no-session + not-managed case keeps its 404.

**Alternatives considered**:
- Drop the guard entirely — rejected: loses the 404 for arbitrary
  unmanaged domains on the re-setup entry point (FR-002).
- Move the guard after `submitAccessCode`/`startSetupSession` — rejected:
  session checks already run there; ordering alone doesn't fix the add
  flow, which needs the config check *skipped*, not reordered.
- Check `isManaged` only when no code is provided — rejected: the
  re-setup flow submits the code on the same endpoint; a session-less
  code submission for an unmanaged domain would pass. Session-awareness
  is strictly more precise.

## R3 — Edge-case behavior of the session-aware guard

**Decision**: session lookup happens FIRST, and the domain guard runs only
when the lookup is empty. Session states then govern as today:
- Session `awaiting_authorization` → `submitAccessCode` proceeds (add flow
  mid-authorization, domain not yet managed).
- Session `failed`/`completed` (stale, timeout, already finished) →
  session exists, so the guard passes and `submitAccessCode`/
  `startSetupSession` surface their own precise errors (CONFLICT /
  NOT_FOUND "No setup session … Start the setup again.") — never "is not
  managed" (FR-004).
- No session + managed → `startSetupSession` (re-setup, 005 behavior).
- No session + not managed → 404 "is not managed" (005 protection).

**Rationale**: read the route's current code: `submitAccessCode` already
throws NOT_FOUND when no session exists and CONFLICT when the session is
not awaiting a code; `startSetupSession` throws CONFLICT for a session in
progress. The guard's only remaining job is the no-session case.

**Alternatives considered**: none — this preserves every existing error
message and only narrows the guard's scope.
