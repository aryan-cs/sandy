# Real-Location Digital Twin Sandbox Audit

Date: 2026-04-24

## Corrected Direction

The earlier `mvps/geo-sandbox` prototype is deprecated. It is an OSM extrusion/map visualization, not a digital twin. A convincing digital-twin walkthrough needs photoreal capture or photoreal geospatial tiles plus a separate collision/navigation layer.

A correct 0-to-1 architecture is:

1. Photoreal visual layer: Gaussian splat, NeRF/radiance field, photogrammetry mesh, or Google Photorealistic 3D Tiles.
2. Movement layer: voxel/GLB collision, navmesh, or simplified proxy mesh.
3. World metadata layer: coordinates, capture date, POIs, semantics, and eventually gameplay systems.

## Why The OSM Prototype Was Wrong

OSM footprints plus satellite imagery cannot recreate real surroundings, colors, materials, interiors, signage, facade detail, lighting, trees, occluded geometry, or room-level design. It produces inferred boxes and roads. That is useful context data, but it is not the image-like digital twin shown in the X videos.

The movement issue was also real: the camera/control path in that prototype was not the correct first-person viewer stack. The replacement MVP uses the official SuperSplat Viewer controls and verified WASD movement in browser.

## X Links Resolved

| Link | Resolved project | Verdict |
| --- | --- | --- |
| https://x.com/HowToAI_/status/2047728492616581484 | PlayCanvas SuperSplat | Legit open-source browser Gaussian Splat editor. The post's "newly open-sourced" framing is misleading; SuperSplat predates the post, but the project is real and active. |
| https://x.com/yak32/status/2047326252344742035 | PlayCanvas Gaussian Splat FPS demo | Legit playable public PlayCanvas demo and workflow writeup. It demonstrates the right hybrid model: splat visuals plus collision/nav/game logic. Exact reproduction is partial because the public PlayCanvas project/assets are not a normal Git repo and one navmesh generator is not yet public. |
| https://x.com/mountain_mal/status/2040833056249135221 | Teleport + World Labs Marble/World API + Spark renderer | Plausible private prototype. Public code exists for World Labs API examples, Spark renderer, and Meta wearables SDKs, but not the full Ray-Ban-to-world pipeline. Reproducible only with API/hardware/private app access. |

## Research Conclusion

| Approach | Usefulness for this project | Constraint |
| --- | --- | --- |
| SuperSplat Viewer + SplatTransform | Best immediate browser MVP for photoreal captured spaces with walk/fly controls and generated collision. | Needs a splat asset from real capture or a public sample. Collision needs tuning per capture. |
| Google Photorealistic 3D Tiles + Cesium | Best arbitrary-city photoreal outdoor context. | Requires API/billing/token and has terms/attribution/caching constraints. Gameplay collision is not solved out of the box. |
| World Labs Marble / API | Good for generated or reconstructed world demos. | API key/credits required; generated content is not automatically an authoritative real-world twin. |
| Matterport / Polycam / Luma / Scaniverse | Practical capture route for real rooms, houses, courtyards, stores, and campuses. | Exports still need cleanup, scale alignment, and collision proxy generation. |
| OSM / OSM2World / Mapbox extrusions | Useful structural/geospatial layer. | Not photoreal and not sufficient as the visual twin. |
| NeRF / Nerfstudio / gsplat | Strong reconstruction path. | More pipeline work than using existing captured splat viewers; still needs collision/proxy mesh. |

## Cloned Repos

| Path | Repo | Status |
| --- | --- | --- |
| `external/supersplat` | https://github.com/playcanvas/supersplat | Pulled. `npm ci` and `npm run build` succeeded. Served at `http://127.0.0.1:3001/`. |
| `external/supersplat-viewer` | https://github.com/playcanvas/supersplat-viewer | Pulled. `npm ci` and `npm run build` succeeded. Local patch adds `window.sse.viewer` for verification and `mode=fly|walk` startup. Served at `http://127.0.0.1:3002/`. |
| `external/splat-transform` | https://github.com/playcanvas/splat-transform | Pulled. CLI works. Generated voxel and GLB collision from the sample SOG. |
| `external/recast-navigation-js` | https://github.com/isaac-mason/recast-navigation-js | Pulled and inspected. Not needed for this first walkthrough MVP. |
| `external/worldlabs-api-examples` | https://github.com/worldlabsai/worldlabs-api-examples | Pulled. Example server works, but actual world generation requires `WLT_API_KEY`. |
| `external/spark` | https://github.com/sparkjsdev/spark | Pulled and inspected. Package works as a dependency, but local repo build needs Rust/Cargo. Custom Spark test was rejected because camera calibration was unreliable versus SuperSplat Viewer. |
| `external/OSM2World` | https://github.com/tordanik/OSM2World | Pulled and inspected. Build requires Java/Maven. Useful later for structural context, not the photoreal MVP. |

## Working MVP

| Path | Purpose | Verification |
| --- | --- | --- |
| `mvps/official-supersplat-walkthrough` | Corrected 0-to-1 photoreal walkthrough using official SuperSplat Viewer, local SOG asset, generated voxel collision, and tuned start pose. | Rendered locally. Walk mode shows official prompt. WASD movement verified by Playwright: camera moved from `[2, 2.14, -3]` to `[5.41, 1.60, -2.70]`. |
| `mvps/photoreal-splat-walkthrough` | Custom Spark/Three experiment. | Build succeeds, but camera calibration was unreliable; not recommended as current MVP. |
| `mvps/geo-sandbox` | Deprecated OSM extrusion prototype. | Build succeeds, but it is not a photoreal digital twin. |

