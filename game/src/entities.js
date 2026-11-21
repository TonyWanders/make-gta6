// People and vehicles: the player, traffic, pedestrians, foot police,
// bullets and pickups. Every update is plain arithmetic so the game
// stays deterministic for a given seed and input.
import { S, say } from './state.js';
import { CAR_TYPES, WORLD_W, WORLD_H, ROAD_HALF } from './config.js';
import { city, collideCircle, onRoad, nearestRoadPoint, buildingAt, inWater } from './world.js';
import { clamp, dist, angleTo, turnToward, range, pick } from './random.js';
import { sfx } from './audio.js';

let entRng = Math.random;

export function setEntRng(rng) {
  entRng = rng;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    weapon: 'pistol', ammo: 48,
    fireCd: 0, hurtCd: 0, sprint: 0,
    moving: false,
  };
}

export function makeCar(x, y, angle, type, opts = {}) {
  const def = CAR_TYPES[type];
  return {
    x, y, angle, speed: 0,
    type, def,
    color: opts.color ?? pick(entRng, [0, 1, 2, 3, 4, 5, 6, 7]),
    hp: def.hp,
    driver: opts.driver ?? null, // 'traffic' | 'police' | 'mission' | null (parked)
    parked: opts.parked ?? false,
    target: null, // traffic waypoint {x, y}
    dead: false, burning: 0, smokeT: 0,
    missionTag: opts.missionTag ?? null,
  };
}

