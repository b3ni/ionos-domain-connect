# Data Model: Fix "is not managed" Error

**Feature**: 007-fix-add-setup-guard
**Date**: 2026-08-13

No new entities — the fix changes a decision rule between two existing
entities. Documented here to make the rule explicit and testable.

## 1. SetupSession (existing, unchanged)

The in-memory authorization state per domain (module-level map in
`webui/src/lib/setup-session.ts`, 15-minute timeout, lost on restart).

| Field | Type | Notes |
|-------|------|-------|
| `domain` | string | the domain being authorized |
| `state` | `"awaiting_authorization" \| "completed" \| "failed"` | drives the dialog |
| `authUrl` | string \| null | consent URL scraped from CLI stdout |
| `error` | string \| null | set when `state === "failed"` |

**Creation**: add flow via `POST /api/domains`; re-setup via
`POST /api/domains/[domain]/setup` (no code).
**Presence rule**: a session exists for the whole lifetime of either flow.

## 2. DomainConfigEntry (existing, unchanged)

The domain's record in the config file (`webui/src/lib/config-store.ts`).

**Key timing fact**: during the ADD flow's authorization phase the domain
is NOT in the config — the CLI writes the entry only when `setup`
completes ("successfully configured"). During the RE-SETUP flow it IS
present (the flow exists because its session went stale).

## 3. Decision rule (the fix — FR-003)

`POST /api/domains/[domain]/setup` request classification:

```
                     GET session(domain)
                     │
          ┌──────────┴───────────┐
          ▼                      ▼
    session EXISTS          session MISSING
          │                      │
          ▼                      ├── isManaged(domain)?
          │                      │   ├── yes → startSetupSession
          │                      │   └── no  → 404 "is not managed."  (unchanged)
          │
          ├── body has code → submitAccessCode
          └── body has no code → startSetupSession (re-setup entry)
```

Stateful outcomes (delegated to existing functions, unchanged):

| Case | Outcome |
|------|---------|
| session awaiting + code submitted (add flow) | code reaches the CLI ✓ (the fix) |
| session awaiting + no code | session continues (re-setup start) |
| session failed/completed + code submitted | `CONFLICT` "Setup … is not awaiting an access code." |
| session failed/completed + no code | `CONFLICT` "A setup for … is already in progress." |
| no session + managed + no code | new session starts (005 behavior) |
| no session + managed + code | `NOT_FOUND` "No setup session … Start the setup again." (existing) |
| no session + not managed | `NOT_FOUND` "<domain> is not managed." (005 protection, unchanged) |

**Validation rules**: only the existing `domainParamSchema` /
`setupCodeSchema` apply — no new validation is introduced.
