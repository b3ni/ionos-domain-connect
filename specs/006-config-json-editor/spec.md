# Feature Specification: Config JSON Viewer/Editor

**Feature Branch**: `006-config-json-editor`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "quiero una zona poder editar y ver el fichero de configuración de dominios json desde la interfaz web, busca algún componente de edición / visualización de json"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View the Domain Configuration File (Priority: P1)

The user opens a dedicated section ("Configuración") in the web UI and sees
the full contents of the domain configuration file — the same file the
updater and the CLI read and write — rendered as readable, expandable JSON,
one entry per domain. Sensitive fields (tokens) are masked by default so a
glance at the screen does not leak credentials; each masked value can be
revealed individually on demand. If the file is missing or unreadable, the
section says so clearly instead of failing silently.

**Why this priority**: Viewing is the foundation of the feature — the user
asked for both "ver" and "editar", and seeing the current state first is
required to make any meaningful edit.

**Independent Test**: Open the Configuración section with a valid config
file present and verify every domain entry and its fields are visible in
structured JSON form, token fields appear masked, and revealing one masked
value shows only that value.

**Acceptance Scenarios**:

1. **Given** a config file with one or more domain entries, **When** the
   user opens the Configuración section, **Then** the file content is shown
   as formatted JSON with all domain keys and their fields.
2. **Given** the rendered JSON, **When** the user collapses or expands
   entries, **Then** the view updates accordingly and stays readable.
3. **Given** a config entry containing token fields, **When** the section is
   rendered, **Then** those values appear masked and are only shown when the
   user explicitly reveals them (per-value reveal).
4. **Given** a missing or unreadable config file, **When** the section is
   opened, **Then** it displays a clear explanation and still offers the
   repair flow described in User Story 3.
5. **Given** a previously revealed value, **When** the section is closed and
   reopened, **Then** all values are masked again by default.

---

### User Story 2 - Edit and Save Changes to the Configuration File (Priority: P1)

The user changes the configuration directly in the section — values,
fields, or whole entries — and saves. Before anything is written, the
system checks that the result is a valid JSON object shaped like a domain
configuration map (same shape the updater and CLI expect), so a bad edit can
never leave the updater with a corrupt file. On save, the previous file
content is preserved as a backup and the new content is written so that the
updater CLI can read it back unchanged (no formatting surprises). If the
file changed on disk since it was loaded (e.g. the updater or another
process wrote it in the meantime), the save is rejected with a conflict
message instead of silently overwriting the newer content.

**Why this priority**: Editing is the second half of the feature and the
reason a plain read-only viewer would not be enough. This story also carries
the safety guarantees (validation, backup, conflict detection) that make
raw-file editing acceptable in a self-service tool.

**Independent Test**: Edit a non-sensitive field of an existing domain,
save, and verify (a) the change appears in the file on disk, (b) the
domain list in the main section reflects the change where applicable, and
(c) the next scheduled update runs without errors.

**Acceptance Scenarios**:

1. **Given** the Configuración section with loaded content, **When** the
   user edits a field and clicks Save, **Then** the content is validated and
   persisted to the config file, and the UI confirms success.
2. **Given** an edit that results in syntactically invalid JSON or in valid
   JSON that is not a flat object keyed by domain name, **When** the user
   clicks Save, **Then** the save is rejected with a specific error message
   and the file on disk is left untouched.
3. **Given** a successful save, **When** the file is inspected, **Then** the
   previous content exists in a backup that can be restored, and the saved
   file is readable by the updater CLI (round-trips unchanged on the next
   update).
4. **Given** the config file modified on disk after the section was loaded,
   **When** the user saves, **Then** the save is rejected with a conflict
   message telling the user to reload, and neither version is overwritten.
5. **Given** a save failure (e.g. file not writable), **When** the user
   saves, **Then** the UI reports the failure clearly and the in-memory
   edits are not lost.
6. **Given** a saved edit, **When** the main domain list is viewed, **Then**
   it still works and the scheduler continues updating on its normal
   interval without manual intervention.

---

### User Story 3 - Diagnose and Fix an Unreadable Configuration File (Priority: P2)

The config file is corrupt (empty, invalid JSON, or not an object). Today
this makes the whole UI show a generic "Could not read config file" state
and the updater fails. The user opens the Configuración section and is
shown the raw file content (not a failed parse), with the problem explained
in plain language, and can repair or replace the content and save it — a
recovery path that needs no shell access.

**Why this priority**: This is a smaller, less frequent scenario than the
main view/edit flows, but it turns the section from a convenience into a
recovery tool and closes the current dead end.

**Independent Test**: Replace the config file with garbage content, open
the Configuración section, fix the content via the editor, save, and verify
the main section and the updater work again without any CLI use.

**Acceptance Scenarios**:

1. **Given** a config file containing invalid JSON, **When** the
   Configuración section is opened, **Then** the raw file content is shown
   with a message explaining it is not valid JSON, instead of the generic
   read failure.
2. **Given** the raw content shown in the editor, **When** the user corrects
   it and saves, **Then** the file becomes readable again, the main section
   recovers, and subsequent updates succeed.
