#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTERNAL="$ROOT/external"
mkdir -p "$EXTERNAL"

clone_at() {
  local url="$1"
  local dir="$2"
  local rev="$3"

  if [ ! -d "$dir/.git" ]; then
    git clone "$url" "$dir"
  fi

  git -C "$dir" fetch origin --tags --prune
  git -C "$dir" checkout "$rev"
}

clone_at https://github.com/playcanvas/supersplat-viewer.git "$EXTERNAL/supersplat-viewer" 3150597e1b3705ea870f7c3c98f58abf61dae9bf
clone_at https://github.com/playcanvas/splat-transform.git "$EXTERNAL/splat-transform" 3b65a8ffcac417401540f2815c8e98ca59ae6e41
clone_at https://github.com/hh-hang/three-player-controller.git "$EXTERNAL/three-player-controller" 691fd3d4bdf259e3fbc9ada1843532159c2aba06
clone_at https://github.com/NASA-AMMOS/3DTilesRendererJS.git "$EXTERNAL/3DTilesRendererJS" 57dc7e72347d674a5ca6dabcc37a018e3e367972

if ! grep -q "window.sse.viewer = viewer" "$EXTERNAL/supersplat-viewer/src/index.html"; then
  git -C "$EXTERNAL/supersplat-viewer" apply "$ROOT/patches/supersplat-viewer-url-mode.patch"
fi

npm --prefix "$EXTERNAL/supersplat-viewer" ci
npm --prefix "$EXTERNAL/supersplat-viewer" run build

npm --prefix "$EXTERNAL/splat-transform" ci

npm --prefix "$EXTERNAL/three-player-controller" install
npm --prefix "$EXTERNAL/three-player-controller" run build:example
ln -sfn docs "$EXTERNAL/three-player-controller/three-player-controller"

npm --prefix "$EXTERNAL/3DTilesRendererJS" install
npm --prefix "$EXTERNAL/3DTilesRendererJS" run build-lib

echo "External dependencies are ready."
