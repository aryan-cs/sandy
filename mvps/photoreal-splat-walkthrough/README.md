# Photoreal Splat Walkthrough MVP

This is the corrected 0 -> 1 digital-twin prototype. It loads actual `.spz` Gaussian Splat captures and lets a user walk inside them in first person.

The previous `geo-sandbox` MVP was a geospatial blockout: OSM extrusions plus satellite imagery. That is useful for GIS context, but it is not a photoreal digital twin.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview -- --port 4180
```

## Controls

- `Enter Walkthrough`: locks pointer and starts first-person mode
- `WASD`: walk
- `Shift`: sprint
- Mouse: look
- `Space`: move up
- `C`: move down
- `Esc`: exit walkthrough

## Important Limitation

The public `.spz` files do not include semantic collision meshes. This MVP therefore gives photoreal first-person navigation, but not perfect physical walking/collision. To match the PlayCanvas FPS demo exactly, the capture must be processed with a collision proxy such as `splat-transform -K` or a manually authored mesh.
