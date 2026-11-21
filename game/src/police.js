// Solmar Bay — the wanted system and the Solmar Bay PD.
// Stars rise with crime and fall when the player stays out of sight;
// police cars ram the player, foot officers chase and arrest.
import { TUNING, WORLD } from './config.js';
import { clamp, dist, angleDiff, range } from './random.js';
import { makeCar, makePed, updateCarPhysics, damagePlayer, endRun } from './entities.js';

export function updateWanted(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  if (state.wanted > 0) {
    // Decay only while no police unit can see the player.
    const seen = state.police.some((c) => dist(c.x, c.y, px, py) < 420)
      || state.peds.some((ped) => ped.state === 'cop' && dist(ped.x, ped.y, px, py) < 260);
    if (!seen) {
      state.wantedTimer -= dt * 1000;
      if (state.wantedTimer <= 0) {
        state.wanted--;
        state.wantedTimer = TUNING.wantedDecayMs;
        state.events.push({ type: 'log', text: `Wanted level fell to ${state.wanted}` });
        if (state.wanted === 0) {
          state.events.push({ type: 'toast', title: 'CLEAN', sub: 'You lost them. For now.' });
          clearPolice(state);
        }
      }
    } else {
      state.wantedTimer = TUNING.wantedDecayMs;
    }
  }

  // Spawn police to match the wanted level.
  const wantCars = state.wanted === 0 ? 0 : state.wanted <= 2 ? 1 : state.wanted <= 3 ? 2 : state.wanted <= 4 ? 3 : 4;
  const wantCops = state.wanted >= 2 && !p.inCar ? Math.min(3, state.wanted - 1) : 0;
  if (state.police.length < wantCars) {
    const a = range(state.rng, 0, Math.PI * 2);
    const sx = clamp(px + Math.cos(a) * 700, 100, WORLD.w - 100);
    const sy = clamp(py + Math.sin(a) * 700, 100, WORLD.beachY - 100);
    const car = makeCar(sx, sy, Math.atan2(py - sy, px - sx), {
      driver: 'police', color: '#1a2a4a', model: { name: 'Interceptor', len: 54, wid: 27, top: TUNING.policeMaxSpeed }, rng: state.rng,
    });
    car.speed = 200;
    state.police.push(car);
    state.cars.push(car);
  }
  const cops = state.peds.filter((ped) => ped.state === 'cop');
  if (cops.length < wantCops) {
    const a = range(state.rng, 0, Math.PI * 2);
    const cop = makePed(clamp(px + Math.cos(a) * 320, 40, WORLD.w - 40), clamp(py + Math.sin(a) * 320, 40, WORLD.beachY - 40), state.rng, { state: 'cop' });
    cop.shirt = '#1a2a4a';
    cop.hp = 120;
    state.peds.push(cop);
  }

  // Police cars chase and ram.
  for (const car of state.police) {
    if (car.dead) continue;
    const wantAngle = Math.atan2(py - car.y, px - car.x);
    const diff = angleDiff(car.angle, wantAngle);
    const steer = clamp(diff * 2.4, -1, 1);
    const d = dist(car.x, car.y, px, py);
    const forward = d > 60 ? 1 : 0.4;
    updateCarPhysics(state, car, dt, { forward, steer, brake: false });
    if (car.speed > TUNING.policeMaxSpeed) car.speed = TUNING.policeMaxSpeed;
    // Ram damage on contact with the player's car.
    if (p.inCar && d < 52 && Math.abs(car.speed) > 60) {
      p.inCar.hp -= 6 * dt * 10;
      car.speed *= 0.6;
      if (p.inCar.hp <= 0) {
        // Car destroyed: player bails out on foot, still wanted.
        p.inCar.dead = true;
        p.inCar = null;
        state.events.push({ type: 'toast', title: 'CAR WRECKED', sub: 'Get out and run!' });
      }
    }
    // Police car next to a walking player: arrest clock.
    if (!p.inCar && d < 46) {
      state.arrestTimer = (state.arrestTimer || 0) + dt;
      if (state.arrestTimer > 2.2) {
        state.arrestTimer = 0;
        endRun(state, 'busted');
      }
    } else {
      state.arrestTimer = 0;
    }
  }

  // Foot officers chase; close contact for 2s = busted.
  for (const cop of state.peds) {
    if (cop.state !== 'cop' || cop.hp <= 0) continue;
    const d = dist(cop.x, cop.y, px, py);
    const want = Math.atan2(py - cop.y, px - cop.x);
    cop.angle += angleDiff(cop.angle, want) * Math.min(1, 8 * dt);
    const sp = p.inCar ? 0 : 235;
    cop.x += Math.cos(cop.angle) * sp * dt;
    cop.y += Math.sin(cop.angle) * sp * dt;
    if (!p.inCar && d < 34) {
      cop.arrest = (cop.arrest || 0) + dt;
      if (cop.arrest > 1.8) {
        cop.arrest = 0;
        endRun(state, 'busted');
      }
    } else {
      cop.arrest = 0;
    }
    // Officers shoot when the player shoots at them.
    if (state.playerFiredRecently && d < 420 && cop.shootCooldown <= 0) {
      cop.shootCooldown = 1.4;
      state.events.push({ type: 'enemyShot', x: cop.x, y: cop.y, angle: want });
      state.audio.enemyShoot();
    }
    if (cop.shootCooldown > 0) cop.shootCooldown -= dt;
  }

  // Siren audio when any police unit is close.
  const sirenOn = state.police.some((c) => !c.dead && dist(c.x, c.y, px, py) < 900);
  state.audio.setSiren(sirenOn, dt);
  state.police = state.police.filter((c) => !c.dead);
}

export function clearPolice(state) {
  for (const car of state.police) {
    const i = state.cars.indexOf(car);
    if (i >= 0) state.cars.splice(i, 1);
  }
  state.police = [];
  state.peds = state.peds.filter((p) => p.state !== 'cop');
  state.arrestTimer = 0;
}
