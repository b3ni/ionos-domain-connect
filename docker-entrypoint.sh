#!/bin/sh
set -e

if [ "$ENABLE_WEBUI" = "true" ]; then
    echo "[entrypoint] ENABLE_WEBUI=true -> starting web UI (port 3000) with in-process scheduler"
    exec node server.js
fi

echo "[entrypoint] ENABLE_WEBUI not set -> headless updater mode (no web server)"
exec python3 /src/updater.py
