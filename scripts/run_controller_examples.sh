#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTROLLER="$ROOT/external/three-player-controller"
SERVE="$ROOT/external/supersplat-viewer/node_modules/.bin/serve"

if [ ! -x "$SERVE" ] || [ ! -d "$CONTROLLER/docs" ]; then
  echo "Missing built controller examples. Run ./scripts/setup_external.sh first." >&2
  exit 1
fi

ln -sfn docs "$CONTROLLER/three-player-controller"

cat <<'MSG'
Controller examples are running.
Open: http://127.0.0.1:4201/three-player-controller/3dgs
Open: http://127.0.0.1:4201/three-player-controller/3dtilesScene
Press Ctrl+C to stop the server.
MSG

cd "$CONTROLLER"
exec "$SERVE" . -C -l tcp://127.0.0.1:4201
