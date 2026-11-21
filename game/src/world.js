// Marisol Bay itself: a road grid, beach and harbour, parks, and the
// buildings that fill every block. All generated from the seed so the
// city is the same every run.
import { WORLD_W, WORLD_H, ROAD_STEP, ROAD_HALF, COLORS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

export const city = {
  buildings: [], // {x, y, w, h, color, roof, hgt}
  parks: [], // {x, y, w, h}
  water: [], // {x, y, w, h}
  sand: [], // {x, y, w, h}
  docks: [], // {x, y, w, h}
  landmarks: {}, // named places: {x, y, label}
  roadsX: [],
  roadsY: [],
};

export function buildCity(seed) {
  const rng = mulberry32(seed);
  city.buildings = [];
  city.parks = [];
  city.water = [];
  city.sand = [];
  city.docks = [];
  city.landmarks = {};
  city.roadsX = [];
  city.roadsY = [];
  for (let x = ROAD_STEP; x < WORLD_W; x += ROAD_STEP) city.roadsX.push(x);
  for (let y = ROAD_STEP; y < WORLD_H; y += ROAD_STEP) city.roadsY.push(y);

  // The bay: water along the whole east edge and the south-east corner,
  // with a sand beach between it and the streets.
  city.water.push({ x: 2920, y: 0, w: WORLD_W - 2920, h: WORLD_H });
  city.water.push({ x: 2400, y: 2100, w: WORLD_W - 2400, h: WORLD_H - 2100 });
  city.sand.push({ x: 2840, y: 0, w: 80, h: 2100 });
  city.sand.push({ x: 2400, y: 2020, w: 520, h: 80 });
  // The docks at the south edge, where the container yard sits.
  city.docks.push({ x: 1200, y: 2280, w: 800, h: 120 });

  // Buildings fill every block that is not water, sand, dock or park.
  const parkBlocks = new Set(['2,2', '5,3', '3,5']);
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = bx * ROAD_STEP + ROAD_HALF + 14;
      const y0 = by * ROAD_STEP + ROAD_HALF + 14;
      const x1 = (bx + 1) * ROAD_STEP - ROAD_HALF - 14;
      const y1 = (by + 1) * ROAD_STEP - ROAD_HALF - 14;
      if (x1 > 2820 || y1 > 2000) continue; // keep the beach clear
      if (parkBlocks.has(bx + ',' + by)) {
        city.parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const n = rangeInt(rng, 2, 4);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 90, 150);
        const h = range(rng, 70, 130);
        const x = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const y = range(rng, y0, Math.max(y0 + 1, y1 - h));
        city.buildings.push({
          x, y, w, h,
          color: pick(rng, COLORS.buildingRoof),
          roof: rng() < 0.3 ? 'pool' : 'flat',
          hgt: rangeInt(rng, 6, 22),
        });
      }
    }
  }

  // Named places the missions and the HUD point at.
  city.landmarks = {
    rosaOffice: { x: 600, y: 600, label: 'Rosa’s Office' },
    hotelSolana: { x: 2200, y: 600, label: 'Hotel Solana' },
    marina: { x: 2600, y: 1400, label: 'Marina' },
    pier: { x: 2860, y: 1000, label: 'Sunset Pier' },
    docks: { x: 1600, y: 2200, label: 'Container Yard' },
    garage: { x: 1000, y: 1800, label: 'Lou’s Garage' },
    hospital: { x: 1400, y: 1000, label: 'Bay General' },
    policeHQ: { x: 1800, y: 1400, label: 'MBPD HQ' },
    cafe: { x: 600, y: 1000, label: 'Café Lumen' },
    hideout: { x: 2200, y: 1800, label: 'Hideout' },
    plaza: { x: 1400, y: 600, label: 'Plaza Mayor' },
  };
  return city;
}

export function onRoad(x, y) {
  for (const rx of city.roadsX) if (Math.abs(x - rx) < ROAD_HALF + 6) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < ROAD_HALF + 6) return true;
  return false;
}

export function inWater(x, y) {
  return city.water.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

export function buildingAt(x, y, pad = 0) {
  return city.buildings.find((b) => x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad) || null;
}

// Push a circle (x, y, r) out of buildings and the map edge. Returns true
// when a wall was hit.
export function collideCircle(p, r) {
  let hit = false;
  p.x = Math.max(r + 4, Math.min(WORLD_W - r - 4, p.x));
  p.y = Math.max(r + 4, Math.min(WORLD_H - r - 4, p.y));
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        p.y = b.y - r;
      }
    }
  }
  return hit;
}

// Nearest point on the road grid to (x, y), used to snap spawns.
export function nearestRoadPoint(x, y) {
  let bx = city.roadsX[0];
  let by = city.roadsY[0];
  for (const rx of city.roadsX) if (Math.abs(x - rx) < Math.abs(x - bx)) bx = rx;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < Math.abs(y - by)) by = ry;
  if (Math.abs(x - bx) < Math.abs(y - by)) return { x: bx, y, vertical: true };
  return { x, y: by, vertical: false };
}
