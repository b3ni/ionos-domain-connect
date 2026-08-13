# ionos-domain-connect

Web interface + scheduler to keep your IONOS/1&1 dynamic DNS subdomains up
to date. It runs the upstream
[domain-connect-dyndns](https://github.com/Domain-Connect/DomainConnectDDNS-Python)
CLI on a schedule and lets you manage your subdomains from the browser.

## Docker compose

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
  same file the updater CLI reads and writes — as a masked JSON tree
  (tokens hidden until revealed) or as raw text; a corrupt/unreadable
  config can be repaired directly from the interface. Saves are validated
  (must remain a valid domain map), backed up to `/backups` before every
  overwrite, and rejected with a conflict message if the file changed on
  disk since it was loaded

The updater runs automatically every `INTERVAL_UPDATE` seconds (default 60).

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
> trusted network.

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
- Python dependencies for the CLI are installed in the Dockerfile
  (`pip install domain-connect-dyndns`); npm dependencies are in
  `webui/package-lock.json`.
- `config.json` holds IONOS credentials after setup and is gitignored —
  never commit it.

## TODO

Send notifications

## License

MIT License

See LICENSE for details.
