import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import './styles.css';

const PRESETS = [
  { label: 'Flatiron, NYC', lat: 40.7411, lon: -73.9897, radius: 320 },
  { label: 'Shibuya Crossing, Tokyo', lat: 35.6595, lon: 139.7005, radius: 320 },
  { label: 'Eiffel Tower, Paris', lat: 48.8584, lon: 2.2945, radius: 360 },
  { label: 'Pike Place, Seattle', lat: 47.6097, lon: -122.3425, radius: 300 }
];

const DEFAULT_LOCATION = PRESETS[0];
const R = 6378137;
const TILE_SIZE = 256;
const EYE_HEIGHT = 1.75;
const PLAYER_HEIGHT = 1.9;
const PLAYER_WIDTH = 0.7;
const MARKER_SIZE = 1.2;
const keys = new Set();
const placedMarkers = [];
const collisionBoxes = [];
const velocity = new THREE.Vector3();

let scene;
let camera;
let renderer;
let controls;
let playerBox;
let currentOrigin = DEFAULT_LOCATION;
let activeLoadId = 0;
let lastFrameMs = performance.now();
let stats = { buildings: 0, roads: 0, markers: 0, source: 'not loaded', imagery: 'not loaded' };

const app = document.querySelector('#app');
app.innerHTML = `
  <canvas id="world"></canvas>
  <section class="panel">
    <div class="brand">DIGITAL TWIN WALKTHROUGH</div>
    <h1>Walk inside a real place.</h1>
    <p class="lede">This MVP stitches satellite imagery under OpenStreetMap buildings and roads, then lets you enter at human scale and walk the scene in first person.</p>
    <label class="wide">Preset world
      <select id="preset">
        ${PRESETS.map((preset, index) => `<option value="${index}">${preset.label}</option>`).join('')}
      </select>
    </label>
    <div class="fields">
      <label>Latitude <input id="lat" value="${DEFAULT_LOCATION.lat}" /></label>
      <label>Longitude <input id="lon" value="${DEFAULT_LOCATION.lon}" /></label>
      <label>Radius m <input id="radius" value="${DEFAULT_LOCATION.radius}" /></label>
    </div>
    <div class="actions">
      <button id="load">Load Digital Twin</button>
      <button id="sample">Offline Demo</button>
      <button id="play">Enter World</button>
    </div>
    <div class="readout" id="readout"></div>
    <p class="hint">WASD move · mouse look · Shift sprint · Space hop · click place marker · right-click remove marker · Esc show panel</p>
    <p class="credit">Imagery: Esri World Imagery. Geometry: OpenStreetMap via Overpass.</p>
  </section>
  <div class="hud" id="hud"></div>
  <div class="reticle"></div>
`;

init();
loadWorld(DEFAULT_LOCATION, { offline: false });
animate();

function init() {
  const canvas = document.querySelector('#world');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1cd);
  scene.fog = new THREE.FogExp2(0xbfd1cd, 0.0038);

  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 3000);
  camera.position.set(0, EYE_HEIGHT, 42);

  controls = new PointerLockControls(camera, document.body);
  controls.addEventListener('lock', () => document.body.classList.add('playing'));
  controls.addEventListener('unlock', () => document.body.classList.remove('playing'));
  playerBox = new THREE.Box3();

  const hemi = new THREE.HemisphereLight(0xdffaff, 0x333b2a, 1.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe3a8, 4.2);
  sun.position.set(-140, 190, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -430;
  sun.shadow.camera.right = 430;
  sun.shadow.camera.top = 430;
  sun.shadow.camera.bottom = -430;
  scene.add(sun);

  document.querySelector('#preset').addEventListener('change', (event) => {
    const preset = PRESETS[Number(event.target.value)];
    setFormLocation(preset);
  });
  document.querySelector('#load').addEventListener('click', () => loadWorld(readFormLocation(), { offline: false }));
  document.querySelector('#sample').addEventListener('click', () => loadWorld(readFormLocation(), { offline: true }));
  document.querySelector('#play').addEventListener('click', () => controls.lock());

  document.addEventListener('keydown', (event) => keys.add(event.code));
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('mousedown', handleMouseAction);
  window.addEventListener('resize', resize);
}

function setFormLocation(location) {
  document.querySelector('#lat').value = location.lat;
  document.querySelector('#lon').value = location.lon;
  document.querySelector('#radius').value = location.radius;
}

function readFormLocation() {
  return {
    label: 'Custom location',
    lat: Number(document.querySelector('#lat').value) || DEFAULT_LOCATION.lat,
    lon: Number(document.querySelector('#lon').value) || DEFAULT_LOCATION.lon,
    radius: clamp(Number(document.querySelector('#radius').value) || DEFAULT_LOCATION.radius, 120, 700)
  };
}

