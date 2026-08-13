# Research: Actionable Domain Re-Setup

**Feature**: 005-domain-resetup-flow | **Date**: 2026-08-13

## 1. Root cause of the "dialog never shows completion" bug (Q1 context)

**Decision**: Fix the completion detection in the shared authorization
dialog; the fix is part of this feature (Q2: shared delivery, no hotfix).

**Diagnosis** (verified in `webui/src/components/add-domain-form.tsx`):

- `pollSession()` returns as soon as `session.authUrl` is set
  (line 32: `if (session.authUrl || session.state !== "awaiting_authorization")`).
- `submitCode()` calls `pollSession(domain, () => false)` right after
  submitting the code — but the auth URL is already present at that point,
  so the FIRST poll returns the same "awaiting_authorization" view and the
  loop never reaches the "completed" state.
- The `useEffect` that polls also returns early while `authUrl` is set
  (line 53-59), so nothing re-polls afterwards.
- Net effect: the CLI finishes and configures the domain ("parece que todo
  es ok") but the dialog stays on the authorization view with zero
  feedback — until the 15-minute session timeout or a manual close.

**Fix**: parameterize the poll with an `until(session)` predicate:
- Phase A (waiting for the URL): `until = s => !!s.authUrl` (current
  behavior).
- Phase B (after code submission): `until = s => s.state !==
  "awaiting_authorization"` — poll every 1.5 s until completed/failed.
- On `completed`: `toast.success(\`${domain} configured.\`)` + auto-close
  + `onCompleted()` (FR-012, SC-006). On `failed`: show the error state in
  the dialog (existing).

**Alternatives considered**: leaving the flow as-is with a visible "Done"
button — rejected by clarification Q1 (auto-close + toast, no extra click);
a setTimeout-based delay before polling — fragile, rejected.

## 2. Shared dialog extraction

**Decision**: Extract the authorization journey (authorization URL,
access-code input, submit, poll-until-done, success/failure feedback) into
a new `AuthorizationDialog` component in
`webui/src/components/authorization-dialog.tsx`, parameterized by
`domain` and an `onCompleted` callback.

**Rationale**: The add flow and the re-setup flow are the same dialog once
the domain is known; the only differences are (a) how the dialog is opened
(form input vs. row trigger), (b) an explanation block in re-setup mode,
(c) what happens on completion (refresh only vs. refresh + per-domain
update). One component avoids the 004-style drift risk and keeps the bug
fix in a single place (Constitution I).

**Decision details**:

- `AuthorizationDialog` props: `{ domain, open, onOpenChange,
  explanation?, onCompleted }`. Internally it runs the setup session
  (start on open via POST), shows URL + code input, polls with the fixed
  `until` predicate, auto-closes with a success toast on completion.
- `AddDomainForm` keeps the domain-input step ("Start setup") and then
  renders `AuthorizationDialog` for the started session.
- `ReauthorizeDomainButton` (per row) renders the trigger + dialog in
  re-setup mode with the explanation text (US2).

## 3. Re-setup endpoint: POST /api/domains/[domain]/setup

**Decision**: Add a `POST` handler to the existing
`webui/src/app/api/domains/[domain]/setup/route.ts`:
- Body `{ code?: string }` — absent/empty → `startSetupSession(domain)`;
  present → `submitAccessCode(domain, code)` (mirrors `POST /api/domains`).
- Guards: `domainParamSchema` (400 VALIDATION); `isManaged(domain)` MUST be
  true (404 NOT_FOUND otherwise) — re-setup is only for existing domains;
  `startSetupSession` already surfaces `409 CONFLICT` for an in-progress
  session.
- Response: the `SetupSessionView` JSON (200; 201 semantics not needed).
- `GET` (polling) unchanged.

**Rationale**: `POST /api/domains` rejects managed domains
(`api/domains/route.ts:35-37`) — by design for the add flow. The re-setup
flow needs the inverse contract on a domain-scoped path; placing it on the
existing `[domain]/setup` route keeps the session API in one file
(Next.js async-params pattern verified via context7 in the previous
feature).

**Alternatives considered**: reusing `POST /api/domains` with a bypass
flag — rejected (muddies the add contract); a new `[domain]/reauth` route
— rejected (redundant; setup IS the reauth).

## 4. Actionable entry point (US1)

**Decision**: In `webui/src/components/domain-table.tsx`, the
NOTFOUND_SESSION hint becomes a reset-styled `<button>` (same visual
pattern as the error-line trigger: muted text, hover color, focus ring)
labelled `Run setup again for this domain.` that opens the re-setup dialog
via `ReauthorizeDomainButton` (per-row instance, like `RemoveDomainButton`).

**Rationale**: Only rows with the known signature get the trigger (FR-001,
FR-004); the pattern mirrors the existing per-row action components; the
button is keyboard-reachable (FR-011, a11y).

## 5. US2 — explanation copy (plain language)

**Decision**: The re-setup dialog shows a short explanation block above the
authorization link (re-setup mode only):

- "This domain's connection authorization has expired or was replaced on
  the provider side, so updates now fail."
- "Re-authorizing reconnects the domain. It does not remove the domain and
  does not change its DNS records."

**Rationale**: Directly answers "qué es eso de setup again?"; static text,
no storage, no credentials (FR-004, FR-010).

## 6. US3 — automatic per-domain update after re-setup (P2)

**Decision**: `ReauthorizeDomainButton`'s completion handler runs the
per-domain update (the same call as `RefreshDomainButton`:
`POST /api/domains/[domain]/update`) and then refreshes the list.
Sequence: success toast (dialog) → POST update → list refresh → outcome
toast from the update call (reuses `RefreshDomainButton`'s logic).

**Rationale**: Closes the loop without waiting up to `INTERVAL_UPDATE`
seconds (SC-004); reuses the 004 endpoint and its lock (a concurrent run
surfaces the existing 409 message).

**Alternative considered**: waiting for the next scheduled tick —
rejected: no immediate confirmation that the fix worked.

## 7. Library documentation consulted (context7 / skills) — Constitution III

- **sonner** (`/emilkowalski/sonner`): `toast.success(message, { description,
  duration })`; default duration 4000 ms; `toast.error` for failures —
  matches the repo's existing usage in `update-now-button.tsx`.
- **Next.js** (`/vercel/next.js`, verified in the 004 plan): route handlers
  take `{ params }: { params: Promise<{ domain: string }> }` (awaited);
  try/catch + safe messages via `errorResponse`.
- **shadcn/ui** (skill loaded; repo usage): `Dialog` needs `DialogTitle`
  (a11y); `Button` has no loading prop — compose `Loader2` + `disabled`;
  icon-only buttons need `aria-label`.

## 8. Verification gates

`npm run lint`, `npm run build` in `webui/`, `docker build -t
ionos-domain-connect .` at root (Constitution V); manual validation per
`quickstart.md` — including the add-flow regression check (the bug fix must
be verified end-to-end).
