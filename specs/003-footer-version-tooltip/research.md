# Research: Footer App Version and Tooltip Sync Errors

**Feature**: 003-footer-version-tooltip | **Date**: 2026-08-13

## 1. Version provenance: GitHub release → Docker image → web UI

**Decision**: Pass the release tag directly as a Docker build arg
(`APP_VERSION=${{ github.event.release.tag_name }}`) in the publish
workflow, export it as a runtime env var in the Dockerfile
(`ARG APP_VERSION=dev` + `ENV APP_VERSION=$APP_VERSION`), and read it at
request time in a server-component footer with fallback `dev`.

**Rationale**: The constitution and AGENTS.md pin the version lifecycle:
the image is published to Docker Hub **only** when a GitHub release is
published, and that release is the only place a version is created. On a
`release: published` event, `github.event.release.tag_name` is the exact
released label (e.g. `v1.2.3`), which matches the spec assumption (show
the version as released, keep the `v`). A runtime env read means the
Next.js builder stage does not need the version (non-`NEXT_PUBLIC_` vars
are not inlined at build; verified via context7 Next.js 16 env-var docs),
so local `docker build` without the arg simply falls back to `dev`.

**Alternatives considered**:

- `steps.meta.outputs.version` from `docker/metadata-action`: strips the
  leading `v` (semver normalization) — contradicts "show as released".
- `fromJSON(steps.meta.outputs.json).labels['org.opencontainers.image.version']`
  (README-recommended build-arg pattern): same value as the tag, but adds
  an indirection over the workflow's current action; no benefit here.
- Baking into a generated `version.json`/constant during the image build:
  adds a file + build-stage coupling for no gain over an env var.

## 2. Reading the version at runtime in Next.js 16

**Decision**: The footer is a Server Component. Per the Next.js 16 docs
(retrieved via context7), `await connection()` from `next/server` before
reading `process.env.APP_VERSION` guarantees runtime evaluation; fallback
`process.env.APP_VERSION?.trim() || "dev"`.

**Rationale**: The single page is already `force-dynamic`; `connection()`
is the documented belt-and-braces pattern from the v16 migration notes
("server-only values should be accessed directly in Server Components; to
ensure runtime rather than build-time evaluation use `connection()`").

**Alternative considered**: `NEXT_PUBLIC_APP_VERSION` — rejected: client
bundle inlining at build time, and no client component needs the version.

## 3. shadcn Tooltip component (radix base, radix-nova style)

**Decision**: Add the standard shadcn `tooltip` component via
`npx shadcn@latest add tooltip` and use
`<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>`,
with `TooltipProvider` wrapping the app in the root layout (per shadcn
docs). Replace the native `title` attribute on the truncated error line in
`domain-table.tsx`.

**Rationale**: Verified through the shadcn skill + context7 (`/shadcn-ui/ui`
radix tooltip docs) and the radix-base example (`tooltip-example.tsx`):
`TooltipTrigger asChild` merges onto a keyboard-focusable child, and Radix
opens the tooltip on **both** hover and keyboard focus — satisfying FR-009
without extra wiring. The project (`shadcn@latest info`) is `style:
radix-nova`, `base: radix`, RSC; `radix-ui@^1.6.7` is already in
`package.json`, so the CLI adds the component with **no new npm
dependencies** (Constitution I). `TooltipContent` supports `side`/`sideOffset`
props; long error text gets a `max-w` + word-wrap so multi-line errors stay
readable and the layout intact (FR-008).

**Trigger element**: the current error line is a `<p>` (not focusable).
Decision: `TooltipTrigger asChild` around a reset-styled
`<button type="button">` that looks identical to the current muted
truncated text (inherit font/size/color, `text-left`, `p-0`, transparent
background) — the shadcn-endorsed trigger pattern and properly keyboard-
reachable. Alternative rejected: `<span tabIndex={0}>` — focusable but
semantically inert; button is the documented pattern.

## 4. Footer placement and look

**Decision**: New `webui/src/components/footer.tsx` (server component),
mounted in `webui/src/app/layout.tsx` after `{children}`. The body is
already `min-h-full flex flex-col` and `main` is `flex-1`, so the footer
sits at the bottom without layout changes. Minimal presentation: small
muted centered text (`Version <v>`), matching the existing muted-foreground
style.

**Rationale**: Root layout = one mount point, visible on every page (spec
assumption: only the main page exists today). Server component keeps the
version out of the client bundle (no `NEXT_PUBLIC_`).

## 5. CI/Dockerfile wiring

**Decision**:

- `.github/workflows/docker-image.yml` — build-push-action step gains:
  `build-args: | APP_VERSION=${{ github.event.release.tag_name }}`.
- `Dockerfile` runner stage — `ARG APP_VERSION=dev` + `ENV APP_VERSION=$APP_VERSION`.
- Everything else in both files unchanged (metadata-action already tags
  `:latest` + `:vX.Y.Z` from the release event; labels unchanged).

**Rationale**: Minimal diff (Constitution I); the release workflow is the
only publisher, so a hardcoded build arg outside it would be dead config.
`ARG` default `dev` keeps plain `docker build` and dev workflows working
with no flags.

**Verification gates** (Constitution V): `npm run lint`, `npm run build`
in `webui/`, `docker build -t ionos-domain-connect .` at repo root;
release-flow check (`--build-arg APP_VERSION=test-1`) in `quickstart.md`.
