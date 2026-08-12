<!--
Sync Impact Report
- Version change: (unfilled template) → 1.0.0
- Modified principles: none (first ratification; template placeholders replaced with real principles)
- Added sections: 5 Core Principles, "Constraints: Deployment & Publishing", "Development Workflow", "Governance"
- Removed sections: none
- Deferred TODOs: none
-->

# ionos-domain-connect Constitution

## Core Principles

### I. Simplicity (Minimum Engineering)

Every spec, plan, and implementation MUST favor the simplest solution that
works. No extra dependencies, abstractions, frameworks, or configuration
layers MAY be added unless a concrete requirement justifies them. Unneeded
features MUST be deferred (YAGNI), never speculated about. Rationale: the
project is a minimal Docker utility whose entire app is a single small
script; over-engineering is its main failure mode.

### II. Code-Grounded Specs (codebase-memory-mcp)

At the start of every spec, the `codebase-memory-mcp` project MUST be indexed
(if not already), and its graph tools (`search_graph`, `trace_path`,
`get_code_snippet`, `get_architecture`) MUST be the primary reference
mechanism while the spec is elaborated. Grep/glob are allowed ONLY as a
fallback for string literals and non-code files. Rationale: specs must
describe the real code and its wiring, not assumptions about it.

### III. Library-Aware Plans (context7)

While a plan is being elaborated, `context7` MUST be consulted for every
library the plan will use (API surface, current version, usage patterns)
before committing to an approach. Library details MUST NOT be written from
memory alone. Rationale: this codebase relies on upstream tools
(`domain-connect-dyndns`, `apscheduler`) whose interfaces change; plans must
match current reality.

### IV. Frontend Design Standards

When a plan involves frontend work, the following skills MUST be loaded and
their guidance followed: `web-design-guidelines` (UI/a11y compliance review),
`nextjs-best-practices` (App Router patterns), and `shadcn-ui` (component
library patterns). Custom hand-rolled components MUST NOT replace shadcn/ui
conventions without justification. Rationale: enforced skills keep UI work
consistent, accessible, and fast to build.

### V. Direct Verification

Every change MUST be verified with the project's real verification gate —
currently a successful `docker build -t ionos-domain-connect .`. Inventing
test frameworks, linters, or typecheckers that the project does not have is
prohibited; when the gate is a build, the build MUST pass.

## Constraints: Deployment & Publishing

- The image is published to Docker Hub (`b3ni/ionos-domain-connect`,
  linux/amd64 + linux/arm64) ONLY by creating a GitHub release; the Actions
  workflow triggers on release publish, not on push. Local commits never
  build or publish the image.
- Publishing requires the `DOCKERHUB_USERNAME` and `DOCKERHUB_PASSWORD`
  repo secrets; missing secrets are a release blocker, not a code problem.
- `config.json` (mounted at `/config.json`) holds IONOS credentials after
  interactive setup and MUST NEVER be committed; it is gitignored.
- Python dependencies are declared ONLY in the `Dockerfile`
  (`pip install domain-connect-dyndns apscheduler`); there is no
  `requirements.txt`.

## Development Workflow

- Features follow the Spec Kit flow, in order, each gated by approval:
  `/speckit.specify` (spec) → `/speckit.plan` (plan) → `/speckit.implement`
  (code). No phase starts until the previous one is approved by the user.
- The spec phase MUST index the project with `codebase-memory-mcp` first
  (Principle II); the plan phase MUST consult `context7` and the frontend
  skills (Principles III and IV).
- Before implementation, the plan MUST state the exact verification
  command(s); the implementer MUST run them and report results.
- `.specify/` (speckit scaffolding templates) and `.opencode/` (local
  OpenCode commands plugin) are NOT part of the application and MUST NOT be
  treated as product code.

## Governance

- This constitution supersedes all other practices; conflicts resolve in
  favor of the constitution.
- Amendments: propose the change, document it in this file, bump the
  version per the policy below, and record the amendment date. Substantive
  changes require user approval.
- Versioning: MAJOR for removal/redefinition of principles; MINOR for new
  principles or materially expanded guidance; PATCH for clarifications and
  wording fixes.
- Compliance: each spec, plan, and code review MUST check adherence to
  Principles I–V and to the constraints; violations are review blockers.

**Version**: 1.0.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-08-12
