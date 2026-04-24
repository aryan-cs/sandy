# Geo Sandbox MVP

Browser MVP for turning a lat/lon into a playable real-location sandbox scene.

## What it does

- Provides preset worlds for Flatiron NYC, Shibuya Crossing, Eiffel Tower, and Pike Place.
- Stitches Esri World Imagery satellite tiles into a local ground plane.
- Fetches OpenStreetMap buildings and roads from Overpass for a target radius.
- Projects OSM lat/lon geometry into local meters.
- Extrudes buildings into 3D collision volumes.
- Renders roads, satellite ground, marker cubes, and a first-person camera in Three.js.
- Lets the player walk at human scale, sprint, hop, and drop/remove small markers.
- Falls back to an offline sample district if Overpass is unavailable.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` unless Vite chooses a different port.

## Build

```bash
npm run build
npm run preview -- --port 4173
```

## Controls

- `WASD`: move
- `Shift`: sprint
- `Space`: hop
- Left click: place marker
- Right click: remove marker
- `Esc`: release pointer lock

## Current Limits

- Uses satellite imagery plus OSM footprints and tag-derived height estimates, not true photogrammetry.
- Collision is simple AABB against extruded buildings.
- Roads are rendered as tubes/strips over imagery instead of full drivable meshes.
- Terrain is flat; DEM/heightmap integration is the next step.
- Overpass is a public API and can rate-limit large/frequent queries.
- Esri imagery is loaded directly from public tile URLs and should be replaced with a formal provider account before production.
