// Solmar Bay — combat: player shooting, enemy shots, muzzle flashes.
import { spawnBullet, spawnSparks, damagePlayer } from './entities.js';
import { dist } from './random.js';

// Aim from the player (or their car) toward the mouse, in world coordinates.
export function aimAngle(state) {
  const cam = state.camera;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const wx = cam.x + (state.input.mouse.x - state.view.w / 2) / cam.zoom;
  const wy = cam.y + (state.input.mouse.y - state.view.h / 2) / cam.zoom;
  return Math.atan2(wy - py, wx - px);
}

export function playerShoot(state) {
  const p = state.player;
  if (p.shootCooldown > 0 || p.inCar) return;
  p.shootCooldown = 0.22;
  const a = aimAngle(state);
  p.angle = a;
  const gx = p.x + Math.cos(a) * 20;
  const gy = p.y + Math.sin(a) * 20;
  spawnBullet(state, gx, gy, a, 'player');
  state.playerFiredRecently = 3;
  state.events.push({ type: 'muzzle', x: gx, y: gy, angle: a });
  state.events.push({ type: 'shake', power: 2 });
  state.audio.shoot();
}

export function enemyShoot(state, x, y, angle) {
  spawnBullet(state, x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, angle + (Math.random() - 0.5) * 0.12, 'enemy', 22);
  state.events.push({ type: 'muzzle', x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18, angle });
}

// Drive-by: shooting from a car is wild but possible.
export function driveByShoot(state) {
  const p = state.player;
  if (!p.inCar || p.shootCooldown > 0) return;
  p.shootCooldown = 0.35;
  const a = aimAngle(state);
  spawnBullet(state, p.inCar.x, p.inCar.y, a + (Math.random() - 0.5) * 0.2, 'player', 26);
  state.playerFiredRecently = 3;
  state.events.push({ type: 'muzzle', x: p.inCar.x, y: p.inCar.y, angle: a });
  state.audio.shoot();
}
