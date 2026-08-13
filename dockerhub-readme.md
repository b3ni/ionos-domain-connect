# ionos-domain-connect

Web interface + scheduler to keep your IONOS/1&1 dynamic DNS subdomains up to date. It runs the upstream [domain-connect-dyndns](https://github.com/Domain-Connect/DomainConnectDDNS-Python) CLI on a schedule and lets you manage your subdomains from the browser.

## Quick start (docker run)

```bash
mkdir -p /path/to/config && echo '{}' > /path/to/config/config.json

docker run -d \
  --name ionos-domain-connect \
  --restart always \
  -p 3000:3000 \
  -e ENABLE_WEBUI=true \
  -e INTERVAL_UPDATE=60 \
  -v /path/to/config/config.json:/config.json \
  b3ni/ionos-domain-connect:latest
```

## Quick start (docker compose)

```yaml
services:
  ionos-domain-connect:
    image: "b3ni/ionos-domain-connect:latest"
    restart: always
    ports:
      - "3000:3000"
    environment:
      - ENABLE_WEBUI=true   # web interface; absent/false = headless updater only
      - INTERVAL_UPDATE=60  # seconds
    volumes:
      - ./config.json:/config.json
```

## Usage

Open `http://<host>:3000`. From the web interface you can:

- see every managed subdomain with its last update status
- add a subdomain (the interface walks you through the provider authorization: open the link, enter the access code, done)
- remove a subdomain
- trigger an immediate update of all subdomains

The updater runs automatically every `INTERVAL_UPDATE` seconds (default 60).

> **Note**: the interface has no authentication — only expose the port on a trusted network.

## Web on/off

The web interface is **opt-in**: it starts only when `ENABLE_WEBUI=true`. Without it (default), the container runs headless — scheduled updates keep running but no web server starts and port 3000 is not bound. The `domain-connect-dyndns` CLI remains usable inside the container in both modes.

## Set up a domain via the CLI (alternative to the web UI)

```
docker run -it --rm -v $(pwd)/config.json:/config.json b3ni/ionos-domain-connect:latest \
    domain-connect-dyndns \
    --config /config.json setup \
    --domain <my-domain.com>
```

Inside the container the binaries are `domain-connect-dyndns` (Python) and `node server.js` (the web app).

## Environment variables

| Variable        | Default          | Description                                            |
| --------------- | ---------------- | ------------------------------------------------------ |
| `ENABLE_WEBUI`  | *(unset)*        | `true` starts the web UI; otherwise headless updater   |
| `INTERVAL_UPDATE` | `60`           | Update interval in seconds                             |
| `CONFIG_PATH`   | `/config.json`   | Path to the IONOS config file                          |
| `DYNDNS_CLI`    | `domain-connect-dyndns` | Override the CLI binary used by the web UI       |
| `BACKUP_DIR`    | `/backups`       | Where backups are written when removing a domain       |
| `PORT`          | `3000`           | Web UI port                                            |

## Platform support

`linux/amd64` and `linux/arm64`.
