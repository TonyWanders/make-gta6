// The story: Dana Cruz, a driver who owes fixer Rosa Vega one last
// favour, works off the debt across six missions in Marisol Bay.
// Every mission is a short list of objectives the engine steps through.
import { S, say, setToast } from './state.js';
import { city } from './world.js';
import { makeCar, raiseWanted, addParticles } from './entities.js';
import { dist, range } from './random.js';
import { sfx } from './audio.js';

export const MISSIONS = [
  {
    name: 'First Fare',
    brief: 'Rosa needs a driver she can trust. Pick up her client at Café Lumen and get him to Hotel Solana before the meeting starts.',
    reward: 300,
    steps: [
      { type: 'goto', at: 'cafe', text: 'Pick up the client at Café Lumen', radius: 70 },
      { type: 'goto', at: 'hotelSolana', text: 'Drive the client to Hotel Solana', radius: 80, timed: 150 },
    ],
  },
  {
    name: 'Hot Wheels',
    brief: 'A Comet GT is sitting at the marina with the keys in it. Take it, lose the heat, and bring it to Lou’s Garage.',
    reward: 600,
    steps: [
      { type: 'goto', at: 'marina', text: 'Find the Comet GT at the marina', radius: 90 },
      { type: 'steal', tag: 'comet', text: 'Steal the Comet GT', radius: 70 },
      { type: 'deliver', at: 'garage', tag: 'comet', text: 'Deliver the Comet GT to Lou’s Garage', radius: 80 },
    ],
  },
  {
    name: 'Bayfront Brawl',
    brief: 'The Dune Kings are leaning on Rosa’s people at Sunset Pier. Go down there and send them a message they will remember.',
    reward: 800,
    steps: [
      { type: 'goto', at: 'pier', text: 'Reach Sunset Pier', radius: 90 },
      { type: 'kill', count: 6, text: 'Deal with the Dune Kings (0/6)', radius: 0 },
      { type: 'goto', at: 'rosaOffice', text: 'Report back to Rosa’s Office', radius: 70 },
    ],
  },
  {
    name: 'The Drop',
    brief: 'A package is waiting in the container yard. Pick it up and take it to the hideout. The MBPD will be watching, so keep moving.',
    reward: 1000,
    steps: [
      { type: 'goto', at: 'docks', text: 'Pick up the package at the Container Yard', radius: 80 },
      { type: 'deliver', at: 'hideout', text: 'Deliver the package to the Hideout — the police are on you', radius: 80, wanted: 3 },
    ],
  },
  {
    name: 'Harbor Lights',
    brief: 'Rosa needs a Hauler from the docks, no questions asked. Take the truck and bring it to the hideout in one piece.',
    reward: 1400,
    steps: [
      { type: 'steal', tag: 'hauler', text: 'Steal the Hauler at the Container Yard', radius: 90 },
      { type: 'deliver', at: 'hideout', tag: 'hauler', text: 'Bring the Hauler to the Hideout', radius: 90, wanted: 3 },
    ],
  },
  {
    name: 'King of the Bay',
    brief: 'Kessler runs the Dune Kings and he runs this city. His convoy is crossing the bayfront. Wreck every car in it and the bay is yours.',
    reward: 2500,
    steps: [
      { type: 'goto', at: 'plaza', text: 'Intercept Kessler’s convoy at Plaza Mayor', radius: 100 },
      { type: 'wreck', count: 4, text: 'Wreck the convoy (0/4)', radius: 0 },
    ],
  },
];

export function missionPoint(key) {
  const lm = city.landmarks[key];
  return lm ? { x: lm.x, y: lm.y, label: lm.label } : { x: 600, y: 600, label: key };
}

export function startMission(index) {
  const def = MISSIONS[index];
  if (!def) return false;
  const m = {
    index,
    def,
    step: 0,
    timer: 0,
    spawned: false,
    targetCar: null,
    kills: 0,
    wrecks: 0,
  };
  S.mission = m;
  S.objective = def.steps[0].text;
  setToast(def.name + ' — ' + def.brief, 6);
  say('Mission: ' + def.name);
  sfx('mission');
  prepareStep(m);
  return true;
}

export function setMissionStep(m, stepIndex) {
  m.step = stepIndex;
  prepareStep(m);
  S.objective = m.def.steps[m.step].text;
}

function prepareStep(m) {
  const step = m.def.steps[m.step];
  if (!step) return;
  m.spawned = false;
  m.timer = step.timed ?? 0;
  S.objective = step.text;
  if (step.type === 'steal' && step.tag === 'comet') {
    const pt = missionPoint('marina');
    const car = makeCar(pt.x + 40, pt.y + 30, 0, 'coupe', { parked: true, missionTag: 'comet' });
    S.cars.push(car);
    m.targetCar = car;
    say('The Comet GT is parked at the marina');
  }
  if (step.type === 'steal' && step.tag === 'hauler') {
    const pt = missionPoint('docks');
    const car = makeCar(pt.x + 60, pt.y - 20, Math.PI / 2, 'truck', { parked: true, missionTag: 'hauler' });
    S.cars.push(car);
    m.targetCar = car;
    say('The Hauler is parked in the container yard');
  }
  if (step.type === 'kill') {
    const pt = missionPoint('pier');
    S.rivals = [];
    for (let i = 0; i < step.count; i++) {
      S.rivals.push({
        x: pt.x - 40 + (i % 3) * 45,
        y: pt.y + 40 + Math.floor(i / 3) * 50,
        angle: 0, hp: 60, fireCd: 1 + i * 0.3, dead: false,
      });
    }
    m.kills = 0;
    say('The Dune Kings are here — ' + step.count + ' of them');
  }
  if (step.type === 'wreck') {
    const pt = missionPoint('plaza');
    S.cars = S.cars.filter((c) => c.driver !== 'mission');
    const convoy = [
      { type: 'sedan', dx: 0, dy: 0, tag: 'kessler' },
      { type: 'sedan', dx: -70, dy: 30, tag: 'escort' },
      { type: 'van', dx: 70, dy: 30, tag: 'escort' },
      { type: 'coupe', dx: 0, dy: 70, tag: 'escort' },
    ];
    for (const c of convoy) {
      const car = makeCar(pt.x + c.dx, pt.y + c.dy, 0, c.type, { driver: 'mission', missionTag: c.tag });
      car.speed = 140;
      S.cars.push(car);
    }
    m.wrecks = 0;
    say('There’s the convoy — wreck them all');
  }
  if (step.wanted) {
    while (S.wanted < step.wanted) raiseWanted(1, 'The MBPD is on you');
  }
}

