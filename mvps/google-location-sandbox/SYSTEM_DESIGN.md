# Google Location Sandbox System Design

## Goal

Let a user choose a real-world location with Google Maps, then enter a first-person 3D sandbox centered on that location using Google Photorealistic 3D Tiles.

## Researched Direction

There are two viable Google-backed paths:

1. **Maps JavaScript API 3D Maps**: fastest official Google path for a 3D map view. It supports `Map3DElement`, camera center/heading/tilt/range, and Places integration. It is less suitable for a game because Google owns the camera/rendering surface and physics/collision hooks are limited.
2. **Map Tiles API Photorealistic 3D Tiles + custom Three.js renderer**: better for a sandbox game because the app owns the render loop, pointer lock, WASD movement, collision approximation, HUD, and future gameplay systems. This MVP uses this path.

## Required APIs

- Maps JavaScript API: loads the 2D map picker and Places UI.
- Places API (New): powers the modern `PlaceAutocompleteElement` search path. The app falls back to legacy `google.maps.places.Autocomplete` when needed.
- Map Tiles API: streams Google Photorealistic 3D Tiles from `https://tile.googleapis.com/v1/3dtiles/root.json` through `3d-tiles-renderer`'s `GoogleCloudAuthPlugin`.

## Runtime Flow

1. Read `VITE_GOOGLE_MAPS_API_KEY`, a saved localStorage key, or a user-pasted key.
2. Load Google Maps JS with the `places` library.
3. Show a satellite map centered on the selected location.
4. Let the user choose a location by Places autocomplete, clicking the map, dragging the marker, picking a preset, or typing lat/lng.
5. On `Enter 3D Sandbox`, create a Three.js scene.
6. Create a `TilesRenderer` and register:
   - `GoogleCloudAuthPlugin` for Map Tiles API auth and attribution collection.
   - `TileCompressionPlugin` for compressed tile content.
   - `TilesFadePlugin` for better tile transitions.
   - `GLTFExtensionsPlugin` with DRACO support.
   - `ReorientationPlugin` to recenter the global tileset at the selected lat/lng.
7. Start a pointer-lock first-person controller.
8. Each animation frame updates camera movement, tile camera/resolution, tile streaming, rendering, and attribution display.

## Collision Strategy

This first Google-location MVP does not claim production collision. It uses a downward raycast against currently visible tile meshes to approximate ground following. That is enough for 0-to-1 immersion, but production needs one of these:

- Runtime proxy collider extraction from loaded tile meshes, constrained to what Google terms allow.
- Separate owned collision meshes for supported areas.
- Cesium/Unreal/Unity engine path if stronger geospatial physics is more important than browser-native delivery.
- Captured-location pipeline with owned splat/mesh assets and generated collision, as in the SuperSplat MVP.

## Credential Policy

No API keys are committed. Browser-visible keys must be restricted in Google Cloud:

- Application restriction: HTTP referrers for local/dev domains and deployed domains.
- API restriction: Maps JavaScript API, Places API (New), and Map Tiles API only.
- Quotas/billing alerts should be configured before public deployment.

For production, use separate keys for Maps JS/Places and Map Tiles where possible. If Google security guidance requires tighter restrictions for Map Tiles, add a backend token/proxy layer rather than embedding an unrestricted key.

## Terms Constraints

The app must show Google attribution, respect cache-control headers, and avoid prohibited uses such as offline caching, extracting geometry/geodata, object detection, resale, or non-visual analysis of Google tile content.
