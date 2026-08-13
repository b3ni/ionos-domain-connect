# Data Model: Sortable Domain List

**Feature**: 008-sort-domain-list | **Date**: 2026-08-13

This feature introduces **no persisted data** and **no changes to the
existing stored config model**. The only new data structure is ephemeral
client-side sort state; the domain row model it operates on is the existing
`DomainView` (webui/src/lib/domains.ts:4) and is documented here for
completeness of the sort semantics.

## SortState (new, client-side only)

The user's current sort selection. Ephemeral — lives in component state,
resets to the default on page reload.

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `key` | enum | `name` \| `lastUpdatedAt` \| `currentIp` \| `lastResult` | The column being sorted; `name` is the default |
| `direction` | enum | `asc` \| `desc` | Toggle: click same column asc → desc → asc |

**Default state**: `{ key: "name", direction: "asc" }` — preserves today's
alphabetical order (spec FR-004).

**Transition rule** (spec FR-002): clicking a different column sets that
column to `asc`; clicking the active column flips `direction`; the actions
column is never a sort target (spec Assumptions).

## Operated-on entity: DomainView (existing, unchanged)

From `webui/src/lib/domains.ts:4`. The table displays these rows; sorting
reorders them without modifying them (spec FR-010).

| Field | Type | Nullable | Display when null | Sort behavior |
|-------|------|----------|-------------------|---------------|
| `name` | string | no | — | Case-insensitive alphabetical (R5) |
| `lastUpdatedAt` | string (ISO 8601 UTC) | yes | "—" | Chronological (R4); nulls pinned last in both directions (R3) |
| `currentIp` | string | yes | "—" | Lexicographic; nulls pinned last in both directions (R3) |
| `lastResult` | `"ok" \| "error" \| "pending" \| null` | yes | "Pending" badge | Ranked; `null` ranks as `pending` to match the visible badge (R2) |

## Sort semantics per column

Comparator shape: `(a: DomainView, b: DomainView) => number` (negative /
zero / positive). Direction is applied after the base comparator
(`desc` negates the result). All comparators:

1. **Null pinning first** (for `lastUpdatedAt` and `currentIp`): if exactly
   one side is null, the non-null side sorts first — regardless of
   direction, so nulls stay at the end (spec FR-006, FR-007, SC-004). If
   both are null, fall through to the tie rule.
2. **Column comparison** per the table below.
3. **Tie rule**: keep original relative order. `Array.prototype.sort` is
   stable (ECMAScript 2019+), and the input array's order is the existing
   server-side name sort, so ties are deterministic (spec Edge Cases:
   "relative order among ties is stable and not perceived as random").

| Column | Base comparison | Direction flip |
|--------|-----------------|----------------|
| `name` | `a.name.toLowerCase()` vs `b.name.toLowerCase()`; tie-break with raw name comparison | negated |
| `lastUpdatedAt` | ISO string `<`/`>` (lexicographic == chronological) | negated |
| `currentIp` | string `<`/`>` | negated |
| `lastResult` | rank `ok=0, pending=1, error=2` on key `lastResult ?? "pending"` | negated |

## Validation rules

- Sort state must always have a valid `key` from the four-column enum and a
  valid `direction` — no partial/invalid states are reachable (toggle is
  the only mutation path).
- No data validation changes: `DomainView` is produced unchanged by
  `getDomains()`.
