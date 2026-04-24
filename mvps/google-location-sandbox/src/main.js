import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  MathUtils,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { TilesRenderer, WGS84_ELLIPSOID, GeoUtils } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/core/plugins';
import {
  GLTFExtensionsPlugin,
  ReorientationPlugin,
  TileCompressionPlugin,
  TilesFadePlugin,
} from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import './styles.css';

const STORAGE_KEY = 'sandy.googleMapsApiKey';
const ENV_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const PRESETS = [
  { label: 'Eiffel Tower, Paris', lat: 48.85837, lng: 2.29448, altitude: 180 },
  { label: 'Tokyo Tower, Tokyo', lat: 35.65858, lng: 139.74543, altitude: 210 },
  { label: 'Flatiron Building, NYC', lat: 40.74106, lng: -73.9897, altitude: 180 },
  { label: 'Golden Gate Bridge, SF', lat: 37.81993, lng: -122.47826, altitude: 260 },
];

const GIB = 1024 * 1024 * 1024;
const TILE_QUALITY = {
  errorTarget: 6,
  maxDepth: 28,
  maxTilesProcessed: 900,
  downloadJobs: 32,
  parseJobs: 8,
  processJobs: 48,
  minBytes: 0.55 * GIB,
  maxBytes: 1.1 * GIB,
};

const app = document.querySelector('#app');
let selectedLocation = { ...PRESETS[0] };
let googleMap = null;
let googleMarker = null;
let activeSandbox = null;
let currentGoogleScriptKey = '';
let autocompleteMode = 'not-loaded';

app.innerHTML = `
  <section class="shell">
    <aside class="panel">
      <p class="eyebrow">Google location sandbox</p>
      <h1>Pick a real place. Enter the 3D tileset.</h1>
      <p class="lede">This MVP uses Google Maps/Places for location selection and Google Photorealistic 3D Tiles for a first-person Three.js walkthrough.</p>

      <label class="field">
        <span>Google Maps Platform API key</span>
        <input id="api-key" autocomplete="off" spellcheck="false" placeholder="VITE_GOOGLE_MAPS_API_KEY or paste a restricted dev key" />
      </label>
      <div class="key-actions">
        <button id="load-google" type="button">Load Google Picker</button>
        <button id="forget-key" type="button" class="ghost">Forget saved key</button>
      </div>
      <p id="key-note" class="note"></p>

      <div class="google-picker">
        <div class="picker-head">
          <span>Search / click map</span>
          <small id="picker-status">Waiting for API key</small>
        </div>
        <div id="autocomplete-slot" class="autocomplete-slot">
          <input id="manual-search" placeholder="Google Places search appears here after loading key" disabled />
        </div>
        <div id="map" class="map-placeholder">Google map preview loads here.</div>
      </div>

      <div class="manual-grid">
        <label class="field compact">
          <span>Latitude</span>
          <input id="lat" inputmode="decimal" />
        </label>
        <label class="field compact">
          <span>Longitude</span>
          <input id="lng" inputmode="decimal" />
        </label>
        <label class="field compact">
          <span>Start altitude / m</span>
          <input id="altitude" inputmode="decimal" />
        </label>
      </div>

      <div class="presets" id="presets"></div>

      <button id="enter" class="primary" type="button">Enter 3D Sandbox</button>
      <button id="exit" class="secondary hidden" type="button">Exit 3D Sandbox</button>

      <div class="status" id="status"></div>
    </aside>

    <main class="stage">
      <div id="scene" class="scene empty">
        <div class="empty-state">
          <p class="eyebrow">No world loaded</p>
          <h2 id="selected-title"></h2>
          <p>Load Google, choose a location, then enter the 3D sandbox. Without a key, the app remains in planning/selection mode.</p>
        </div>
      </div>
      <div id="hud" class="hud hidden">
        <div>
          <strong id="hud-location"></strong>
          <span id="hud-coords"></span>
        </div>
        <div class="hud-grid">
          <span>WASD move</span>
          <span>Mouse look</span>
          <span>Shift crouch</span>
          <span>Ctrl/Cmd sprint</span>
          <span>Space jump</span>
          <span>F fly</span>
          <span id="mode-status">Walk mode</span>
        </div>
        <div id="credits" class="credits"></div>
      </div>
    </main>
  </section>
`;

