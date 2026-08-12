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
- add a subdomain (the interface walks you through the provider
  authorization: open the link, enter the access code, done)
- remove a subdomain
- trigger an immediate update of all subdomains

The updater runs automatically every `INTERVAL_UPDATE` seconds (default 60).

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
