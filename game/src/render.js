// Solmar Bay — rendering: the city, cars, people, effects, lighting and minimap.
// Everything is drawn with the 2D canvas API; no image assets are needed.
import { WORLD } from './config.js';
import { clamp, lerp } from './random.js';
import { roadCentersX, roadCentersY, isRoad } from './world.js';

// Sun position per time of day: returns a tint + darkness for the lighting overlay.
export function lightingFor(dayTime) {
  // 6h sunrise, 12h noon, 18h golden hour, 20h night.
  if (dayTime < 5 || dayTime >= 21) return { tint: 'rgba(10,16,48,0.42)', sun: 0.25 };
  if (dayTime < 7) return { tint: 'rgba(255,150,80,0.10)', sun: 0.6 };
  if (dayTime < 16) return { tint: 'rgba(255,255,255,0)', sun: 1 };
  if (dayTime < 19) return { tint: 'rgba(255,140,60,0.14)', sun: 0.85 };
  if (dayTime < 21) return { tint: 'rgba(30,20,70,0.30)', sun: 0.45 };
  return { tint: 'rgba(10,16,48,0.42)', sun: 0.25 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(state) {
  const ctx = state.ctx;
  const view = state.view;
  const cam = state.camera;
  const city = state.city;
  ctx.clearRect(0, 0, view.w, view.h);
  // Sky-ish backdrop beyond the map.
  ctx.fillStyle = '#274b63';
  ctx.fillRect(0, 0, view.w, view.h);

  const scale = cam.zoom;
  const ox = view.w / 2 - cam.x * scale + (state.shakeX || 0);
  const oy = view.h / 2 - cam.y * scale + (state.shakeY || 0);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  const vx0 = cam.x - view.w / 2 / scale - 60;
  const vy0 = cam.y - view.h / 2 / scale - 60;
  const vx1 = cam.x + view.w / 2 / scale + 60;
  const vy1 = cam.y + view.h / 2 / scale + 60;
  const visible = (x, y, m = 80) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  // Ground: grass base.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(0, 0, WORLD.w, WORLD.beachY);
  // Beach sand + water.
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(0, WORLD.beachY, WORLD.w, WORLD.waterY - WORLD.beachY);
  const wave = Math.sin(state.time / 600) * 6;
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(0, WORLD.waterY + wave, WORLD.w, WORLD.h - WORLD.waterY);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD.w; x += 140) {
    ctx.fillRect(x + ((state.time / 40 + x) % 140), WORLD.waterY + wave - 6, 60, 3);
  }

  // Parks and lots.
  for (const park of city.parks) {
    if (!visible(park.x + park.w / 2, park.y + park.h / 2, 200)) continue;
    ctx.fillStyle = park.lot ? '#3a3f46' : '#6fa055';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.lot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let x = park.x + 20; x < park.x + park.w - 20; x += 46) {
        ctx.beginPath(); ctx.moveTo(x, park.y + 14); ctx.lineTo(x, park.y + 44); ctx.stroke();
      }
    }
  }

  // Roads.
  ctx.fillStyle = '#33373f';
  for (const cx of roadCentersX()) ctx.fillRect(cx - WORLD.road / 2, 0, WORLD.road, WORLD.beachY);
  for (const cy of roadCentersY()) ctx.fillRect(0, cy - WORLD.road / 2, WORLD.w, WORLD.road);
  // Sidewalks.
  ctx.fillStyle = '#9a9a92';
  for (const cx of roadCentersX()) {
    ctx.fillRect(cx - WORLD.road / 2 - 14, 0, 14, WORLD.beachY);
    ctx.fillRect(cx + WORLD.road / 2, 0, 14, WORLD.beachY);
  }
  for (const cy of roadCentersY()) {
    ctx.fillRect(0, cy - WORLD.road / 2 - 14, WORLD.w, 14);
    ctx.fillRect(0, cy + WORLD.road / 2, WORLD.w, 14);
  }
  // Lane dashes.
  ctx.strokeStyle = 'rgba(255,220,90,0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const cx of roadCentersX()) {
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, WORLD.beachY); ctx.stroke();
  }
  for (const cy of roadCentersY()) {
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(WORLD.w, cy); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings with height shading + windows.
  for (const b of city.buildings) {
    if (!visible(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
    const shade = Math.min(26, b.height * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + shade, b.y + shade, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,240,180,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.height) % 4 === 0) continue;
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 14);
      }
    }
  }
  // Dock containers.
  for (const c of city.containers) {
    if (!visible(c.x, c.y)) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  // Trees.
  for (const t of city.trees) {
    if (!visible(t.x, t.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#3f9a4a' : '#2f7a35';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  // Hidden packages (glinting crates).
  for (const spot of state.packageSpots) {
    const key = `${spot[0]},${spot[1]}`;
    if (state.packagesFound.has(key)) continue;
    if (!visible(spot[0], spot[1])) continue;
    const pulse = 0.6 + Math.sin(state.time / 300) * 0.4;
    ctx.fillStyle = `rgba(255,210,60,${pulse})`;
    ctx.fillRect(spot[0] - 9, spot[1] - 9, 18, 18);
    ctx.strokeStyle = '#7a5a00';
    ctx.strokeRect(spot[0] - 9, spot[1] - 9, 18, 18);
  }

  // Mission marker: pulsing beacon.
  if (state.mission && state.mission.marker) {
    const m = state.mission.marker;
    const pulse = 1 + Math.sin(state.time / 220) * 0.25;
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,176,46,0.25)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 52); ctx.lineTo(m.x - 10, m.y - 30); ctx.lineTo(m.x + 10, m.y - 30); ctx.closePath(); ctx.fill();
  }
  // Taxi fare marker.
  if (state.taxi && !state.taxi.pickedUp) {
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', state.taxi.x, state.taxi.y - 14);
  } else if (state.taxi && state.taxi.pickedUp) {
    ctx.strokeStyle = '#37d67a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(state.taxi.dx, state.taxi.dy, 30, 0, Math.PI * 2); ctx.stroke();
  }

  // Cars.
  for (const car of state.cars) {
    if (car.dead || !visible(car.x, car.y, 100)) continue;
    drawCar(ctx, car, state);
  }
  // Pedestrians.
  for (const ped of state.peds) {
    if (!visible(ped.x, ped.y)) continue;
    drawPed(ctx, ped, state);
  }
  // Player.
  drawPlayer(ctx, state);
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Muzzle flashes.
  for (const mz of state.muzzles) {
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath(); ctx.arc(mz.x, mz.y, 9, 0, Math.PI * 2); ctx.fill();
  }

  // Lighting overlay for time of day.
  const light = lightingFor(state.dayTime);
  ctx.fillStyle = light.tint;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Headlight cones at night.
  if (light.sun < 0.5) {
    for (const car of state.cars) {
      if (car.dead || !visible(car.x, car.y, 100)) continue;
      const hx = car.x + Math.cos(car.angle) * 30;
      const hy = car.y + Math.sin(car.angle) * 30;
      const grad = ctx.createRadialGradient(hx, hy, 4, hx, hy, 130);
      grad.addColorStop(0, 'rgba(255,240,180,0.20)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(hx, hy, 130, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // Vignette.
  const vg = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.45, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, view.w, view.h);
}

function drawCar(ctx, car, state) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 5, m.len / 2, m.wid / 2, car.angle, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#111';
  const wl = m.len / 2 - 8, ww = m.wid / 2 - 2;
  ctx.fillRect(-wl, -ww - 3, 14, 6);
  ctx.fillRect(wl - 6, -ww - 3, 14, 6);
  ctx.fillRect(-wl, ww - 3, 14, 6);
  ctx.fillRect(wl - 6, ww - 3, 14, 6);
  // Body.
  ctx.fillStyle = car.hp < 30 ? '#3a3a3a' : car.color;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 8);
  ctx.fill();
  // Smoke when wrecked.
  if (car.hp < 35) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-m.len / 4 + Math.sin(state.time / 200) * 3, 0, 8, 0, Math.PI * 2); ctx.fill();
  }
  // Windows + roof.
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -m.len / 2 + 8, -m.wid / 2 + 4, 14, m.wid - 8, 3);
  ctx.fill();
  ctx.fillStyle = car.driver === 'police' ? '#d8e8ff' : 'rgba(200,220,240,0.7)';
  roundRect(ctx, -6, -m.wid / 2 + 3, 16, m.wid - 6, 3);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(m.len / 2 - 2, -m.wid / 2 + 2, 3, 5);
  ctx.fillRect(m.len / 2 - 2, m.wid / 2 - 7, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a1a';
    ctx.fillRect(-m.len / 2 - 1, -m.wid / 2 + 2, 3, 5);
    ctx.fillRect(-m.len / 2 - 1, m.wid / 2 - 7, 3, 5);
  }
  // Police light bar.
  if (car.driver === 'police') {
    const flash = Math.floor(state.time / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a1a' : '#2a6cff';
    ctx.fillRect(-8, -m.wid / 2 - 1, 16, 5);
    ctx.fillStyle = flash ? '#2a6cff' : '#ff2a1a';
    ctx.fillRect(-8, m.wid / 2 - 4, 16, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  ctx.restore();
}

function drawPed(ctx, ped, state) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'dead') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-10, -5, 20, 10);
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle);
  // Body + head.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
  // Cop hat / guard cap.
  if (ped.state === 'cop') {
    ctx.fillStyle = '#101a30';
    ctx.beginPath(); ctx.arc(6, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(4, -1, 4, 2);
  } else if (ped.state === 'guard') {
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(6, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    // Gun.
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(18, 0); ctx.stroke();
  }
  ctx.restore();
  // Health bar for guards/cops in a fight.
  if ((ped.state === 'guard' || ped.state === 'cop') && ped.hp < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(ped.x - 14, ped.y - 20, 28, 4);
    ctx.fillStyle = '#ff5544';
    ctx.fillRect(ped.x - 14, ped.y - 20, 28 * (ped.hp / 100), 4);
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle);
  // Dax Mercer: teal jacket, dark jeans.
  ctx.fillStyle = '#0e8a7a';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(7, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(5, 0, 5.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  // Pistol in hand.
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.restore();
  // Aim line (subtle).
  if (state.mode === 'playing') {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.lineTo(p.x + Math.cos(p.angle) * 70, p.y + Math.sin(p.angle) * 70);
    ctx.stroke();
  }
}

// --- Minimap: the whole city at a glance.
export function drawMinimap(state, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sx = W / 5200, sy = H / 3800;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#101623';
  ctx.fillRect(0, 0, W, H);
  // Water + sand.
  ctx.fillStyle = '#2a6a9a';
  ctx.fillRect(0, 3600 * sy, W, H - 3600 * sy);
  ctx.fillStyle = '#c8b478';
  ctx.fillRect(0, 3380 * sy, W, (3600 - 3380) * sy);
  // Roads.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 2;
  for (const cx of roadCentersX()) {
    ctx.beginPath(); ctx.moveTo(cx * sx, 0); ctx.lineTo(cx * sx, 3380 * sy); ctx.stroke();
  }
  for (const cy of roadCentersY()) {
    ctx.beginPath(); ctx.moveTo(0, cy * sy); ctx.lineTo(W, cy * sy); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#3d4654';
  for (const b of state.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker.
  if (state.mission && state.mission.marker) {
    const m = state.mission.marker;
    const pulse = 3 + Math.sin(state.time / 220) * 1.5;
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath(); ctx.arc(m.x * sx, m.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Taxi.
  if (state.taxi) {
    ctx.fillStyle = '#37d67a';
    ctx.beginPath(); ctx.arc((state.taxi.pickedUp ? state.taxi.dx : state.taxi.x) * sx, (state.taxi.pickedUp ? state.taxi.dy : state.taxi.y) * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff5544';
  for (const car of state.police) {
    ctx.beginPath(); ctx.arc(car.x * sx, car.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.save();
  ctx.translate(px * sx, py * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    (state.camera.x - state.view.w / 2 / state.camera.zoom) * sx,
    (state.camera.y - state.view.h / 2 / state.camera.zoom) * sy,
    (state.view.w / state.camera.zoom) * sx,
    (state.view.h / state.camera.zoom) * sy,
  );
}
