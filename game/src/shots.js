// Staged scenes for the entry's screenshots: each one sets up a real
// moment of the game (title, driving, a police chase, a mission fight)
// so the screenshots show the game itself, not a menu alone.
import { S, setToast } from './state.js';
import { city } from './world.js';
import { makeCar, makePed, raiseWanted } from './entities.js';
import { startMission, setMissionStep } from './missions.js';
import { mulberry32, range } from './random.js';

export const SHOTS = ['start', 'drive', 'chase', 'mission'];

export function stageShot(name, seed) {
  const rng = mulberry32(seed * 7919 + 13);
  S.shot = name;
  S.shotT = 0;
  if (name === 'start') {
    S.mode = 'title';
    return;
  }
  S.mode = 'playing';
  const p = S.player;
  if (name === 'drive') {
    // Dana in a Comet GT on the bayfront road, traffic around, mission one
    // on the HUD.
    const car = makeCar(1800, 600, 0, 'coupe', { parked: false });
    car.speed = 420;
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    S.cash = 450;
    S.health = 100;
    S.objective = 'Drive the client to Hotel Solana';
    setToast('First Fare — Drive Rosa’s client to Hotel Solana', 6);
    for (let i = 0; i < 5; i++) {
      const c = makeCar(1400 + i * 170, 600 + (i % 2 ? 16 : -16), 0, i % 2 ? 'sedan' : 'taxi', { driver: 'traffic' });
      c.speed = 300;
      S.cars.push(c);
    }
    for (let i = 0; i < 6; i++) {
      S.peds.push(makePed(1200 + i * 130, 600 + 52));
    }
    S.shotAuto = { throttle: true, steer: 0 };
  }
  if (name === 'chase') {
    // Three stars, two cruisers on Dana's tail, speeding down the avenue.
    const car = makeCar(1400, 1000, 0, 'coupe', { parked: false });
    car.speed = 560;
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    S.cash = 1250;
    S.wanted = 3;
    S.objective = 'Lose the MBPD';
    setToast('Wanted level 3 — lose the MBPD', 6);
    for (let i = 0; i < 2; i++) {
      const cop = makeCar(1400 - 140 - i * 90, 1000 + (i % 2 ? 20 : -20), 0, 'police', { driver: 'police' });
      cop.speed = 540;
      S.cars.push(cop);
    }
    for (let i = 0; i < 4; i++) {
      const c = makeCar(1700 + i * 200, 1000 + (i % 2 ? 16 : -16), 0, 'sedan', { driver: 'traffic' });
      c.speed = 280;
      S.cars.push(c);
    }
    S.shotAuto = { throttle: true, steer: 0 };
  }
  if (name === 'mission') {
    // The pier shootout: Dana on foot, pistol out, Dune Kings closing in.
    // Jump straight to the shootout step so the rivals are in the frame.
    startMission(2);
    setMissionStep(S.mission, 1);
    const pt = city.landmarks.pier;
    p.onFoot = true;
    p.car = null;
    p.x = pt.x - 160;
    p.y = pt.y + 120;
    p.angle = 0;
    p.aim = Math.atan2(pt.y + 40 - p.y, pt.x - p.x);
    p.ammo = 48;
    S.health = 82;
    S.cash = 950;
    S.wanted = 1;
    S.objective = 'Deal with the Dune Kings (0/6)';
    setToast('Bayfront Brawl — Deal with the Dune Kings', 6);
    // A couple of shots already in the air for the screenshot.
    S.bullets.push({
      x: p.x + 60, y: p.y - 10, vx: 700, vy: -80, life: 0.5, from: 'player', damage: 34,
    });
    S.shotAuto = null;
  }
  // Put the camera on the player at once so the first frame is framed.
  S.camera.x = p.x;
  S.camera.y = p.y;
}

export function updateShotAuto(dt) {
  // In staged screenshots the car drives itself down the road so the
  // scene stays alive while the browser takes the picture.
  const auto = S.shotAuto;
  const p = S.player;
  if (!auto || !p || p.onFoot || !p.car) return;
  const car = p.car;
  const ahead = car.x + Math.cos(car.angle) * 200;
  const aheadY = car.y + Math.sin(car.angle) * 200;
  // Steer gently back to the nearest road centre line.
  let targetY = car.y;
  let best = 1e9;
  for (const ry of city.roadsY) {
    const d = Math.abs(ry - car.y);
    if (d < best) {
      best = d;
      targetY = ry + 16;
    }
  }
  const want = Math.atan2(targetY - car.y, ahead - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-1.2 * dt, Math.min(1.2 * dt, diff));
  car.speed += (430 - car.speed) * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  S.shotT += dt;
}
