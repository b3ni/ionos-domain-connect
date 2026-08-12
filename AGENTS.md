# AGENTS.md

## What this is

A small Docker image that keeps IONOS/1&1 dynamic DNS entries updated by running the upstream `domain-connect-dyndns` CLI on a schedule. The entire app is `src/main.py` (~27 lines). There are no tests, no linter, no typecheck — the only verification is a successful Docker build.

## Build & deps

- Build: `docker build -t ionos-domain-connect .` (context is repo root).
- Python dependencies are declared **only** in the `Dockerfile` (`pip install domain-connect-dyndns apscheduler`) — there is no `requirements.txt`. Add new deps to that line, then rebuild.
- `src/main.py` uses APScheduler `BlockingScheduler` to run `domain-connect-dyndns --config /config.json update --all` every `INTERVAL_UPDATE` seconds (env var, default 60). Note: the job function is named `train_model`; it is unrelated to ML.

## Runtime behavior

- `config.json` is mounted at `/config.json` (declared `VOLUME`). It is gitignored because it holds IONOS credentials after setup.
- Domains are provisioned interactively before the scheduler runs: `domain-connect-dyndns --config /config.json setup --domain <domain>` (run inside a container or with `docker run -it --rm`). See README for the exact commands.

## CI / publishing

- `.github/workflows/docker-image.yml` triggers **only on GitHub release publish**. It does a multi-arch buildx push (linux/amd64 + linux/arm64) to Docker Hub `b3ni/ionos-domain-connect`, tagging from the release ref via `docker/metadata-action`. Requires `DOCKERHUB_USERNAME` and `DOCKERHUB_PASSWORD` repo secrets.
- Local commit/push will never build the image; to release, create a GitHub release.

## Directories to ignore

- `.opencode/` — local OpenCode commands plugin (vendored `node_modules`), unrelated to the image.
- `.specify/` — unused speckit scaffolding templates (e.g. `memory/constitution.md` is an unfilled placeholder), unrelated to the image.