function advanceStep(m) {
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    completeMission(m);
    return;
  }
  prepareStep(m);
  setToast(S.objective, 3);
}

function completeMission(m) {
  S.cash += m.def.reward;
  S.stats.missionsDone += 1;
  S.missionIndex = Math.min(MISSIONS.length, m.index + 1);
  S.mission = null;
  S.objective = '';
  S.rivals = [];
  setToast('Mission complete: ' + m.def.name + ' — $' + m.def.reward, 5);
  say('Mission complete — $' + m.def.reward);
  sfx('mission');
  addParticles(S.player.x, S.player.y, 30, '#ffd700');
  saveGame();
  if (S.missionIndex >= MISSIONS.length) {
    S.mode = 'gameover';
  }
}

export function failMission(reason) {
  const m = S.mission;
  if (!m) return;
  S.mission = null;
  S.objective = '';
  S.rivals = [];
  setToast('Mission failed: ' + reason + ' — talk to Rosa to try again', 5);
  say('Mission failed: ' + reason);
  sfx('fail');
}

export function updateMission(dt) {
  const m = S.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = S.player;
  if (step.timed) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission('Out of time');
      return;
    }
  }
  if (step.type === 'goto' || step.type === 'deliver') {
    const pt = missionPoint(step.at);
    const d = dist(p.x, p.y, pt.x, pt.y);
    if (step.type === 'deliver' && step.tag && m.targetCar) {
      // The delivery counts when the target car reaches the marker.
      const cd = dist(m.targetCar.x, m.targetCar.y, pt.x, pt.y);
      if (cd < step.radius) {
        say('Delivered');
        advanceStep(m);
      }
      return;
    }
    if (d < step.radius) {
      advanceStep(m);
    }
  } else if (step.type === 'steal') {
    const car = m.targetCar;
    if (car && p.car === car) {
      say('Got it — now deliver it');
      advanceStep(m);
    }
  } else if (step.type === 'kill') {
    const done = step.count - S.rivals.filter((r) => !r.dead).length;
    m.kills = done;
    S.objective = step.text.replace(/\(\d+\/\d+\)/, '(' + done + '/' + step.count + ')');
    if (S.rivals.length > 0 && S.rivals.every((r) => r.dead)) {
      advanceStep(m);
    }
  } else if (step.type === 'wreck') {
    const convoy = S.cars.filter((c) => c.driver === 'mission');
    const done = step.count - convoy.filter((c) => !c.dead).length;
    m.wrecks = done;
    S.objective = step.text.replace(/\(\d+\/\d+\)/, '(' + done + '/' + step.count + ')');
    if (convoy.length > 0 && convoy.every((c) => c.dead)) {
      advanceStep(m);
    }
  }
}

// Convoy cars drive a loop around the bayfront while the final mission runs.
export function updateConvoy(dt) {
  const p = S.player;
  for (const car of S.cars) {
    if (car.driver !== 'mission' || car.dead) continue;
    // Flee from the player when rammed, otherwise cruise the loop.
    const d = p ? dist(car.x, car.y, p.x, p.y) : 9999;
    let tx = 2200;
    let ty = 600;
    if (car.x > 1800) { tx = 2200; ty = 1400; }
    if (car.y > 1000 && car.x > 1800) { tx = 1400; ty = 1400; }
    if (car.y > 1000 && car.x < 1800) { tx = 1400; ty = 600; }
    if (d < 160) {
      // Swerve away from the player.
      tx = car.x + (car.x - p.x);
      ty = car.y + (car.y - p.y);
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
    car.speed += (260 - car.speed) * dt * 0.8;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep them on the roads.
    if (car.x < 200) car.x = 200;
    if (car.x > 2800) car.x = 2800;
    if (car.y < 200) car.y = 200;
    if (car.y > 2000) car.y = 2000;
  }
}

// ---- Save / load -------------------------------------------------------
export function saveGame() {
  try {
    const data = {
      cash: S.cash,
      missionIndex: S.missionIndex,
      stats: S.stats,
      health: S.health,
      armor: S.armor,
    };
    localStorage.setItem('marisol-bay-save-v1', JSON.stringify(data));
  } catch { /* saving is optional */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem('marisol-bay-save-v1');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function applySave(data) {
  if (!data) return;
  S.cash = data.cash ?? 150;
  S.missionIndex = data.missionIndex ?? 0;
  S.stats = { ...S.stats, ...(data.stats ?? {}) };
  S.health = data.health ?? 100;
  S.armor = data.armor ?? 0;
}