const elements = {
  apiKey: document.querySelector('#api-key'),
  loadGoogle: document.querySelector('#load-google'),
  forgetKey: document.querySelector('#forget-key'),
  keyNote: document.querySelector('#key-note'),
  pickerStatus: document.querySelector('#picker-status'),
  autocompleteSlot: document.querySelector('#autocomplete-slot'),
  map: document.querySelector('#map'),
  lat: document.querySelector('#lat'),
  lng: document.querySelector('#lng'),
  altitude: document.querySelector('#altitude'),
  presets: document.querySelector('#presets'),
  enter: document.querySelector('#enter'),
  exit: document.querySelector('#exit'),
  status: document.querySelector('#status'),
  scene: document.querySelector('#scene'),
  selectedTitle: document.querySelector('#selected-title'),
  hud: document.querySelector('#hud'),
  hudLocation: document.querySelector('#hud-location'),
  hudCoords: document.querySelector('#hud-coords'),
  modeStatus: document.querySelector('#mode-status'),
  credits: document.querySelector('#credits'),
};

initUi();

function initUi() {
  const savedKey = localStorage.getItem(STORAGE_KEY) || '';
  elements.apiKey.value = ENV_KEY || savedKey;
  elements.keyNote.textContent = ENV_KEY
    ? 'Using VITE_GOOGLE_MAPS_API_KEY from the local environment. Browser-visible keys must be restricted in Google Cloud.'
    : 'No key is committed. Paste a restricted local key or create .env from .env.example.';

  elements.presets.innerHTML = PRESETS.map((preset, index) => `
    <button type="button" data-preset="${index}">${preset.label}</button>
  `).join('');

  elements.presets.addEventListener('click', (event) => {
    const button = event.target.closest('[data-preset]');
    if (!button) return;
    setSelectedLocation(PRESETS[Number(button.dataset.preset)], { panMap: true });
  });

  for (const input of [elements.lat, elements.lng, elements.altitude]) {
    input.addEventListener('change', updateLocationFromManualInputs);
    input.addEventListener('blur', updateLocationFromManualInputs);
  }

  elements.loadGoogle.addEventListener('click', () => initGooglePicker().catch(handleFatalError));
  elements.forgetKey.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    if (!ENV_KEY) elements.apiKey.value = '';
    setStatus('Saved key removed from localStorage.');
  });
  elements.enter.addEventListener('click', () => enterSandbox().catch(handleFatalError));
  elements.exit.addEventListener('click', exitSandbox);

  setSelectedLocation(selectedLocation);
  updateLaunchState();

  if (ENV_KEY || savedKey) {
    initGooglePicker().catch((error) => {
      console.warn(error);
      setStatus(`Google picker did not load: ${error.message}`);
    });
  }
}

function getApiKey() {
  return elements.apiKey.value.trim();
}

function updateLaunchState() {
  const hasKey = Boolean(getApiKey());
  elements.enter.disabled = !hasKey;
  if (!hasKey) {
    setStatus('A Google Maps Platform API key is required before live Places search or 3D Tiles can load.');
  }
}

