# Data Model: Per-Domain Refresh

**Feature**: 004-per-domain-refresh | **Date**: 2026-08-13

## Entities

No new entities, no new fields, no schema change. The per-domain update
writes the exact same state fields the global update writes today.

### Managed Domain (existing, unchanged)

`config.json` entry (CLI-owned). Fields written by updates — unchanged
contract, now also produced by single-domain runs:

| Field | Type | Written by | Notes |
|-------|------|------------|-------|
| `last_success` | number (unix) | CLI | set on successful update |
| `last_attempt` | number (unix) | CLI | set on failed update |
| `last_error` | string (optional) | **web UI** | failure reason, set/cleared per outcome (feature 002 semantics) |

### Update Outcome (existing notion)

`"ok" | "error" | "unchanged" | "unknown"` — per domain, now computed for a
single-domain run from the same stdout markers ("DNS records successfully
updated.", "All records up to date", "Could not update DNS records.", "not
configured", "configured incorrectly").

### Known Failure Signature (no storage)

Display-time classification of the stored `last_error` text:

| Signature | Detected when `lastError` contains | Hint shown |
|-----------|------------------------------------|------------|
| NOTFOUND_SESSION | `"Failed to get async token"` **or** `"NOTFOUND_SESSION"` | "Run setup again for this domain." |

Derived at render time from the existing `DomainView.lastError`; nothing is
persisted.

## State transitions

| Transition | Trigger | Effect |
|------------|---------|--------|
| per-domain update succeeds | row refresh button → CLI `update --domain X`, outcome `ok`/`unchanged` | `last_success` updated; `last_error` cleared (if present) — same as global |
| per-domain update fails | row refresh button, outcome `error` | `last_attempt` updated; `last_error` set to extracted/fallback reason (redacted) — same as global |
| per-domain update for unmanaged domain | row refresh button on a domain not in config | rejected in the API layer (`404`); no CLI run, no config write |
| concurrent update trigger | any button while a run is in progress | rejected (`409 CONFLICT`); running run undisturbed |

## Consistency & concurrency

- Single shared execution lock (scheduler `running` flag) covers global and
  per-domain runs — two CLI processes can never interleave config writes.
- `persistOutcome` runs only after the CLI child has exited (`close` event
  in `runCli`), same as the global path.
- Per-domain run writes only its own domain's entry; other entries are
  untouched (FR-002, SC-002).

## Read model (API surface)

`DomainView` unchanged. New endpoint `POST /api/domains/[domain]/update`
returns the same response shape as `POST /api/update`
(`{ started: true, results: { [domain]: outcome } }`) with a single-entry
`results` object.
