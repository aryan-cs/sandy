# Quality Notes

## Why the world can look bad up close

Google Photorealistic 3D Tiles are city-scale aerial/oblique photogrammetry, not a first-person game asset pack. The data is strongest from a flyover distance. At human eye height, streets, trees, thin structures, facades, and occluded surfaces can become melted, stretched, low-poly, or blurry because they were reconstructed from imagery captured above and around the subject.

The screenshot with the Eiffel Tower also has renderer/runtime issues layered on top of that data limitation:

- The copied `three-player-controller` demo uses a rough separate `EiffelCollider.glb` for gameplay collision. If the player/camera gets too close to that proxy or to low-detail tile geometry, the scene can look like large jagged blobs.
- 3D Tiles are streamed by level of detail. If the renderer accepts high screen-space error, keeps a small cache, or has not finished loading high-detail descendants, it will show coarse parent tiles.
- Close-up walking exposes texture and mesh errors that are hidden from normal map/city camera distances.
- Some real-world areas simply have weaker Google photogrammetry coverage than landmarks or dense downtown areas.

## First browser-side fixes in this MVP

The current MVP now uses a higher-quality 3D Tiles preset:

- Lower `errorTarget` so the renderer asks for finer tiles sooner.
- Higher `maxDepth` so deeper tile levels are allowed.
- Larger tile cache budget so high-detail tiles are less aggressively evicted.
- Higher download/parse/process queue concurrency so selected areas refine faster.

This improves visual refinement but costs more network, memory, GPU time, and billable tile traffic.

## Stronger approaches

1. **Use Google tiles for outdoor context only.** Keep Google Photorealistic 3D Tiles for city-scale surroundings, but do not expect perfect first-person fidelity at every sidewalk.
2. **Add owned high-resolution local captures.** For the playable area, use phone/drone/LiDAR/photogrammetry captures converted to Gaussian splats or textured meshes. This is the path that can look close to the X videos.
3. **Hybrid composition.** Use Google tiles as the background and replace the near interaction zone with an owned splat/mesh at high fidelity.
4. **Use first-party capture APIs/products where possible.** Matterport, Polycam, Luma, Scaniverse, Nerfstudio/Brush/COLMAP, or custom drone photogrammetry can produce a local asset with better ground-level detail.
5. **Generate proper collision separately.** Use proxy meshes, SplatTransform voxel collision, Recast/navmesh, or physics colliders. Do not rely on raw Google visual meshes as authoritative walkable physics.
6. **Engine path for heavy fidelity.** If browser delivery is not mandatory, Cesium for Unreal/Unity gives stronger streaming/camera/physics tooling for 3D Tiles, though it still does not magically fix source photogrammetry detail.
7. **Quality controls.** Expose a quality slider that tunes `errorTarget`, max depth, cache size, and tile loading concurrency based on device performance.

## Product implication

For arbitrary locations, Google tiles give broad outdoor coverage but not perfect game-ready close-up environments. For “almost perfectly recreated” places, the product needs an owned capture/reconstruction pipeline and should treat Google tiles as context rather than the final playable surface.
