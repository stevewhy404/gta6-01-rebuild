// Solmar Bay — HUD: money, wanted stars, objective, health, hints, toasts, menus.
import { MISSIONS } from './missions.js';
import { nearestCar } from './entities.js';
import { dist } from './random.js';

const $ = (id) => document.getElementById(id);
let toastTimer = null;

export function showToast(title, sub) {
  const el = $('toast');
  el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  el.style.display = 'block';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3600);
}

export function updateHUD(state) {
  $('money').firstChild.textContent = `$${state.money.toLocaleString('en-US')}`;
  $('respect').textContent = `REP ${state.respect}`;
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
  $('wanted').innerHTML = stars;
  // Clock.
  const h = Math.floor(state.dayTime) % 24;
  const m = Math.floor((state.dayTime % 1) * 60);
  const district = districtAt(state, state.player.x, state.player.y);
  $('clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${district}`;
  // Health / armor.
  $('healthFill').style.width = `${Math.max(0, state.player.health)}%`;
  $('armorFill').style.width = `${Math.max(0, state.player.armor)}%`;
  // Objective.
  let obj = '';
  if (state.storyComplete) {
    obj = '<b>FREEDOM</b> — Story complete. Taxi jobs (F), packages and the city are yours.';
  } else if (state.mission) {
    const m = MISSIONS[state.mission.index];
    const st = m.stages[state.mission.stage];
    const timer = state.mission.timer !== null ? ` · ⏱ ${Math.ceil(state.mission.timer)}s` : '';
    obj = `<b>MISSION ${state.mission.index + 1}: ${m.name}${timer}</b><br>${st ? st.text : ''}`;
  }
  if (state.taxi) {
    obj += `<br><span style="color:#8dff9a">TAXI: ${state.taxi.pickedUp ? `drop off at ${state.taxi.destName}` : 'pick up the fare'} · ${Math.ceil(state.taxi.timer)}s</span>`;
  }
  $('objective').innerHTML = obj;
  // Contextual hint.
  let hint = '';
  const p = state.player;
  if (state.mode === 'playing') {
    if (p.inCar) {
      hint = 'WASD drive · SPACE handbrake · E exit car · Click shoot (drive-by) · H honk · C camera';
    } else {
      const car = nearestCar(state, 70);
      if (car) hint = `E — steal the ${car.model.name}`;
      else if (state.taxi) hint = 'F — hail a taxi fare · Mouse aim · Click shoot · SHIFT sprint';
      else hint = 'WASD walk · SHIFT sprint · Mouse aim · Click shoot · E enter a car';
    }
  }
  $('hint').textContent = hint;
}

function districtAt(state, x, y) {
  let best = null, bd = Infinity;
  for (const d of state.districts) {
    const dd = dist(x, y, d.x, d.y);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best ? best.name : 'Solmar Bay';
}

export function showScreen(id) {
  for (const s of ['startScreen', 'pauseScreen', 'endScreen']) {
    $(s).style.display = s === id ? 'flex' : 'none';
  }
  document.body.classList.toggle('title-mode', id === 'startScreen');
}

export function updatePauseStats(state) {
  $('pauseStats').innerHTML =
    `Missions done: ${state.stats.missionsDone} · Cars stolen: ${state.stats.carsStolen} · ` +
    `Kills: ${state.stats.kills} · Taxi fares: ${state.stats.taxiDone} · Packages: ${state.packagesFound.size}/10 · Cash: $${state.money}`;
}
