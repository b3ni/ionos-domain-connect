# Specification Quality Checklist: Fix "is not managed" Error When Adding a Domain

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation passed on first pass. Diagnosis grounded in the code:
  the guard `if (!isManaged(parsed.data.domain)) throw NOT_FOUND "<domain>
  is not managed."` was added to `POST /api/domains/[domain]/setup` in
  commit dabe2d2 (feature 005, re-setup); the shared AuthorizationDialog
  (feature 005) submits the add flow's access code through this same
  endpoint, where the domain is not yet in the config by design — the CLI
  writes it only when setup completes (`webui/src/lib/setup-session.ts`
  `startSetupSession`; `webui/src/lib/domains.ts` `isManaged` reads the
  config file).
- The design decision (active session bypasses the config check, no
  session → config check applies) satisfies both US1 and US2 without
  weakening feature 005's protection; the session map is the source of
  truth for in-progress flows.
- The fix is surgical: only the decision logic of the shared endpoint
  changes; no CLI, config format, or UI changes.