async function loadWorld(target, options) {
  const loadId = ++activeLoadId;
  currentOrigin = target;
  clearWorld();
  resetStats(options.offline);
  setStatus(`Loading ${target.label ?? 'location'}...`);
  addBaseGround(target.radius);
  addAtmosphere(target.radius);

  const imageryPromise = options.offline
    ? Promise.resolve(false)
    : addSatelliteGround(target, loadId).catch((error) => {
      console.warn(error);
      stats.imagery = 'fallback color';
      return false;
    });

  let data;
  try {
    data = options.offline ? offlineSample(target) : await fetchOsm(target);
    if (loadId !== activeLoadId) return;
    stats.source = options.offline ? 'offline sample geometry' : 'OpenStreetMap geometry';
  } catch (error) {
    console.warn(error);
    data = offlineSample(target);
    stats.source = 'offline fallback geometry';
    setStatus(`OSM fetch failed; loaded offline geometry. ${error.message}`);
  }

  buildRoads(data.roads);
  buildBuildings(data.buildings);
  addWalkableMarkers(target.radius);
  await imageryPromise;
  if (loadId !== activeLoadId) return;
  resetPlayer();
  updateReadout();
}

function resetStats(offline) {
  stats = {
    buildings: 0,
    roads: 0,
    markers: 0,
    source: offline ? 'offline sample geometry' : 'loading OSM',
    imagery: offline ? 'procedural color' : 'loading satellite'
  };
}

async function fetchOsm(target) {
  const dLat = target.radius / 111320;
  const dLon = target.radius / (111320 * Math.cos(toRad(target.lat)));
  const bbox = [target.lat - dLat, target.lon - dLon, target.lat + dLat, target.lon + dLon];
  const query = `
    [out:json][timeout:25];
    (
      way["building"](${bbox.join(',')});
      way["highway"](${bbox.join(',')});
      way["amenity"](${bbox.join(',')});
      way["leisure"](${bbox.join(',')});
      way["natural"="water"](${bbox.join(',')});
    );
    out tags geom;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
  const json = await response.json();

  const buildings = [];
  const roads = [];
  for (const element of json.elements ?? []) {
    if (!element.geometry || element.geometry.length < 2) continue;
    if (element.tags?.building && element.geometry.length >= 4) {
      buildings.push({ id: element.id, tags: element.tags, points: element.geometry });
    } else if (element.tags?.highway) {
      roads.push({ id: element.id, tags: element.tags, points: element.geometry });
    }
  }

  if (!buildings.length && !roads.length) throw new Error('No usable OSM ways found in that radius');
  return { buildings, roads };
}

async function addSatelliteGround(target, loadId) {
  stats.imagery = 'loading satellite';
  const zoom = target.radius > 500 ? 16 : target.radius > 330 ? 17 : 18;
  const worldSize = target.radius * 2.35;
  const half = worldSize / 2;
  const northWest = unproject(-half, -half, target);
  const southEast = unproject(half, half, target);
  const minTile = latLonToTile(southEast.lat, northWest.lon, zoom);
  const maxTile = latLonToTile(northWest.lat, southEast.lon, zoom);
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#667457';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawJobs = [];
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = maxTile.y; y <= minTile.y; y++) {
      drawJobs.push(drawImageryTile(ctx, x, y, zoom, target, half, canvas.width, canvas.height));
    }
  }

  const results = await Promise.allSettled(drawJobs);
  if (loadId !== activeLoadId) return false;
  const loaded = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  if (!loaded) throw new Error('No imagery tiles loaded');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.needsUpdate = true;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize, 1, 1),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.92, metalness: 0 })
  );
  ground.name = 'satellite-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.015;
  ground.receiveShadow = true;
  scene.add(ground);
  stats.imagery = `satellite (${loaded} tiles)`;
  return true;
}

async function drawImageryTile(ctx, x, y, zoom, origin, half, width, height) {
  const url = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
  const image = await loadImage(url);
  const nw = projectLatLon(tileToLat(y, zoom), tileToLon(x, zoom), origin);
  const se = projectLatLon(tileToLat(y + 1, zoom), tileToLon(x + 1, zoom), origin);
  const dx = ((nw.x + half) / (half * 2)) * width;
  const dy = ((nw.z + half) / (half * 2)) * height;
  const dw = ((se.x - nw.x) / (half * 2)) * width;
  const dh = ((se.z - nw.z) / (half * 2)) * height;
  ctx.drawImage(image, dx, dy, dw, dh);
  return true;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load tile ${url}`));
    image.src = url;
  });
}

