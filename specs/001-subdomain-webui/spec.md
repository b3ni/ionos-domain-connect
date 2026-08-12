# Feature Specification: Web UI for Subdomain Management

**Feature Branch**: `001-subdomain-webui`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "quiero añadir una interfaz web simple para poder gestionar mis subdominios"

## Clarifications

### Session 2026-08-12

- Q: When the web is disabled, should scheduled DNS updates keep running anyway? → A: Yes — the container runs a headless updater mode (no web server, no port bound), preserving the original image behaviour.
- Q: Should the web be active by default or only when the variable is explicitly enabled? → A: Opt-in — the web is active only when the configuration variable is enabled; absent = headless.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Managed Domains and Status (Priority: P1)

The user opens the web interface in a browser and immediately sees every
domain that is currently being kept up to date, together with when each one
was last updated and whether that update succeeded or failed.

**Why this priority**: It is the foundation of the interface: without
visibility there is no way to know what is being managed. It is also the
simplest slice and delivers immediate value on its own.

**Independent Test**: Open the web interface with a config that contains
several domains (including one whose last update failed) and verify all of
them are listed with correct status, without touching the command line.

**Acceptance Scenarios**:

1. **Given** a config with 3 managed domains, **When** the user opens the web
   interface, **Then** all 3 domains are listed with their names.
2. **Given** a domain whose last update succeeded, **When** it is listed,
   **Then** the interface shows a success status and a timestamp.
3. **Given** a domain whose last update failed, **When** it is listed,
   **Then** the interface clearly marks it as failed and shows the time of
   the last attempt.
4. **Given** a config with no domains, **When** the user opens the interface,
   **Then** it shows an empty state with guidance on how to add the first
   domain.

---

### User Story 2 - Add a New Subdomain (Priority: P1)

The user adds a new subdomain from the web interface. The system starts the
authorization flow with the DNS provider for the new subdomain; when the
provider requires a user action (e.g., approving access in the provider's
portal), the interface shows the user the link and what to do. Once
authorized, the subdomain is added to the managed list and starts being kept
up to date.

**Why this priority**: "Gestionar" (manage) primarily means being able to add
new subdomains without the command line. Together with User Story 1 it forms
the complete MVP.

**Independent Test**: Add a brand-new subdomain through the interface, follow
the authorization link, and verify the subdomain appears in the managed list
and receives an update.

**Acceptance Scenarios**:

1. **Given** the user enters a valid, not-yet-managed subdomain, **When** the
   user submits it, **Then** the interface starts the authorization flow for
   that subdomain.
2. **Given** the authorization flow requires provider approval, **When** the
   flow starts, **Then** the interface presents the user with the provider
   link and clear instructions.
3. **Given** the provider authorization completes, **When** the user returns,
   **Then** the subdomain appears in the managed list and is updated on the
   regular schedule.
4. **Given** the user enters a subdomain that is already managed, **When**
   they submit it, **Then** the interface informs them it is already
   managed and takes no other action.

---

### User Story 3 - Remove a Subdomain (Priority: P2)

The user removes a subdomain from the managed list. The interface asks for
confirmation before removal, and after removal the subdomain is no longer
kept up to date, while all other managed subdomains are unaffected.

**Why this priority**: Removal completes the management lifecycle but is less
frequently used than adding, and the core value (add + see status) exists
without it.

**Independent Test**: Remove one subdomain from a config with several, then
verify only that subdomain disappeared from the list and the others still
update.

**Acceptance Scenarios**:

1. **Given** a managed subdomain, **When** the user requests removal,
   **Then** the interface asks for explicit confirmation first.
2. **Given** the user confirms the removal, **When** it completes,
   **Then** the subdomain no longer appears in the managed list.
3. **Given** a removal is confirmed, **When** it completes, **Then** the
   remaining managed subdomains continue to be updated unchanged.

---

### User Story 4 - Trigger an Immediate Update (Priority: P3)

The user triggers an update of all managed subdomains at any time and sees
the outcome of that update in the interface.

**Why this priority**: Useful when a change must propagate immediately
instead of waiting for the next scheduled run, but the scheduled behaviour
already covers the core need.

**Independent Test**: Click the update button, then verify a fresh update
runs for all domains and its result is shown in the list.

