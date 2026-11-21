// Solmar Bay — the city itself: road grid, blocks, buildings, beach, docks.
// Everything is generated from a seed so the map is identical every run.
import { WORLD } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';

const BUILDING_COLORS = [
  '#8a7f72', '#a89a86', '#7d8aa0', '#b09a7a', '#6f7f6a', '#96705a',
  '#5f6f8a', '#a08a6a', '#7a6a8a', '#8a8a7a', '#c0b090', '#4a5a6a',
];
const ROOF_COLORS = ['#5a4a3a', '#3a4a5a', '#6a5a4a', '#4a3a2a', '#555a66'];

export function roadCentersX() {
  const xs = [];
  for (let x = 200; x <= WORLD.w - 200; x += WORLD.block) xs.push(x);
  return xs;
}
export function roadCentersY() {
  const ys = [];
  for (let y = 200; y <= WORLD.beachY - 200; y += WORLD.block) ys.push(y);
  return ys;
}

export function isRoad(x, y) {
  const r = WORLD.road / 2;
  for (const cx of roadCentersX()) if (Math.abs(x - cx) <= r && y < WORLD.beachY) return true;
  for (const cy of roadCentersY()) if (Math.abs(y - cy) <= r && x < WORLD.w) return true;
  return false;
}

// Distance from a point to the nearest road centreline (used for lane driving).
export function roadDistance(x, y) {
  let best = Infinity;
  for (const cx of roadCentersX()) best = Math.min(best, Math.abs(x - cx));
  for (const cy of roadCentersY()) best = Math.min(best, Math.abs(y - cy));
  return best;
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const xs = roadCentersX();
  const ys = roadCentersY();
  const roadHalf = WORLD.road / 2;

  // Named landmarks (fixed positions, used by missions + minimap).
  const landmarks = [
    { name: "Mara's Garage", x: 2600, y: 1900, kind: 'garage' },
    { name: 'Solmar PD HQ', x: 2200, y: 1400, kind: 'police' },
    { name: 'Bay General Hospital', x: 1400, y: 1000, kind: 'hospital' },
    { name: 'The Docks', x: 4700, y: 2900, kind: 'docks' },
    { name: 'Lighthouse Point', x: 4900, y: 3520, kind: 'lighthouse' },
    { name: 'Palm Plaza', x: 1200, y: 2200, kind: 'plaza' },
    { name: 'Sunset Pier', x: 2600, y: 3550, kind: 'pier' },
    { name: 'City Hall', x: 3000, y: 1000, kind: 'hall' },
  ];

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + roadHalf + 14;
      const by0 = ys[j] + roadHalf + 14;
      const bx1 = xs[i + 1] - roadHalf - 14;
      const by1 = ys[j + 1] - roadHalf - 14;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const roll = rng();
      if (roll < 0.16) {
        // Park block: grass + trees.
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        const n = rangeInt(rng, 6, 11);
        for (let t = 0; t < n; t++) {
          trees.push({ x: range(rng, bx0 + 20, bx1 - 20), y: range(rng, by0 + 20, by1 - 20), r: range(rng, 10, 18) });
        }
        continue;
      }
      if (roll < 0.24) {
        // Parking lot block: empty asphalt with a few parked cars (spawned later).
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, lot: true });
        continue;
      }
      // Building block: 1 big building or 2-4 small ones.
      const downtown = Math.hypot(cx - 2600, cy - 1500) < 900;
      const count = downtown ? 1 : rangeInt(rng, 1, 3);
      if (count === 1) {
        const w = (bx1 - bx0) * range(rng, 0.55, 0.85);
        const h = (by1 - by0) * range(rng, 0.55, 0.85);
        buildings.push(makeBuilding(rng, cx - w / 2, cy - h / 2, w, h, downtown));
      } else {
        const cols = 2;
        const cw = (bx1 - bx0) / cols;
        for (let c = 0; c < cols; c++) {
          for (let rr = 0; rr < 2; rr++) {
            if (rng() < 0.25) continue;
            const w = cw * range(rng, 0.6, 0.85);
            const h = ((by1 - by0) / 2) * range(rng, 0.6, 0.85);
            buildings.push(makeBuilding(rng,
              bx0 + c * cw + (cw - w) / 2, by0 + rr * ((by1 - by0) / 2) + (((by1 - by0) / 2) - h) / 2,
              w, h, downtown));
          }
        }
      }
      // Street trees along the block edge.
      if (rng() < 0.6) {
        trees.push({ x: bx0 + 8, y: by0 + 8, r: 11 });
        trees.push({ x: bx1 - 8, y: by1 - 8, r: 11 });
      }
    }
  }

  // Beach palm trees.
  for (let x = 150; x < WORLD.w; x += 90) {
    if (rng() < 0.7) trees.push({ x: x + range(rng, -20, 20), y: WORLD.beachY + range(rng, 30, 120), r: 13, palm: true });
  }
  // Dock containers.
  const containers = [];
  for (let i = 0; i < 14; i++) {
    containers.push({
      x: 4550 + (i % 7) * 70, y: 2750 + Math.floor(i / 7) * 60,
      w: 56, h: 34, color: pick(rng, ['#b03a2e', '#2e6fb0', '#c08a2e', '#3a8a4a', '#7a4a8a']),
    });
  }

  return { buildings, trees, parks, containers, landmarks, seed };
}

function makeBuilding(rng, x, y, w, h, downtown) {
  return {
    x, y, w, h,
    height: downtown ? rangeInt(rng, 3, 9) : rangeInt(rng, 1, 3),
    color: pick(rng, BUILDING_COLORS),
    roof: pick(rng, ROOF_COLORS),
    windows: rangeInt(rng, 2, 5),
  };
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  for (const c of city.containers) {
    if (x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad) return c;
  }
  return null;
}

// Circle vs building collision: push the circle out, return corrected position.
export function collideBuildings(city, x, y, radius) {
  let nx = x, ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx, dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) { ny = b.y - radius; continue; }
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    }
  }
  return { x: nx, y: ny };
}

export function randomRoadPosition(rng) {
  const xs = roadCentersX(), ys = roadCentersY();
  if (rng() < 0.5) {
    return { x: pick(rng, xs) + (rng() < 0.5 ? -22 : 22), y: range(rng, 240, WORLD.beachY - 240), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  return { x: range(rng, 240, WORLD.w - 240), y: pick(rng, ys) + (rng() < 0.5 ? -22 : 22), angle: rng() < 0.5 ? 0 : Math.PI };
}

export function randomSidewalkPosition(rng) {
  const xs = roadCentersX(), ys = roadCentersY();
  if (rng() < 0.5) {
    const cx = pick(rng, xs);
    return { x: cx + (rng() < 0.5 ? -62 : 62), y: range(rng, 240, WORLD.beachY - 240) };
  }
  const cy = pick(rng, ys);
  return { x: range(rng, 240, WORLD.w - 240), y: cy + (rng() < 0.5 ? -62 : 62) };
}

// Nearest point on a road centreline to (x,y) — traffic follows these.
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const cx of roadCentersX()) {
    const d = Math.abs(x - cx);
    if (d < bd) { bd = d; best = { x: cx, y, vertical: true }; }
  }
  for (const cy of roadCentersY()) {
    const d = Math.abs(y - cy);
    if (d < bd) { bd = d; best = { x, y: cy, vertical: false }; }
  }
  return best;
}
