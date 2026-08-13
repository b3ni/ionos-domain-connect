# Feature Specification: Footer App Version and Tooltip Sync Errors

**Feature Branch**: `003-footer-version-tooltip`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Quiero que en el pie de la página se muestre la versión actual de la aplicación, teniendo en cuenta que distribuyo esto con github y docker hub y cuando creo el release en github es cuando se crea la versión. Por otro lado, para ver el error de sincronización de cada dominio usar el tooltip de shadcn"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Running App Version in the Footer (Priority: P1)

The user opens the web interface and, in the footer of the page, can read
which version of the application is running. That version corresponds to the
GitHub release that produced the Docker image they are running, so they can
tell at a glance whether the container matches the latest published release.

**Why this priority**: Version visibility is the core of this feature — it
answers the common question "which version am I running?" without leaving the
page. It also helps debugging, since the version ties a running container to
a specific GitHub release.

**Independent Test**: Build and run the interface from a tagged release
(e.g. `v1.2.3`), open the page, and verify the footer shows that release
version. Build without any release tag and verify a fallback label is shown
instead of nothing.

**Acceptance Scenarios**:

1. **Given** a web interface built from a GitHub release tagged `v1.2.3`,
   **When** the user opens the main page, **Then** the footer shows the
   version `v1.2.3` (or the release's label as published).
2. **Given** a web interface built without a release version (e.g. local
   development), **When** the user opens the main page, **Then** the footer
   shows a stable fallback label (e.g. "dev") and the page renders normally.
3. **Given** the main page, **When** the user scrolls to the bottom of the
   page, **Then** the footer is visible and does not overlap or hide any page
   content.
4. **Given** an interface built from a release, **When** the user compares the
   footer version with the GitHub release that published the image, **Then**
   both match exactly.

---

### User Story 2 - Read a Domain's Full Sync Error via Tooltip (Priority: P1)

A managed domain has a failed sync. The truncated error line in the domain
row is not enough to read the whole message. The user hovers (or focuses) the
error and the full error text appears in an accessible tooltip, without
navigating away from the list.

**Why this priority**: Failure reasons are already displayed in the list
(feature 002), but the native browser tooltip is not accessible to keyboard
users and is inconsistent with the rest of the interface. Moving to the
standard tooltip of the UI kit gives every user a reliable way to read the
full error.

**Independent Test**: Open the domain list with a failed domain, place the
pointer over its error text, and verify the full error appears in a tooltip.
Repeat using the keyboard: tab to the error and verify the same tooltip
appears on focus.

**Acceptance Scenarios**:

1. **Given** a domain whose last sync failed and shows a truncated error
   line, **When** the user hovers over that line, **Then** a tooltip displays
   the full error text.
2. **Given** the same failed domain, **When** the user navigates to the error
   line with the keyboard, **Then** the same tooltip appears (focus shows the
   tooltip, not only hover).
3. **Given** a domain whose last sync succeeded, **When** the user hovers or
   focuses the row, **Then** no error tooltip appears.
4. **Given** a failed domain with a very long multi-line error, **When** the
   tooltip is shown, **Then** the full text remains readable and the page
   layout stays intact.

---

### Edge Cases

- The interface is built without any release tag (local dev, manual build):
  the footer must still render with a fallback label.
- The release tag has an unexpected format (e.g. no leading `v`): the footer
  shows the version as provided by the release, without transformation.
- The version value is missing or empty at runtime: the fallback label is
  shown and the page does not crash.
- A domain has no failure reason: no tooltip trigger is rendered for it.
- The error text is very long or contains multiple lines: the tooltip shows
  it fully, word-wrapped, without breaking the layout.
- The tooltip is open when the domain list refreshes: the tooltip closes
  cleanly and no stale tooltip remains.
- Keyboard-only users must be able to reach every error tooltip (no mouse
  dependency).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web interface MUST show the current application version in
  the page footer.
- **FR-002**: The version shown MUST correspond to the GitHub release whose
  publication produced the running Docker image.
- **FR-003**: When no release version is available (e.g. local development or
  manual build), the footer MUST show a stable fallback label instead of an
  empty value.
- **FR-004**: An unexpected or malformed version value MUST NOT break the
  page; a sensible label is always shown.
- **FR-005**: The footer MUST not overlap or cover other page content and
  MUST be visible on the main page.
- **FR-006**: The full sync error of a failed domain MUST be displayed in an
  accessible tooltip when the user hovers or focuses the error text in the
  domain row.
- **FR-007**: The tooltip MUST NOT appear for domains whose last sync
  succeeded or that have no failure reason.
- **FR-008**: Errors of any length MUST be fully readable in the tooltip
  without breaking the page layout.
- **FR-009**: The error tooltip MUST be reachable with the keyboard alone
  (focus), not only by mouse hover.
- **FR-010**: When the domain list refreshes with a tooltip open, the
  interface MUST not show stale tooltip content for a removed or updated
  domain.

### Key Entities *(include if feature involves data)*

- **Managed Domain**: Existing entity, unchanged. Its failed sync error text
  (already captured per feature 002) is the content shown in the tooltip.
- **Application Version**: The release label (e.g. `v1.2.3`) of the GitHub
  release that produced the running image; a fallback label ("dev") is used
  when no release produced the build.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of images published to Docker Hub from a GitHub
  release, the footer shows exactly that release's version.
- **SC-002**: The footer never shows an empty version; a fallback label is
  shown in 100% of builds without a release version.
- **SC-003**: In 100% of failed domains with an error text, the full error is
  readable via tooltip, and 100% of these tooltips are reachable by keyboard
  focus alone.
- **SC-004**: Zero tooltips appear for domains whose last sync succeeded.
- **SC-005**: No page layout regression is observed for long or multi-line
  error texts.

## Assumptions

- The version source is the GitHub release tag that triggers the Docker Hub
  publication workflow (e.g. `v1.2.3`); the release is the only place where
  a new version is created.
- The footer shows the version text as released (including a leading `v` if
  the release tag uses one); no normalization or reformatting is required.
- The fallback label for builds without a release version is "dev"; wording
  is fixed for all such builds.
- The existing truncated error line stays in the domain row; the tooltip
  replaces the native browser tooltip as the way to read the full text.
- The interface language remains English; the existing single-user, trusted
  network assumptions are unchanged.
- Only the main page needs the footer (it is currently the only page); any
  future pages reuse the same footer.
