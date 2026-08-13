# Feature Specification: Fix "is not managed" Error When Adding a Domain

**Feature Branch**: `007-fix-add-setup-guard`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "cuando intento dar de alta un dominio, pongo el access code, me da un error: <subdominio> is not managed. ¿por qué ocurre esto? ¿cómo se soluciona?"

## Background (why this happens)

The add-domain flow and the re-authorization flow share one API entry
point: `POST /api/domains/[domain]/setup`. In the add flow the domain is
NOT yet in the config file while the authorization is in progress — the
CLI only writes the domain into the config once the setup completes. But
that endpoint currently refuses to accept the access code unless the
domain is already in the config ("is not managed"). The check was added
for the re-authorization flow (where the domain must already exist) and
incorrectly blocks the add flow, which is in the middle of creating the
domain. Result: entering the access code for a new domain always fails
with "<subdominio> is not managed." even though the setup is otherwise
fine.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a New Domain End-to-End Again (Priority: P1)

A user adds a new subdomain: opens the dialog, approves it in the
provider's portal, enters the access code and clicks "Finish setup" — and
the setup completes as it did before the regression. No "is not managed"
error appears, the domain appears in the managed list, and the updater
picks it up.

**Why this priority**: This is the primary broken flow — the whole point
of the interface is adding subdomains, and today it fails at the last
step for every new domain.

**Independent Test**: Add a brand-new subdomain from the UI, complete the
provider authorization, paste the access code, and verify: no "is not
managed" error; the dialog closes with a success message; the domain shows
up in the list; a manual update for it succeeds.

**Acceptance Scenarios**:

1. **Given** a new subdomain whose authorization is in progress, **When**
   the user submits its access code, **Then** the code reaches the
   provider authorization (no "is not managed" error).
2. **Given** a successful authorization, **When** the setup completes,
   **Then** the dialog auto-closes with a success message and the domain
   appears in the managed list (existing behavior, must keep working).
3. **Given** the completed setup, **When** the user updates that domain,
   **Then** the update runs without the "not managed" failure.

---

### User Story 2 - Keep Re-Authorization Protection for Existing Domains (Priority: P1)

The fix must not open a hole in the re-authorization flow: starting a
re-authorization is still only possible for domains that already exist in
the config. A stray request for a domain that is neither mid-setup nor
managed is still rejected with a clear message.

**Why this priority**: The guard was added intentionally for feature 005
(expired provider sessions); removing it entirely would let anyone start
re-authorization sessions for arbitrary domains. The fix must be surgical.

**Independent Test**: (a) From a row showing the re-authorize entry point,
complete a re-authorization successfully; (b) call the setup endpoint for
a domain that has no session and is not managed — it must still be
rejected with "is not managed".

**Acceptance Scenarios**:

1. **Given** a managed domain with a stale provider session, **When** the
   user re-authorizes it (entry point → dialog → code), **Then** the
   re-authorization completes as before the fix.
2. **Given** a domain with no active setup session that is not in the
   config, **When** someone calls the setup endpoint for it, **Then** it
   is rejected with the "is not managed" message (protection preserved).
3. **Given** an active add-flow session for a domain, **When** the user
   submits the access code, **Then** the request is accepted regardless of
   whether the domain is in the config yet.

---

### Edge Cases

- The setup session expired (15-minute timeout) before the user submitted
  the code — the existing session errors must still surface clearly
  ("start the setup again"), not as "is not managed".
- The access code is submitted twice for the same session — the second
  submission is rejected by the session state, not by the domain guard.
- A re-authorization is started for a domain while its add flow is still
  in progress (same domain) — session conflicts must behave as today.
- The config file is temporarily unreadable (corrupt/missing) while the
  guard would normally consult it — the guard must degrade to a sensible
  answer (the active session still wins) instead of a misleading error.
- Two users adding different domains at the same time — neither flow
  affects the other.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Submitting the access code during the add-domain flow MUST
  succeed even though the domain is not yet in the config file.
- **FR-002**: The re-authorization flow MUST still require the domain to
  exist in the config before starting a NEW session (protection from
  feature 005 is preserved).
- **FR-003**: The distinction between "mid-setup session exists" and "no
  session" MUST be the deciding factor: an active session for the domain
  bypasses the config check; without a session, the config check applies.
- **FR-004**: Error messages MUST remain specific and truthful: session
  problems (expired, not awaiting a code, duplicate submission) keep their
  own messages and are never reported as "is not managed".
- **FR-005**: The completed setup keeps its existing behavior: success
  message, auto-close, domain listed, per-domain update runs.

### Key Entities *(include if feature involves data)*

- **Setup Session**: the in-progress authorization state for one domain
  (created by the add flow or the re-authorization flow; lives in memory,
  expires after 15 minutes). Its presence is the signal that the request
  belongs to a legitimate flow.
- **Domain Config Entry**: the domain's record in the config file — absent
  during the add flow's authorization phase (the CLI writes it on
  completion), present for re-authorization.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new-domain authorizations that reach the access-code
  step complete without the "is not managed" error.
- **SC-002**: 0% of re-authorization requests for non-managed domains
  without an active session get through (protection unchanged).
- **SC-003**: The add flow completes with no additional clicks or steps
  compared to the pre-regression behavior.
- **SC-004**: No existing session-related error message is replaced or
  masked by the fix.

## Assumptions

- The regression originates in the shared setup endpoint's config check
  introduced with the re-authorization feature; the fix is confined to
  that decision logic (session-aware) and does not change the CLI setup
  behavior.
- The session map is the single source of truth for "a flow is in
  progress" — it exists for both the add flow and the re-authorization
  flow, so using it to relax the guard cannot bypass the re-authorization
  protection.
- The "is not managed" message itself stays as-is for the still-protected
  case (no session + not managed), keeping feature 005's contract.
- No changes to the CLI, the config format, or the dialog UI are needed.
