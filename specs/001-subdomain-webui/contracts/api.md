# API Contract — Web UI for Subdomain Management

**Date**: 2026-08-12
**Version**: 0.3 (headless-mode note)
**Base**: same-origin under the web UI (Next.js Route Handlers, `PORT 3000`).

**Availability**: the API exists ONLY in web mode (`ENABLE_WEBUI=true`). In
headless mode no web server runs and no port is bound (spec FR-012); the
endpoints below are not reachable.

The UI is a single-page experience: one route (`/`) plus API routes. All
requests/responses are JSON; errors follow the `Error` envelope. There is no
authentication (spec FR-011) — the port must only be exposed on a trusted
network.

## Endpoints

### GET /api/domains

List managed domains with last-update status (spec FR-002, US1).

**Response 200**

```json
{
  "domains": [
    {
      "name": "home.example.com",
      "lastUpdatedAt": "2026-08-12T10:00:00Z",
      "lastResult": "ok",
      "currentIp": "203.0.113.7"
    }
  ],
  "configError": null
}
```

`lastResult`: `"ok"` | `"error"` | `"pending"` | `null`.
`configError`: non-null string if `/config.json` is missing/unreadable.

### POST /api/domains

Two-phase "add subdomain" flow (spec FR-003, FR-004, US2). Body:

```json
{ "domain": "new.example.com" }
```

Starts the CLI `setup` subprocess and returns the session. When the CLI has
printed the authorization URL, the client shows it to the user; the user
opens it, approves the domain in the provider portal, and gets an access
code. The code is then submitted with the same endpoint:

```json
{ "domain": "new.example.com", "code": "abcd1234" }
```

**Response 201** (both phases)

```json
{ "domain": "new.example.com", "authUrl": "https://api.domainconnect.org/...", "state": "awaiting_authorization", "startedAt": "2026-08-12T10:00:00Z", "error": null }
```

`authUrl` may be `null` until the CLI prints it (client polls the setup
endpoint). `state` transitions to `"completed"` or `"failed"` (`error`
carries the CLI message).

**Response 400** — validation errors (`{ "error": { "code": "VALIDATION", "details": [...] } }`).
**Response 409** — domain already managed, or a setup is already in progress.

### GET /api/domains/{domain}/setup

Poll the in-flight setup session. Domain is URL-encoded.

**Response 200**

```json
{ "domain": "new.example.com", "authUrl": "https://...", "state": "awaiting_authorization", "startedAt": "...", "error": null }
```

or `"state": "completed"` / `"state": "failed"` with `error`.

**Response 404** — no such session.

### DELETE /api/domains/{domain}

Remove a managed domain (spec FR-005, FR-006, US3). The server runs the
CLI `remove --domain {domain} --backup_file /backups/{ts}-{domain}.bak`;
other domains are untouched.

**Response 200**

```json
{ "removed": "old.example.com" }
```

**Response 404** — domain not managed.
**Response 502** — CLI failure, with error text.

### POST /api/update

Trigger an immediate update of all domains (spec FR-008, US4). Runs
`update --all` (synchronously, sharing the scheduler's lock) and returns
the per-domain outcome once finished.

**Response 200**

```json
{ "started": true, "results": { "home.example.com": "ok", "lab.example.com": "error" } }
```

`results` values: `"ok"` | `"error"` | `"unchanged"` | `"unknown"`.

**Response 409** — an update (scheduled or manual) is already running.

## CLI invocation contract (internal)

The web app talks to the DNS engine only through subprocess calls:

| Action | Command (config always `--config /config.json`) |
|--------|--------------------------------------------------|
| Update | `domain-connect-dyndns update --all` |
| Remove | `domain-connect-dyndns remove --domain <d> --backup_file <path>` (underscore, per CLI 0.0.9) |
| Add (setup) | `domain-connect-dyndns setup --domain <d>` — consent URL parsed from stdout; access code fed via stdin |

Status is NOT a separate call: the CLI persists `last_success`,
`last_attempt`, `last_dns_check` and `ip` in `config.json`, which the GET
endpoint reads directly.

## Error envelope

All non-2xx responses:

```json
{ "error": { "code": "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "CLI_ERROR" | "INTERNAL", "message": "human-readable", "details": null } }
```

## Conventions

- `GET` endpoints respond in < 5 s (spec SC-001) and never wait on a
  running CLI process.
- Mutations that start long CLI work return immediately and are polled; the
  UI shows progress rather than blocking (exception: POST /api/update
  awaits the run, see above).
- Route handlers validate all input with zod before touching the CLI.
