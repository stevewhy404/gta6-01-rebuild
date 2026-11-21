// Solmar Bay — story missions, taxi jobs and hidden packages.
// Five missions tell Dax Mercer's first week working for Mara Voss.
import { MISSION_REWARDS } from './config.js';
import { dist, range } from './random.js';
import { makeCar, makePed, addWanted, spawnBullet } from './entities.js';

export const MISSIONS = [
  {
    name: 'First Wheels',
    intro: 'Mara needs a wheelman. Steal any car and bring it to her garage.',
    stages: [
      { text: 'Steal a car (walk up to one and press E)', check: (s) => !!s.player.inCar, marker: null },
      { text: 'Drive to Mara\'s Garage', marker: { x: 2600, y: 1900, r: 70 }, check: (s) => near(s, 2600, 1900, 70) },
    ],
  },
  {
    name: 'The Drop',
    intro: 'A package for the docks. The PD is watching the waterfront — go fast, stay quiet.',
    stages: [
      { text: 'Get in a car', check: (s) => !!s.player.inCar, marker: null },
      { text: 'Deliver the package to The Docks (2:30)', marker: { x: 4700, y: 2900, r: 80 }, timer: 150,
        onStart: (s) => addWanted(s, 1, 'The Drop is hot'), check: (s) => near(s, 4700, 2900, 80) },
    ],
  },
  {
    name: 'Harbor Lights',
    intro: 'The package is guarded. Take out the crew at the warehouse, grab the crate, and get clear.',
    stages: [
      { text: 'Reach the warehouse at The Docks', marker: { x: 4700, y: 2900, r: 90 }, check: (s) => near(s, 4700, 2900, 90),
        onStart: (s) => spawnGuards(s, 4700, 2900, 4) },
      { text: 'Clear out the guards at the warehouse', check: (s) => s.peds.filter((p) => p.state === 'guard' && p.hp > 0).length === 0, marker: { x: 4700, y: 2900, r: 90 } },
      { text: 'Grab the crate and return to Mara\'s Garage', marker: { x: 2600, y: 1900, r: 70 }, check: (s) => near(s, 2600, 1900, 70) },
    ],
  },
  {
    name: 'Heat Wave',
    intro: 'Somebody talked. Three stars and counting — lose the tail before Mara cuts you loose.',
    stages: [
      { text: 'Lose the police (get your wanted level to 0)', check: (s) => s.wanted === 0, marker: null,
        onStart: (s) => { addWanted(s, 3, 'Heat Wave'); } },
    ],
  },
  {
    name: 'The Long Way Home',
    intro: 'One last drive: get Mara to Lighthouse Point. The whole department is on the road tonight.',
    stages: [
      { text: 'Pick Mara up at her garage', marker: { x: 2600, y: 1900, r: 70 }, check: (s) => near(s, 2600, 1900, 70),
        onStart: (s) => { s.maraRiding = true; } },
      { text: 'Drive Mara to Lighthouse Point — do not wreck the car', marker: { x: 4900, y: 3520, r: 80 }, timer: 240,
        onStart: (s) => addWanted(s, 2, 'The escort is blown'),
        check: (s) => near(s, 4900, 3520, 80) && !!s.player.inCar },
    ],
  },
];

function near(s, x, y, r) {
  const p = s.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  return dist(px, py, x, y) < r;
}

function spawnGuards(s, x, y, n) {
  for (let i = 0; i < n; i++) {
    const g = makePed(x + range(s.rng, -120, 120), y + range(s.rng, -120, 120), s.rng, { state: 'guard' });
    g.shirt = '#3a3a3a';
    g.hp = 100;
    s.peds.push(g);
  }
}

export function startMission(s, index) {
  const m = MISSIONS[index];
  s.mission = {
    index,
    stage: 0,
    name: m.name,
    timer: null,
    failed: false,
  };
  s.events.push({ type: 'toast', title: `MISSION ${index + 1}: ${m.name.toUpperCase()}`, sub: m.intro });
  s.events.push({ type: 'log', text: `Mission started: ${m.name}` });
  startStage(s);
}

function startStage(s) {
  const m = MISSIONS[s.mission.index];
  const st = m.stages[s.mission.stage];
  if (!st) return;
  s.mission.timer = st.timer || null;
  s.mission.marker = st.marker || null;
  if (st.onStart) st.onStart(s);
}

