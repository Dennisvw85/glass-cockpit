#!/bin/sh
# Launcher for the Cockpit LaunchAgent. launchd runs with a bare environment and
# no login shell, so pin PATH here rather than relying on a profile. Resolves its
# own location so the checkout can live anywhere.
set -e
cd "$(cd "$(dirname "$0")/.." && pwd)"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
export NODE_ENV=production
# COCKPIT_PORT defaults to 5200 in the server; in production the web app is served
# from that same port (no Vite), so the whole thing lives on one port.

exec node_modules/.bin/tsx server/index.ts
