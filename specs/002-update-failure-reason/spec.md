# Feature Specification: Show Failure Reason for Failed Domain Updates

**Feature Branch**: `002-update-failure-reason`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Cuando pone en un dominio Update failed quiero saber cual ha sido el fallo"

## Clarifications

### Session 2026-08-12

- Q: What should the new tab show when clicking a domain in the list? → A: The domain's live website (its public address, e.g. https://sub.example.com); no internal detail page is built.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Why a Domain Update Failed (Priority: P1)

A domain in the managed list shows "Update failed". The user wants to know
what went wrong and can read the failure reason reported by the updater for
that domain directly in the interface, without leaving the page or using the
command line.

**Why this priority**: This is the entire point of the feature — today the
interface only signals that a failure happened, never what caused it. It is
the smallest slice that delivers value on its own.

**Independent Test**: Set up a managed domain whose last update failed
(e.g., invalid credentials), open the interface, and verify the failure
reason is visible next to the "Update failed" status without any additional
clicks.

**Acceptance Scenarios**:

1. **Given** a domain whose last update attempt failed, **When** the user
   views the domain list, **Then** the row shows the "Update failed" status
   together with the failure reason reported by the updater for that domain.
2. **Given** two domains of which only one failed, **When** the user views
   the list, **Then** only the failed domain shows a failure reason, and the
   reason describes that domain's own failure (not the other domain's).
3. **Given** a failed domain whose failure reason is a long error message,
   **When** the reason is displayed, **Then** the page layout stays intact
   and the full text of the reason remains readable.

---

### User Story 2 - Reason Always Matches Reality (Priority: P2)

The failure reason the user sees is never stale or misleading: it always
describes the most recent failed attempt, it survives a restart of the
service just like the status it explains, and it disappears once the domain
updates successfully or is removed.

**Why this priority**: The reason is only trustworthy if it stays in sync
with the status; without this, the user could be misled by an outdated error
message. It builds on the capture capability from User Story 1.

**Independent Test**: Cause a failure, verify the reason appears, restart the
service, verify the reason is still there, then trigger a successful update
and verify the reason is gone while the status shows success.

**Acceptance Scenarios**:

1. **Given** a domain with a stored failure reason, **When** the service is
   restarted, **Then** the failure reason is still displayed alongside the
   still-failed status.
2. **Given** a domain that fails on a second attempt, **When** the second
   attempt completes, **Then** the stored reason is replaced by the reason of
   the second (most recent) attempt.
3. **Given** a domain with a stored failure reason, **When** a later update
   attempt succeeds, **Then** the status shows success and no failure reason
   is displayed anymore.
4. **Given** a domain with a stored failure reason, **When** the domain is
   removed from the managed list, **Then** its stored reason is removed with
   it.

---

### User Story 3 - Reason Even When Nothing to Parse (Priority: P3)

When the updater exits without producing any usable error text (crash,
interruption, empty output), the user still gets a meaningful explanation
instead of an empty field, and never sees credentials or other sensitive
values in a failure reason.

**Why this priority**: This covers failure modes of the updater itself and
safety; the common case (a real error message) is already handled by User
Stories 1 and 2.

**Independent Test**: Simulate an update attempt that terminates abnormally
without error output, then verify the interface shows a meaningful fallback
explanation rather than nothing.

**Acceptance Scenarios**:

1. **Given** a failed update attempt that produced no parseable error text,
   **When** the interface displays the failure, **Then** the user sees a
   meaningful generic explanation of the attempt outcome instead of an empty
   field.
2. **Given** updater output that contains sensitive values (tokens,
   credentials), **When** the failure reason is stored or displayed, **Then**
   those values never appear in the reason.

---

### User Story 4 - Open a Domain's Live Website (Priority: P2)

The user clicks on a managed domain in the list and its live website opens in
a new browser tab, so they can check what the domain actually serves without
leaving the current view.

**Why this priority**: A one-step convenience on top of the failure
visibility stories; it depends on the existing list but adds value on its
own.

**Independent Test**: Click on a domain in the list and verify its website
opens in a new browser tab while the list stays open in the original tab.

**Acceptance Scenarios**:

1. **Given** any managed domain in the list, **When** the user clicks on the
   domain name, **Then** the domain's live website opens in a new browser
   tab.
