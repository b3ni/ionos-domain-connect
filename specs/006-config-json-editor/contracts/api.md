# API Contract: Config Viewer/Editor

**Feature**: 006-config-json-editor
**Date**: 2026-08-13

Internal HTTP contract of the web UI (served by the standalone Next.js
server). Follows the existing conventions of `api/domains` /
`api/update`: `export const dynamic = "force-dynamic"`, errors via
`appError` → `errorResponse` (see `webui/src/lib/errors.ts`).

Errors are returned as:

```json
{ "error": { "code": "<CODE>", "message": "<human text>", "details": null } }
```

Codes reused from the existing set — no new codes introduced:

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION` | 400 | invalid JSON or wrong shape |
| `CONFLICT` | 409 | file changed on disk since load |
| `NOT_FOUND` | 404 | config file does not exist |
| `INTERNAL` | 500 | read/write/backup I/O failure |

## GET /api/config

Reads the config file and returns its state. Never fails on unreadable
content — that is a *state*, not an error (repair flow, spec US3).

**Response 200** — `ConfigFileView` (see data-model.md §1):

```json
{
  "path": "/config.json",
  "exists": true,
  "raw": "{\n \"home.example.com\": {...}\n}",
  "parsed": { "home.example.com": { "provider_name": "...", "access_token": "...", "ip": { "IPv4": "1.2.3.4" } } },
  "parseError": null
}
```

| `exists` | `raw` | `parsed` | `parseError` | Meaning |
|----------|-------|----------|--------------|---------|
| true | content | object | null | ok — render tree |
| true | content | null | "not valid JSON …" | unreadable — repair mode |
| false | null | null | null | missing — explanation card |

## PUT /api/config

Replaces the whole config file after validation. Idempotent overwrite.

**Request body**:

```json
{ "raw": "{ ...new content... }", "baseRaw": "{ ...content as loaded... }" }
```

- `raw` — required, string. New file content.
- `baseRaw` — required, string or null (null only if the file was missing
  when loaded).

**Success 200** — `SaveResult` (data-model.md §4):

```json
{ "path": "/config.json", "savedAt": 1723550000, "backupPath": "/backups/config.1723549999.json" }
```

`backupPath` is null only when the file did not exist at save time (which
cannot happen — see 404 below — and is therefore always present in
practice).

**Error responses**:

- `400 VALIDATION` — `raw` is not valid JSON, or parses to a non-object
  (array / null / primitive), or keys empty. The file is NOT touched.
- `404 NOT_FOUND` — config file does not exist on disk. Creating the file
  from scratch is out of scope; the CLI creates it during domain setup.
- `409 CONFLICT` — disk content differs from `baseRaw`. The file is NOT
  overwritten; the client must reload and re-apply edits.
- `500 INTERNAL` — backup copy or write failed (permissions, disk).

**Server-side processing order** (guarantees FR-005/FR-007/FR-008):

1. `JSON.parse(raw)` → 400 on failure.
2. Shape check (plain object, non-empty string keys) → 400 on failure.
3. Read current disk content; if it differs from `baseRaw` (and `baseRaw`
   is not null) → 409.
4. If the file currently exists: copy to `BACKUP_DIR/config.<ts>.json`
   (recursive mkdir) → 500 on failure.
5. Atomic write: temp file + rename in the config directory → 500 on
   failure.
6. Re-serialize with `JSON.stringify(parsed, null, 1)` (CLI indent-1
   contract, same as `writeConfig`).

## Client behavior summary

| Server | Client |
|--------|--------|
| 200 GET | render tree (masked) or repair textarea or missing card |
| 200 PUT | sonner success toast; dirty cleared; section shows saved state |
| 400 | sonner error with message; editor keeps user's edits |
| 409 | sonner error; offer "reload" (refetch GET, discard edits) |
| 404 | sonner error; show missing-file explanation |
| 500 | sonner error; edits kept |
