# Data Model: Actionable Domain Re-Setup

**Feature**: 005-domain-resetup-flow | **Date**: 2026-08-13

## Entities

No new persistent entities, no schema change. Re-setup replaces a Managed
Domain's stored authorization entry (existing CLI `setup` behavior) and
reuses the existing Setup Session flow.

### Managed Domain (existing)

Unchanged schema. Re-setup (via the CLI `setup` command) replaces the
entry with a fresh authorization: `last_error` is cleared (fresh start,
consistent with 002 research), `last_success`/`last_attempt` reset. The
domain's name and DNS records are untouched.

### Setup Session (existing, reused)

The in-memory session from `webui/src/lib/setup-session.ts`:
`awaiting_authorization → completed | failed`, 15-minute timeout, one
session per domain (409 on conflict). Reused unchanged by the new POST
handler and the shared dialog. No new fields.

### Known Failure Signature (existing, reused)

Display-time classification ("Failed to get async token" /
"NOTFOUND_SESSION") in `domain-table.tsx` — now drives the actionable
re-setup trigger.

## State transitions

| Transition | Trigger | Effect |
|------------|---------|--------|
| re-setup started | row trigger → dialog → POST `[domain]/setup` (no code) | session `awaiting_authorization`; CLI `setup` child spawned |
| code submitted | dialog → POST `[domain]/setup` `{code}` | code sent to CLI; dialog polls until terminal state |
| authorization approved | CLI finishes with "successfully configured" | session `completed`; dialog auto-closes + success toast + refresh (+ US3: per-domain update) |
| authorization fails | CLI error / timeout / wrong code | session `failed`; dialog shows the error |
| re-setup while session in progress | dialog reopened / re-triggered | 409 CONFLICT message; existing session undisturbed |

## Consistency & concurrency

- One session per domain (existing `Map` + CONFLICT guard) — unchanged.
- The add flow keeps rejecting managed domains (`POST /api/domains`,
  409); the re-setup flow requires the domain to be managed (404
  otherwise). The two contracts are disjoint.
- Setup and update CLI processes may overlap as today (pre-existing
  behavior, unchanged — noted in spec assumptions); the dialog's
  auto-update (US3) goes through the existing per-domain update endpoint
  and its lock.

## Read model (API surface)

`SetupSessionView` unchanged. New: `POST /api/domains/[domain]/setup`
returns the same `SetupSessionView` shape as the existing GET (and as the
add flow's POST).