export function makePed(x, y) {
  return {
    x, y, angle: entRng() * Math.PI * 2,
    speed: range(entRng, 30, 55),
    target: null, flee: 0,
    shirt: pick(entRng, ['#d35400', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#ecf0f1', '#e74c3c']),
    walkPhase: entRng() * 10,
  };
}

export function spawnWorldLife() {
  // Parked cars along the roads, traffic driving, pedestrians on the
  // sidewalks, and a few pickups tucked around the city.
  S.cars = [];
  S.peds = [];
  const types = ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'sedan'];
  for (let i = 0; i < 26; i++) {
    const rx = city.roadsX[Math.floor(entRng() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(entRng() * city.roadsY.length)];
    const vertical = entRng() < 0.5;
    const x = vertical ? rx + (entRng() < 0.5 ? -ROAD_HALF - 16 : ROAD_HALF + 16) : rx + range(entRng, -300, 300);
    const y = vertical ? ry + range(entRng, -300, 300) : ry + (entRng() < 0.5 ? -ROAD_HALF - 16 : ROAD_HALF + 16);
    const type = types[Math.floor(entRng() * types.length)];
    const car = makeCar(x, y, vertical ? (entRng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (entRng() < 0.5 ? 0 : Math.PI), type, { parked: true });
    S.cars.push(car);
  }
  for (let i = 0; i < 14; i++) {
    const rx = city.roadsX[Math.floor(entRng() * city.roadsX.length)];
    const ry = city.roadsY[Math.floor(entRng() * city.roadsY.length)];
    const vertical = entRng() < 0.5;
    const car = makeCar(
      vertical ? rx + 16 : rx + range(entRng, -300, 300),
      vertical ? ry + range(entRng, -300, 300) : ry + 16,
      vertical ? Math.PI / 2 : 0,
      types[Math.floor(entRng() * types.length)],
      { driver: 'traffic' },
    );
    car.speed = range(entRng, 120, 200);
    pickTrafficTarget(car);
    S.cars.push(car);
  }
  for (let i = 0; i < 40; i++) {
    const p = nearestRoadPoint(range(entRng, 100, WORLD_W - 400), range(entRng, 100, WORLD_H - 100));
    const off = ROAD_HALF + 14;
    S.peds.push(makePed(p.vertical ? p.x + (entRng() < 0.5 ? -off : off) : p.x, p.vertical ? p.y : p.y + (entRng() < 0.5 ? -off : off)));
  }
  S.pickups = [
    { kind: 'health', x: 640, y: 560 },
    { kind: 'armor', x: 1420, y: 640 },
    { kind: 'ammo', x: 2220, y: 640 },
    { kind: 'health', x: 1020, y: 1820 },
    { kind: 'ammo', x: 2620, y: 1420 },
    { kind: 'cash', x: 1820, y: 1420 },
  ];
}

export function pickTrafficTarget(car) {
  // Drive to the next intersection along the current road, then turn.
  const step = 400;
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  let tx = car.x;
  let ty = car.y;
  if (vertical) {
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    ty = car.y + dir * step;
    tx = car.x;
    // At the intersection, sometimes turn onto the cross street.
    if (entRng() < 0.45) {
      tx = car.x + (entRng() < 0.5 ? -step : step);
    }
  } else {
    const dir = Math.cos(car.angle) > 0 ? 1 : -1;
    tx = car.x + dir * step;
    if (entRng() < 0.45) {
      ty = car.y + (entRng() < 0.5 ? -step : step);
    }
  }
  tx = clamp(tx, 200, WORLD_W - 400);
  ty = clamp(ty, 200, WORLD_H - 100);
  car.target = { x: tx, y: ty };
}

function carRadius(car) {
  return car.type === 'truck' ? 26 : 19;
}

export function updatePlayer(dt, ax) {
  const p = S.player;
  if (!p) return;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);
  p.moving = false;
  if (p.onFoot) {
    const sprint = ax.sprint && p.sprint > 0;
    const spd = sprint ? 330 : 210;
    if (ax.x !== 0 || ax.y !== 0) {
      const len = Math.hypot(ax.x, ax.y) || 1;
      p.x += (ax.x / len) * spd * dt;
      p.y += (ax.y / len) * spd * dt;
      p.angle = Math.atan2(ax.y, ax.x);
      p.moving = true;
      if (sprint) p.sprint = Math.max(0, p.sprint - dt);
      else p.sprint = Math.min(1, p.sprint + dt * 0.4);
      S.stats.distance += spd * dt;
    } else {
      p.sprint = Math.min(1, p.sprint + dt * 0.4);
    }
    collideCircle(p, 14);
    if (inWater(p.x, p.y)) {
      // The bay is not swimmable: push back onto the sand.
      p.x = Math.min(p.x, 2900);
    }
    // Pickups.
    for (const pk of S.pickups) {
      if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 26) {
        pk.taken = true;
        applyPickup(pk.kind);
      }
    }
  } else if (p.car) {
    updateDrivenCar(p.car, ax, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.moving = Math.abs(p.car.speed) > 20;
    S.stats.distance += Math.abs(p.car.speed) * dt;
  }
  // Aim follows the mouse.
  if (S.mouse) {
    p.aim = Math.atan2(S.mouse.wy - p.y, S.mouse.wx - p.x);
  }
}

export function applyPickup(kind) {
  const p = S.player;
  if (kind === 'health') {
    S.health = Math.min(100, S.health + 40);
    say('Health +40');
  } else if (kind === 'armor') {
    S.armor = Math.min(100, S.armor + 50);
    say('Armour +50');
  } else if (kind === 'ammo') {
    p.ammo += 60;
    say('Ammo +60');
  } else if (kind === 'cash') {
    S.cash += 120;
    say('Found $120');
    sfx('cash');
    return;
  }
  sfx('pickup');
}

export function updateDrivenCar(car, ax, dt) {
  // In a staged screenshot the autopilot owns the car: skip input here
  // so the car does not brake and move twice in one frame.
  if (S.shotAuto) return;
  const def = car.def;
  if (ax.y < 0) car.speed += def.accel * dt;
  else if (ax.y > 0) car.speed -= def.accel * 0.9 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  car.speed = clamp(car.speed, -def.top * 0.45, def.top);
  if (Math.abs(car.speed) > 10) {
    car.angle += ax.x * def.turn * dt * Math.sign(car.speed) * (0.55 + 0.45 * Math.min(1, Math.abs(car.speed) / 200));
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = collideCircle(car, carRadius(car));
  if (hitWall && Math.abs(car.speed) > 180) {
    car.hp -= 8;
    car.speed *= 0.55;
    sfx('crash');
    addParticles(car.x, car.y, 8, '#cccccc');
    if (car.hp <= 0) explodeCar(car);
  }
  // Bumping pedestrians is a crime, and it shows.
  for (const ped of S.peds) {
    if (dist(car.x, car.y, ped.x, ped.y) < carRadius(car) + 10) {
      const away = angleTo(car.x, car.y, ped.x, ped.y);
      ped.x += Math.cos(away) * 60;
      ped.y += Math.sin(away) * 60;
      ped.flee = 3;
      if (!ped.hit) {
        ped.hit = true;
        S.stats.pedsHit += 1;
        raiseWanted(1, 'Pedestrian hit');
      }
    }
  }
  // Bumping another car.
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const min = carRadius(car) + carRadius(other);
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const a = angleTo(other.x, other.y, car.x, car.y);
      car.x += Math.cos(a) * push;
      car.y += Math.sin(a) * push;
      other.x -= Math.cos(a) * push;
      other.y -= Math.sin(a) * push;
      if (Math.abs(car.speed) > 200) {
        other.hp -= 10;
        car.speed *= 0.7;
        sfx('crash');
        if (other.hp <= 0) explodeCar(other);
      }
    }
  }
}

export function explodeCar(car) {
  if (car.dead) return;
  car.dead = true;
  car.burning = 2.5;
  car.speed = 0;
  addParticles(car.x, car.y, 40, '#ff7b00');
  addParticles(car.x, car.y, 24, '#333333');
  sfx('explode');
  const p = S.player;
  if (p && p.car === car) {
    p.car = null;
    p.onFoot = true;
    damagePlayer(35, 'explosion');
  }
  if (p && dist(p.x, p.y, car.x, car.y) < 120) damagePlayer(25, 'explosion');
}

export function updateTraffic(dt) {
  for (const car of S.cars) {
    if (car.dead || car.driver !== 'traffic') continue;
    if (car.burning > 0) {
      car.burning -= dt;
      continue;
    }
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 30) {
      pickTrafficTarget(car);
    }
    const want = angleTo(car.x, car.y, car.target.x, car.target.y);
    car.angle = turnToward(car.angle, want, 1.6 * dt);
    // Slow down for the car ahead.
    let targetSpeed = 170;
    for (const other of S.cars) {
      if (other === car || other.dead) continue;
      const ahead = Math.cos(angleTo(car.x, car.y, other.x, other.y) - car.angle);
      if (ahead > 0.85 && dist(car.x, car.y, other.x, other.y) < 90) targetSpeed = 0;
    }
    const p = S.player;
    if (p && !p.onFoot && p.car && dist(car.x, car.y, p.car.x, p.car.y) < 80) {
      const ahead = Math.cos(angleTo(car.x, car.y, p.car.x, p.car.y) - car.angle);
      if (ahead > 0.8) targetSpeed = 0;
    }
    car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideCircle(car, carRadius(car));
    if (car.hp <= 0) explodeCar(car);
  }
  // Thin the traffic that drifted far from the player, and top it up.
  const p = S.player;
  if (p) {
    S.cars = S.cars.filter((c) => c.driver !== 'traffic' || dist(c.x, c.y, p.x, p.y) < 1600 || c.parked);
    const traffic = S.cars.filter((c) => c.driver === 'traffic').length;
    for (let i = traffic; i < 14; i++) {
      const rp = nearestRoadPoint(p.x + range(entRng, -700, 700), p.y + range(entRng, -700, 700));
      const car = makeCar(rp.x + 16, rp.y, 0, pick(entRng, ['sedan', 'coupe', 'taxi', 'van']), { driver: 'traffic' });
      car.speed = 150;
      pickTrafficTarget(car);
      S.cars.push(car);
    }
  }
}