function updateLocationFromManualInputs() {
  const lat = Number.parseFloat(elements.lat.value);
  const lng = Number.parseFloat(elements.lng.value);
  const altitude = Number.parseFloat(elements.altitude.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setStatus('Latitude and longitude must be valid numbers.');
    return;
  }
  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) {
    setStatus('Latitude must be between -85 and 85, longitude between -180 and 180.');
    return;
  }
  setSelectedLocation({
    label: `Manual location ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    altitude: Number.isFinite(altitude) ? altitude : 180,
  }, { panMap: true });
}

function setSelectedLocation(location, options = {}) {
  selectedLocation = {
    label: location.label || 'Selected location',
    lat: Number(location.lat),
    lng: Number(location.lng),
    altitude: Number(location.altitude ?? selectedLocation.altitude ?? 180),
  };

  elements.lat.value = selectedLocation.lat.toFixed(6);
  elements.lng.value = selectedLocation.lng.toFixed(6);
  elements.altitude.value = String(Math.round(selectedLocation.altitude));
  elements.selectedTitle.textContent = selectedLocation.label;
  elements.hudLocation.textContent = selectedLocation.label;
  elements.hudCoords.textContent = `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;

  if (googleMap && options.panMap) {
    const position = { lat: selectedLocation.lat, lng: selectedLocation.lng };
    googleMap.panTo(position);
    googleMap.setZoom(Math.max(googleMap.getZoom() || 17, 17));
    googleMarker?.setPosition(position);
  }

  updateLaunchState();
}

async function initGooglePicker() {
  const apiKey = getApiKey();
  if (!apiKey) {
    setStatus('Paste a Google Maps Platform API key first.');
    return;
  }
  localStorage.setItem(STORAGE_KEY, apiKey);
  elements.pickerStatus.textContent = 'Loading Google Maps...';
  elements.loadGoogle.disabled = true;

  await loadGoogleMaps(apiKey);
  await initMapPreview();
  await initAutocomplete();

  elements.pickerStatus.textContent = `Ready (${autocompleteMode})`;
  setStatus('Google picker is ready. Search, click the map, or use a preset.');
  elements.loadGoogle.disabled = false;
  updateLaunchState();
}

function loadGoogleMaps(apiKey) {
  if (window.google?.maps && currentGoogleScriptKey === apiKey) {
    return Promise.resolve();
  }
  if (window.google?.maps && currentGoogleScriptKey && currentGoogleScriptKey !== apiKey) {
    window.location.reload();
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const callbackName = '__sandyGoogleMapsReady';
    window[callbackName] = () => {
      currentGoogleScriptKey = apiKey;
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error('Google Maps JavaScript API failed to load. Check key restrictions and enabled APIs.'));
    document.head.appendChild(script);
  });
}

async function initMapPreview() {
  const { Map } = await google.maps.importLibrary('maps');
  const position = { lat: selectedLocation.lat, lng: selectedLocation.lng };

  elements.map.classList.remove('map-placeholder');
  elements.map.textContent = '';

  googleMap = new Map(elements.map, {
    center: position,
    zoom: 18,
    mapTypeId: 'satellite',
    tilt: 0,
    clickableIcons: true,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
  });

  googleMarker = new google.maps.Marker({
    map: googleMap,
    position,
    draggable: true,
    title: 'Sandbox start location',
  });

  googleMap.addListener('click', (event) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLocation({ label: `Map pick ${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, altitude: selectedLocation.altitude }, { panMap: false });
    googleMarker.setPosition({ lat, lng });
  });

  googleMarker.addListener('dragend', (event) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setSelectedLocation({ label: `Marker pick ${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, altitude: selectedLocation.altitude }, { panMap: false });
  });
}

async function initAutocomplete() {
  elements.autocompleteSlot.innerHTML = '';

  try {
    const places = await google.maps.importLibrary('places');
    if (places.PlaceAutocompleteElement) {
      const autocomplete = new places.PlaceAutocompleteElement();
      autocomplete.className = 'place-autocomplete';
      autocomplete.addEventListener('gmp-select', async (event) => {
        const prediction = event.placePrediction || event.detail?.placePrediction || event.detail?.prediction;
        if (!prediction?.toPlace) return;
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'viewport'] });
        const latLng = place.location;
        if (!latLng) return;
        const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
        const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
        setSelectedLocation({
          label: place.displayName || place.formattedAddress || prediction.text?.toString() || 'Google place',
          lat,
          lng,
          altitude: selectedLocation.altitude,
        }, { panMap: true });
      });
      elements.autocompleteSlot.appendChild(autocomplete);
      autocompleteMode = 'PlaceAutocompleteElement';
      return;
    }
  } catch (error) {
    console.warn('PlaceAutocompleteElement unavailable, falling back to legacy Autocomplete.', error);
  }

  const input = document.createElement('input');
  input.placeholder = 'Search Google Places';
  input.autocomplete = 'off';
  elements.autocompleteSlot.appendChild(input);

  const autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ['geometry', 'name', 'formatted_address'],
  });
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    const latLng = place.geometry?.location;
    if (!latLng) {
      setStatus('That place did not return geometry. Try another result.');
      return;
    }
    const lat = latLng.lat();
    const lng = latLng.lng();
    setSelectedLocation({
      label: place.name || place.formatted_address || 'Google place',
      lat,
      lng,
      altitude: selectedLocation.altitude,
    }, { panMap: true });
  });
  autocompleteMode = 'legacy Autocomplete fallback';
}

