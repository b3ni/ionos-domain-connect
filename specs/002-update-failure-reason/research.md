# Research: Update Failure Reason + Domain Link

**Feature**: 002-update-failure-reason | **Date**: 2026-08-12

## 1. Persistence of the failure reason

**Decision**: Store the failure reason as a custom per-domain key `last_error`
inside the existing `config.json`, written by the web UI after each update
run. Do NOT introduce a separate state file.

**Rationale**: Verified against `domain-connect-dyndns` 0.0.9 source
(`dyndns/domain_update.py`, `domain_setup.py`, `domain_remove.py`): every
CLI command that writes the config does `json.load(file)` → mutate → 
`json.dump(config, sort_keys=True, indent=1)`, i.e. it **round-trips the
entire dict and preserves unknown keys**. Therefore a `last_error` key we
add is carried through by every subsequent CLI update/remove. Benefits:

- Atomic with the status source (`last_attempt`/`last_success` live in the
  same file), so the reason and the badge can never diverge.
- Survives restarts for free (spec SC-003).
- Removal cleanup is free: `remove` pops the whole domain entry, taking
  `last_error` with it (spec FR-006).
- No new Docker volume mounts, no new dependencies (Constitution I).

**Alternatives considered**:

- Separate sidecar state file (e.g. `/state/errors.json`): rejected — adds
  a second source of truth, explicit cleanup on domain removal, and a new
  mount; the CLI round-trip already makes it unnecessary.
- In-memory only: rejected — violates SC-003 (persistence across restarts).
- Derived from logs: rejected — no reliable correlation to domain/attempt.

**Caveats**:

- `setup` replaces the domain's entry with only its own fields, so a
  re-setup of the same domain wipes `last_error`. Acceptable: re-setup is a
  fresh start.
- The CLI writes with `sort_keys=True, indent=1`; the web UI writer should
  mimic `indent=1` formatting to keep diffs minimal (ordering is irrelevant
  to the CLI, which re-sorts on its next write).
- The web UI only writes after the CLI child process has exited (the
  `close` event in `runCli`), so there is no read-modify-write race with
  the CLI.
- Headless mode (`src/updater.py`) does not capture reasons (no UI there);
  a domain that failed while headless shows the generic fallback text in
  the web UI. Documented in data-model + spec assumptions.

## 2. Failure reason extraction from CLI output

**Decision**: Extract the reason per domain from the CLI's stdout/stderr
block between the `Read <domain> config.` marker and the next domain's
marker, using the existing `lastMeaningfulLine`-style filtering, then
redact token values. Fall back to a fixed generic message when no usable
text exists.

**Rationale**: Verified against `domain_update.py` 0.0.9: on a failed
update the CLI does `except DomainConnectException as e: ... print(e)` and
returns `"Could not update DNS records."`. The `print(e)` output (usually
a single `DomainConnectException` message, e.g. HTTP status from the
provider, token/consent errors) is the real failure reason and lands on
stdout inside the failing domain's block. The existing
`outcomeForDomain()` already slices exactly that block to classify the
outcome; the same slice yields the reason.

Extraction rules:

1. Slice the per-domain block (same marker logic as `outcomeForDomain`).
2. Collect "meaningful" lines (trimmed, non-empty, excluding `***` banner,
   `Traceback`, `File ...`, `^` caret frames) from stderr first, then
   stdout — mirrors `lastMeaningfulLine` (`webui/src/lib/dyndns.ts:34`).
3. Exclude the known status/classifier strings themselves
   ("DNS records successfully updated.", "All records up to date",
   "Could not update DNS records.", "not configured",
   "configured incorrectly") so the reason holds only the detail.
4. Take the last remaining line as the reason; cap length (e.g. 500
   chars) for display safety (FR-009).
5. Redact the domain's `access_token` and `refresh_token` values from the
   text before storing (FR-008). Cheap exact-match replacement; tokens are
   not expected in error output, but the requirement is absolute.
6. If nothing remains → fallback: `Update failed. No error details
   reported by the updater.` (FR-007).

**Alternatives considered**:

- Capture full stdout for the domain: rejected — noisy multi-line
  tracebacks offer no value; the single last meaningful line is the CLI's
  own error summary.
- Categorize/translate error kinds (e.g. "auth", "network"): rejected —
  speculation over the upstream CLI's evolving messages (AGENTS.md notes
  this coupling is brittle already); raw text with fallback is honest and
  minimal (Constitution I).

## 3. Web UI: showing the reason

**Decision**: Extend `DomainView` (`webui/src/lib/domains.ts`) with
`lastError: string | null` read from the config entry. In `DomainTable`,
render a muted, truncated detail line under the domain name when
`lastResult === "error"`, with the full text available on hover. When
status is `error` but `lastError` is null (headless-era failure), render
the same generic fallback text.

**Rationale**: The badge is derived from timestamps (`toView`), so the
reason must render wherever the error state renders. Truncation (CSS
line-clamp + `title`) satisfies FR-009 (long reasons must not break the
layout; full text readable).

**Alternative considered**: tooltip/expandable row only — rejected: hidden
interaction violates the spec's "without additional clicks" (FR-003) and
the single-page simplicity principle.

## 4. Web UI: domain opens live website in a new tab

**Decision**: In the domain name cell of `DomainTable` (client component),
render a plain anchor `<a href="https://{domain}" target="_blank"
rel="noopener noreferrer">`. No `next/link`.

**Rationale**: Verified via context7 (Next.js 16.1.6 docs + official
create-next-app template): external URLs are served with a plain `<a>` and
`target="_blank"` + `rel="noopener noreferrer"`; `next/link` only handles
client-side transitions for local URLs. `noopener noreferrer` is the
security baseline for new-tab external links.

**Alternatives considered**: `next/link` with the external href — rejected
(no client-side benefit, `isLocalURL` check makes it a full navigation
anyway); making the whole row clickable — rejected (conflicts with the
remove action column; spec assumption: only the domain name is the link).

## 5. Next.js / App Router constraints

**Decision**: No new libraries. Changes are confined to existing modules:
`webui/src/lib/dyndns.ts` (capture + persist), `webui/src/lib/config-store.ts`
(reason write helper), `webui/src/lib/domains.ts` (view model),
`webui/src/components/domain-table.tsx` (reason line + link).

**Rationale**: Next.js 16 breaking-change warnings in `webui/AGENTS.md`
apply to new App Router APIs; here only a client-component table cell is
touched. Per Constitution IV, the implementation phase must load
`web-design-guidelines`, `nextjs-best-practices`, and `shadcn-ui` skills
for the UI work.

**Verification gates** (Constitution V): `npm run lint`, `npm run build`
in `webui/`, and `docker build -t ionos-domain-connect .` at repo root.