**Acceptance Scenarios**:

1. **Given** the web interface is open, **When** the user triggers an
   update, **Then** the system starts an update of all managed subdomains
   immediately.
2. **Given** an update is running, **When** it finishes, **Then** the
   interface shows the result for each domain.
3. **Given** a scheduled update is already running, **When** the user
   triggers a manual one, **Then** the manual update does not corrupt or
   duplicate the scheduled one (the list remains consistent).

---

### Edge Cases

- What happens when the user submits an invalid domain name (wrong format)?
- How does the system behave when the configuration file is missing,
  unreadable, or malformed?
- How does the interface handle a provider authorization flow that the user
  abandons or that times out?
- What happens when a domain is removed while its update is in progress?
- How does the interface behave when the scheduled updater itself is not
  running (e.g., container just started)?
- What happens when a user opens the web address while the web is disabled?
  (Nothing listens on the port — connection refused; the headless updater
  keeps running unaffected.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a web interface reachable from a
  browser on a documented address and port, but ONLY when a configuration
  variable enables it (opt-in; variable absent or false = web not active).
- **FR-002**: The interface MUST list every domain currently managed by the
  system, including name, last update time, and last update result
  (success/failure).
- **FR-003**: The interface MUST allow the user to add a new subdomain to
  the managed set via a form.
- **FR-004**: The system MUST embed the provider authorization flow in the
  interface: adding a subdomain starts the flow, and when the provider
  requires approval, the interface MUST present the provider link and clear
  instructions to the user.
- **FR-005**: The interface MUST allow the user to remove a managed domain,
  with an explicit confirmation step.
- **FR-006**: Removing one domain MUST NOT affect the other managed domains.
- **FR-007**: The system MUST persist all changes (added/removed domains) so
  they survive restarts.
- **FR-008**: The interface MUST allow the user to trigger an immediate
  update of all managed domains and show the result.
- **FR-009**: The interface MUST reject invalid or duplicate domain names
  with a clear message.
- **FR-010**: The existing scheduled updates MUST continue to run
  automatically and unaffected by the web interface.
- **FR-011**: The interface MUST NOT include any authentication, and the
  need to expose it only on a trusted network MUST be stated in the
  documentation accompanying the interface.
- **FR-012**: When the web is not enabled, the system MUST still run the
  scheduled updates (headless mode): no web server starts and no port is
  bound.
- **FR-013**: The variable enabling the web, its values and the headless
  default MUST be documented with the deployment instructions.

### Key Entities *(include if feature involves data)*

- **Managed Domain**: A domain or subdomain being kept up to date. Key
  attributes: name, when it was added, last update time, last update result.
- **Update Result**: Outcome of an update attempt for a domain (success or
  failure, with a timestamp). Relates to a Managed Domain.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The user can see the full list of managed domains with status
  within 5 seconds of opening the interface.
- **SC-002**: A user familiar with DNS concepts can add a new subdomain in
  under 2 minutes, excluding time spent waiting on provider approval.
- **SC-003**: 100% of domain additions and removals made through the
  interface persist across a restart of the service.
- **SC-004**: Scheduled automatic updates continue to run with zero
  user-visible regressions after the interface is introduced.
- **SC-005**: All management tasks (view, add, remove, trigger update) are
  each completable in a single page, with no more than one confirmation
  step per destructive action.

## Assumptions

- The interface serves a single user: the owner of the domains.
- The web interface runs in the same container as the existing updater and
  reuses the existing configuration file; no separate deployment is added.
- Adding a new subdomain still requires the provider's authorization step
  (approving in the provider's portal); the interface guides the user but
  cannot bypass it.
- The interface is desktop-browser oriented; mobile layout is out of scope
  for v1 but must not break.
- The interface language is English.
- The interface has no authentication: it MUST only be exposed on a trusted
  local network, and this constraint is documented with the interface.
- The web is opt-in via a configuration variable (e.g. `ENABLE_WEBUI`):
  when it is not enabled, the container runs headless — scheduled updates
  continue, no web server starts and no port is bound.
- The `domain-connect-dyndns` CLI remains usable inside the container
  (e.g. `setup`) whether the web is enabled or not.
- The existing scheduled update behaviour (`update --all` on a fixed
  interval) remains the source of truth for actual DNS updates.