async function enterSandbox() {
  const apiKey = getApiKey();
  if (!apiKey) {
    updateLaunchState();
    return;
  }

  localStorage.setItem(STORAGE_KEY, apiKey);
  elements.enter.disabled = true;
  setStatus(`Loading Google Photorealistic 3D Tiles at ${selectedLocation.label}...`);

  exitSandbox({ silent: true });
  activeSandbox = new LocationSandbox({
    container: elements.scene,
    creditsEl: elements.credits,
    apiKey,
    location: selectedLocation,
  });
  await activeSandbox.start();

  elements.scene.classList.remove('empty');
  elements.hud.classList.remove('hidden');
  elements.exit.classList.remove('hidden');
  elements.enter.disabled = false;
  setStatus('3D sandbox running. Click the viewport for mouse look.');
}

function exitSandbox(options = {}) {
  if (activeSandbox) {
    activeSandbox.dispose();
    activeSandbox = null;
  }
  elements.scene.innerHTML = `
    <div class="empty-state">
      <p class="eyebrow">No world loaded</p>
      <h2>${escapeHtml(selectedLocation.label)}</h2>
      <p>Load Google, choose a location, then enter the 3D sandbox. Without a key, the app remains in planning/selection mode.</p>
    </div>
  `;
  elements.scene.classList.add('empty');
  elements.hud.classList.add('hidden');
  elements.exit.classList.add('hidden');
  if (!options.silent) setStatus('Exited the 3D sandbox.');
}

class LocationSandbox {
  constructor({ container, creditsEl, apiKey, location }) {
    this.container = container;
    this.creditsEl = creditsEl;
    this.apiKey = apiKey;
    this.location = location;
    this.clock = new Clock();
    this.keys = new Set();
    this.pointer = { locked: false, yaw: 0, pitch: -0.28 };
    this.forward = new Vector3();
    this.right = new Vector3();
    this.raycaster = new Raycaster();
    this.down = new Vector3(0, -1, 0);
    this.flyMode = false;
    this.grounded = false;
    this.verticalVelocity = 0;
    this.gravity = -24;
    this.jumpVelocity = 9.2;
    this.standingEyeHeight = 2.2;
    this.crouchEyeHeight = 1.25;
    this.eyeHeight = this.standingEyeHeight;
    this.groundY = null;
    this.lastGroundProbe = 0;
    this.bound = {
      resize: () => this.onResize(),
      keydown: (event) => this.onKeyDown(event),
      keyup: (event) => this.keys.delete(event.code),
      mousemove: (event) => this.onMouseMove(event),
      click: () => this.renderer?.domElement.requestPointerLock(),
      pointerlockchange: () => {
        this.pointer.locked = document.pointerLockElement === this.renderer?.domElement;
      },
    };
  }

  async start() {
    this.container.innerHTML = '';
    this.scene = new Scene();
    this.scene.background = new Color(0x0c1118);
    this.scene.fog = new FogExp2(0x0c1118, 0.00055);

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(68, this.container.clientWidth / this.container.clientHeight, 0.1, 900000);
    this.camera.position.set(0, this.location.altitude, 420);
    this.camera.lookAt(0, 30, 0);

    this.scene.add(new AmbientLight(0xffffff, 1.8));
    const sun = new DirectionalLight(0xffffff, 4.5);
    sun.position.set(100, 220, 80);
    this.scene.add(sun);

    this.createTiles();
    this.bindEvents();
    this.onResize();
    this.animate();
  }

