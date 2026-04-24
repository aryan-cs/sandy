#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MVP="$ROOT/mvps/google-location-sandbox"

if [ ! -d "$MVP/node_modules" ]; then
  npm --prefix "$MVP" install
fi

cat <<'MSG'
Google Location Sandbox is starting.
Open the Vite URL printed below, usually http://127.0.0.1:5173/
Set VITE_GOOGLE_MAPS_API_KEY in mvps/google-location-sandbox/.env or paste a restricted dev key in the app.
Press Ctrl+C to stop.
MSG

cd "$MVP"
exec npm run dev -- --host 127.0.0.1
