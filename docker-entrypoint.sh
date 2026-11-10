#!/bin/sh
set -e

CONFIG_PATH="${CONFIG_PATH:-/config.json}"

# Docker creates a directory when the host file of a bind mount does not
# exist (`-v ./config.json:/config.json` without `./config.json`).
if [ -d "$CONFIG_PATH" ]; then
    echo "[entrypoint] ERROR: $CONFIG_PATH is a directory, not a file." >&2
    echo "[entrypoint] Create the file on the host before starting the container, e.g.:" >&2
    echo "[entrypoint]     echo '{}' > config.json" >&2
    echo "[entrypoint] (remove the directory Docker created in its place first)" >&2
    exit 1
fi

if [ ! -e "$CONFIG_PATH" ]; then
    echo "[entrypoint] WARNING: $CONFIG_PATH does not exist; mount it from the host or credentials will be lost when the container is recreated" >&2
fi

if [ "$ENABLE_WEBUI" = "true" ]; then
    echo "[entrypoint] ENABLE_WEBUI=true -> starting web UI (port 3000) with in-process scheduler"
    exec node server.js
fi

echo "[entrypoint] ENABLE_WEBUI not set -> headless updater mode (no web server)"
exec python3 /src/updater.py
