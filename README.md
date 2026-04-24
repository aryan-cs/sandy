# Sandy

Research and MVP work for a real-location digital-twin sandbox: walking around photoreal captured or tiled real-world environments before adding full game systems.

## Current status

The useful 0-to-1 path is **photoreal scene data plus a separate movement/collision layer**. The old OSM extrusion prototype is kept for comparison, but it is not a digital twin because it cannot reproduce facades, materials, colors, interiors, signage, lighting, vegetation, or scene-specific geometry.

The primary MVP is:

- `mvps/official-supersplat-walkthrough`: a local launcher for the official PlayCanvas SuperSplat Viewer.
- `mvps/official-supersplat-walkthrough/assets/apartment.sog`: captured Gaussian splat sample asset.
- `mvps/official-supersplat-walkthrough/assets/apartment.voxel.*`: generated voxel collision assets.
- `mvps/official-supersplat-walkthrough/assets/apartment.collision.glb`: generated GLB collision proxy.

See `PROJECT_AUDIT.md` for the research notes, project verdicts, and candidate architecture.

## What is intentionally not committed

The `external/` directory is ignored because it contains cloned upstream repos and dependency folders. Recreate it with:

```bash
./scripts/setup_external.sh
```

That script clones the required upstream projects, installs dependencies, patches SuperSplat Viewer to support `mode=fly|walk` URL params, and builds the viewer.

## Run the main MVP

```bash
./scripts/setup_external.sh
./scripts/run_supersplat_mvp.sh
```

Then open:

```text
http://127.0.0.1:4190/
```

The launcher has three options:

- `Open Walkthrough`: reliable Fly-mode movement using the local splat asset.
- `Open Walk Mode`: SuperSplat Walk mode using generated voxel collision.
- `Public Asset`: loads the upstream public asset without local collision.

## Run copied controller references

```bash
./scripts/setup_external.sh
./scripts/run_controller_examples.sh
```

Then open:

```text
http://127.0.0.1:4201/three-player-controller/3dgs
http://127.0.0.1:4201/three-player-controller/3dtilesScene
```

These examples are useful references for avatar/game controls, first-person/third-person toggles, vehicle controls, GLB collider handling, Gaussian splats, and 3D Tiles.

## Run the Google location sandbox

```bash
./scripts/run_google_location_sandbox.sh
```

This MVP lets you choose a location with Google Maps/Places and then enter a first-person Three.js scene centered on that latitude/longitude using Google Photorealistic 3D Tiles.

Controls: `WASD` movement, `Shift` crouch, `Cmd` / `Ctrl` sprint, `Space` jump, `F` fly.

Required Google APIs:

- Maps JavaScript API
- Places API (New)
- Map Tiles API

No API keys are committed. Set `VITE_GOOGLE_MAPS_API_KEY` in `mvps/google-location-sandbox/.env` or paste a restricted development key into the app.

## Recommended architecture

1. Captured-location mode: import a phone/drone/video scan, reconstruct or load a Gaussian splat/mesh, generate collision, and open it in a walkthrough viewer.
2. Arbitrary outdoor-location mode: use Google Photorealistic 3D Tiles or Cesium for city-scale real-world visuals, then add proxy collision/gameplay separately.
3. Later gameplay: add inventory, health, crafting, NPCs, multiplayer, and world rules after the player can reliably move inside the real-looking environment.

## Key upstream projects

- https://github.com/playcanvas/supersplat-viewer
- https://github.com/playcanvas/splat-transform
- https://github.com/hh-hang/three-player-controller
- https://github.com/NASA-AMMOS/3DTilesRendererJS
- https://github.com/sparkjsdev/spark
- https://github.com/ArthurBrussee/brush
- https://github.com/nerfstudio-project/nerfstudio
- https://github.com/colmap/colmap