export function updateMissions(s, dt) {
  if (!s.mission) { startMission(s, 0); return; }
  const m = MISSIONS[s.mission.index];
  const st = m.stages[s.mission.stage];
  if (!st) return;
  if (s.mission.timer !== null) {
    s.mission.timer -= dt;
    if (s.mission.timer <= 0) {
      failMission(s, 'Out of time');
      return;
    }
  }
  if (st.check(s)) {
    s.mission.stage++;
    if (s.mission.stage >= m.stages.length) {
      completeMission(s);
    } else {
      s.events.push({ type: 'log', text: 'Objective complete' });
      s.audio.pickup();
      startStage(s);
    }
  }
  // Guards fight back.
  const p = s.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const g of s.peds) {
    if (g.state !== 'guard' || g.hp <= 0) continue;
    const d = dist(g.x, g.y, px, py);
    if (d < 460) {
      // Move toward the player and shoot.
      const a = Math.atan2(py - g.y, px - g.x);
      g.angle = a;
      if (d > 180) { g.x += Math.cos(a) * 120 * dt; g.y += Math.sin(a) * 120 * dt; }
      if (g.shootCooldown <= 0) {
        g.shootCooldown = 1.6;
        s.events.push({ type: 'enemyShot', x: g.x, y: g.y, angle: a });
        s.audio.enemyShoot();
      }
    }
    if (g.shootCooldown > 0) g.shootCooldown -= dt;
  }
}

function completeMission(s) {
  const reward = MISSION_REWARDS[s.mission.index];
  s.money += reward;
  s.respect += 10 + s.mission.index * 5;
  s.stats.missionsDone++;
  s.audio.missionDone();
  s.events.push({ type: 'toast', title: 'MISSION COMPLETE', sub: `+$${reward}  ·  ${MISSIONS[s.mission.index].name}` });
  s.events.push({ type: 'log', text: `Mission complete: ${MISSIONS[s.mission.index].name} (+$${reward})` });
  if (s.mission.index + 1 < MISSIONS.length) {
    startMission(s, s.mission.index + 1);
  } else {
    s.mission = null;
    s.storyComplete = true;
    s.events.push({ type: 'toast', title: 'SOLMAR BAY IS YOURS', sub: 'Story complete — keep driving, keep earning. Taxi jobs (F) still pay.' });
  }
}

function failMission(s, why) {
  s.events.push({ type: 'toast', title: 'MISSION FAILED', sub: `${why} — Mara is giving you one more shot` });
  s.events.push({ type: 'log', text: `Mission failed: ${why}` });
  startMission(s, s.mission.index);
}

// --- Taxi side jobs: press F near a waiting fare.
export function updateTaxi(s, dt) {
  if (s.taxi) {
    const fare = s.taxi;
    const p = s.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    fare.timer -= dt;
    if (fare.timer <= 0) {
      s.events.push({ type: 'toast', title: 'FARE LOST', sub: 'The passenger walked away' });
      s.taxi = null;
      return;
    }
    if (!fare.pickedUp) {
      if (dist(px, py, fare.x, fare.y) < 60 && p.inCar) {
        fare.pickedUp = true;
        s.events.push({ type: 'toast', title: 'PASSENGER ABOARD', sub: `Take them to ${fare.destName}` });
      }
    } else if (dist(px, py, fare.dx, fare.dy) < 70 && p.inCar) {
      const pay = fare.pay + Math.floor(Math.random() * 20);
      s.money += pay;
      s.stats.taxiDone++;
      s.audio.pickup();
      s.events.push({ type: 'toast', title: 'FARE PAID', sub: `+$${pay}  ·  tip included` });
      s.taxi = null;
    }
    return;
  }
  // Spawn a waiting fare now and then.
  if (!s.taxi && s.mode === 'playing' && Math.random() < dt * 0.02) {
    const spots = [
      { x: 1000, y: 1000, name: 'Palm Plaza' },
      { x: 3400, y: 1800, name: 'Downtown' },
      { x: 1800, y: 2600, name: 'Marina District' },
      { x: 4200, y: 2200, name: 'Old Town' },
    ];
    const from = spots[Math.floor(Math.random() * spots.length)];
    const to = spots[Math.floor(Math.random() * spots.length)];
    if (from === to) return;
    s.taxi = { x: from.x, y: from.y, dx: to.x, dy: to.y, destName: to.name, pay: 60 + Math.floor(dist(from.x, from.y, to.x, to.y) / 40), timer: 120, pickedUp: false };
    s.events.push({ type: 'log', text: `Taxi fare waiting at ${from.name} — press F nearby` });
  }
}

// --- Hidden packages: 10 stashed around the city, $150 each.
export const PACKAGE_SPOTS = [
  [600, 600], [4600, 600], [600, 3000], [4600, 1800], [1400, 1400],
  [3400, 2600], [2200, 3000], [4200, 3000], [1000, 1800], [3000, 3400],
];

export function updatePackages(s) {
  const p = s.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const spot of PACKAGE_SPOTS) {
    const key = `${spot[0]},${spot[1]}`;
    if (s.packagesFound.has(key)) continue;
    if (dist(px, py, spot[0], spot[1]) < 46) {
      s.packagesFound.add(key);
      s.money += 150;
      s.audio.pickup();
      s.events.push({ type: 'toast', title: 'HIDDEN PACKAGE', sub: `+$150  ·  ${s.packagesFound.size}/10 found` });
    }
  }
}
