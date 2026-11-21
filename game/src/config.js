// Solmar Bay — configuration: world size, tuning, names. All original.
export const WORLD = {
  w: 5200,
  h: 3800,
  block: 400,        // city block size (road centre to road centre)
  road: 96,          // road width
  beachY: 3380,      // south of this: sand, then water
  waterY: 3600,
};

export const TUNING = {
  walkSpeed: 175,
  sprintSpeed: 275,
  carAccel: 420,
  carBrake: 700,
  carMaxSpeed: 560,
  carReverseMax: 180,
  carTurn: 2.6,
  carGrip: 0.985,
  policeMaxSpeed: 590,
  pedSpeed: 55,
  trafficSpeed: 200,
  bulletSpeed: 900,
  wantedDecayMs: 14000,
};

export const PLAYER_START = { x: 2600, y: 1900, angle: -Math.PI / 2 };

export const DISTRICTS = [
  { name: 'Downtown', x: 2200, y: 1400, r: 800 },
  { name: 'Marina District', x: 800, y: 2600, r: 700 },
  { name: 'Old Town', x: 4200, y: 1000, r: 650 },
  { name: 'The Docks', x: 4700, y: 2900, r: 600 },
  { name: 'Palm Heights', x: 1200, y: 800, r: 650 },
  { name: 'Solmar Beach', x: 2600, y: 3500, r: 900 },
];

export const CAR_COLORS = [
  '#d8342c', '#2c6fd8', '#e8b62a', '#e8e8e8', '#22242a', '#3fae6a',
  '#8a4fd8', '#e87a2a', '#2ad8d0', '#c0c8d8', '#7a2c2c', '#4a7a3a',
];

export const CAR_MODELS = [
  { name: 'Comet GT', len: 52, wid: 26, top: 620 },
  { name: 'Bayliner', len: 56, wid: 28, top: 520 },
  { name: 'Hustler', len: 48, wid: 24, top: 500 },
  { name: 'Vagabond', len: 60, wid: 28, top: 480 },
  { name: 'Sunrunner', len: 50, wid: 25, top: 540 },
];

export const PED_NAMES = [
  'Tourist', 'Dockworker', 'Student', 'Jogger', 'Vendor', 'Businesswoman',
  'Fisherman', 'Skater', 'Grandma', 'Courier',
];

export const MISSION_REWARDS = [400, 900, 1600, 2200, 3500];
