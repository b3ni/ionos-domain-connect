# Data Model: Config JSON Viewer/Editor

**Feature**: 006-config-json-editor
**Date**: 2026-08-13

Entities derived from spec requirements (FR-002 … FR-009). The on-disk
format is an external contract owned by the `domain-connect-dyndns` CLI —
this feature never changes it.

## 1. ConfigFile (view state)

What `GET /api/config` returns; drives the whole section UI.

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Absolute path of the file (`CONFIG_PATH`), shown to the user |
| `exists` | boolean | Whether the file exists on disk |
| `raw` | string \| null | The exact file content as text; `null` if missing. **Always** returned raw so the repair mode (US3) works on unreadable content |
| `parsed` | object \| null | Domain map (see §2) when the content is valid JSON and a plain object; `null` otherwise |
| `parseError` | string \| null | Human-readable explanation when `parsed` is null (invalid JSON message, empty file, wrong shape, unreadable) |

**States**:

| State | Condition | UI |
|-------|-----------|-----|
| `ok` | exists && parsed != null | tree viewer (masked) |
| `unreadable` | exists && parseError (invalid JSON / not an object) | raw textarea repair mode |
| `missing` | !exists | explanatory card (creation out of scope) |

**Validation rules (FR-005, applied on save)**:
- Content must parse as JSON (`JSON.parse`).
- Parsed value must be a plain object: not `null`, not an array, not a
  primitive.
- Keys are JSON object keys (always strings) and must be non-empty.
- No per-value schema checks — unknown/edge fields must round-trip
  unchanged (spec edge cases); the CLI is the content authority.

## 2. DomainConfig (the domain map)

Unchanged shape, already typed as `DomainConfig` in
`webui/src/lib/config-store.ts`:

```
Record<string, DomainConfigEntry>
```

| Field (entry) | Type | Sensitive |
|---------------|------|-----------|
| `provider_name` | string | no |
| `url_api` | string | no |
| `access_token` | string | **yes — masked (FR-003)** |
| `refresh_token` | string | **yes — masked (FR-003)** |
| `iat`, `access_token_expires_in`, `last_dns_check`, `last_success`, `last_attempt` | number | no |
| `last_error` | string | no |
| `protocols` | string[] | no |
| `ip` | Record<string,string> | no |

Unknown fields: preserved and displayed; never dropped or re-schematized.

**Masking rule**: string values of the keys `access_token` and
`refresh_token` (at any depth) are masked on display; revealing is
per-value, ephemeral, and reverted on section reload (FR-003, SC-006).

## 3. SaveRequest

`PUT /api/config` body:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw` | string | yes | The new file content (client sends `JSON.stringify(state, null, 1)` from the tree, or the textarea text in repair mode) |
| `baseRaw` | string \| null | yes | The `raw` value the client loaded; `null` only if the file did not exist at load. Optimistic concurrency token (FR-008) |

## 4. SaveResult

`PUT /api/config` 200 response:

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Where the file was written |
| `savedAt` | number | Unix timestamp of the write |
| `backupPath` | string \| null | Path of the timestamped backup copy (null only if the file did not previously exist — see state transition) |

## 5. ConfigBackup

A copy of the file content taken **immediately before** every overwrite
(FR-007, SC-004), stored at:

```
BACKUP_DIR/config.<unix-ts>.json     (e.g. /backups/config.1723550000.json)
```

- Directory created recursively if absent (`mkdirSync recursive`).
- Timestamped name → never collides with a previous backup.
- Restore-from-UI is explicitly out of scope (spec Assumptions); backup is
  for manual/CLI recovery.

## State transitions

```
        GET /api/config
              │
              ▼
   ┌──────────┴───────────┐
   │ load state (raw+parsed) │
   └──────────┬───────────┘
              │ user edits tree / textarea
              ▼
         (dirty) ──► PUT {raw, baseRaw}
                        │
          ┌─────────────┼──────────────────┐
          ▼             ▼                  ▼
     400 VALIDATION  409 CONFLICT       200 saved
     (bad JSON /      (disk changed      (backup + atomic
      wrong shape,     since load;       write; UI confirms;
      file untouched)  reload to fix)    list keeps working)
```

- On 400: file untouched, editor keeps the user's edits, error shown.
- On 409: file untouched on the save path; UI offers to reload, discarding
  in-editor changes (both copies preserved — spec US2 scenario 4).
- On 200: UI confirms via sonner toast; dirty flag cleared.
- PUT when the file does not exist → 404 NOT_FOUND (repair ≠ create; scope
  boundary from spec Assumptions).
