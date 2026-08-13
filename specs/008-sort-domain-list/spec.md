# Feature Specification: Sortable Domain List

**Feature Branch**: `008-sort-domain-list`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "quiero que se pueda ordenar por diferentes columnas el listado de dominios"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sort the Domain List by Any Column (Priority: P1)

The user manages a list of subdomains in the web UI table with columns:
Domain, Last update, Current IP, Status (plus row actions). Today the list is
always shown alphabetically by domain name. The user wants to click any of
those column headers to reorder the rows: click once to sort ascending,
click again to sort descending, click a different column to switch the sort.
The active column and direction are visible (e.g. an arrow next to the
header label), so the current sort is always obvious.

**Why this priority**: This is the entire feature. A user with many domains
needs to answer questions like "which domains failed last update?" (sort by
Status) or "which domain is stale?" (sort by Last update) without scanning
an alphabetically ordered list.

**Independent Test**: With three or more managed domains in mixed state
(different statuses, timestamps and IPs), click each column header and verify
the rows reorder correctly in both directions, the indicator follows the
active column, and the default on load is alphabetical by domain name.

**Acceptance Scenarios**:

1. **Given** a list with several domains, **When** the page loads, **Then**
   the domains appear alphabetically by name (same as today) and the Domain
   header shows the sort indicator.
2. **Given** the Domain column is the active sort, **When** the user clicks
   the "Domain" header again, **Then** the list reorders to descending
   alphabetical order and the indicator flips.
3. **Given** the "Last update" header, **When** the user clicks it, **Then**
   the list reorders by last update time, oldest first, and the indicator
   moves to that column.
4. **Given** a sort active on any column, **When** the user clicks the
   "Status" header, **Then** the list reorders by status group (Up to date,
   then Pending, then Update failed) and the indicator moves to "Status".

### User Story 2 - Empty and Unavailable Values Stay Deterministic (Priority: P2)

Some domains have no recorded update time ("—") or no current IP, and
"pending" domains have no conclusive status. The user should never see the
row order jitter or look random when sorting such columns.

**Why this priority**: Guarantees the sort behaves predictably with real
config state, which is what makes the feature trustworthy.

**Independent Test**: With at least one domain that has never been updated
and one without a recorded IP, sort by "Last update" and by "Current IP" in
both directions and verify the value-less rows always land at the same end
of the list regardless of direction.

**Acceptance Scenarios**:

1. **Given** one or more domains without a last update time, **When** the
   user sorts by "Last update" ascending or descending, **Then** those rows
   always appear last, at the bottom of the list.
2. **Given** one or more domains without a current IP, **When** the user
   sorts by "Current IP" ascending or descending, **Then** those rows always
   appear last, at the bottom of the list.
3. **Given** a domain with status "pending" and no recorded time, **When**
   the user sorts by "Last update", **Then** it behaves like a domain
   without a last update time (bottom of the list).

---

### Edge Cases

- List with only one domain: sorting has no visible effect but must not
  error or lose the row.
- Empty list: sort controls are either hidden or inert; no error is shown.
- Domains whose names differ only in case or punctuation: comparison is
  case-insensitive and stable, so order is unambiguous.
- Data changes while a custom sort is active (manual refresh, per-domain
  update): the sort direction and column are kept, the reordered view
  reflects the new data.
- Clicking the currently active column repeatedly: toggles ascending →
  descending → ascending, never "unsorts".
- All rows have identical values in the sorted column (e.g. same IP): the
  relative order among ties is stable and not perceived as random.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The domain list MUST be sortable by each of the four data
  columns: Domain, Last update, Current IP, and Status.
- **FR-002**: Clicking a sortable column header MUST sort the list
  ascending; clicking the same header again MUST toggle to descending;
  clicking again MUST toggle back to ascending.
- **FR-003**: The active sort column and direction MUST be visibly indicated
  on the table header so the user can always tell the current sort.
- **FR-004**: On load, the list MUST default to alphabetical order by domain
  name (the current behavior), preserving existing behavior as the default.
- **FR-005**: "Domain" sorting MUST be case-insensitive alphabetical; ties
  MUST be broken by a deterministic rule.
- **FR-006**: "Last update" sorting MUST order by actual timestamp; rows
  without a timestamp MUST be pinned to the end of the list in both
  directions.
- **FR-007**: "Current IP" sorting MUST be deterministic; rows without a
  value MUST be pinned to the end of the list in both directions.
- **FR-008**: "Status" sorting MUST use a fixed logical order (Up to date,
  then Pending, then Update failed); rows without a conclusive status MUST
  be pinned to the end of the list in both directions.
- **FR-009**: The active sort MUST survive data refreshes (e.g. after a
  manual or per-domain update) and MUST be applied to the newly loaded rows.
- **FR-010**: Sorting MUST never alter the underlying data — only the
  display order of the rows; per-row actions must keep working on the
  correct domain after any sort.
- **FR-011**: Sorting MUST remain responsive with a list of 50+ domains;
  reordering must happen instantly, without a page reload.
- **FR-012**: The feature MUST degrade gracefully with an empty or
  single-row list (no errors, no lost rows).

### Key Entities *(include if feature involves data)*

- **Domain view**: The row model shown in the table — domain name, last
  update timestamp, current IP, and status (ok / error / pending / none).
  Sort operates on this display model only; the stored config is unchanged.
- **Sort state**: The currently active column and direction (ascending /
  descending) chosen by the user, applied to the displayed rows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reorder the list by any of the four data columns
  with at most two clicks (one to pick the column, one to flip direction),
  verified manually with 3+ domains in mixed state.
- **SC-002**: 100% of the sortable columns show the active-sort indicator,
  and the indicator always matches the actual row order after every click.
- **SC-003**: Sorting a list of 50 domains renders the reordered view
  instantly, with no measurable delay and no page reload.
- **SC-004**: Value-less rows (no update time, no IP, inconclusive status)
  appear at the end of the list in both directions for 100% of sort
  operations, so ordering never appears random.

## Assumptions

- Sorting is a display-only concern: the sort choice is not persisted and
  resets to alphabetical by domain name on reload. Persisting the user's
  choice across reloads is out of scope for this iteration (YAGNI).
- All sorting happens on the currently loaded list; there is no pagination
  to combine with sorting, so ordering applies to every row shown.
- "Sortable columns" means the four data columns; the actions column
  (refresh / remove buttons) is not a sort column.
- Accessibility defaults apply: sortable headers are keyboard-operable and
  the sort state is announced to assistive technology the same way the
  visible indicator communicates it to sighted users.
- The feature is confined to the existing domain list view: it introduces
  no new storage, no user-facing settings, and no changes to how domain
  data is produced or stored.
