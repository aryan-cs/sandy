# Google Location Sandbox MVP

Choose a real location with Google Maps/Places, then launch a first-person Three.js scene using Google Photorealistic 3D Tiles.

## Required Google APIs

Enable these in Google Cloud for the API key you use locally:

- Maps JavaScript API
- Places API (New)
- Map Tiles API

No secrets are committed. Use either a local `.env` file or paste a key into the app during development.

```bash
cp .env.example .env
# edit .env and set VITE_GOOGLE_MAPS_API_KEY
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173/
```

## Controls

- Search with Google Places Autocomplete, click the 2D map, use a preset, or type lat/lng manually.
- Click `Enter 3D Sandbox` to load Google Photorealistic 3D Tiles at that coordinate.
- Click the 3D viewport to lock the mouse.
- `WASD` moves, mouse looks, `Shift` sprints.
- `Space`/`E` moves up, `Q`/`C` moves down.
- `F` toggles ground-follow raycast.
- `Esc` releases pointer lock.

## Current implementation boundary

This is a location-selectable 0-to-1 outdoor digital twin sandbox. It does not yet solve production collision. The MVP uses a downward raycast against visible tiles to approximate ground height and lets the user fly/step around while Google tiles stream in.

For production, add a proxy collision layer or physics mesh strategy. Do not derive, cache, extract, or resell geometry from Google tiles; respect Google attribution and cache-control requirements.
