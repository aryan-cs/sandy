import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import './styles.css';

const SCENES = [
  {
    id: 'painted-bedroom',
    title: 'Captured Bedroom',
    description: 'Interior generated/captured Marble-style .spz scene for room-scale walkthrough testing.',
    url: 'https://storage.googleapis.com/forge-dev-public/painted_bedroom.spz',
    scale: 1.8,
    rotation: [Math.PI, 0, 0],
    position: [0, -1.2, -4],
    start: [0, 1.6, 2.9],
    yaw: Math.PI,
    bounds: { x: 10, z: 12 }
  },
  {
    id: 'snow-street',
    title: 'Captured Snow Street',
    description: 'Outdoor real-world Gaussian Splat capture. This is the closest no-key browser substitute for the Twitter demos.',
    url: 'https://sparkjs.dev/assets/splats/snow-street.spz',
    scale: 2.4,
    rotation: [Math.PI, 0, 0],
    position: [0, -1.4, -7],
    start: [0, 1.65, 5.2],
    yaw: Math.PI,
    bounds: { x: 18, z: 22 }
  },
  {
    id: 'forge',
    title: 'Captured Forge',
    description: 'Dense object/room splat with real texture complexity and photographic color.',
    url: 'https://sparkjs.dev/assets/splats/forge.spz',
    scale: 1.7,
    rotation: [Math.PI, 0, 0],
    position: [0, -1.1, -4.5],
    start: [0, 1.55, 2.8],
    yaw: Math.PI,
    bounds: { x: 10, z: 12 }
  },
  {
    id: 'valley',
    title: 'Captured Valley',
    description: 'Outdoor splat scene for free-fly walkthrough testing.',
    url: 'https://sparkjs.dev/assets/splats/valley.spz',
    scale: 2.0,
    rotation: [Math.PI, 0, 0],
    position: [0, -1.8, -6],
    start: [0, 1.8, 4],
    yaw: Math.PI,
    bounds: { x: 18, z: 20 }
  }
];

const EYE_HEIGHT = 1.65;
const WALK_SPEED = 2.35;
const SPRINT_SPEED = 5.5;
const keys = new Set();
const pointer = { locked: false, yaw: Math.PI, pitch: 0 };
const velocity = new THREE.Vector3();
const move = new THREE.Vector3();
const side = new THREE.Vector3();

let scene;
let camera;
let renderer;
let spark;
let activeSplat = null;
let activePreset = SCENES[0];
let lastFrameMs = performance.now();
let loadToken = 0;

const app = document.querySelector('#app');
app.innerHTML = `
  <canvas id="stage"></canvas>
  <main class="panel" id="panel">
    <div class="eyebrow">GAUSSIAN SPLAT DIGITAL TWIN</div>
    <h1>Walk a photographed place, not a map.</h1>
    <p class="lede">This version loads real .spz Gaussian Splat captures. The scene is photographic because the color and geometry come from camera reconstruction, not OSM footprints.</p>
    <label>Preloaded captured world
      <select id="scene-picker">
        ${SCENES.map((item, index) => `<option value="${index}">${item.title}</option>`).join('')}
      </select>
    </label>
    <div class="actions">
      <button id="load">Load Capture</button>
      <button id="enter">Enter Walkthrough</button>
      <button id="reset">Reset Camera</button>
    </div>
    <p class="status" id="status">Preparing renderer...</p>
    <p class="controls">Click Enter, then WASD to walk. Mouse looks around. Shift sprints. Space/C toggles height. Esc exits.</p>
  </main>
  <div class="hud" id="hud">loading</div>
  <div class="reticle"></div>
`;

init();
loadCapture(activePreset);
animate();

