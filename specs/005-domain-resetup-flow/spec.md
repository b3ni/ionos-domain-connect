# Feature Specification: Actionable Domain Re-Setup

**Feature Branch**: `005-domain-resetup-flow`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "cuando le doy a actualizar un dominio que está funcionando correctamente dice fail y luego el mensaje es: Failed to get async token: 400 invalid_request NOTFOUND_SESSION / Run setup again for this domain. que eso de setup again? como se puede resolver?"

## Clarifications

### Session 2026-08-13

- Q: Tras completar la autorización (access code + "Finish setup"), ¿qué debe hacer el diálogo? → A: Cierre automático con toast de éxito al detectar la finalización; sin clics extra. Contexto: el diálogo actual se queda abierto sin confirmación (bug de detección de finalización en el flujo de añadir dominio); el re-setup heredaría el mismo comportamiento.
- Q: ¿Dónde encaja la corrección del bug de finalización del diálogo? → A: Dentro del alcance de 005 — el diálogo y el polling son compartidos entre el flujo de añadir dominio y el de re-setup, así que ambos quedan corregidos en la misma entrega (sin hotfix separado).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Re-Authorize a Domain from the List (Priority: P1)

A domain fails with the known "NOTFOUND_SESSION" error and the row shows
the hint "Run setup again for this domain." The user can act on it
directly: the hint is an actionable entry point that opens the existing
authorization dialog pre-targeted to that domain — open the link, enter
the access code, done. No command line, no typing the domain name.

**Why this priority**: Today the hint is inert text; the user asked "qué es
eso de setup again? cómo se puede resolver?" — this makes the fix
executable inside the interface, which is the entire point of the feature.

**Independent Test**: Open the list with a domain failing with
NOTFOUND_SESSION, click the re-authorize entry point on its row, complete
the authorization (open link → enter code), and verify the dialog reports
success and the list refreshes — all without leaving the page.

**Acceptance Scenarios**:

1. **Given** a domain row showing the NOTFOUND_SESSION failure, **When** the
   user clicks the re-authorize entry point, **Then** the authorization
   dialog opens with that domain already targeted (no domain field).
2. **Given** the opened dialog, **When** the user opens the authorization
   link, approves the domain in the provider portal, and enters the access
   code, **Then** the dialog shows the completed state.
3. **Given** a successful authorization, **When** the setup completes,
   **Then** the dialog closes automatically and a success message confirms
   the domain was configured.
4. **Given** a domain that does NOT show the NOTFOUND_SESSION failure,
   **When** the user views its row, **Then** no re-authorize entry point is
   shown.
5. **Given** the re-authorize entry point, **When** the row is rendered,
   **Then** the layout stays intact and the action remains clickable while
   the update buttons in the same row keep working.

---

### User Story 2 - Understand What "Setup" Means and Why It Happens (Priority: P1)

The user understands, in plain language, what happened to the domain and
what re-authorizing does: the authorization the domain received when it was
first connected is no longer valid on the provider's side (expired or
replaced by an authorization made elsewhere); re-authorizing reconnects the
domain to the account without removing it and without touching its DNS
records.

**Why this priority**: The user explicitly asked what "setup again" means.
Without the explanation, an actionable button is still a black box.

**Independent Test**: Open the re-authorization dialog for a failing domain
and verify the text explains (a) why the failure happened, (b) what
re-authorizing does, and (c) that no DNS records or the domain itself are
affected.

**Acceptance Scenarios**:

1. **Given** the re-authorization dialog, **When** the user reads it,
   **Then** it explains that the domain's connection authorization expired
   or was replaced on the provider side and that this is why updates now
   fail.
2. **Given** the same dialog, **When** the user reads it, **Then** it states
   that re-authorizing reconnects the domain and does not remove the domain
   or change its DNS records.
3. **Given** a domain whose last update succeeded before failing, **When**
   the user views the row, **Then** the interface conveys that a previous
   success does not prevent the authorization from expiring afterwards.
4. **Given** the explanation text, **When** it is displayed, **Then** it
   contains no credentials or other sensitive values.

---

### User Story 3 - Domain Back to "Up to Date" Right After Re-Setup (Priority: P2)

After the user completes the re-authorization, the domain is updated
immediately (not only on the next scheduled tick), so the row returns to
"Up to date" and the error hint disappears as soon as the fix is done.

**Why this priority**: Completing the loop without waiting up to
`INTERVAL_UPDATE` seconds gives immediate confirmation that the fix worked;
it builds directly on the per-domain update action.

**Independent Test**: Re-authorize a failing domain; verify an update of
that domain runs right after completion and the row shows success with no
failure hint.

**Acceptance Scenarios**:

1. **Given** a successfully re-authorized domain, **When** the dialog
   closes automatically (success toast shown), **Then** a per-domain
   update is triggered automatically and the list shows the outcome.
2. **Given** a successful update after re-authorization, **When** the user
   views the row, **Then** the status is "Up to date" and the failure
   reason/hint are gone.
3. **Given** a re-authorization that completes but the subsequent update
   fails for a different reason, **When** the user views the row, **Then**
   the new failure reason is shown (and the re-authorize hint reappears
   only if the new reason is again the known signature).

---

### Edge Cases

