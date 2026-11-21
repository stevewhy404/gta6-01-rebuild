// Solmar Bay — screenshot staging: ?shot=start|chase|mission|city (and ?seed=N).
// The game itself stages each scene from its own code, so every screenshot is a
// real render of the game running. Used only for the entry's screenshots.
import { makeCar, makePed, addWanted } from './entities.js';
import { startMission } from './missions.js';
import { showScreen } from './hud.js';

export function applyShot(state, shot) {
  const p = state.player;
  // Screenshot mode: no toast popups over the staged scenes.
  state.shotMode = true;
  document.getElementById('toast').style.display = 'none';
  if (shot === 'start') {
    state.mode = 'title';
    state.dayTime = 17.4;
    state.camera.x = 2600; state.camera.y = 1750; state.camera.zoom = 0.62;
    showScreen('startScreen');
    return;
  }
  // Every other shot plays the game: hide the title, start the engine.
  showScreen(null);
  state.mode = 'playing';
  state.audio.unlock();
  state.audio.startMusic();

  if (shot === 'chase') {
    // Dusk police chase: Dax in a Comet GT, 3 stars, two interceptors on his tail,
    // mission 2 (The Drop) live on the HUD.
    state.dayTime = 18.4;
    startMission(state, 1);
    state.mission.stage = 1;
    state.mission.marker = { x: 4700, y: 2900, r: 80 };
    state.mission.timer = 132;
    const car = makeCar(2600, 1800, 0, { driver: 'player', color: '#d8342c', model: { name: 'Comet GT', len: 52, wid: 26, top: 620 }, rng: state.rng });
    car.speed = 420;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y;
    addWanted(state, 3, 'Staged chase');
    state.wantedTimer = 14000;
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(2600 - 340 - i * 110, 1800 + (i === 0 ? 30 : -30), 0, {
        driver: 'police', color: '#1a2a4a',
        model: { name: 'Interceptor', len: 54, wid: 27, top: 590 }, rng: state.rng,
      });
      cop.speed = 320;
      state.police.push(cop);
      state.cars.push(cop);
    }
    state.camera.x = 2600; state.camera.y = 1800; state.camera.zoom = 0.9;
    state.money = 1250;
    state.respect = 25;
  } else if (shot === 'mission') {
    // On foot at the docks: guards closing in, muzzle flash, 2 stars.
    state.dayTime = 18.3;
    startMission(state, 2);
    state.mission.stage = 1;
    state.mission.marker = { x: 4700, y: 2900, r: 90 };
    p.x = 4560; p.y = 2850; p.angle = 0.35;
    p.health = 82;
    for (let i = 0; i < 3; i++) {
      const g = makePed(4680 + (i - 1) * 60, 2900 - 40 + i * 45, state.rng, { state: 'guard' });
      g.shirt = '#3a3a3a'; g.hp = 100;
      state.peds.push(g);
    }
    addWanted(state, 2, 'Staged firefight');
    state.events.push({ type: 'muzzle', x: p.x + 24, y: p.y + 8, angle: 0.4 });
    state.events.push({ type: 'muzzle', x: 4680, y: 2860, angle: Math.PI });
    state.camera.x = p.x + 140; state.camera.y = p.y + 30; state.camera.zoom = 1;
    state.money = 2150;
    state.respect = 40;
  } else if (shot === 'city') {
    // Golden-hour overview of downtown with traffic on the grid.
    state.dayTime = 17.8;
    startMission(state, 0);
    state.mission.stage = 1;
    state.mission.marker = { x: 2600, y: 1900, r: 70 };
    const car = makeCar(2000, 2200, 0, { driver: 'player', color: '#2c6fd8', model: { name: 'Bayliner', len: 56, wid: 28, top: 520 }, rng: state.rng });
    car.speed = 120;
    state.cars.push(car);
    p.inCar = car;
    p.x = car.x; p.y = car.y;
    state.camera.x = 2600; state.camera.y = 1900; state.camera.zoom = 0.42;
    state.money = 400;
    state.respect = 10;
  }
  // Let traffic and pedestrians populate for a beat before the shot lands.
  state.warmup = 1.2;
}
