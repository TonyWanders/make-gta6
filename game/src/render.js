// Everything the player sees: the city, the people and cars in it, the
// HUD with its minimap, and the title, pause and end screens.
import { S } from './state.js';
import { WORLD_W, WORLD_H, ROAD_HALF, COLORS, CAR_TYPES, RANKS } from './config.js';
import { city } from './world.js';
import { MISSIONS, missionPoint } from './missions.js';
import { clamp } from './random.js';

let ctx = null;
let viewW = 1280;
let viewH = 800;

export function setCanvas(c, w, h) {
  ctx = c.getContext('2d');
  viewW = w;
  viewH = h;
}

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, viewW, viewH);
  if (S.mode === 'title') {
    drawTitle();
    return;
  }
  const cam = S.camera;
  const vw = viewW / cam.zoom;
  const vh = viewH / cam.zoom;
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + vw / 2, -cam.y + vh / 2);
  drawWorld(vw, vh);
  drawPickups();
  drawCars();
  drawPeds();
  drawCops();
  drawRivals();
  drawPlayer();
  drawBullets();
  drawParticles();
  drawMissionMarker();
  ctx.restore();
  drawHUD();
  if (S.mode === 'paused') drawOverlay('PAUSED', 'Press P to keep playing. M for missions. Progress saves itself.');
  if (S.mode === 'busted') drawOverlay('BUSTED', 'The MBPD caught up with you. You lost 10% of your cash. Press Enter to walk free.');
  if (S.mode === 'wasted') drawOverlay('WASTED', 'Marisol Bay General patched you up. You lost 10% of your cash. Press Enter to get back out there.');
  if (S.mode === 'gameover') drawOverlay('BAY LEGEND', 'Every mission done. Kessler is finished and Marisol Bay is yours, Dana. Press Enter to keep playing the city.');
  if (S.mode === 'missionlist') drawMissionList();
}

function drawWorld(vw, vh) {
  const cam = S.camera;
  const x0 = cam.x - vw / 2 - 60;
  const y0 = cam.y - vh / 2 - 60;
  const x1 = cam.x + vw / 2 + 60;
  const y1 = cam.y + vh / 2 + 60;
  // Ground: grass everywhere, so the city reads as a coastal town.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Water and sand.
  for (const w of city.water) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.deepWater;
    ctx.fillRect(w.x + 40, w.y, w.w - 40, w.h);
  }
  for (const s of city.sand) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  // Docks: grey concrete with container stripes.
  for (const d of city.docks) {
    ctx.fillStyle = '#7d7a72';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#c0392b';
    for (let i = 0; i < 8; i++) ctx.fillRect(d.x + 20 + i * 95, d.y + 20, 70, 28);
    ctx.fillStyle = '#2471a3';
    for (let i = 0; i < 8; i++) ctx.fillRect(d.x + 20 + i * 95, d.y + 60, 70, 28);
  }
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#3d7a33';
    for (let i = 0; i < 6; i++) {
      const tx = p.x + 40 + (i % 3) * 100;
      const ty = p.y + 40 + Math.floor(i / 3) * 90;
      ctx.beginPath();
      ctx.arc(tx, ty, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roads: dark asphalt with sidewalks and dashed centre lines.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of city.roadsX) ctx.fillRect(rx - ROAD_HALF - 10, 0, (ROAD_HALF + 10) * 2, WORLD_H);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - ROAD_HALF - 10, WORLD_W, (ROAD_HALF + 10) * 2);
  ctx.fillStyle = COLORS.road;
  for (const rx of city.roadsX) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  ctx.fillStyle = COLORS.lane;
  for (const rx of city.roadsX) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of city.roadsY) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }
  // Buildings: a shaded side and a coloured roof, taller ones casting more.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.hgt * 0.4, b.y + b.hgt * 0.4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.roof === 'pool') {
      ctx.fillStyle = '#4db2d8';
      ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
    }
  }
  // Landmark labels, small and only when close enough to read.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.landmarks)) {
    const lm = city.landmarks[key];
    if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(lm.label, lm.x, lm.y - 8);
  }
}