export function updatePeds(dt) {
  const p = S.player;
  for (const ped of S.peds) {
    ped.walkPhase += dt * 6;
    let tx = ped.x;
    let ty = ped.y;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = p ? angleTo(p.x, p.y, ped.x, ped.y) : ped.angle;
      ped.angle = away;
      tx = ped.x + Math.cos(away) * 120 * dt;
      ty = ped.y + Math.sin(away) * 120 * dt;
    } else {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
        const rp = nearestRoadPoint(ped.x + range(entRng, -300, 300), ped.y + range(entRng, -300, 300));
        ped.target = { x: rp.x, y: rp.y };
      }
      ped.angle = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      tx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      ty = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    }
    if (!buildingAt(tx, ty, 6) && !inWater(tx, ty)) {
      ped.x = tx;
      ped.y = ty;
    }
    // A scared pedestrian near a gunfight runs.
    if (S.bullets.length > 0 && p && dist(ped.x, ped.y, p.x, p.y) < 260) ped.flee = 2;
  }
}

export function raiseWanted(n, why) {
  const before = S.wanted;
  S.wanted = clamp(S.wanted + n, 0, 5);
  S.wantedTimer = 0;
  if (S.wanted > before) {
    say(why + ' — wanted level ' + S.wanted);
    spawnPolice();
  }
}