function init() {
  const canvas = document.querySelector('#stage');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.02, 1000);

  spark = new SparkRenderer({ renderer });
  scene.add(spark);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 0.6));
  addReferenceFloor();

  document.querySelector('#scene-picker').addEventListener('change', (event) => {
    activePreset = SCENES[Number(event.target.value)];
    setStatus(activePreset.description);
  });
  document.querySelector('#load').addEventListener('click', () => loadCapture(activePreset));
  document.querySelector('#enter').addEventListener('click', () => lockPointer());
  document.querySelector('#reset').addEventListener('click', () => resetCamera(activePreset));

  document.addEventListener('pointerlockchange', () => {
    pointer.locked = document.pointerLockElement === renderer.domElement;
    document.body.classList.toggle('walking', pointer.locked);
  });
  document.addEventListener('mousemove', (event) => {
    if (!pointer.locked) return;
    pointer.yaw -= event.movementX * 0.002;
    pointer.pitch -= event.movementY * 0.002;
    pointer.pitch = clamp(pointer.pitch, -1.35, 1.35);
  });
  document.addEventListener('keydown', (event) => keys.add(event.code));
  document.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('resize', resize);
}

async function loadCapture(preset) {
  const token = ++loadToken;
  setStatus(`Loading ${preset.title}...`);
  document.querySelector('#hud').textContent = 'downloading .spz capture';

  if (activeSplat) {
    scene.remove(activeSplat);
    activeSplat.dispose?.();
    activeSplat = null;
  }

  const splat = new SplatMesh({
    url: preset.url,
    onProgress: (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setStatus(`Loading ${preset.title}: ${percent}%`);
      document.querySelector('#hud').textContent = `${preset.title} · ${percent}%`;
    }
  });

  splat.scale.setScalar(preset.scale);
  splat.rotation.set(...preset.rotation);
  splat.position.set(...preset.position);
  scene.add(splat);

  try {
    await splat.initialized;
    if (token !== loadToken) return;
    activeSplat = splat;
    resetCamera(preset);
    setStatus(`${preset.title} loaded. This is a real Gaussian Splat capture, so colors/facades/details come from camera reconstruction. Click Enter Walkthrough.`);
    document.querySelector('#hud').textContent = `${preset.title} · photoreal .spz loaded`;
  } catch (error) {
    console.error(error);
    setStatus(`Failed to load ${preset.title}: ${error.message}`);
    document.querySelector('#hud').textContent = 'load failed';
  }
}

function resetCamera(preset) {
  camera.position.set(...preset.start);
  pointer.yaw = preset.yaw;
  pointer.pitch = 0;
  velocity.set(0, 0, 0);
  updateCameraRotation();
}

function lockPointer() {
  renderer.domElement.requestPointerLock();
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastFrameMs) / 1000, 0.05);
  lastFrameMs = now;

  updateCameraRotation();
  updateMovement(dt);
  renderer.render(scene, camera);
}

function updateCameraRotation() {
  camera.rotation.order = 'YXZ';
  camera.rotation.y = pointer.yaw;
  camera.rotation.x = pointer.pitch;
  camera.rotation.z = 0;
}

function updateMovement(dt) {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  const right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const lift = Number(keys.has('Space')) - Number(keys.has('KeyC'));

  move.set(Math.sin(pointer.yaw), 0, Math.cos(pointer.yaw)).multiplyScalar(forward);
  side.set(Math.cos(pointer.yaw), 0, -Math.sin(pointer.yaw)).multiplyScalar(right);
  move.add(side);
  if (move.lengthSq() > 1) move.normalize();
  camera.position.addScaledVector(move, speed * dt);

  // Splat files do not ship semantic floor colliders, so vertical motion is explicit and bounded.
  camera.position.y += lift * speed * 0.55 * dt;
  camera.position.y = clamp(camera.position.y, 0.45, 4.5);

  const bounds = activePreset.bounds;
  camera.position.x = clamp(camera.position.x, -bounds.x, bounds.x);
  camera.position.z = clamp(camera.position.z, -bounds.z, bounds.z);
}

function addReferenceFloor() {
  const grid = new THREE.GridHelper(40, 40, 0x303030, 0x151515);
  grid.position.y = -0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  scene.add(grid);
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setStatus(message) {
  document.querySelector('#status').textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
