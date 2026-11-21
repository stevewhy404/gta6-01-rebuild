// Solmar Bay — entities: player, cars, pedestrians, police, bullets, particles.
import { WORLD, TUNING, CAR_COLORS, CAR_MODELS, PED_NAMES } from './config.js';
import { clamp, dist, angleDiff, pick, range, rangeInt } from './random.js';
import { pointInBuilding, collideBuildings, randomRoadPosition, randomSidewalkPosition } from './world.js';

let nextId = 1;

export function makeCar(x, y, angle, opts = {}) {
  const model = opts.model || pick(opts.rng || Math.random, CAR_MODELS);
  return {
    id: nextId++,
    kind: 'car',
    x, y, angle,
    speed: 0,
    color: opts.color || pick(opts.rng || Math.random, CAR_COLORS),
    model,
    driver: opts.driver || 'parked', // 'player' | 'traffic' | 'police' | 'parked' | 'mission'
    hp: 100,
    stuck: 0,
    target: null,      // traffic waypoint {x,y}
    honk: 0,
    brakeLight: false,
    siren: opts.driver === 'police',
    crashed: 0,
  };
}

export function makePed(x, y, rng, opts = {}) {
  return {
    id: nextId++,
    kind: 'ped',
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: 0,
    name: pick(rng, PED_NAMES),
    color: pick(rng, ['#e8c39a', '#c98d5f', '#8a5a3a', '#f0d0b0', '#6a4a2a']),
    shirt: pick(rng, ['#d8342c', '#2c6fd8', '#e8b62a', '#3fae6a', '#8a4fd8', '#e87a2a', '#eee', '#333']),
    state: opts.state || 'walk', // walk | flee | dead | cop | guard | driver
    target: null,
    hp: 100,
    fleeTimer: 0,
    shootCooldown: 0,
    panic: 0,
  };
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: 100, armor: 0,
    inCar: null,
    walkSpeed: TUNING.walkSpeed,
    shootCooldown: 0,
    invuln: 0,
  };
}

// --- Car physics (arcade): forward speed + steering, building + car collisions.
export function updateCarPhysics(state, car, dt, input) {
  const { forward, steer, brake } = input;
  const model = car.model;
  if (forward > 0) car.speed += TUNING.carAccel * forward * dt;
  else if (forward < 0) {
    if (car.speed > 5) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.55 * dt;
  } else {
    car.speed *= Math.pow(0.4, dt);
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  if (brake) car.speed *= Math.pow(0.05, dt);
  car.speed = clamp(car.speed, -TUNING.carReverseMax, model.top);
  const grip = brake ? 0.7 : 1;
  car.angle += steer * TUNING.carTurn * grip * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // World bounds + water.
  const bx = clamp(nx, 30, WORLD.w - 30);
  const by = clamp(ny, 30, WORLD.waterY - 24);
  const hitWall = bx !== nx || by !== ny;
  // Building collision: test the nose and tail.
  const noseX = bx + Math.cos(car.angle) * (model.len / 2);
  const noseY = by + Math.sin(car.angle) * (model.len / 2);
  const tailX = bx - Math.cos(car.angle) * (model.len / 2);
  const tailY = by - Math.sin(car.angle) * (model.len / 2);
  const hitBuilding = pointInBuilding(state.city, noseX, noseY, 4) || pointInBuilding(state.city, tailX, tailY, 4);
  if (hitBuilding || hitWall) {
    if (Math.abs(car.speed) > 240 && car.crashed <= 0) {
      state.events.push({ type: 'crash', x: car.x, y: car.y, hard: true });
      car.hp -= 12;
    }
    car.speed *= -0.25;
    car.crashed = 0.4;
  } else {
    car.x = bx; car.y = by;
  }
  if (car.crashed > 0) car.crashed -= dt;
  car.brakeLight = brake || forward < 0;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true;
    state.events.push({ type: 'explosion', x: car.x, y: car.y });
    if (car.driver === 'player') state.player.inCar = null;
  }
}

