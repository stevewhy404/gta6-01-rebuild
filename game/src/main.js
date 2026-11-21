// Solmar Bay — bootstrap and game loop. An original open-world crime game:
// a city to explore on foot and by car, traffic, pedestrians, car theft, a wanted
// system with police, five story missions, taxi jobs, hidden packages, combat,
// a HUD with minimap, a start screen and saves. No network requests, no assets
// beyond these files; all sound is synthesized.
import { WORLD, PLAYER_START, DISTRICTS } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { generateCity } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  makeCar, makePlayer, makePed, updateCarPhysics, updatePlayerOnFoot,
  nearestCar, enterCar, exitCar, updateBullets, updateParticles,
  spawnExplosion, maintainPopulation, resolveCarCollisions,
} from './entities.js';
import { updateTraffic, updatePeds } from './traffic.js';
import { updateWanted } from './police.js';
import { updateMissions, updateTaxi, updatePackages, PACKAGE_SPOTS, startMission } from './missions.js';
import { playerShoot, driveByShoot, enemyShoot, aimAngle } from './combat.js';
import { render, drawMinimap } from './render.js';
import { updateHUD, showToast, showScreen, updatePauseStats } from './hud.js';
import { hasSave, saveGame, loadSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261121', 10);
const shot = params.get('shot');

window.__solmarErrors = [];
window.addEventListener('error', (e) => {
  window.__solmarErrors.push(`${e.message} @${e.filename || ''}:${e.lineno || ''}`);
  const d = document.getElementById('debug');
  if (d) d.textContent = window.__solmarErrors.join(' | ');
});

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const input = createInput(canvas);
const audio = createAudio();

function createState() {
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const state = {
    rng,
    city,
    districts: DISTRICTS,
    time: 0,
    dayTime: 17.2,
    money: 0,
    respect: 0,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    arrestTimer: 0,
    playerFiredRecently: 0,
    player: makePlayer(PLAYER_START.x, PLAYER_START.y),
    cars: [],
    peds: [],
    police: [],
    bullets: [],
    particles: [],
    muzzles: [],
    events: [],
    mission: null,
    storyComplete: false,
    maraRiding: false,
    taxi: null,
    packagesFound: new Set(),
    packageSpots: PACKAGE_SPOTS,
    stats: { missionsDone: 0, carsStolen: 0, kills: 0, taxiDone: 0 },
    camera: { x: PLAYER_START.x, y: PLAYER_START.y, zoom: 1 },
    zoomLevels: [1, 0.7, 1.3],
    zoomIdx: 0,
    mode: 'title',
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    warmup: 0,
    view: { w: window.innerWidth, h: window.innerHeight },
    input,
    audio,
    ctx,
  };
  // A few parked cars near the start so the first mission is playable at once.
  const starter = makeCar(2600, 1740, 0, { driver: 'parked', rng });
  state.cars.push(starter);
  const second = makeCar(2380, 1900, Math.PI / 2, { driver: 'parked', rng });
  state.cars.push(second);
  return state;
}

const state = createState();

// --- Save handling on the title screen.
if (hasSave()) {
  const s = loadSave();
  if (s) {
    document.getElementById('continueNote').textContent =
      `Save found: $${s.money} · Mission ${s.missionIndex >= 99 ? 'complete' : s.missionIndex + 1} · ${s.packagesFound.length}/10 packages — START loads it.`;
  }
}

function startGame() {
  audio.unlock();
  audio.startMusic();
  const s = loadSave();
  if (s && !state.startedOnce) {
    state.money = s.money;
    state.respect = s.respect;
    state.player.health = s.health;
    state.player.armor = s.armor;
    state.player.x = s.x;
    state.player.y = s.y;
    state.packagesFound = new Set(s.packagesFound);
    state.stats = s.stats;
    state.dayTime = s.dayTime;
    state.camera.x = s.x;
    state.camera.y = s.y;
    if (s.missionIndex < 99) startMission(state, s.missionIndex);
    else state.storyComplete = true;
    showToast('WELCOME BACK', 'Your save was loaded');
  } else if (!state.mission && !state.storyComplete) {
    startMission(state, 0);
  }
  state.startedOnce = true;
  state.mode = 'playing';
  showScreen(null);
}

document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', () => {
  state.mode = 'playing';
  showScreen(null);
});
document.getElementById('saveBtn').addEventListener('click', () => {
  const ok = saveGame(state);
  document.getElementById('pauseStats').textContent = ok ? 'Game saved.' : 'Save failed (storage unavailable).';
});
document.getElementById('quitBtn').addEventListener('click', () => {
  saveGame(state);
  state.mode = 'title';
  showScreen('startScreen');
});
document.getElementById('retryBtn').addEventListener('click', () => {
  const p = state.player;
  p.health = 100; p.armor = 0; p.inCar = null;
  p.x = PLAYER_START.x; p.y = PLAYER_START.y;
  state.wanted = 0; state.wantedTimer = 0;
  state.police = [];
  state.peds = state.peds.filter((ped) => ped.state === 'guard');
  state.mode = 'playing';
  showScreen(null);
  showToast('BACK ON THE STREETS', 'Mara is not done with you yet');
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.view.w = window.innerWidth;
  state.view.h = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Screenshot staging: ?shot=... starts the game and stages a scene.
if (shot) applyShot(state, shot);

let last = performance.now();
let firstFrame = true;

function processEvents() {
  for (const ev of state.events) {
    if (ev.type === 'toast' && state.shotMode) continue; // staged screenshots stay clean
    if (ev.type === 'toast') showToast(ev.title, ev.sub);
    else if (ev.type === 'log') console.log('[Solmar Bay]', ev.text);
    else if (ev.type === 'shake') state.shake = Math.max(state.shake, ev.power);
    else if (ev.type === 'crash') {
      audio.crash();
      state.shake = Math.max(state.shake, ev.hard ? 9 : 4);
    } else if (ev.type === 'explosion') {
      spawnExplosion(state, ev.x, ev.y);
      state.cars = state.cars.filter((c) => !(c.dead && dist(c.x, c.y, ev.x, ev.y) < 5));
    } else if (ev.type === 'muzzle') {
      state.muzzles.push({ x: ev.x, y: ev.y, angle: ev.angle, life: 0.07 });
    } else if (ev.type === 'enemyShot') {
      enemyShoot(state, ev.x, ev.y, ev.angle);
    }
  }
  state.events = [];
}

function update(dt) {
  state.time += dt * 1000;
  state.dayTime = (state.dayTime + dt / 240) % 24;
  if (state.playerFiredRecently > 0) state.playerFiredRecently -= dt;
  for (const mz of state.muzzles) mz.life -= dt;
  state.muzzles = state.muzzles.filter((m) => m.life > 0);

  const p = state.player;
  const keys = input.keys;
  const move = {
    up: keys['w'] || keys['arrowup'],
    down: keys['s'] || keys['arrowdown'],
    left: keys['a'] || keys['arrowleft'],
    right: keys['d'] || keys['arrowright'],
    sprint: keys['shift'],
  };

  if (p.inCar) {
    const car = p.inCar;
    let forward = move.up ? 1 : move.down ? -1 : 0;
    let steer = (move.left ? -1 : 0) + (move.right ? 1 : 0);
    if (state.shotMode) { forward = 1; steer = 0; } // staged cars keep driving for the shot
    const brake = !!keys[' '];
    updateCarPhysics(state, car, dt, { forward, steer, brake });
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (Math.abs(car.speed) > 300 && Math.random() < dt * 8) {
      state.particles.push({
        x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24,
        vx: 0, vy: 0, life: 0.35, max: 0.35, color: 'rgba(200,200,200,0.6)', size: 5,
      });
    }
    audio.setEngine(Math.abs(car.speed) / 560, true);
    if (input.consumeClick()) driveByShoot(state);
  } else {
    updatePlayerOnFoot(state, dt, move);
    audio.setEngine(0, false);
    if (input.mouse.down) playerShoot(state);
    else input.consumeClick();
  }

  // Edge-triggered keys.
  if (input.wasPressed('e')) {
    if (p.inCar) exitCar(state);
    else {
      const car = nearestCar(state, 70);
      if (car) enterCar(state, car);
    }
  }
  if (input.wasPressed('p') || input.wasPressed('escape')) {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      updatePauseStats(state);
      showScreen('pauseScreen');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      showScreen(null);
    }
  }
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    showToast(muted ? 'SOUND OFF' : 'SOUND ON', '');
  }
  if (input.wasPressed('c')) {
    state.zoomIdx = (state.zoomIdx + 1) % state.zoomLevels.length;
    state.camera.zoom = state.zoomLevels[state.zoomIdx];
  }
  if (input.wasPressed('h') && p.inCar) audio.honk();
  if (input.wasPressed('f') && !state.taxi) {
    // Hail a fare: one spawns at a nearby landmark.
    const spots = [
      { x: 1000, y: 1000, name: 'Palm Plaza' },
      { x: 3400, y: 1800, name: 'Downtown' },
      { x: 1800, y: 2600, name: 'Marina District' },
      { x: 4200, y: 2200, name: 'Old Town' },
    ];
    const from = spots.reduce((a, b) => (dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b));
    const to = spots[(spots.indexOf(from) + 1 + Math.floor(Math.random() * 2)) % spots.length];
    state.taxi = { x: from.x, y: from.y, dx: to.x, dy: to.y, destName: to.name, pay: 80, timer: 150, pickedUp: false };
    showToast('TAXI FARE', `Passenger waiting at ${from.name} — drive there`);
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateWanted(state, dt);
  updateMissions(state, dt);
  updateTaxi(state, dt);
  updatePackages(state);
  updateBullets(state, dt);
  updateParticles(state, dt);
  resolveCarCollisions(state);
  maintainPopulation(state);

  // Camera follows the player with a little look-ahead.
  const lookX = p.inCar ? Math.cos(p.angle) * p.inCar.speed * 0.22 : 0;
  const lookY = p.inCar ? Math.sin(p.angle) * p.inCar.speed * 0.22 : 0;
  const tx = clamp(p.x + lookX, state.view.w / 2 / state.camera.zoom, WORLD.w - state.view.w / 2 / state.camera.zoom);
  const ty = clamp(p.y + lookY, state.view.h / 2 / state.camera.zoom, WORLD.h - state.view.h / 2 / state.camera.zoom);
  state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);

  // Screen shake.
  if (state.shake > 0.2) {
    state.shakeX = (Math.random() - 0.5) * state.shake;
    state.shakeY = (Math.random() - 0.5) * state.shake;
    state.shake *= Math.pow(0.02, dt);
  } else {
    state.shake = 0; state.shakeX = 0; state.shakeY = 0;
  }

  processEvents();
  input.endFrame();
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (state.mode === 'playing') {
    if (state.warmup > 0) {
      // Fast-forward the world so screenshots show a living city.
      for (let i = 0; i < 4; i++) update(0.05);
      state.warmup -= dt;
    } else {
      update(dt);
    }
  } else if (state.mode === 'title') {
    // Slow cinematic pan over the city behind the title screen.
    state.time += dt * 1000;
    state.camera.x = 2600 + Math.sin(state.time / 9000) * 900;
    state.camera.y = 1750 + Math.cos(state.time / 12000) * 500;
    state.camera.zoom = 0.62;
    updateTraffic(state, dt);
    updatePeds(state, dt);
    maintainPopulation(state);
    processEvents();
  }
  render(state);
  drawMinimap(state, minimap);
  updateHUD(state);
  if (firstFrame) {
    firstFrame = false;
    document.title = 'Solmar Bay — READY';
    window.__solmarReady = true;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
