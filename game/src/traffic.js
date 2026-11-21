// Solmar Bay — traffic and pedestrian AI: cars follow the road grid,
// pedestrians stroll the sidewalks and flee from gunfire and sirens.
import { TUNING, WORLD } from './config.js';
import { clamp, dist, angleDiff, range } from './random.js';
import { nearestRoadPoint, pointInBuilding, randomSidewalkPosition, roadCentersY } from './world.js';
import { updateCarPhysics } from './entities.js';

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    // Pick a waypoint on the road grid ahead; re-pick at intersections.
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 40) {
      car.target = pickNextWaypoint(state, car);
    }
    const t = car.target;
    const wantAngle = Math.atan2(t.y - car.y, t.x - car.x);
    const diff = angleDiff(car.angle, wantAngle);
    const steer = clamp(diff * 2.2, -1, 1);
    // Slow down for the car ahead.
    let forward = 0.7;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = Math.cos(wantAngle) * (other.x - car.x) + Math.sin(wantAngle) * (other.y - car.y);
        if (ahead > 0) { forward = -0.4; break; }
      }
    }
    // Yield to the player a little: honk instead of ramming.
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (dist(car.x, car.y, px, py) < 60) {
      forward = -0.3;
      if (car.honk <= 0 && Math.random() < 0.02) { car.honk = 0.5; state.audio.honk(); }
    }
    if (car.honk > 0) car.honk -= dt;
    updateCarPhysics(state, car, dt, { forward, steer, brake: false });
    // Traffic never exceeds its cruise speed.
    if (car.speed > TUNING.trafficSpeed) car.speed = TUNING.trafficSpeed;
    // If stuck against a building for a while, respawn the waypoint.
    if (Math.abs(car.speed) < 5) car.stuck += dt; else car.stuck = 0;
    if (car.stuck > 3) { car.target = pickNextWaypoint(state, car, true); car.stuck = 0; }
  }
}

function pickNextWaypoint(state, car, forceTurn = false) {
  const rng = state.rng;
  const rp = nearestRoadPoint(car.x, car.y);
  const step = 500;
  // Drive along the current road; at intersections sometimes turn.
  if (rp.vertical) {
    const dir = Math.abs(angleDiff(car.angle, Math.PI / 2)) < Math.abs(angleDiff(car.angle, -Math.PI / 2)) ? 1 : -1;
    const turn = forceTurn || rng() < 0.25;
    if (turn) {
      // Turn onto the nearest cross street.
      const ys = roadCentersY();
      let ny = ys[0];
      for (const y of ys) if (Math.abs(y - car.y) < Math.abs(ny - car.y)) ny = y;
      return { x: clamp(rp.x + (rng() < 0.5 ? -step : step), 220, WORLD.w - 220), y: ny + (rng() < 0.5 ? -22 : 22) };
    }
    return { x: rp.x + (rng() < 0.5 ? -22 : 22), y: clamp(rp.y + dir * step, 220, WORLD.beachY - 220) };
  }
  const dir = Math.abs(angleDiff(car.angle, 0)) < Math.abs(angleDiff(car.angle, Math.PI)) ? 1 : -1;
  return { x: clamp(rp.x + dir * step, 220, WORLD.w - 220), y: rp.y + (rng() < 0.5 ? -22 : 22) };
}

export function updatePeds(state, dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const ped of state.peds) {
    if (ped.state === 'dead') continue;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - py, ped.x - px);
      ped.x += Math.cos(away) * 220 * dt;
      ped.y += Math.sin(away) * 220 * dt;
      ped.angle = away;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.state === 'guard') continue; // missions move guards
    if (ped.state === 'cop') continue;   // police.js moves cops
    // Strolling pedestrian: pick a sidewalk target, walk to it.
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 20) {
      const pos = randomSidewalkPosition(state.rng);
      ped.target = { x: pos.x, y: pos.y };
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle += angleDiff(ped.angle, want) * Math.min(1, 6 * dt);
    const sp = TUNING.pedSpeed;
    const nx = ped.x + Math.cos(ped.angle) * sp * dt;
    const ny = ped.y + Math.sin(ped.angle) * sp * dt;
    if (!pointInBuilding(state.city, nx, ny, 6)) { ped.x = nx; ped.y = ny; }
    // Flee gunfire / nearby speeding car.
    const nearShot = state.bullets.some((b) => dist(b.x, b.y, ped.x, ped.y) < 120);
    const nearCar = state.cars.some((c) => c.driver === 'player' && Math.abs(c.speed) > 200 && dist(c.x, c.y, ped.x, ped.y) < 90);
    if (nearShot || nearCar) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
      if (nearCar) state.events.push({ type: 'log', text: 'Pedestrian nearly hit' });
    }
  }
  // Player running over a pedestrian.
  if (p.inCar && Math.abs(p.inCar.speed) > 60) {
    for (const ped of state.peds) {
      if (ped.state === 'dead') continue;
      if (dist(ped.x, ped.y, p.inCar.x, p.inCar.y) < 30) {
        ped.state = 'dead';
        ped.hp = 0;
        state.stats.kills++;
        state.events.push({ type: 'shake', power: 5 });
        state.audio.crash();
        // Witnesses call the police.
        if (state.wanted < 5) {
          state.wanted = Math.min(5, state.wanted + 1);
          state.wantedTimer = TUNING.wantedDecayMs;
          state.events.push({ type: 'toast', title: 'WANTED', sub: 'A witness called the Solmar Bay PD' });
        }
      }
    }
  }
}
