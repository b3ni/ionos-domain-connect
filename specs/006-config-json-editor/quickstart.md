# Quickstart: Config JSON Viewer/Editor

**Feature**: 006-config-json-editor
**Date**: 2026-08-13

Runnable end-to-end validation guide. Contracts: [contracts/api.md](contracts/api.md) ·
Data model: [data-model.md](data-model.md).

## Prerequisites

- A built image or a dev environment with `CONFIG_PATH` set and a valid
  config file mounted (the file the CLI writes after domain setup).
- Verification gates (Constitution V / AGENTS.md):
  - `docker build -t ionos-domain-connect .` from repo root
  - `npm run lint` inside `webui/`

## Setup (sample config)

```bash
mkdir -p /tmp/ionos-test && cd /tmp/ionos-test
cat > config.json <<'EOF'
{
 "home.example.com": {
   "provider_name": "ionos",
   "url_api": "https://api.hosting.ionos.com/dns/v1",
   "access_token": "aaa.bbb.ccc",
   "refresh_token": "xxx.yyy.zzz",
   "iat": 1723550000,
   "access_token_expires_in": 3600,
   "protocols": ["IPv4"],
   "last_dns_check": 1723550000,
   "last_success": 1723550000,
   "last_attempt": 1723550000,
   "ip": { "IPv4": "1.2.3.4" }
 }
}
EOF
```

Run the web UI against it (`docker run` with `-e CONFIG_PATH=/tmp/.../config.json`
mounted read-write, or `npm run dev` with `CONFIG_PATH=/tmp/ionos-test/config.json
DYNDNS_CLI=/usr/bin/true` for a stub CLI).

## Scenario 1 — View + masking (US1)

1. Open the page, click **Configuración**.
2. **Expected**: domain `home.example.com` renders as expandable JSON;
   `access_token` and `refresh_token` show `••••••`; clicking the eye
   reveals only that value; reload of the section re-masks everything.

## Scenario 2 — Edit + save (US2)

1. In the tree, change `ip.IPv4` to `5.6.7.8`. Click **Save**.
2. **Expected**: success toast; `config.json` on disk contains
   `"IPv4": "5.6.7.8"`; a backup file appears in `BACKUP_DIR`
   (`config.<ts>.json`) with the previous content; `cat config.json` shows
   valid JSON with 1-space indentation (CLI round-trip contract).
3. Trigger a manual update (`Update now`): no errors; the domain list still
   works.

## Scenario 3 — Invalid save rejected (FR-005)

1. Add a stray comma to make the JSON invalid (e.g. `"ip": { "IPv4": "1.2.3.4", }`).
2. Click **Save**. **Expected**: 400 error toast, file on disk unchanged
   (compare checksum before/after: `md5sum config.json`), editor keeps the
   edit so it can be fixed.

## Scenario 4 — Wrong shape rejected (FR-005)

1. Replace the whole content with `["not", "a", "map"]`, save.
2. **Expected**: 400 error, file untouched.

## Scenario 5 — Concurrent change conflict (FR-008)

1. Load the section, then `sed -i 's/5.6.7.8/9.9.9.9/' config.json` (simulate
   the CLI rewriting the file mid-edit).
2. Save from the UI. **Expected**: 409 error telling you the file changed;
   neither version lost; reloading shows the disk version.

## Scenario 6 — Repair a corrupt file (US3)

1. `echo "{ broken json" > config.json`.
2. Open **Configuración**. **Expected**: raw content shown in a textarea
   with a "not valid JSON" message — not the generic read error.
3. Fix the content to a valid domain map, save. **Expected**: section and
   the main list recover; next scheduled/manual update succeeds.

## Scenario 7 — Missing file (edge case)

1. Move `config.json` away. Open **Configuración**. **Expected**: clear
   "file does not exist" explanation; the Save path is disabled/404s
   (creation is out of scope); restoring the file brings the section back.

## Final gates

- `npm run lint` (webui/) — no new warnings.
- `docker build -t ionos-domain-connect .` — build passes.
- Manual sweep: theme toggle light/dark keeps the tree readable; keyboard
  navigation of the tree (arrows/enter) works; section renders on narrow
  viewports without horizontal page overflow.