function drawCarShape(car) {
  const len = car.type === 'truck' ? 52 : car.type === 'van' ? 46 : 40;
  const wid = car.type === 'truck' ? 22 : 20;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(-len / 2 + 3, -wid / 2 + 4, len, wid, 6);
  ctx.fill();
  const palette = COLORS.car;
  let col = palette[car.color % palette.length];
  if (car.type === 'police') col = COLORS.police;
  if (car.missionTag === 'kessler') col = '#111111';
  ctx.fillStyle = col;
  rr(-len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  // Windshield and roof.
  ctx.fillStyle = 'rgba(180,220,240,0.85)';
  ctx.fillRect(len * 0.08, -wid / 2 + 3, len * 0.16, wid - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len * 0.18, -wid / 2 + 3, len * 0.2, wid - 6);
  if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-len * 0.28, -wid / 2, len * 0.14, 4);
    ctx.fillRect(-len * 0.28, wid / 2 - 4, len * 0.14, 4);
    // Light bar, flashing with time.
    const on = Math.floor(S.time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2222' : '#2266ff';
    ctx.fillRect(-2, -wid / 2 - 2, 8, 6);
    ctx.fillStyle = on ? '#2266ff' : '#ff2222';
    ctx.fillRect(-2, wid / 2 - 4, 8, 6);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.burning > 0) {
    ctx.fillStyle = 'rgba(255,123,0,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, 12 + Math.sin(S.time * 20) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCars() {
  for (const car of S.cars) {
    if (car.dead && car.burning <= 0) {
      // A wreck stays on the street, blackened.
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#1a1a1a';
      rr(-20, -10, 40, 20, 6);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawCarShape(car);
  }
}

function drawPerson(x, y, angle, shirt, isCop, isRival) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#16294d';
    ctx.fillRect(-6, -9, 12, 5);
  }
  if (isRival) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(-4, -4, 14, 3);
  }
  ctx.restore();
}

function drawPeds() {
  for (const ped of S.peds) {
    if (ped.hit) continue; // knocked down, out of the scene
    const bob = Math.sin(ped.walkPhase) * 1.5;
    drawPerson(ped.x, ped.y + bob, ped.angle, ped.shirt, false, false);
  }
}

function drawCops() {
  for (const cop of S.cops) {
    drawPerson(cop.x, cop.y, cop.angle, '#1e4f9c', true, false);
  }
}

function drawRivals() {
  for (const r of S.rivals) {
    if (r.dead) continue;
    drawPerson(r.x, r.y, r.angle, '#8e1f1f', false, true);
  }
}

