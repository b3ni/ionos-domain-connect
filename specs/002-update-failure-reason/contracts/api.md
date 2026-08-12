# Contracts: Update Failure Reason + Domain Link

**Feature**: 002-update-failure-reason | **Date**: 2026-08-12

## 1. config.json (extended)

File: `CONFIG_PATH` (default `/config.json`), owned by
`domain-connect-dyndns` CLI, extended by the web UI.

```jsonc
{
  "sub.example.com": {
    "provider_name": "ionos",
    "url_api": "https://...",
    "access_token": "...",        // secret — never in reasons
    "refresh_token": "...",       // secret — never in reasons
    "iat": 0,
    "access_token_expires_in": 0,
    "protocols": ["IPv4"],
    "ip": { "IPv4": "203.0.113.10" },
    "last_success": 1789000000,
    "last_attempt": 1789000060,
    "last_error": "HTTP 401: access token expired"   // NEW, optional
  }
}
```

- `last_error`: optional string, ≤ 500 chars, never empty, tokens
  redacted. Absent or deleted on success/removal.
- The CLI preserves this key on every write (round-trip verified in
  research.md §1).
- Formatting: web UI writes `indent=1` JSON like the CLI.

## 2. GET /api/domains

Response item (`DomainView`) gains `lastError`:

```jsonc
{
  "name": "sub.example.com",
  "lastUpdatedAt": "2026-09-01T12:00:00.000Z",   // existing
  "lastResult": "error",                          // existing: "ok" | "error" | "pending" | null
  "currentIp": "203.0.113.10",                    // existing
  "lastError": "HTTP 401: access token expired"   // NEW: string | null
}
```

- `lastError` is `null` when the domain has no stored reason or its status
  is not `error`. The UI renders the generic fallback text when
  `lastResult === "error" && lastError === null`.
- No new endpoints; `POST /api/update` response shape unchanged.

## 3. Domain list UI behaviour

- The domain name cell renders as an external link:
  `https://<domain>` with `target="_blank"` and
  `rel="noopener noreferrer"` — the current page must not navigate
  (FR-010, FR-011).
- Rows with `lastResult === "error"` show a muted, single-line truncated
  reason detail below the domain name; full text available on hover;
  layout must not break for long text (FR-009).

## 4. Failure reason extraction contract

Per-domain extraction from CLI stdout+stderr (mirrors
`outcomeForDomain` block slicing, `webui/src/lib/dyndns.ts:65`):

1. Slice block after `Read <domain> config.` marker.
2. Meaningful lines: trimmed, non-empty, excluding `***` banners,
   `Traceback`, `File `, `^` frames.
3. Exclude status classifier strings: `DNS records successfully updated.`,
   `All records up to date`, `Could not update DNS records.`,
   `not configured`, `configured incorrectly`.
4. Take the last remaining line → reason (≤ 500 chars).
5. Redact exact `access_token`/`refresh_token` values of that domain.
6. Empty result → fallback: `Update failed. No error details reported by
   the updater.`