function buildBuildings(buildings) {
  const buildingGroup = new THREE.Group();
  buildingGroup.name = 'osm-buildings';
  stats.buildings = 0;

  for (const building of buildings.slice(0, 850)) {
    const pts = building.points.map((point) => projectLatLon(point.lat, point.lon, currentOrigin));
    if (pts.length < 4 || polygonArea(pts) < 10) continue;

    const height = getBuildingHeight(building.tags, building.id);
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, buildingMaterial(height, building.id));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.type = 'building';
    buildingGroup.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom, 28),
      new THREE.LineBasicMaterial({ color: 0xefe2bc, transparent: true, opacity: 0.18 })
    );
    buildingGroup.add(edges);

    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) continue;
    collisionBoxes.push(box);
    stats.buildings++;
  }

  scene.add(buildingGroup);
}

function buildRoads(roads) {
  const roadGroup = new THREE.Group();
  roadGroup.name = 'osm-roads';
  stats.roads = 0;

  for (const road of roads.slice(0, 1000)) {
    const points = road.points.map((point) => projectLatLon(point.lat, point.lon, currentOrigin)).map((p) => new THREE.Vector3(p.x, 0.12, p.z));
    if (points.length < 2) continue;
    const width = roadWidth(road.tags.highway);
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
    const geom = new THREE.TubeGeometry(curve, Math.max(1, points.length * 3), width, 8, false);
    const mesh = new THREE.Mesh(geom, roadMaterial(road.tags.highway));
    mesh.receiveShadow = true;
    mesh.userData.type = 'road';
    roadGroup.add(mesh);
    stats.roads++;
  }

  scene.add(roadGroup);
}

function addBaseGround(radius) {
  const size = radius * 2.35;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size, 96, 96),
    new THREE.MeshStandardMaterial({ color: 0x566849, roughness: 1, metalness: 0 })
  );
  ground.name = 'base-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(size, Math.round(size / 20), 0xe8dba7, 0x93a36d);
  grid.name = 'scale-grid';
  grid.material.opacity = 0.08;
  grid.material.transparent = true;
  scene.add(grid);
}

function addAtmosphere(radius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 1.08, radius * 1.12, 96),
    new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
  );
  ring.name = 'world-boundary';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  scene.add(ring);
}

function addWalkableMarkers(radius) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffb84d, roughness: 0.65, emissive: 0x281300, emissiveIntensity: 0.2 });
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI * 0.25;
    const r = Math.min(radius * 0.42, 42 + i * 6);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(MARKER_SIZE, MARKER_SIZE, MARKER_SIZE), material.clone());
    marker.position.set(Math.cos(angle) * r, MARKER_SIZE / 2, Math.sin(angle) * r);
    marker.castShadow = true;
    marker.receiveShadow = true;
    marker.userData.type = 'marker';
    scene.add(marker);
    placedMarkers.push(marker);
  }
  stats.markers = placedMarkers.length;
}

function handleMouseAction(event) {
  if (!controls.isLocked) return;
  if (event.button === 0) placeMarker();
  if (event.button === 2) removeMarker();
}

function placeMarker() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const target = camera.position.clone().add(direction.multiplyScalar(4.5));
  target.y = MARKER_SIZE / 2;

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(MARKER_SIZE, MARKER_SIZE, MARKER_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x72d4ff, roughness: 0.55, emissive: 0x06202d, emissiveIntensity: 0.28 })
  );
  marker.position.copy(target);
  marker.castShadow = true;
  marker.receiveShadow = true;
  marker.userData.type = 'player-marker';
  scene.add(marker);
  placedMarkers.push(marker);
  stats.markers = placedMarkers.length;
  updateReadout();
}

function removeMarker() {
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  raycaster.set(camera.position, direction);
  const hit = raycaster.intersectObjects(placedMarkers, false)[0];
  if (!hit || hit.distance > 10) return;
  scene.remove(hit.object);
  placedMarkers.splice(placedMarkers.indexOf(hit.object), 1);
  stats.markers = placedMarkers.length;
  updateReadout();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastFrameMs) / 1000, 0.05);
  lastFrameMs = now;

  if (controls.isLocked) {
    movePlayer(dt);
  }

  document.querySelector('#hud').textContent = `${stats.buildings} buildings · ${stats.roads} roads · ${stats.markers} markers · ${stats.imagery}`;
  renderer.render(scene, camera);
}

function movePlayer(dt) {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 10.5 : 4.8;
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const oldPosition = camera.position.clone();

  controls.moveForward(forward * speed * dt);
  controls.moveRight(right * speed * dt);

  velocity.y -= 16 * dt;
  if (camera.position.y <= EYE_HEIGHT + 0.02 && keys.has('Space')) velocity.y = 5.8;
  camera.position.y += velocity.y * dt;
  if (camera.position.y < EYE_HEIGHT) {
    camera.position.y = EYE_HEIGHT;
    velocity.y = 0;
  }

  const bottom = camera.position.y - EYE_HEIGHT;
  const center = new THREE.Vector3(camera.position.x, bottom + PLAYER_HEIGHT / 2, camera.position.z);
  playerBox.setFromCenterAndSize(center, new THREE.Vector3(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH));
  for (const box of collisionBoxes) {
    if (playerBox.intersectsBox(box)) {
      camera.position.copy(oldPosition);
      velocity.y = Math.max(0, velocity.y);
      break;
    }
  }
}

