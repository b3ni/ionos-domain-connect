# ionos-domain-connect

Web interface + scheduler to keep your IONOS/1&1 dynamic DNS subdomains up
to date. It runs the upstream
[domain-connect-dyndns](https://github.com/Domain-Connect/DomainConnectDDNS-Python)
CLI on a schedule and lets you manage your subdomains from the browser.

## Docker compose

Create the config file on the host first — if it does not exist, Docker
mounts an empty directory in its place and the container refuses to start:

```bash
echo '{}' > config.json
```

```yaml
services:
    ionos-domain-connect:
        image: "b3ni/ionos-domain-connect:latest"
        restart: always
        ports:
            - "3000:3000"
        environment:
            - ENABLE_WEBUI=true   # web interface; absent/false = headless updater only
            - INTERVAL_UPDATE=60    # seconds
        volumes:
            - ./config.json:/config.json
```

## Web on/off

The web interface is **opt-in**: it starts only when `ENABLE_WEBUI=true`.
Without it (default), the container runs headless — scheduled updates keep
running but no web server starts and port 3000 is not bound. The
`domain-connect-dyndns` CLI remains usable inside the container in both
modes.

## Usage

Open `http://<host>:3000`. From the web interface you can:

- see every managed subdomain with its last update status
- see why a subdomain's last update failed: failed domains show the error
  reported by the updater under the domain name; hover or focus (Tab) the
  error text to read the full message in a tooltip (the reason is stored as
  `last_error` in `config.json`, which the CLI preserves; it is cleared
  after a successful update)
- refresh a single subdomain: each row has its own update button that runs
  the updater for that domain only (global and per-domain updates share one
  lock, so concurrent runs are rejected with a clear message)
- every change to `config.json` made from the interface (updates, removing
  or adding a domain, saving the config editor) is serialized: removing a
  domain, finishing a setup or saving the config waits for a running update
  instead of being silently overwritten by it. Changes made with the CLI
  via `docker exec` at the same time are not coordinated
- when a domain fails with a stale provider session ("Failed to get async
  token ... NOTFOUND_SESSION"), the row shows a "Run setup again for this
  domain." action that re-authorizes the domain in the interface — the
  stored OAuth authorization is no longer valid on the provider side and
  re-authorizing reconnects the domain without removing it or changing its
  DNS records; the setup dialog closes automatically with a success
  message when done
- click a domain name to open its live website in a new browser tab
- add a subdomain (the interface walks you through the provider
  authorization: open the link, enter the access code, done)
- remove a subdomain
- trigger an immediate update of all subdomains
- open the **Configuración** section to view and edit `config.json` — the
  same file the updater CLI reads and writes — as a JSON tree or as raw
  text. OAuth tokens never leave the server: they are shown as
  `__SECRET_…__` placeholders and restored when you save; a corrupt/unreadable
  config can be repaired directly from the interface. Saves are validated
  (must remain a valid domain map), backed up to `/backups` before every
  overwrite, and rejected with a conflict message if the file changed on
  disk since it was loaded

The updater runs automatically every `INTERVAL_UPDATE` seconds (default 60).
A single updater run is stopped after `CLI_TIMEOUT` seconds (default 120) so
a hung provider call cannot block later updates; in the web interface the
affected domains show the timeout as their failure reason.

## Versioning

The footer of the web interface shows the running version. A new version is
created only by publishing a GitHub release — that release builds and
pushes the Docker image (`b3ni/ionos-domain-connect:latest` +
`:vX.Y.Z`), and the release tag (e.g. `v1.2.3`) is passed into the image as
the `APP_VERSION` build arg and shown in the footer. Builds without a
release version (local `docker build`, `npm run dev`) show `dev`:

```bash
docker build --build-arg APP_VERSION=test-1 -t ionos-domain-connect .
```

> **Note**: the interface has no authentication — only expose the port on a
> trusted network. State-changing API requests coming from another website
> (cross-site, checked via `Sec-Fetch-Site` / `Origin`) are rejected with
> 403; behind a reverse proxy, forward the original host (`Host` or
> `X-Forwarded-Host`).

## Setup a domain via the CLI (alternative to the web UI)

```
docker run -it --rm -v $(pwd)/config.json:/config.json b3ni/ionos-domain-connect:latest \
    domain-connect-dyndns \
    --config /config.json setup \
    --domain <my-domain.com>
```

Inside the container the binaries are `domain-connect-dyndns` (Python) and
`node server.js` (the web app).

## Development

- The web app lives in `webui/` (Next.js App Router + shadcn/ui + Tailwind
  v4). Build the image with `docker build -t ionos-domain-connect .`.
- Python dependencies are pinned in `requirements.txt` (the web UI parses
  the `domain-connect-dyndns` output, so bump it deliberately); npm
  dependencies are in `webui/package-lock.json`.
- `config.json` holds IONOS credentials after setup and is gitignored —
  never commit it.

## TODO

Send notifications

## License

MIT License

See LICENSE for details.