function drawPlayer() {
  const p = S.player;
  if (!p) return;
  if (p.onFoot) {
    drawPerson(p.x, p.y, p.aim ?? p.angle, '#f5d76e', false, false);
    // Aim line and pistol.
    const a = p.aim ?? p.angle;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14);
    ctx.lineTo(p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34);
    ctx.stroke();
  } else if (p.car) {
    // The driven car is drawn with the rest; mark it with a soft ring.
    ctx.strokeStyle = 'rgba(255,215,0,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.car.x, p.car.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets() {
  ctx.fillStyle = '#ffe066';
  for (const b of S.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const pt of S.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPickups() {
  for (const pk of S.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(S.time * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'health' ? '#e74c3c' : pk.kind === 'armor' ? '#3498db' : pk.kind === 'ammo' ? '#f1c40f' : '#2ecc71';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : pk.kind === 'ammo' ? '»' : '$', 0, 4);
    ctx.restore();
  }
}

function drawMissionMarker() {
  const m = S.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step || !step.at) return;
  const pt = missionPoint(step.at);
  const pulse = 1 + Math.sin(S.time * 5) * 0.15;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(0, -44 * pulse);
  ctx.lineTo(8, -30);
  ctx.lineTo(-8, -30);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('▼', 0, -46 * pulse);
  ctx.restore();
  // A line from the player toward the marker, faint, so the player can
  // always find the objective.
  const p = S.player;
  if (p) {
    ctx.strokeStyle = 'rgba(255,215,0,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---- HUD ---------------------------------------------------------------
function drawHUD() {
  const p = S.player;
  // Top left: health, armour, cash, rank.
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(12, 12, 250, 92, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DANA CRUZ', 24, 34);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(24, 44, 150 * clamp(S.health / 100, 0, 1), 10);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(24, 44, 150, 10);
  ctx.fillStyle = '#3498db';
  ctx.fillRect(24, 60, 150 * clamp(S.armor / 100, 0, 1), 8);
  ctx.strokeRect(24, 60, 150, 8);
  ctx.fillStyle = '#ffd700';
  ctx.fillText('$' + S.cash.toLocaleString('en-US'), 24, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(RANKS[Math.min(S.missionIndex, RANKS.length - 1)], 110, 90);
  // Top right: wanted stars and the clock.
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  ctx.fillStyle = S.wanted > 0 ? '#ff4444' : '#ffffff';
  ctx.fillText(stars, viewW - 24, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  const hh = String(Math.floor(S.clock / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(S.clock % 60)).padStart(2, '0');
  ctx.fillText(hh + ':' + mm + '  MARISOL BAY', viewW - 16, 64);
  // Top centre: current objective.
  if (S.objective) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(S.objective).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr((viewW - w) / 2, 12, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.fillText(S.objective, viewW / 2, 33);
  }
  // Mission toast under the objective.
  if (S.missionToastT > 0 && S.missionToast) {
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    const lines = wrapText(S.missionToast, 560);
    const h = lines.length * 20 + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr((viewW - 580) / 2, 50, 580, h, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, i) => ctx.fillText(line, viewW / 2, 50 + 22 + i * 20));
  }
  // Bottom left: weapon, ammo, speed.
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(12, viewH - 64, 210, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  if (p) {
    if (p.onFoot) ctx.fillText('Pistol   •   ' + p.ammo + ' rounds', 24, viewH - 40);
    else ctx.fillText((p.car ? p.car.def.name : 'Car') + '   •   ' + Math.round(Math.abs(p.car ? p.car.speed : 0) * 0.12) + ' mph', 24, viewH - 40);
    ctx.font = '13px sans-serif';
    ctx.fillText('E enter car   •   M missions   •   P pause', 24, viewH - 20);
  }
  // Message log above the weapon box.
  ctx.font = '13px sans-serif';
  S.messages.slice(-4).forEach((msg, i) => {
    ctx.fillStyle = 'rgba(255,255,255,' + (1 - i * 0.18) + ')';
    ctx.fillText(msg.text, 24, viewH - 78 - (3 - i) * 18);
  });
  drawMinimap();
}

function wrapText(text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawMinimap() {
  const mw = 200;
  const mh = 150;
  const x0 = viewW - mw - 12;
  const y0 = viewH - mh - 12;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#2e6b34';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#1b6f8f';
  ctx.fillRect(x0 + 2920 * sx, y0, mw - 2920 * sx, mh);
  ctx.fillStyle = '#555555';
  for (const rx of city.roadsX) ctx.fillRect(x0 + rx * sx - 1, y0, 3, mh);
  for (const ry of city.roadsY) ctx.fillRect(x0, y0 + ry * sy - 1, mw, 3);
  // Mission marker.
  const m = S.mission;
  if (m) {
    const step = m.def.steps[m.step];
    if (step && step.at) {
      const pt = missionPoint(step.at);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x0 + pt.x * sx, y0 + pt.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Police blips.
  ctx.fillStyle = '#4488ff';
  for (const car of S.cars) {
    if (car.driver === 'police' && !car.dead) {
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  const p = S.player;
  if (p) {
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MARISOL BAY', x0, y0 - 8);
}

// ---- Screens -----------------------------------------------------------
function drawTitle() {
  // Sunset gradient sky over a drawn skyline, then the menu.
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#2b1055');
  g.addColorStop(0.45, '#7597de');
  g.addColorStop(0.7, '#ff7e5f');
  g.addColorStop(1, '#feb47b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.fillStyle = '#ffdf6b';
  ctx.beginPath();
  ctx.arc(viewW * 0.72, viewH * 0.42, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1440';
  for (let i = 0; i < 14; i++) {
    const bw = 60 + ((i * 37) % 60);
    const bh = 120 + ((i * 53) % 180);
    ctx.fillRect(i * 95, viewH - bh - 90, bw, bh);
  }
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, viewH - 90, viewW, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, viewH - 92, viewW, 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('MARISOL BAY', viewW / 2, 190);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText('AN OPEN-WORLD CRIME GAME', viewW / 2, 232);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffffff';
  const save = S.save;
  ctx.fillText('Dana Cruz owes Rosa Vega one last favour. The bay is yours to take.', viewW / 2, 300);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER to play' + (save ? '   •   C to continue your save' : ''), viewW / 2, 380);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText('WASD move and drive  •  E enter a car  •  Mouse aim, click to shoot  •  Shift sprint', viewW / 2, 440);
  ctx.fillText('Steal cars, dodge the MBPD, run six missions, become a Bay Legend.', viewW / 2, 468);
  if (save) {
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Save found: $' + save.cash + '  •  ' + save.missionIndex + ' of 6 missions done', viewW / 2, 520);
  }
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('An original game. No characters, places or art from any commercial game.', viewW / 2, viewH - 24);
}

function drawOverlay(title, sub) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, viewW / 2, viewH / 2 - 20);
  ctx.font = '18px sans-serif';
  const lines = wrapText(sub, 620);
  lines.forEach((line, i) => ctx.fillText(line, viewW / 2, viewH / 2 + 30 + i * 26));
}

function drawMissionList() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('MISSIONS — ROSA VEGA’S LIST', 90, 110);
  ctx.font = '16px sans-serif';
  MISSIONS.forEach((m, i) => {
    const y = 160 + i * 84;
    const done = i < S.missionIndex;
    const current = i === S.missionIndex;
    ctx.fillStyle = done ? '#2ecc71' : current ? '#ffd700' : '#888888';
    ctx.fillText((done ? '✓ ' : current ? '► ' : '· ') + (i + 1) + '. ' + m.name + ' — $' + m.reward, 90, y);
    ctx.fillStyle = '#dddddd';
    ctx.font = '14px sans-serif';
    const lines = wrapText(m.brief, 1000);
    lines.forEach((line, j) => ctx.fillText(line, 110, y + 22 + j * 18));
    ctx.font = '16px sans-serif';
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press M or Esc to close. Press N to start the next mission.', 90, 160 + MISSIONS.length * 84 + 10);
}