  createTiles() {
    this.tiles = new TilesRenderer();
    this.tiles.registerPlugin(new GoogleCloudAuthPlugin({
      apiToken: this.apiKey,
      autoRefreshToken: true,
      useRecommendedSettings: true,
    }));
    this.tiles.registerPlugin(new TileCompressionPlugin());
    this.tiles.registerPlugin(new TilesFadePlugin());
    this.tiles.registerPlugin(new GLTFExtensionsPlugin({
      dracoLoader: new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.182.0/examples/jsm/libs/draco/gltf/'),
    }));
    this.tiles.registerPlugin(new ReorientationPlugin({
      lat: this.location.lat * MathUtils.DEG2RAD,
      lon: this.location.lng * MathUtils.DEG2RAD,
      height: 0,
    }));
    this.tiles.errorTarget = TILE_QUALITY.errorTarget;
    this.tiles.maxDepth = TILE_QUALITY.maxDepth;
    this.tiles.maxTilesProcessed = TILE_QUALITY.maxTilesProcessed;
    this.tiles.downloadQueue.maxJobs = TILE_QUALITY.downloadJobs;
    this.tiles.parseQueue.maxJobs = TILE_QUALITY.parseJobs;
    this.tiles.processNodeQueue.maxJobs = TILE_QUALITY.processJobs;
    this.tiles.lruCache.minBytesSize = TILE_QUALITY.minBytes;
    this.tiles.lruCache.maxBytesSize = TILE_QUALITY.maxBytes;

    this.scene.add(this.tiles.group);
    this.tiles.setCamera(this.camera);
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);