3. **Given** a config file that is valid JSON but not the expected domain
   map shape (e.g. an array), **When** the user saves the unmodified
   content, **Then** the save is rejected with an explanation of the
   expected shape.

---

### Edge Cases

- The config file does not exist at all — the section must explain this and
  not crash; creating a file from scratch is not in scope (the CLI creates
  it during domain setup).
- The config file contains a domain entry with unexpected or unknown
  fields — these must be preserved and shown, never dropped or reformatted
  into a different schema.
- A domain key that is empty or unusual (spaces, dots) — the file is a flat
  map; any string key must survive a save untouched.
- The file is very large (many domains / long histories) — the section must
  still render and remain usable, not freeze the page.
- Two tabs open at the same time editing the same file — the conflict
  detection must protect against lost updates between tabs.
- The updater runs while the user is mid-edit — an in-flight save must
  never produce a half-written file that the scheduler reads.
- A save succeeds but the domain list entry for an edited domain is now
  inconsistent (e.g. timestamps removed) — the list must degrade gracefully
  (unknown state) instead of crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The web UI MUST provide a dedicated section to view and edit
  the domain configuration file, reachable from the main page.
- **FR-002**: The section MUST render the current file content as formatted,
  expandable JSON grouped by domain, with values editable in place.
- **FR-003**: Sensitive credential fields (access and refresh tokens) MUST
  be masked by default and MUST only be revealed by explicit per-value user
  action; masking MUST be re-applied whenever the section is (re)opened.
- **FR-004**: The user MUST be able to modify any part of the JSON content
  (values, fields, entries) before saving.
- **FR-005**: On save, the system MUST validate that the content is valid
  JSON and is a flat object keyed by domain name with string keys; invalid
  content MUST be rejected with a specific error message and MUST NOT be
  written to disk.
- **FR-006**: On successful save, the system MUST write the file in a form
  the updater CLI can read back unchanged (round-trip), MUST preserve all
  existing fields including unknown ones, and MUST confirm success in the
  UI.
- **FR-007**: Before overwriting the file, the system MUST preserve the
  previous content as a backup that can be restored.
- **FR-008**: If the file changed on disk since it was loaded, the save MUST
  be rejected with a conflict message and MUST NOT overwrite the newer
  content.
- **FR-009**: If the file is missing, unreadable, or invalid JSON, the
  section MUST show the raw content (when available) and a plain-language
  explanation, and MUST allow the user to repair and save it.
- **FR-010**: All errors in this feature MUST follow the existing error
  conventions of the web UI (machine-readable code + human message), so
  clients can react consistently.
- **FR-011**: After a successful save, the main domain list and the
  scheduled updater MUST continue to work without manual intervention.

### Key Entities *(include if feature involves data)*

- **Domain Configuration File**: the single JSON document that drives the
  whole tool; a flat object whose keys are domain names and whose values are
  per-domain entries. Currently located outside the web UI process and
  shared with the updater CLI, which both reads and writes it (formatted
  with a 1-space indent).
- **Domain Config Entry**: one domain's data — provider, API endpoint,
  credentials (tokens), timestamps of last check/success/attempt, last
  error, and per-protocol IP state. Contains sensitive values.
- **Configuration Backup**: a copy of the file's previous content taken
  before every overwrite, restorable by the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open the section and see the file content
  formatted within 2 clicks and with no perceptible delay for typical
  configs (up to ~100 KB).
- **SC-002**: 100% of valid saves produce a file that the updater CLI
  round-trips unchanged on the next update, and that the scheduler picks up
  without errors.
- **SC-003**: 0% of invalid saves (bad JSON or wrong shape) write anything
  to disk — the file is only ever replaced by validated content.
- **SC-004**: 100% of overwrites are preceded by a restorable backup of the
  previous content.
- **SC-005**: A user can recover a corrupt config file from the UI, without
  shell access, in under 5 minutes including diagnosis.
- **SC-006**: Credential values are never displayed unmasked unless the
  user explicitly reveals them in the current view.

## Assumptions

- The UI remains unauthenticated and intended for trusted networks only
  (existing project stance); token masking (FR-003) is the mitigation for
  shoulder-surfing, not a replacement for access control.
- The section is a raw-file view/edit tool for power users; a per-field
  form wizard or schema-driven generator is out of scope for this feature.
- The file's on-disk format (flat domain map, 1-space indentation,
  CLI-compatible field names) is an external contract with the
  `domain-connect-dyndns` CLI and MUST NOT be changed by this feature.
- Creating the config file from scratch is out of scope — the file is
  created by the CLI during domain setup; the section only reads, repairs
  and modifies existing content.
- The existing backup infrastructure (backups directory) is reused for
  FR-007.
- Component selection (JSON viewer/editor library) is a planning-phase
  decision; candidate research is documented in `research.md` in this
  feature directory.
- Restoring a backup from the UI (a "restore previous version" action) is a
  plausible follow-up but is NOT in scope here beyond the backup being
  restorable (FR-007).