export function spawnPolice() {
  const p = S.player;
  if (!p) return;
  const wantCars = S.wanted >= 2 ? Math.min(2 + S.wanted, 5) : 0;
  const haveCars = S.cars.filter((c) => c.driver === 'police' && !c.dead).length;
  for (let i = haveCars; i < wantCars; i++) {
    const rp = nearestRoadPoint(p.x + range(entRng, -500, 500), p.y + range(entRng, -500, 500));
    const car = makeCar(rp.x, rp.y, angleTo(rp.x, rp.y, p.x, p.y), 'police', { driver: 'police' });
    car.speed = 200;
    S.cars.push(car);
  }
  const wantFoot = S.wanted >= 1 ? Math.min(1 + S.wanted, 4) : 0;
  for (let i = S.cops.length; i < wantFoot; i++) {
    S.cops.push({
      x: p.x + range(entRng, -300, 300),
      y: p.y + range(entRng, -300, 300),
      angle: 0, speed: 150, punchCd: 0,
    });
  }
}

export function updatePolice(dt) {
  const p = S.player;
  if (!p) return;
  // Wanted level fades when the player stays clean and unseen.
  const nearCop = S.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 420)
    || S.cars.some((c) => c.driver === 'police' && !c.dead && dist(c.x, c.y, p.x, p.y) < 520);
  if (S.wanted > 0) {
    if (nearCop) S.wantedTimer = 0;
    else {
      S.wantedTimer += dt;
      if (S.wantedTimer > 22) {
        S.wanted -= 1;
        S.wantedTimer = 0;
        say('The heat dies down — wanted level ' + S.wanted);
        if (S.wanted === 0) {
          S.cops = [];
          for (const c of S.cars) if (c.driver === 'police') c.driver = 'traffic';
        }
      }
    }
  }
  for (const car of S.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    if (car.burning > 0) {
      car.burning -= dt;
      continue;
    }
    const want = angleTo(car.x, car.y, p.x, p.y);
    car.angle = turnToward(car.angle, want, 2.6 * dt);
    car.speed = clamp(car.speed + 320 * dt, 0, car.def.top);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hitWall = collideCircle(car, carRadius(car));
    if (hitWall) car.speed *= 0.6;
    // Ramming the player's car (not in a staged screenshot).
    if (!S.shot && !p.onFoot && p.car && dist(car.x, car.y, p.car.x, p.car.y) < carRadius(car) + carRadius(p.car)) {
      p.car.hp -= 14 * dt;
      p.car.speed *= 0.985;
      if (p.car.hp <= 0) explodeCar(p.car);
    }
    // A cruiser alongside a player on foot tries to run them down slowly.
    if (p.onFoot && dist(car.x, car.y, p.x, p.y) < 30) {
      damagePlayer(20 * dt, 'police');
    }
  }
  for (const cop of S.cops) {
    cop.punchCd = Math.max(0, cop.punchCd - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > 520) continue;
    cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
    if (d > 26) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      collideCircle(cop, 12);
    } else if (p.onFoot && cop.punchCd <= 0) {
      cop.punchCd = 0.9;
      damagePlayer(12, 'police');
      sfx('hurt');
    }
    // Foot cops give up the chase and vanish far from the player.
    if (d > 900) {
      cop.gone = true;
    }
  }
  S.cops = S.cops.filter((c) => !c.gone);
}

export function damagePlayer(amount, source) {
  const p = S.player;
  if (!p || p.hurtCd > 0 || S.mode !== 'playing') return;
  p.hurtCd = 0.25;
  let left = amount;
  if (S.armor > 0) {
    const absorbed = Math.min(S.armor, left * 0.6);
    S.armor -= absorbed;
    left -= absorbed;
  }
  S.health -= left;
  sfx('hurt');
  if (S.health <= 0) {
    S.health = 0;
    S.mode = 'wasted';
    sfx('fail');
    say('Wasted by ' + source);
  }
}

export function playerShoot() {
  const p = S.player;
  if (!p || !p.onFoot || p.fireCd > 0) return;
  if (p.ammo <= 0) {
    say('Out of ammo — find an ammo pickup');
    p.fireCd = 0.4;
    return;
  }
  p.ammo -= 1;
  p.fireCd = 0.22;
  S.stats.shotsFired += 1;
  const a = p.aim ?? p.angle;
  S.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 950,
    vy: Math.sin(a) * 950,
    life: 0.9, from: 'player', damage: 34,
  });
  sfx('shoot');
}