## Additional Projects Searched / Copied

| Path | Repo | Status | Usefulness |
| --- | --- | --- | --- |
| `external/three-player-controller` | https://github.com/hh-hang/three-player-controller | Cloned, `npm install` succeeded, `npm run build:example` succeeded. Served at `http://127.0.0.1:4201/three-player-controller/3dgs.html` and `http://127.0.0.1:4201/three-player-controller/3dtilesScene.html`. | Best copied gameplay-controller reference. Includes Spark 3DGS example with `3dgs.ply` and `3dgsCollider.glb`, plus a Google/Cesium/3DTilesRendererJS example with avatar, WASD, first-person toggle, vehicle support, and collider GLB. |
| `external/3DTilesRendererJS` | https://github.com/NASA-AMMOS/3DTilesRendererJS | Cloned, `npm install` succeeded, `npm run build-lib` succeeded. | Strongest copyable Three.js 3D Tiles renderer. Best for city-scale photoreal tiles, but collision/player controller must be added separately or via `three-player-controller`. |
| `external/GaussianSplats3D` | https://github.com/mkkellogg/GaussianSplats3D | Cloned, `npm install` and `npm run build` succeeded. | Useful historical Three.js splat viewer, but README says it is no longer actively developed and recommends Spark. No collision/gameplay layer. |
| `external/brush` | https://github.com/ArthurBrussee/brush | Cloned and inspected. Not built because this environment lacks Rust/Cargo. | Strong Apache-2.0 capture/training/viewer candidate, especially for WebGPU and non-CUDA devices. More relevant for asset generation than immediate walkthrough. |
| `external/OpenSplat` | https://github.com/pierotofy/OpenSplat | Cloned and inspected. Not built because it needs libtorch/OpenCV/CMake setup and is AGPL-3.0. | Useful capture/training pipeline from COLMAP/OpenSfM/ODM/Nerfstudio to `.ply` or `.splat`, but AGPL may constrain product use. |

## Copied Project Verification

`three-player-controller` 3DGS example:

- URL: `http://127.0.0.1:4201/three-player-controller/3dgs.html`
- Loaded local `3dgs.ply` and `3dgsCollider.glb`.
- WASD movement and first-person toggle verified in Playwright.
- Screenshots:
  - `output/playwright/three-player-controller-3dgs-loaded.png`
  - `output/playwright/three-player-controller-3dgs-after-wasd.png`
  - `output/playwright/three-player-controller-3dgs-first-person.png`

`three-player-controller` 3D Tiles example:

- URL: `http://127.0.0.1:4201/three-player-controller/3dtilesScene.html`
- Loaded Google/Cesium photoreal 3D Tiles through 3DTilesRendererJS using the demo configuration.
- WASD and first-person toggle verified in Playwright.
- Screenshots:
  - `output/playwright/three-player-controller-3dtiles-loaded.png`
  - `output/playwright/three-player-controller-3dtiles-after-w-firstperson.png`

Run command for the copied project:

```bash
cd /Users/aryan/Desktop/sandy/external/three-player-controller
npm install
npm run build:example
ln -sfn docs three-player-controller
/Users/aryan/Desktop/sandy/external/supersplat-viewer/node_modules/.bin/serve /Users/aryan/Desktop/sandy/external/three-player-controller -C -l tcp://127.0.0.1:4201
```

## Current Architecture Recommendation

Use two parallel MVP tracks:

1. Clean digital-twin viewer: keep `mvps/official-supersplat-walkthrough` on SuperSplat Viewer + SplatTransform. This is the best user-facing photoreal capture walkthrough.
2. Game-feel prototype: adapt `external/three-player-controller` patterns if the next goal is an avatar, third-person/first-person gameplay, vehicles, jumping, mobile controls, and stronger GLB collider handling.

Do not switch to `GaussianSplats3D` as primary runtime. Do not build product-critical capture on `OpenSplat` unless AGPL obligations are acceptable. Treat `Brush` as a promising capture/training/viewer track once Rust is available.

## Run The Working MVP

Terminal 1:

```bash
cd /Users/aryan/Desktop/sandy/external/supersplat-viewer
./node_modules/.bin/serve public -C -c ../serve.json -l tcp://127.0.0.1:3002
```

Terminal 2:

```bash
cd /Users/aryan/Desktop/sandy/mvps/official-supersplat-walkthrough
/Users/aryan/Desktop/sandy/external/supersplat-viewer/node_modules/.bin/serve . -C -l tcp://127.0.0.1:4190
```

Open the launcher:

```text
http://127.0.0.1:4190/
```

Direct Walk-mode URL:

```text
http://127.0.0.1:3002/?content=http%3A%2F%2F127.0.0.1%3A4190%2Fassets%2Fapartment.sog&settings=http%3A%2F%2F127.0.0.1%3A4190%2Fsettings.json&mode=walk&collision=http%3A%2F%2F127.0.0.1%3A4190%2Fassets%2Fapartment.voxel.json&aa&nofx&noanim
```

## Next Build Step

Do not keep investing in OSM-only rendering as the primary demo. The next useful step is a capture/import pipeline:

1. Accept a user-provided `.ply`, `.sog`, `.spz`, or `.lcc` capture.
2. Run SplatTransform to normalize/compress it and generate voxel/GLB collision.
3. Open it in the patched SuperSplat Viewer with a calibrated start pose.
4. Add a small calibration UI for start position, eye height, collision seed, and movement mode.
5. Later: add Cesium/Google Photorealistic 3D Tiles for outdoor arbitrary-location context when API keys and licensing are available.
