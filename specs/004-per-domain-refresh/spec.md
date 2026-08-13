# Feature Specification: Per-Domain Refresh

**Feature Branch**: `004-per-domain-refresh`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "poder hacer un refesh individual por dominio, no un refresh global, luego por otro lado en muchos dominios tengo 'Failed to get async token: 400 invalid_request NOTFOUND_SESSION' por que"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refresh a Single Domain (Priority: P1)

The user wants to update just one managed domain (e.g. because its last
update failed or its IP changed) without triggering the update of all the
other domains. Each domain row in the list has its own update action that
runs the updater for that domain only; the global "Update now" button keeps
working for all domains at once.

**Why this priority**: This is the entire point of the feature — today the
only trigger updates every domain at once, which is slow and touches every
domain (and every failing domain's tokens) even when only one needs
attention.

**Independent Test**: With two or more managed domains, click the refresh
action of one domain and verify that only that domain runs an update: its
last-update time advances, the other domains' times and statuses stay
unchanged.

**Acceptance Scenarios**:

1. **Given** a list with at least two managed domains, **When** the user
   clicks the per-domain refresh action of one domain, **Then** the updater
   runs for that domain only and the list refreshes with that domain's new
   status.
2. **Given** the same list, **When** the per-domain refresh runs, **Then**
   the other domains' last update time and status are unchanged.
3. **Given** a domain whose last update failed, **When** the user refreshes
   it, **Then** the failure reason shown for it is updated according to the
   new attempt (replaced on failure, cleared on success).
4. **Given** the domain list, **When** the user clicks the per-domain
   refresh action, **Then** the action shows a loading state until the
   update finishes and is disabled against double-clicks.
5. **Given** an update already running (scheduled, global, or per-domain),
   **When** the user triggers another update, **Then** the second trigger is
   rejected with a clear "update already running" message and the running
   update is not disturbed.

---

### User Story 2 - Know What to Do About the Token Error (Priority: P2)

Many domains fail with the message "Failed to get async token: 400
invalid_request NOTFOUND_SESSION". The user understands why this happens and
what to do: the interface explains, for this known failure, that the
domain's stored authorization session is no longer valid on the provider
side and that re-running the domain setup restores it.

**Why this priority**: The raw error text is opaque; without guidance the
user cannot know that the fix is simply to re-authorize the domain (the
existing setup flow already does this). This removes recurring confusion
with zero new workflows.

**Independent Test**: Force the known error (e.g. use a domain whose stored
tokens/session the provider no longer recognizes) and verify the interface
shows the failure reason together with a hint that re-running the domain
setup fixes it.

**Acceptance Scenarios**:

1. **Given** a domain whose failure reason contains the known
   "NOTFOUND_SESSION" token error signature, **When** the user views the
   domain row, **Then** the row also shows a short guidance hint telling the
   user to re-run the setup for that domain.
2. **Given** the same domain, **When** the user follows the hint and
   re-runs setup, **Then** the next update succeeds and the guidance hint
   disappears with the failure reason.
3. **Given** a domain failing with an unrelated error, **When** the user
   views the row, **Then** no setup guidance is shown — only the failure
   reason as today.
4. **Given** the hint text, **When** it is displayed, **Then** it contains
   no credentials or other sensitive values.

---

### Edge Cases

- A per-domain refresh is triggered while a global update is running (or
  vice versa): the new trigger is rejected, the running one completes
  undisturbed.
- Two per-domain refreshes are triggered for different domains at the same
  time: only one runs; the other receives the "already running" message.
- The per-domain refresh target is not present in the configuration (e.g.
  removed concurrently): a clear error is shown, nothing else changes.
- The updater reports the domain as not configured: the row shows the
  failure as today, with the existing reason text.
- The failure reason (with or without the NOTFOUND_SESSION hint) is long:
  layout stays intact and the full text remains readable (existing tooltip
  behaviour).
- A per-domain refresh that fails must not modify other domains' stored
  state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every managed domain in the list MUST have its own update
  action in its row.
- **FR-002**: The per-domain update action MUST run the update for that
  domain only; no other domain's DNS records or stored state may change.
- **FR-003**: The existing global update action MUST keep working unchanged.
- **FR-004**: Per-domain and global updates MUST never run concurrently; a
  trigger issued while an update is running MUST be rejected with a clear
  message.
- **FR-005**: After a per-domain update finishes, the interface MUST refresh
  the list so the updated domain's status, last-update time, and failure
  reason reflect the new attempt.
- **FR-006**: The user MUST receive feedback about the outcome of a
  per-domain update (success or failure), including which domain it
  concerned.
- **FR-007**: The per-domain update action MUST show a loading state while
  running and MUST NOT accept repeated clicks during the run.
- **FR-008**: A per-domain update of a domain that is not in the
  configuration MUST fail with a clear error and change nothing else.
- **FR-009**: When a domain's failure reason matches the known
  "NOTFOUND_SESSION" token error, the interface MUST additionally show a
  short hint that re-running the domain's setup fixes it.
- **FR-010**: The hint MUST NOT appear for other failure reasons.
- **FR-011**: The hint MUST NOT contain credentials or other sensitive
  values, and MUST NOT break the row layout for long content.

### Key Entities *(include if feature involves data)*

- **Managed Domain**: Existing entity, unchanged (config.json entry with
  update state). Gains no new fields; the per-domain update writes the same
  state fields the global update writes today (last_success, last_attempt,
  last_error).
- **Update Outcome**: Existing notion (ok / error / unchanged / unknown),
  now produced per domain for a single-domain run.
- **Known Failure Signature**: The text pattern identifying the
  NOTFOUND_SESSION token failure (no storage; a display-time
  classification).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of managed domains in the list have a working per-domain
  update action.
- **SC-002**: 100% of per-domain updates change only the targeted domain:
  verified by observing other domains' last-update times and statuses
  before and after.
- **SC-003**: Zero concurrent update runs occur: every conflicting trigger
  is rejected with a clear message.
- **SC-004**: 100% of domains failing with the NOTFOUND_SESSION signature
  show the re-setup guidance hint.
- **SC-005**: No regression in the global update action (it still updates
  all domains and reports the outcome).
- **SC-006**: No hint or reason ever exposes credentials.

## Assumptions

- "Refresh individual por dominio" means a per-row update action (one per
  managed domain) next to the existing global "Update now" button; the
  global button remains.
- The per-domain update uses the updater's built-in single-domain mode;
  domains not in the config can legitimately be reported as not configured.
- Per-domain and global updates share the existing single execution lock
  (the updater writes a shared config file; concurrent runs would corrupt
  it). A busy lock surfaces as a clear "already running" message, not a
  queue.
- The reason for the NOTFOUND_SESSION error (documented in the feature
  research): the provider no longer recognizes the OAuth authorization
  session stored at setup time (session expired or replaced by a re-setup
  elsewhere); re-running setup for that domain is the fix. No changes to
  the provider communication itself are in scope.
- The known-error hint is derived from the stored failure reason at display
  time; no new storage is introduced.
- The interface language remains English; the existing single-user, trusted
  network assumptions are unchanged.
