# Quickstart: Validate Sortable Domain List

**Feature**: 008-sort-domain-list | **Date**: 2026-08-13

Goal: prove the feature works end-to-end. There is no automated test
framework in this project — validation is a mix of build/lint gates and
manual functional checks. See [contracts/ui-sorting.md](contracts/ui-sorting.md)
for the exact behavior being validated and [data-model.md](data-model.md)
for sort semantics.

## Prerequisites

- Node/npm in `webui/` with dependencies installed (`npm install`).
- The `domain-connect-dyndns` CLI is not needed for pure sorting checks,
  but the web UI's instrumentation starts the scheduler on `npm run dev`,
  so the CLI must be on PATH with a valid config, or use `npm run build &&
  npm start` (standalone) with `ENABLE_WEBUI=true` as in the container.
- A `config.json` with at least 4 domains in mixed state so every column
  has discriminating values. Recommended fixture (mount or set
  `CONFIG_PATH` to it):

```json
{
  "home.example.com": {
    "ip": { "IPv4": "10.0.0.1" },
    "last_success": 1789000000,
    "last_attempt": 1788950000
  },
  "api.example.com": {
    "ip": { "IPv4": "10.0.0.2" },
    "last_success": 1788900000,
    "last_attempt": 1789000000,
    "last_error": "Failed to get async token: 400 invalid_request NOTFOUND_SESSION"
  },
  "old.example.com": {
    "ip": { "IPv4": "10.0.0.3" },
    "last_success": 1780000000
  },
  "staging.example.com": {
    "ip": { "IPv6": "2001:db8::1" }
  },
  "never.example.com": {}
}
```

This fixture covers: 3 distinct statuses (ok: `home`/`old`, error: `api`,
pending: `staging`/`never`), distinct timestamps, an IPv6-only row, and a
row with no data at all (null timestamp, null IP, "Pending" badge).

## Verification commands (constitution gate)

```bash
cd webui && npm run lint          # ESLint passes
cd webui && npm run build         # TypeScript + Next build passes
docker build -t ionos-domain-connect .   # repository verification gate
```

## Manual functional validation

Run the UI (`npm run dev` in `webui/` with `CONFIG_PATH` pointing at the
fixture, or the Docker image with `ENABLE_WEBUI=true` and the fixture
mounted at `/config.json`), then:

1. **Default order** — Reload the page: rows appear alphabetical by name
   (`api, home, never, old, staging`), the Domain header shows the sort
   indicator (up arrow). [SC-001, FR-004]
2. **Toggle direction** — Click "Domain" again: order flips to `staging,
   old, never, home, api`, indicator flips to down arrow. Click again:
   back to ascending. [FR-002, SC-002]
3. **Sort by Last update** — Click "Last update": oldest first
   (`old` 2026-05-28 … `home` 2026-09-10); `never` and `staging` (no
   timestamp) appear **last** regardless of direction; click again →
   newest first, still with the two null rows last. [FR-006, SC-004]
4. **Sort by Current IP** — Click "Current IP": `10.0.0.1, 10.0.0.2,
   10.0.0.3, 2001:db8::1`, then `never` (no IP) last; flip direction and
   confirm `never` stays last. [FR-007, SC-004]
5. **Sort by Status** — Click "Status": groups appear in order Up to date
   (`home`, `old`) → Pending (`staging`, `never`) → Update failed (`api`).
   Flip direction and confirm the group order inverts but the Pending
   group stays together (rows without recorded state ride with Pending,
   matching their badge). [FR-008]
6. **Sort survives refresh** — With "Status" active and descending, click
   "Update now": the list re-renders with fresh data but keeps Status
   descending order and the indicator. [FR-009]
7. **Stable ties** — Sort by Current IP where `home` and `api` would tie
   if they shared an IP: relative order among equal values does not
   visibly jump between clicks. [FR-005 tie rule]
8. **Keyboard & screen reader** — Tab to a header button, activate with
   Enter/Space: sort applies. With a screen reader (or inspecting the
   DOM), the active `<th>` carries `aria-sort="ascending"|"descending"`;
   inactive sortable headers carry `aria-sort="none"`. [Accessibility
   contract]
9. **Edge cases** — (a) A config with exactly one domain: sorting does not
   error, row stays. (b) Empty config (`{}`): page shows the empty state,
   no sort errors. [FR-012]
10. **Data integrity** — After any sort, use the per-row refresh/remove
    actions: they act on the domain of the row they appear in, not on a
    shifted row. `config.json` on disk is byte-identical. [FR-010]

## Expected outcome

All commands above exit 0 (lint/build/docker) and every manual scenario
produces the stated ordering; the contract in
[contracts/ui-sorting.md](contracts/ui-sorting.md) is fully satisfied.
