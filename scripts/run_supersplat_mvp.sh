#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIEWER="$ROOT/external/supersplat-viewer"
MVP="$ROOT/mvps/official-supersplat-walkthrough"

if [ ! -x "$VIEWER/node_modules/.bin/serve" ] || [ ! -d "$VIEWER/public" ]; then
  echo "Missing built SuperSplat Viewer. Run ./scripts/setup_external.sh first." >&2
  exit 1
fi

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

(
  cd "$VIEWER"
  ./node_modules/.bin/serve public -C -c serve.json -l tcp://127.0.0.1:3002
) &

(
  cd "$MVP"
  "$VIEWER/node_modules/.bin/serve" . -C -l tcp://127.0.0.1:4190
) &

cat <<'MSG'
SuperSplat MVP is running.
Open: http://127.0.0.1:4190/
Press Ctrl+C to stop both servers.
MSG

wait
