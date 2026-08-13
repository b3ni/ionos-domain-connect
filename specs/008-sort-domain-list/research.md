# Research: Sortable Domain List

**Feature**: 008-sort-domain-list | **Date**: 2026-08-13

All unknowns from the plan's Technical Context were resolved below. No
[NEEDS CLARIFICATION] markers remain.

## R1: Sorting implementation approach (library vs. hand-rolled)

**Question**: Should the sortable table use a table library (TanStack Table,
used by shadcn's data-table example) or a hand-rolled client-side sort?

**Decision**: Hand-rolled sort in the existing `DomainTable` client
component, with the comparator logic extracted as pure functions in a new
`webui/src/lib/sort.ts` module.

**Rationale**:
- Dataset is ≤ 50 rows, one table, no pagination, no filtering, no
  selection, no multi-sort, no column resizing/reordering. Sorting is a
  `useState` + `useMemo` + one comparator — the simplest correct solution.
- Constitution Principle I (Simplicity/Minimum Engineering) forbids adding
  abstractions or dependencies unless a concrete requirement justifies
  them; none of TanStack Table's feature surface beyond basic sorting would
  be used.
- The comparator is kept in a pure module so the sort semantics are
  trivially reviewable and could be unit-tested later without a framework.
- `lucide-react` (already a dependency, webui/package.json) provides the
  sort indicator icons; shadcn/ui `Table` components are already in use.

**Alternatives considered**:
- **TanStack Table v8 (`/tanstack/table`, context7)**: mature, headless,
  first-class sorting (`getSortedRowModel`, `toggleSorting`, per-column
  `sortFn`, `sortUndefined: "last"` — which even matches our null-pinning
  requirement). Rejected because: it is a new dependency for a feature that
  uses only its simplest feature; its own docs target pagination,
  virtualization, and multi-column workflows that this UI does not need.
- **Server-side sorting (query param on `GET /api/domains`)**: rejected —
  the spec requires instant reordering without page reload or server
  round-trip (FR-011, SC-003); the data is already fully loaded client-side
  and re-fetching per sort click would be slower and add API surface.
- **`localStorage` persistence of sort state**: rejected — spec Assumptions
  explicitly defer persistence (YAGNI).

## R2: Status column sort order

**Question**: What order should the Status column use, and how should
missing statuses rank?

**Decision**: Fixed rank order `ok` (Up to date) = 0, `pending` = 1,
`error` (Update failed) = 2. The sort key is `lastResult ?? "pending"`,
mirroring the existing display fallback in domain-table.tsx
(`RESULT_META[domain.lastResult ?? "pending"]`), so the sort always matches
the badge the user sees — a row showing the "Pending" badge sorts with the
pending group regardless of whether the underlying value is `"pending"` or
`null`.

**Rationale**: Spec FR-008 requires a fixed logical order (Up to date →
Pending → Update failed); using the same key as the visible badge keeps the
sort predictable to users. Missing timestamps/IPs are handled by the
column-level null-pinning rule instead (see R3).

**Alternatives considered**:
- Alphabetical by badge label: rejected — arbitrary, not the logical
  severity/staleness order users expect.
- Sorting `null` lastResult after `error`: rejected — a `null` row is
  displayed as "Pending", so placing it after "Update failed" would
  contradict the visible badge.

## R3: Missing-value handling (null pinning)

**Question**: How should rows with no last-update timestamp or no current IP
behave when sorting those columns?

**Decision**: Nulls are pinned to the **end** of the list in **both**
ascending and descending directions (spec FR-006, FR-007, acceptance
scenarios). Implementation: the comparator short-circuits before comparing
values — if exactly one side is null, the non-null side wins; if both are
null, rows fall back to their original (stable) order.

**Rationale**: Mirrors TanStack's `sortUndefined: "last"` semantics — the
industry-standard behavior — and matches the spec exactly. The user sees
"—" placeholders grouped at the bottom, never jittering with direction.

**Alternatives considered**:
- Nulls-first (`sortUndefined: "first"`): rejected — spec mandates end-of-
  list in both directions.
- Treating "—" as an empty string in a plain string sort: rejected — would
  place them at the start in ascending order and move them on direction
  flip, violating FR-006/FR-007.

## R4: Timestamp comparison

**Question**: How to compare `lastUpdatedAt` values (ISO 8601 strings)?

**Decision**: Plain lexicographic string comparison (`a < b ? -1 : a > b ?
1 : 0`). All `lastUpdatedAt` values are produced by
`new Date(lastTs * 1000).toISOString()` (webui/src/lib/domains.ts:44), i.e.
UTC ISO 8601 with fixed zero-padded fields, so string order equals
chronological order. No `Date.parse` needed.

**Rationale**: Simplest correct comparison for a single, known format;
avoids timezone/parsing pitfalls entirely.

## R5: Name comparison and tie-breaking

**Question**: How should the Domain column compare, and what happens on
ties?

**Decision**: Case-insensitive comparison via `toLowerCase()` on both
sides, then a plain string comparison of the raw names as tie-break.
Remaining ties (identical names) keep their original relative order —
`Array.prototype.sort` is guaranteed stable (ECMAScript 2019+), so no
explicit index tie-break is needed.

**Rationale**: Spec FR-005 (case-insensitive alphabetical, deterministic
tie rule). `localeCompare` with default options was considered but its
case-sensitivity is locale-dependent; explicit `toLowerCase()` is
deterministic everywhere.

**Alternatives considered**: `localeCompare` with `sensitivity: "base"`:
rejected — same result but heavier and locale-dependent for edge cases
(punctuation); plain lowercased comparison is sufficient for hostnames
(A-Z, 0-9, dots, hyphens).

## R6: Sort state location

**Question**: Where should the sort state live in the component tree?

**Decision**: Inside `DomainTable` itself (`useState<SortState>` +
`useMemo`-sorted rows). `DomainList` passes `data.domains` unchanged.

**Rationale**: `DomainTable` is the only consumer of the table, is already a
client component ("use client", domain-table.tsx:1), and self-containment
means zero prop churn in `DomainList` and its call sites. Data refreshes
(manual update, per-domain refresh) arrive as new props; `useMemo` re-runs
the comparator on `[domains, sort]`, satisfying FR-009 without any extra
wiring.

**Alternatives considered**: Lift state to `DomainList` and pass sort state
down: rejected — adds two props to an otherwise unchanged component and
couples the list container to table-specific UI state.

## R7: Sortable-header accessibility

**Question**: How do sortable headers behave for keyboard and screen-reader
users?

**Decision**:
- Each sortable header contains a native `<button>` (or the `TableHead`
  itself is a button) so the control is focusable and operable with Enter /
  Space — no custom key handling.
- The active header's `<th>` carries `aria-sort="ascending"` or
  `aria-sort="descending"`; inactive sortable headers carry
  `aria-sort="none"`; the actions header carries nothing.
- The indicator icon (lucide `ArrowUp`/`ArrowDown`/`ArrowUpDown`) is
  `aria-hidden`; `aria-sort` is the source of truth for assistive
  technology.

**Rationale**: WAI-ARIA 1.2 table sortable-column pattern; web-design-
guidelines compliance (keyboard-operable, announced state). The spec
requires (Assumptions) that sort state be communicated to assistive tech
the same way the visual indicator communicates it to sighted users.

**Alternatives considered**: Click-only headers with CSS cursor change:
rejected — not keyboard accessible.