// Push overlapping cars apart (cheap circle test).
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.7; b.speed = avg * 0.7;
        if (Math.abs(avg) > 200) state.events.push({ type: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
}

export function updatePlayerOnFoot(state, dt, input) {
  const p = state.player;
  const sprint = input.sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.vx = mx * sprint; p.vy = my * sprint;
    p.angle = Math.atan2(my, mx);
  } else {
    p.vx *= Math.pow(0.001, dt); p.vy *= Math.pow(0.001, dt);
  }
  const nx = clamp(p.x + p.vx * dt, 20, WORLD.w - 20);
  const ny = clamp(p.y + p.vy * dt, 20, WORLD.waterY - 16);
  const hit = collideBuildings(state.city, nx, ny, 12);
  p.x = hit.x; p.y = hit.y;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  // Slow health regen out of combat.
  if (state.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
}

// Find the nearest enterable car to the player.
export function nearestCar(state, maxDist = 70) {
  let best = null, bd = maxDist;
  for (const c of state.cars) {
    if (c.dead) continue;
    const d = dist(state.player.x, state.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  if (car.driver === 'traffic') {
    // Carjacking: the driver flees, the law notices.
    const driver = makePed(car.x + 30, car.y, state.rng, { state: 'flee' });
    driver.fleeTimer = 4;
    state.peds.push(driver);
    state.stats.carsStolen++;
    addWanted(state, 1, 'Car stolen');
    state.events.push({ type: 'toast', title: 'CAR STOLEN', sub: `${car.model.name} — the law has been notified` });
    state.audio.door();
  }
  car.driver = 'player';
  car.speed = 0;
  p.inCar = car;
  state.audio.door();
}

export function exitCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  p.inCar = null;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  p.x = clamp(car.x + side * 34, 20, WORLD.w - 20);
  p.y = clamp(car.y + sideY * 34, 20, WORLD.waterY - 16);
  p.angle = car.angle;
  state.audio.door();
}

export function addWanted(state, stars, reason) {
  if (state.wanted >= 5) return;
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = TUNING.wantedDecayMs;
  if (reason) state.events.push({ type: 'log', text: reason });
}

export function spawnBullet(state, x, y, angle, from, damage = 34) {
  state.bullets.push({
    x, y, angle,
    vx: Math.cos(angle) * TUNING.bulletSpeed,
    vy: Math.sin(angle) * TUNING.bulletSpeed,
    from, damage, life: 0.9,
  });
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    // Buildings stop bullets.
    if (pointInBuilding(state.city, b.x, b.y, 0)) { b.life = 0; spawnSparks(state, b.x, b.y); continue; }
    if (b.from === 'player') {
      // Hit a ped?
      for (const ped of state.peds) {
        if (ped.state === 'dead') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 13) {
          b.life = 0;
          ped.hp -= b.damage;
          spawnSparks(state, b.x, b.y, '#ff5544');
          if (ped.hp <= 0) {
            ped.state = 'dead';
            state.stats.kills++;
            if (ped.state === 'cop' || ped.kind === 'cop') addWanted(state, 2, 'Officer down');
            else addWanted(state, 1, 'Pedestrian hit');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of state.cars) {
        if (car.dead || car.driver === 'player') continue;
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          b.life = 0;
          car.hp -= b.damage * 0.5;
          spawnSparks(state, b.x, b.y, '#ffd23e');
          if (car.driver === 'traffic') {
            const d = state.peds.find((p) => p.state === 'flee');
            car.driver = 'parked';
            addWanted(state, 1, 'Shots fired at traffic');
          }
          break;
        }
      }
    } else {
      // Enemy bullet vs player.
      const p = state.player;
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      const r = p.inCar ? 26 : 12;
      if (dist(b.x, b.y, px, py) < r) {
        b.life = 0;
        damagePlayer(state, b.damage * 0.6);
        spawnSparks(state, b.x, b.y, '#ff5544');
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0 || state.mode !== 'playing') return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount * 0.6);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.health -= amount;
  p.invuln = 0.25;
  state.events.push({ type: 'shake', power: 6 });
  if (p.health <= 0) {
    p.health = 0;
    if (state.wanted > 0 && state.police.some((c) => dist(c.x, c.y, p.x, p.y) < 500)) {
      endRun(state, 'busted');
    } else {
      endRun(state, 'wasted');
    }
  }
}

export function endRun(state, how) {
  state.mode = how;
  state.audio.busted();
  const el = document.getElementById('endScreen');
  const title = document.getElementById('endTitle');
  const text = document.getElementById('endText');
  if (how === 'busted') {
    title.textContent = 'BUSTED';
    title.style.color = '#3fa9f5';
    text.textContent = `The Solmar Bay PD caught up with you. $${state.money} seized as evidence — the streets will wait.`;
    state.money = Math.max(0, state.money - 200);
  } else {
    title.textContent = 'WASTED';
    title.style.color = '#ff5544';
    text.textContent = 'Solmar Bay chewed you up. Mara Voss is already looking for a new wheelman.';
  }
  el.style.display = 'flex';
}

export function spawnSparks(state, x, y, color = '#ffd23e') {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x, y,
      vx: range(state.rng, -160, 160), vy: range(state.rng, -160, 160),
      life: range(state.rng, 0.2, 0.5), max: 0.5, color, size: range(state.rng, 2, 4),
    });
  }
}

export function spawnExplosion(state, x, y) {
  for (let i = 0; i < 40; i++) {
    const a = range(state.rng, 0, Math.PI * 2);
    const sp = range(state.rng, 60, 420);
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: range(state.rng, 0.4, 1.1), max: 1.1,
      color: pick(state.rng, ['#ff9a2a', '#ff5544', '#ffd23e', '#888']),
      size: range(state.rng, 3, 8),
    });
  }
  state.events.push({ type: 'shake', power: 14 });
  state.audio.crash();
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.2, dt); pt.vy *= Math.pow(0.2, dt);
    pt.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

// Spawn ambient traffic + pedestrians around the camera.
export function maintainPopulation(state) {
  const cam = state.camera;
  const rng = state.rng;
  // Traffic cars: keep ~14 near the player.
  const traffic = state.cars.filter((c) => c.driver === 'traffic');
  if (traffic.length < 14 && state.cars.length < 40) {
    const pos = randomRoadPosition(rng);
    const car = makeCar(pos.x, pos.y, pos.angle, { driver: 'traffic', rng });
    car.speed = TUNING.trafficSpeed * 0.8;
    state.cars.push(car);
  }
  // Parked cars.
  const parked = state.cars.filter((c) => c.driver === 'parked');
  if (parked.length < 8 && state.cars.length < 40) {
    const pos = randomRoadPosition(rng);
    const car = makeCar(pos.x, pos.y, pos.angle, { driver: 'parked', rng });
    state.cars.push(car);
  }
  // Pedestrians: keep ~22 near the player.
  if (state.peds.filter((p) => p.state === 'walk').length < 22 && state.peds.length < 60) {
    const pos = randomSidewalkPosition(rng);
    state.peds.push(makePed(pos.x, pos.y, rng));
  }
  // Cull far-away ambient entities.
  state.cars = state.cars.filter((c) => c.driver === 'player' || c.driver === 'police' || c.driver === 'mission' || dist(c.x, c.y, cam.x, cam.y) < 2200);
  state.peds = state.peds.filter((p) => ['cop', 'guard', 'mission'].includes(p.state) || dist(p.x, p.y, cam.x, cam.y) < 1800);
}