function clearWorld() {
  for (const child of [...scene.children]) {
    if (!['HemisphereLight', 'DirectionalLight'].includes(child.type)) scene.remove(child);
  }
  collisionBoxes.length = 0;
  placedMarkers.length = 0;
}

function resetPlayer() {
  camera.position.set(0, EYE_HEIGHT, Math.min(62, currentOrigin.radius * 0.22));
  velocity.set(0, 0, 0);
}

function projectLatLon(lat, lon, origin) {
  return {
    x: toRad(lon - origin.lon) * R * Math.cos(toRad(origin.lat)),
    z: -toRad(lat - origin.lat) * R
  };
}

function latLonToTile(lat, lon, zoom) {
  const n = 2 ** zoom;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(toRad(lat)) + 1 / Math.cos(toRad(lat))) / Math.PI) / 2) * n)
  };
}

function tileToLon(x, zoom) {
  return (x / (2 ** zoom)) * 360 - 180;
}

function tileToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function getBuildingHeight(tags, id) {
  const parsedHeight = parseFloat(String(tags?.height ?? '').replace('m', ''));
  if (Number.isFinite(parsedHeight) && parsedHeight > 1) return clamp(parsedHeight, 3, 170);
  const levels = parseFloat(tags?.['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return clamp(levels * 3.1, 3, 170);
  return 4 + ((Number(id) || 1) % 8) * 2.8;
}

function buildingMaterial(height, id) {
  const hue = 0.085 + (((Number(id) || 0) % 21) / 21) * 0.055;
  const color = new THREE.Color().setHSL(hue, 0.15, clamp(0.28 + height / 260, 0.32, 0.58));
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.06 });
}

function roadWidth(kind) {
  if (['motorway', 'trunk', 'primary'].includes(kind)) return 3.8;
  if (['secondary', 'tertiary'].includes(kind)) return 2.6;
  if (['footway', 'path', 'cycleway', 'steps', 'pedestrian'].includes(kind)) return 0.75;
  return 1.6;
}

function roadMaterial(kind) {
  const color = ['footway', 'path', 'cycleway', 'pedestrian'].includes(kind) ? 0xc1a76d : 0x20231f;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.97, metalness: 0.02, transparent: true, opacity: 0.9 });
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area / 2);
}

function offlineSample(target) {
  const square = (cx, cz, w, d) => [
    unproject(cx - w / 2, cz - d / 2, target),
    unproject(cx + w / 2, cz - d / 2, target),
    unproject(cx + w / 2, cz + d / 2, target),
    unproject(cx - w / 2, cz + d / 2, target),
    unproject(cx - w / 2, cz - d / 2, target)
  ];
  const buildings = [];
  for (let x = -110; x <= 110; x += 32) {
    for (let z = -95; z <= 95; z += 36) {
      if (Math.abs(x) < 22 && Math.abs(z) < 28) continue;
      buildings.push({
        id: buildings.length + 10,
        tags: { building: 'yes', 'building:levels': String(1 + ((x + z + 230) % 7)) },
        points: square(x, z, 14 + Math.abs(x % 17), 16 + Math.abs(z % 15))
      });
    }
  }
  const roads = [];
  const line = (coords, kind) => ({
    id: roads.length + 1000,
    tags: { highway: kind },
    points: coords.map(([x, z]) => unproject(x, z, target))
  });
  roads.push(line([[-155, 0], [-62, 0], [0, 8], [74, 0], [155, -7]], 'primary'));
  roads.push(line([[0, -155], [0, -45], [11, 15], [0, 92], [-8, 155]], 'secondary'));
  roads.push(line([[-130, -100], [-58, -43], [25, -42], [134, -72]], 'footway'));
  roads.push(line([[-132, 100], [-42, 56], [38, 64], [140, 104]], 'residential'));
  return { buildings, roads };
}

function unproject(x, z, origin) {
  return {
    lat: origin.lat - (z / R) * (180 / Math.PI),
    lon: origin.lon + (x / (R * Math.cos(toRad(origin.lat)))) * (180 / Math.PI)
  };
}

function setStatus(message) {
  document.querySelector('#readout').textContent = message;
}

function updateReadout() {
  setStatus(`Loaded ${stats.buildings} buildings and ${stats.roads} roads. Imagery: ${stats.imagery}. Click Enter World to walk at street scale.`);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRad(deg) {
  return deg * Math.PI / 180;
}