2. **Given** a domain whose last update failed, **When** the user clicks on
   it, **Then** the live website still opens (the failed status does not
   affect the link).
3. **Given** the domain list, **When** the user opens a domain's website,
   **Then** the current list view is preserved in its original tab.

---

### Edge Cases

- A domain fails, then later succeeds: the old reason must not reappear or
  linger under a success status.
- Several domains fail in the same update run: each row shows its own
  reason, correctly attributed.
- The updater process crashes, is interrupted, or exits without output:
  fallback explanation is shown.
- The failure reason is very long or contains multiple lines.
- The updater output contains credentials or other sensitive values.
- The service restarts while a domain is in a failed state.
- A domain with a stored reason is removed.
- The config file is missing, unreadable, or malformed: the existing
  configuration-error view is unchanged.
- A domain whose update failed is clicked: the link must still open the
  live website.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When an update attempt for a managed domain fails, the system
  MUST capture the failure reason reported by the updater for that specific
  domain at the time of the attempt.
- **FR-002**: The system MUST persist the failure reason so it survives
  restarts of the service.
- **FR-003**: The web interface MUST show the failure reason for every
  domain whose status is "Update failed", in the domain's row, without
  requiring any additional navigation or clicks.
- **FR-004**: Each displayed reason MUST correspond to the most recent
  failed attempt of its own domain.
- **FR-005**: After a successful update attempt of a domain, the system MUST
  clear that domain's stored failure reason.
- **FR-006**: When a domain is removed, the system MUST remove its stored
  failure reason along with it.
- **FR-007**: When a failed attempt produces no parseable error text, the
  system MUST store a meaningful fallback explanation that identifies the
  attempt outcome, never an empty reason.
- **FR-008**: The system MUST NOT store or display credentials or other
  sensitive values (tokens, secrets) as part of a failure reason.
- **FR-009**: Failure reasons of any length MUST be displayed without
  breaking the page layout, and the full text MUST remain readable.
- **FR-010**: The interface MUST open any managed domain's live website in a
  new browser tab when the user clicks on the domain name, regardless of the
  domain's update status.
- **FR-011**: Opening a domain's website MUST NOT navigate the current page
  away from the domain list.

### Key Entities *(include if feature involves data)*

- **Managed Domain**: A domain or subdomain being kept up to date (existing
  entity; unchanged). Key attributes: name, last update time, last update
  result.
- **Failure Reason**: The error text reported by the updater for the most
  recent failed update attempt of a Managed Domain. Key attributes: the
  reason text, the attempt it came from, the domain it belongs to. It is
  captured at attempt time, persisted, and cleared when the domain updates
  successfully or is removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of cases where a domain shows "Update failed" and the
  updater produced an error message, the user can read the failure cause
  directly in the interface with no additional clicks.
- **SC-002**: 100% of displayed failure reasons describe the most recent
  failed attempt of their own domain.
- **SC-003**: 100% of stored failure reasons survive a restart of the
  service.
- **SC-004**: Zero failure reasons are displayed for domains whose last
  update succeeded.
- **SC-005**: No failure reason ever exposes credentials or other sensitive
  values.
- **SC-006**: 100% of managed domains are clickable from the list and open
  their live website in a new browser tab without navigating the current
  page away.

## Assumptions

- "Update failed" refers to the existing status shown in the web interface
  for a domain whose most recent update attempt failed.
- Only the most recent failure reason per domain is kept; a history of past
  failures is out of scope for this feature.
- The failure reason is the updater's own error text for the failing domain;
  no categorization or rewording is attempted beyond redaction and the
  fallback for missing text.
- The reason is captured on every update run the service performs, whether
  scheduled or manually triggered; the headless (non-web) mode keeps its
  current behaviour of printing updater output to the container log.
- Storing the failure reason must not interfere with the updater's own
  handling of the configuration file it writes and reads.
- "Ver su contenido" means the live website served at the domain's public
  address (https://<domain>), opened in a new browser tab; no internal
  detail page is built for this feature.
- Only the domain name itself acts as the link; other parts of the row
  (including the remove action) are not clickable as a link, so actions
  stay unambiguous.
- The link is formed from the domain name using the https scheme; no
  per-provider or scheme fallback handling is required.
- The interface language remains English; the existing single-user, trusted
  network assumptions are unchanged.