    this.tiles.addEventListener('load-error', (event) => {
      console.error('Tile load error', event);
      setStatus('A Google tile request failed. Check Map Tiles API access, billing, referrer restrictions, and quota.');
    });
  }

  bindEvents() {
    window.addEventListener('resize', this.bound.resize);
    window.addEventListener('keydown', this.bound.keydown);
    window.addEventListener('keyup', this.bound.keyup);
    document.addEventListener('mousemove', this.bound.mousemove);
    document.addEventListener('pointerlockchange', this.bound.pointerlockchange);
    this.renderer.domElement.addEventListener('click', this.bound.click);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.tiles?.setResolutionFromRenderer(this.camera, this.renderer);
  }

  onKeyDown(event) {
    const gameplayKeys = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'Space', 'ShiftLeft', 'ShiftRight',
      'ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight',
      'KeyF',
    ];
    if (gameplayKeys.includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyF' && !event.repeat) {
      this.flyMode = !this.flyMode;
      this.verticalVelocity = 0;
      this.grounded = false;
      setStatus(`${this.flyMode ? 'Fly' : 'Walk'} mode enabled.`);
    }

    if (event.code === 'Space' && !event.repeat && !this.flyMode && this.grounded) {
      this.verticalVelocity = this.jumpVelocity;
      this.grounded = false;
    }

    this.keys.add(event.code);
  }

  onMouseMove(event) {
    if (!this.pointer.locked) return;
    this.pointer.yaw -= event.movementX * 0.002;
    this.pointer.pitch -= event.movementY * 0.002;
    this.pointer.pitch = MathUtils.clamp(this.pointer.pitch, -1.45, 1.25);
  }

  updateCamera(delta) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.pointer.yaw;
    this.camera.rotation.x = this.pointer.pitch;
    this.camera.rotation.z = 0;

    const sprinting = this.keys.has('ControlLeft') ||
      this.keys.has('ControlRight') ||
      this.keys.has('MetaLeft') ||
      this.keys.has('MetaRight');
    const crouching = !this.flyMode && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
    const targetEyeHeight = crouching ? this.crouchEyeHeight : this.standingEyeHeight;
    this.eyeHeight = MathUtils.lerp(this.eyeHeight, targetEyeHeight, Math.min(1, delta * 12));

    const speed = this.flyMode
      ? (sprinting ? 95 : 42)
      : crouching
        ? 4.2
        : sprinting
          ? 16
          : 7.5;

    if (this.flyMode) {
      this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      this.right.set(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    } else {
      this.forward.set(
        Math.sin(this.pointer.yaw),
        0,
        Math.cos(this.pointer.yaw) * -1,
      ).normalize();
      this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    }

    const move = new Vector3();
    if (this.keys.has('KeyW')) move.add(this.forward);
    if (this.keys.has('KeyS')) move.sub(this.forward);
    if (this.keys.has('KeyD')) move.add(this.right);
    if (this.keys.has('KeyA')) move.sub(this.right);

    if (this.flyMode) {
      if (this.keys.has('Space')) move.y += 1;
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) move.y -= 1;
    } else {
      move.y = 0;
    }

    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * delta);

    this.camera.position.add(move);

    if (this.flyMode) {
      this.grounded = false;
      this.verticalVelocity = 0;
    } else {
      this.applyWalkingVerticalMotion(delta);
    }

    this.updateModeStatus(crouching, sprinting);
  }

  applyWalkingVerticalMotion(delta) {
    const groundY = this.probeGroundY();
    if (groundY === null) {
      return;
    }

    const targetY = groundY + this.eyeHeight;

    if (this.camera.position.y < targetY) {
      this.camera.position.y = targetY;
      this.verticalVelocity = 0;
      this.grounded = true;
      return;
    }

    if (this.verticalVelocity <= 0 && this.camera.position.y <= targetY + 0.25) {
      this.camera.position.y = MathUtils.lerp(this.camera.position.y, targetY, Math.min(1, delta * 18));
      if (Math.abs(this.camera.position.y - targetY) < 0.04) {
        this.camera.position.y = targetY;
      }
      this.verticalVelocity = 0;
      this.grounded = true;
      return;
    }

    this.verticalVelocity += this.gravity * delta;
    this.camera.position.y += this.verticalVelocity * delta;
    this.grounded = false;
  }

  probeGroundY() {
    if (!this.tiles?.group) return null;
    if (performance.now() - this.lastGroundProbe < 45) {
      return this.groundY;
    }

    this.lastGroundProbe = performance.now();
    const origin = this.camera.position.clone();
    origin.y += 450;
    this.raycaster.set(origin, this.down);
    this.raycaster.far = 1500;
    const hits = this.raycaster.intersectObject(this.tiles.group, true);
    this.groundY = hits.length ? hits[0].point.y : null;
    return this.groundY;
  }

  updateModeStatus(crouching, sprinting) {
    if (!elements.modeStatus) return;
    if (this.flyMode) {
      elements.modeStatus.textContent = sprinting ? 'Fly sprint' : 'Fly mode';
    } else if (!this.grounded) {
      elements.modeStatus.textContent = 'Airborne';
    } else if (crouching) {
      elements.modeStatus.textContent = 'Crouch';
    } else if (sprinting) {
      elements.modeStatus.textContent = 'Sprint';
    } else {
      elements.modeStatus.textContent = 'Walk mode';
    }
  }

  updateCredits() {
    if (!this.tiles) return;
    const mat = this.tiles.group.matrixWorld.clone().invert();
    const local = this.camera.position.clone().applyMatrix4(mat);
    const cart = {};
    WGS84_ELLIPSOID.getPositionToCartographic(local, cart);

    const attributions = this.tiles.getAttributions()
      .map((entry) => entry.value)
      .filter(Boolean)
      .join(' ');

    const coords = Number.isFinite(cart.lat) && Number.isFinite(cart.lon)
      ? GeoUtils.toLatLonString(cart.lat, cart.lon)
      : `${this.location.lat.toFixed(6)}, ${this.location.lng.toFixed(6)}`;

    this.creditsEl.innerHTML = `
      <span>${escapeHtml(coords)}</span>
      <span>Google Photorealistic 3D Tiles</span>
      <span>${attributions || 'Map data © Google'}</span>
    `;
  }

  animate() {
    this.frame = requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.updateCamera(delta);

    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.setCamera(this.camera);
    this.camera.updateMatrixWorld();
    this.tiles.update();

    this.renderer.render(this.scene, this.camera);
    this.updateCredits();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.bound.resize);
    window.removeEventListener('keydown', this.bound.keydown);
    window.removeEventListener('keyup', this.bound.keyup);
    document.removeEventListener('mousemove', this.bound.mousemove);
    document.removeEventListener('pointerlockchange', this.bound.pointerlockchange);
    this.renderer?.domElement.removeEventListener('click', this.bound.click);
    if (document.pointerLockElement === this.renderer?.domElement) document.exitPointerLock();
    this.tiles?.dispose();
    this.renderer?.dispose();
    this.container.innerHTML = '';
  }
}

function setStatus(message) {
  elements.status.textContent = message;
}

function handleFatalError(error) {
  console.error(error);
  elements.loadGoogle.disabled = false;
  elements.enter.disabled = false;
  setStatus(error.message || String(error));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}