- Re-authorization while a setup for the same domain is already in progress
  (e.g. dialog reopened): a clear conflict message is shown, nothing is
  disturbed.
- The user closes the dialog before authorizing: the session keeps running
  until its timeout, and reopening shows the conflict message (existing
  behavior) — the message must point to the running session.
- The authorization link never appears (provider unreachable): the dialog
  shows the failure and lets the user close/retry.
- After the access code is submitted, the dialog MUST NOT stay stuck on
  the authorization view: completion detection polls until the session
  finishes and the dialog closes with the success message (this fixes the
  existing add-domain flow, which never shows completion).
- The access code is wrong or expires: the dialog shows the provider's
  failure message.
- A domain re-authorized successfully but its previous failure was
  headless-mode-only: the fresh entry has no stored reason (fresh start)
  and no hint.
- The re-authorize entry point and the row's refresh/remove buttons are all
  present in the same row without overlapping or breaking the layout.
- Re-authorization while a domain update is running: setup and update both
  spawn updater processes; behavior matches the existing add-domain flow
  (pre-existing concurrency model, unchanged by this feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Domains whose failure reason matches the known
  NOTFOUND_SESSION signature MUST show an actionable re-authorize entry
  point on their row (not only explanatory text).
- **FR-002**: The re-authorize entry point MUST open the authorization
  dialog pre-targeted to that domain; the user MUST NOT need to type the
  domain name.
- **FR-003**: Re-authorization MUST work for already-managed domains
  (the add-domain flow keeps rejecting duplicates; the new flow must not).
- **FR-004**: The dialog MUST explain, in plain language, why the failure
  happened (the domain's authorization expired or was replaced provider-
  side) and what re-authorizing does (reconnects the domain; does not
  remove it or change DNS records).
- **FR-005**: The dialog MUST provide the full authorization journey in the
  interface: authorization link, access code input, completion, failure
  feedback (mirroring the existing add-domain dialog).
- **FR-006**: After successful re-authorization, the domain list MUST
  refresh.
- **FR-007**: After successful re-authorization, a per-domain update of
  that domain MUST be triggered automatically so the status is refreshed
  immediately.
- **FR-008**: A successful re-authorization MUST clear the domain's stored
  failure reason (fresh start); the hint disappears.
- **FR-009**: Conflicts (setup already in progress) and failures MUST
  surface clear messages without disturbing other operations.
- **FR-010**: No credential or sensitive value MAY be displayed in the
  entry point, dialog, or explanations.
- **FR-011**: The entry point and dialog MUST not break the row layout or
  overlap other row actions.
- **FR-012**: When a setup (add or re-authorization) completes
  successfully, the dialog MUST close automatically and a success message
  MUST appear; no additional click is required.
- **FR-013**: Completion detection MUST poll the setup session until it
  finishes (never returns early while authorization is still in progress),
  for both the add-domain and the re-authorization flows.

### Key Entities *(include if feature involves data)*

- **Managed Domain**: Existing entity; re-authorization replaces its stored
  authorization entry (fresh start — consistent with the CLI's `setup`
  behavior, which wipes `last_error`).
- **Setup Session**: Existing entity/flow (start → await authorization →
  completed/failed, 15-minute timeout, in-memory); reused unchanged by the
  new re-authorization entry point.
- **Known Failure Signature**: Existing display-time classification
  ("Failed to get async token" / "NOTFOUND_SESSION") — now drives the
  re-authorize entry point.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of rows failing with the NOTFOUND_SESSION signature show
  an actionable re-authorize entry point.
- **SC-002**: 100% of managed domains can be re-authorized through the
  interface (zero "already managed" rejections in the re-authorization
  flow).
- **SC-003**: A user who has authorized a domain before can complete the
  re-authorization journey in the interface in under 5 minutes.
- **SC-004**: After a successful re-authorization, the domain's status is
  updated and the failure hint is gone in 100% of cases (where the
  subsequent update succeeds).
- **SC-005**: Zero credentials or sensitive values are displayed anywhere
  in the flow.
- **SC-006**: 100% of successful setups (add and re-authorization) end
  with the dialog closing automatically and a success message visible to
  the user.

## Assumptions

- "Setup" is the domain authorization flow (the same one used when adding
  a domain): the provider hands out an access code after the user approves
  the domain in its portal; the CLI stores the resulting credentials.
- The NOTFOUND_SESSION failure means the stored authorization no longer
  exists on the provider side (expired or replaced by an authorization made
  elsewhere, e.g. another machine or a re-setup); a previous successful
  update does not prevent this.
- The re-authorize entry point replaces the plain text hint on affected
  rows only; healthy rows keep no entry point.
- Re-authorization reuses the existing setup-session plumbing; the
  add-domain flow keeps rejecting domains that are already managed.
- The completion-detection fix for the authorization dialog is IN SCOPE
  for this feature: add-domain and re-authorization share the dialog and
  polling logic, so both flows are corrected in the same delivery (no
  separate hotfix; clarified session 2026-08-13).
- Re-authorization replaces the domain's stored entry (fresh start), which
  clears its failure reason — consistent with the existing behavior of the
  CLI's `setup` command.
- The concurrency model for setup vs. update runs is unchanged (matches the
  existing add-domain flow); no new locking is introduced by this feature.
- The interface language remains English; the existing single-user, trusted
  network assumptions are unchanged.
