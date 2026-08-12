# Data Model: Update Failure Reason + Domain Link

**Feature**: 002-update-failure-reason | **Date**: 2026-08-12

## Entities

### Managed Domain (extended)

A domain/subdomain kept up to date. Stored as a key of `config.json`
(mounted at `CONFIG_PATH`, default `/config.json`), owned by the
`domain-connect-dyndns` CLI; the web UI reads it and adds one optional
field (see Failure Reason). Lifecycle unchanged: `setup` adds, `remove`
deletes (whole entry, including `last_error`).

| Field | Type | Owner | Notes |
|-------|------|-------|-------|
| `name` (key) | string | CLI | e.g. `sub.example.com` |
| `provider_name`, `url_api`, `access_token`, `refresh_token`, `iat`, `access_token_expires_in` | string/number | CLI | OAuth state, written by `setup` |
| `protocols` | string[] | CLI | e.g. `["IPv4"]` |
| `ip` | object | CLI | last known public IP(s) per protocol |
| `last_success` | number (unix) | CLI | set on successful update |
| `last_attempt` | number (unix) | CLI | set when an update attempt raises `DomainConnectException`; drives the "Update failed" badge |
| `last_dns_check` | number (unix) | CLI | optional |
| `last_error` | string (optional) | **web UI (new)** | failure reason of the most recent failed attempt; **preserved by the CLI** (verified: all CLI writes round-trip the full dict with `sort_keys=True, indent=1`) |

### Failure Reason (new)

The human-readable error detail of a domain's most recent failed update
attempt.

- Stored as `last_error` inside the domain's `config.json` entry — no
  separate entity/file.
- Set by the web UI immediately after an update run when the domain's
  outcome is `error`; deleted when the outcome is `ok`/`unchanged`.
- Value rules: CLI meaningful-line extracted (last meaningful line of the
  domain's output block, excluding status classifier strings); token
  values redacted; capped at 500 chars; never empty (fallback text used
  instead).
- Fallback text (when no parseable detail, or when `error` status exists
  without any stored reason, e.g. headless-era failures):
  `Update failed. No error details reported by the updater.`
- Does NOT participate in status computation: the badge remains
  timestamp-driven (`last_success` vs `last_attempt`); `last_error` is
  only displayed alongside an `error` status.

## State transitions

| Transition | Trigger | Effect on `last_error` |
|------------|---------|------------------------|
| attempt fails | update run, outcome `error` | set to extracted (redacted, fallback) reason |
| attempt succeeds | update run, outcome `ok`/`unchanged` | deleted (FR-005) |
| domain removed | `remove` CLI (web UI button) | deleted with entry (FR-006) |
| domain re-setup | `setup` CLI | wiped (CLI replaces entry); acceptable, fresh start |

## Consistency & concurrency

- Web UI writes `last_error` only after the CLI child process has exited
  (`close` event in `runCli`), so CLI and web UI never write concurrently.
- Scheduled ticks and manual triggers already share one lock
  (`runUpdateNow`), so two web UI writes cannot interleave.
- Headless mode (`src/updater.py`) never writes `last_error`; it only
  prints CLI output to container logs (unchanged behaviour). A failure
  that happened in headless mode therefore shows the generic fallback text
  in the web UI.

## Read model (API surface)

`DomainView` (web UI internal view model, `GET /api/domains` response
item) gains:

| Field | Type | Source |
|-------|------|--------|
| `lastError` | string \| null | `config[domain].last_error` |