export function updateBullets(dt) {
  for (const b of S.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (buildingAt(b.x, b.y, 0)) {
      b.life = 0;
      addParticles(b.x, b.y, 4, '#ffcc66');
      continue;
    }
    if (b.from === 'player') {
      // Rivals first, then foot cops, then cars.
      for (const r of S.rivals) {
        if (!r.dead && dist(b.x, b.y, r.x, r.y) < 16) {
          r.hp -= b.damage;
          b.life = 0;
          addParticles(b.x, b.y, 6, '#ff5555');
          if (r.hp <= 0) {
            r.dead = true;
            addParticles(r.x, r.y, 16, '#ff5555');
            say('Rival down');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of S.cops) {
        if (dist(b.x, b.y, cop.x, cop.y) < 15) {
          cop.gone = true;
          b.life = 0;
          addParticles(b.x, b.y, 8, '#3355ff');
          raiseWanted(1, 'Cop down');
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of S.cars) {
        if (!car.dead && dist(b.x, b.y, car.x, car.y) < carRadius(car) + 4) {
          car.hp -= b.damage;
          b.life = 0;
          addParticles(b.x, b.y, 5, '#ffcc66');
          if (car.hp <= 0) explodeCar(car);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const ped of S.peds) {
        if (!ped.hit && dist(b.x, b.y, ped.x, ped.y) < 13) {
          ped.hit = true;
          ped.flee = 4;
          b.life = 0;
          raiseWanted(1, 'Pedestrian shot');
          break;
        }
      }
    } else {
      // Enemy bullet: only the player can be hit.
      const p = S.player;
      if (p && p.onFoot && dist(b.x, b.y, p.x, p.y) < 15) {
        b.life = 0;
        damagePlayer(b.damage, 'gunfire');
      }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0);
}

export function updateRivals(dt) {
  const p = S.player;
  if (!p) return;
  for (const r of S.rivals) {
    if (r.dead) continue;
    r.fireCd = Math.max(0, (r.fireCd ?? 0) - dt);
    const d = dist(r.x, r.y, p.x, p.y);
    if (d > 700) continue;
    r.angle = angleTo(r.x, r.y, p.x, p.y);
    if (d > 260) {
      r.x += Math.cos(r.angle) * 130 * dt;
      r.y += Math.sin(r.angle) * 130 * dt;
      collideCircle(r, 13);
    } else if (r.fireCd <= 0 && !S.shot) {
      // Staged screenshots hold their fire so the scene stays readable.
      r.fireCd = range(entRng, 0.8, 1.6);
      const a = r.angle + range(entRng, -0.12, 0.12);
      S.bullets.push({
        x: r.x + Math.cos(a) * 20, y: r.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        life: 1.1, from: 'rival', damage: 9,
      });
      sfx('enemyShoot');
    }
  }
  S.rivals = S.rivals.filter((r) => !r.dead || r.fade !== true);
}

export function addParticles(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = entRng() * Math.PI * 2;
    const sp = range(entRng, 40, 220);
    S.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: range(entRng, 0.3, 0.9), max: 0.9, color,
      size: range(entRng, 2, 6),
    });
  }
}

export function updateParticles(dt) {
  for (const pt of S.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  for (const car of S.cars) {
    if (car.burning > 0) {
      car.burning -= dt;
      car.smokeT = (car.smokeT ?? 0) - dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.08;
        addParticles(car.x + range(entRng, -14, 14), car.y + range(entRng, -14, 14), 2, '#222222');
        if (entRng() < 0.4) addParticles(car.x, car.y, 2, '#ff7b00');
      }
      if (car.burning <= 0) car.dead = true;
    }
  }
}

// Steal or enter the nearest car, or step out of the one being driven.
export function tryEnterExitCar() {
  const p = S.player;
  if (!p) return;
  if (!p.onFoot && p.car) {
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    collideCircle(p, 14);
    return;
  }
  let best = null;
  let bestD = 60;
  for (const car of S.cars) {
    if (car.dead || car.burning > 0) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    best.driver = null;
    S.stats.carsStolen += 1;
    raiseWanted(1, 'Car stolen');
    sfx('steal');
  } else if (best.driver === 'police') {
    best.driver = null;
    S.stats.carsStolen += 1;
    raiseWanted(2, 'Police cruiser stolen');
    sfx('steal');
  }
  best.parked = false;
  p.car = best;
  p.onFoot = false;
  p.x = best.x;
  p.y = best.y;
}
