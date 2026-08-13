# UI Contract: Sortable Domain Table

**Feature**: 008-sort-domain-list | **Date**: 2026-08-13

Scope: the domain table rendered by `DomainTable` (webui/src/components/
domain-table.tsx). This is the user-facing contract of the sorting feature;
there are no API/CLI contract changes — `GET /api/domains` still returns
`{ domains: DomainView[], configError: string | null }` in the server's
alphabetical order, and `config.json` is untouched.

## Sortable columns

| Column | Header label | Sort key | Initial state |
|--------|--------------|----------|---------------|
| Domain | "Domain" | `name` | `asc` (default; page load) |
| Last update | "Last update" | `lastUpdatedAt` | `asc` on first click |
| Current IP | "Current IP" | `currentIp` | `asc` on first click |
| Status | "Status" | `lastResult` | `asc` on first click |
| Actions (refresh/remove) | (none) | — | never sortable |

## Interaction contract

1. **Click a column header** → the list reorders by that column,
   ascending; the header shows the active-sort indicator (up arrow).
2. **Click the active column again** → descending (down arrow).
3. **Click it a third time** → ascending again. There is no "unsorted"
   state (spec Edge Cases).
4. **Click a different column** → switches to that column, ascending.
5. **Default on load** → `name` ascending (alphabetical), identical order
   to the pre-feature behavior (spec FR-004).
6. **After any data refresh** (manual "Update now", per-domain refresh) →
   the sort column and direction are retained and applied to the new rows
   (spec FR-009).
7. **Row actions** (refresh, remove, reauthorize) remain bound to the
   correct domain row regardless of sort order (spec FR-010).

## Accessibility contract (WAI-ARIA 1.2 table pattern)

- Each sortable header is a focusable button, operable with Enter and
  Space.
- Active header: `aria-sort="ascending"` or `aria-sort="descending"` on
  the `<th>`.
- Inactive sortable headers: `aria-sort="none"`.
- The visual indicator (lucide `ArrowUp` / `ArrowDown` for active,
  `ArrowUpDown` for inactive) is `aria-hidden` — `aria-sort` is the
  assistive-tech source of truth.

## Sort semantics (summary — full detail in data-model.md)

- **Domain**: case-insensitive alphabetical; deterministic ties.
- **Last update**: chronological; missing timestamps pinned to the end in
  both directions.
- **Current IP**: lexicographic; missing values pinned to the end in both
  directions.
- **Status**: fixed order Up to date → Pending → Update failed; a row
  without recorded state sorts with the Pending group (it displays the
  "Pending" badge).

## Out of scope (contract boundary)

- No persistence of sort choice across reloads.
- No pagination, filtering, multi-column sort, or column resize/reorder.
- No change to the actions column, row content, or any API response shape.
