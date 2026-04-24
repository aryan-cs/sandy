# Photoreal Digital Twin MVP

This MVP intentionally replaces the earlier OSM extrusion prototype. It uses the official PlayCanvas SuperSplat Viewer with a real captured Gaussian splat asset.

## Run

From the repo root:

```bash
./scripts/setup_external.sh
./scripts/run_supersplat_mvp.sh
```

Then open:

```text
http://127.0.0.1:4190/
```

Manual commands, if the external repos are already set up:

Terminal 1, official viewer:

```bash
cd /Users/aryan/Desktop/sandy/external/supersplat-viewer
./node_modules/.bin/serve public -C -c serve.json -l tcp://127.0.0.1:3002
```

Terminal 2, this MVP launcher and assets:

```bash
cd /Users/aryan/Desktop/sandy/mvps/official-supersplat-walkthrough
/Users/aryan/Desktop/sandy/external/supersplat-viewer/node_modules/.bin/serve . -C -l tcp://127.0.0.1:4190
```

## Controls

- The launcher starts the official viewer in Fly mode for reliable MVP movement.
- `WASD` / arrow keys move.
- Mouse/right-drag look behavior is handled by the official SuperSplat controls.
- The local scene includes generated voxel and GLB collision assets. Walk mode is available, but it still needs capture-specific tuning before it feels production-grade.

## Asset

The default local asset is `assets/apartment.sog`, copied from PlayCanvas's public engine example assets.

Source: `https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets/splats/apartment.sog`

## Collision

SplatTransform generated these files from the local SOG:

- `assets/apartment.voxel.json`
- `assets/apartment.voxel.bin`
- `assets/apartment.collision.glb`

Regenerate them with:

```bash
cd /Users/aryan/Desktop/sandy/external/splat-transform
node bin/cli.mjs -w -K --voxel-floor-fill --voxel-carve --seed-pos 0,1,-2 /Users/aryan/Desktop/sandy/mvps/official-supersplat-walkthrough/assets/apartment.sog /Users/aryan/Desktop/sandy/mvps/official-supersplat-walkthrough/assets/apartment.voxel.json
```

If successful, open the viewer with:

```text
http://127.0.0.1:3002/?content=http%3A%2F%2F127.0.0.1%3A4190%2Fassets%2Fapartment.sog&settings=http%3A%2F%2F127.0.0.1%3A4190%2Fsettings.json&collision=http%3A%2F%2F127.0.0.1%3A4190%2Fassets%2Fapartment.voxel.json&mode=fly&aa&nofx&noanim
```
