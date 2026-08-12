# Data Model — Web UI for Subdomain Management

**Date**: 2026-08-12 (updated after implementation: status is read from the
CLI-persisted fields in config.json; no separate status file exists).
**Delta 2026-08-12**: web gating adds no entities — headless mode is the
same config.json + same CLI writes, just without the web process.
**Source**: spec.md + research.md decisions.

## Entities

### ManagedDomain

A domain or subdomain the system keeps up to date. **Source of truth**:
`/config.json` (owned by the `domain-connect-dyndns` CLI — the app never
writes it directly, except via the CLI's `setup`/`remove` commands).

The config is a flat JSON object keyed by domain name, e.g.:

```jsonc
{
  "home.example.com": {
    "provider_name": "...",
    "url_api": "...",
    "access_token": "...",
    "refresh_token": "...",
    "iat": 0,
    "access_token_expires_in": 3600,
    "protocols": ["IPv4"],
    "last_dns_check": 1755000000,   // int epoch seconds
    "last_success": 1755000000,     // last successful update
    "last_attempt": 1755090000,     // last failed update attempt
    "ip": { "IPv4": "203.0.113.7" }
  }
}
```

The view exposed by the API adds computed fields:

| Field | Source |
|-------|--------|
| `name` | config key |
| `lastUpdatedAt` | ISO of `max(last_success, last_attempt, last_dns_check)`; null if absent |
| `lastResult` | `"ok"` if newest of last_success/last_attempt is success, `"error"` if failure, `"pending"` if only last_dns_check exists, else null |
| `currentIp` | `ip.IPv4` \|\| `ip.IP` \|\| `ip.IPv6`; null if absent |

Validation (spec FR-009, app-level before calling the CLI): hostname regex,
duplicate check against the current config.

### SetupSession

Represents an in-flight "add subdomain" authorization flow (spec FR-003,
FR-004). Lives in memory only (single user; a crash simply requires
re-adding). The CLI prints an authorization URL and then waits on stdin for
the access code the provider hands out after approval.

| Field | Type | Notes |
|-------|------|-------|
| `domain` | string | The domain being added. Primary key. |
| `authUrl` | string \| null | Authorization URL extracted from CLI stdout; shown to the user. |
| `state` | `"awaiting_authorization"` \| `"completed"` \| `"failed"` | |
| `startedAt` | ISO timestamp | |
| `error` | string \| null | Human message when `failed` (CLI output, stderr fallback). |

State transitions:

```text
submitted ──(URL extracted from stdout)──▶ awaiting_authorization
    │                                            │  (access code fed to stdin,
    │  (CLI exits without URL)                   │   CLI finishes with
    ▼                                            ▼  "successfully configured")
  failed  ◀──────────────────────────(15 min timeout / CLI failure)──┘
```

## Integrity rules

1. The app MUST never edit `/config.json` directly — only via CLI commands
   (`setup`, `remove`, `update` — the CLI itself persists update state).
2. There is exactly one update runner (the web app scheduler); scheduled
   ticks and manual triggers share a lock, so updates never overlap.
3. If `/config.json` is unreadable/missing, the UI shows the error state and
   refuses mutations.
