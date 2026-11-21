// Marisol Bay: the game loop, the state machine, saving, and the
// wiring between input, world, missions and the renderer.
import { S, resetRun, say, setToast } from './state.js';
import { buildCity } from './world.js';
import { bindInput, keys, pressed, mouse, axis, consumePressed, wasPressed } from './input.js';
import { setCanvas, render } from './render.js';
import {
  makePlayer, spawnWorldLife, setEntRng, updatePlayer, updateTraffic,
  updatePeds, updatePolice, updateBullets, updateRivals, updateParticles,
  updateDrivenCar, playerShoot, tryEnterExitCar, damagePlayer, explodeCar,
} from './entities.js';
import { startMission, updateMission, updateConvoy, saveGame, loadGame, applySave, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';
import { updateShotAuto } from './shots.js';
import { mulberry32, clamp } from './random.js';
import { unlockAudio, setEngine, setSiren, sfx, toggleMute } from './audio.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shotName = params.get('shot');
S.seed = seed;

let last = performance.now();
let fpsAccum = 0;

function newRun(withSave) {
  resetRun();
  buildCity(seed);
  const rng = mulberry32(seed * 101 + 7);
  setEntRng(rng);
  S.player = makePlayer(600, 640);
  S.player.sprint = 1;
  spawnWorldLife();
  if (withSave) {
    const save = loadGame();
    if (save) {
      applySave(save);
      S.save = save;
    }
  }
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
}

function applySaveToTitle() {
  S.save = loadGame();
}

function respawnPlayer(after) {
  // Busted: outside MBPD HQ, wanted cleared. Wasted: outside Bay General.
  const spot = after === 'busted'
    ? { x: 1800, y: 1480 }
    : { x: 1400, y: 1080 };
  const p = S.player;
  p.onFoot = true;
  p.car = null;
  p.x = spot.x;
  p.y = spot.y;
  p.angle = -Math.PI / 2;
  S.health = 100;
  S.armor = 0;
  S.wanted = 0;
  S.cops = [];
  for (const c of S.cars) if (c.driver === 'police') c.driver = 'traffic';
  S.cash = Math.floor(S.cash * 0.9);
  S.mode = 'playing';
  say(after === 'busted' ? 'Released. Rosa is not going to like this.' : 'Patched up. Back to work.');
}

function update(dt) {
  S.time += dt;
  S.clock = (S.clock + dt * 0.5) % (24 * 60);
  if (S.missionToastT > 0) S.missionToastT -= dt;
  if (S.mode === 'title') {
    if (wasPressed('enter') || mouse.clicked) {
      unlockAudio();
      newRun(false);
      S.mode = 'playing';
      say('Welcome to Marisol Bay. Rosa is waiting at her office.');
      setToast('Go to Rosa’s Office to start your first mission — or press M for the list', 6);
    } else if (wasPressed('c') && S.save) {
      unlockAudio();
      newRun(true);
      S.mode = 'playing';
      say('Welcome back, Dana.');
    }
    return;
  }
  if (S.mode === 'paused' || S.mode === 'missionlist') {
    if (wasPressed('p') || wasPressed('escape')) S.mode = 'playing';
    if (S.mode === 'missionlist') {
      if (wasPressed('m') || wasPressed('escape')) S.mode = 'playing';
      if (wasPressed('n') && !S.mission) {
        if (S.missionIndex < MISSIONS.length) {
          startMission(S.missionIndex);
          S.mode = 'playing';
        } else {
          say('Every mission is done. The bay is yours.');
          S.mode = 'playing';
        }
      }
    }
    return;
  }
  if (S.mode === 'busted' || S.mode === 'wasted' || S.mode === 'gameover') {
    if (wasPressed('enter')) {
      if (S.mode === 'gameover') {
        S.mode = 'playing';
      } else {
        respawnPlayer(S.mode);
      }
    }
    return;
  }
  if (S.mode !== 'playing') return;

  // Mouse position in world space for aiming.
  const cam = S.camera;
  const vw = canvas.width / cam.zoom;
  const vh = canvas.height / cam.zoom;
  S.mouse.wx = cam.x - vw / 2 + mouse.x / cam.zoom;
  S.mouse.wy = cam.y - vh / 2 + mouse.y / cam.zoom;
  S.mouse.x = mouse.x;
  S.mouse.y = mouse.y;
  S.mouse.down = mouse.down;

  const ax = axis();
  ax.sprint = !!(keys['shift']);
  if (S.shot) updateShotAuto(dt);
  updatePlayer(dt, ax);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateRivals(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateMission(dt);
  updateConvoy(dt);

  // Shooting: hold to fire on foot.
  if (mouse.down && S.player.onFoot) playerShoot();
  if (wasPressed('e')) tryEnterExitCar();
  if (wasPressed('p')) S.mode = 'paused';
  if (wasPressed('m')) S.mode = 'missionlist';
  if (wasPressed('n') && !S.mission) {
    if (S.missionIndex < MISSIONS.length) startMission(S.missionIndex);
    else say('Every mission is done. The bay is yours.');
  }
  if (wasPressed('0')) {
    const m = toggleMute();
    say(m ? 'Sound off' : 'Sound on');
  }

  // Walk into Rosa's office marker with no mission running to start one.
  if (!S.mission && S.missionIndex < MISSIONS.length) {
    const rosa = { x: 600, y: 600 };
    if (Math.hypot(S.player.x - rosa.x, S.player.y - rosa.y) < 80) {
      startMission(S.missionIndex);
    }
  }

  // Busted: a foot cop close to a wanted player on foot ends the run.
  if (S.wanted > 0 && S.player.onFoot) {
    for (const cop of S.cops) {
      if (Math.hypot(cop.x - S.player.x, cop.y - S.player.y) < 24) {
        S.mode = 'busted';
        sfx('busted');
        say('Busted by the MBPD');
        break;
      }
    }
  }

  // Camera follows the player, easing behind.
  const tx = S.player.x;
  const ty = S.player.y;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.x = clamp(cam.x, vw / 2 - 100, 3200 - vw / 2 + 100);
  cam.y = clamp(cam.y, vh / 2 - 100, 2400 - vh / 2 + 100);

  // Sound follows the scene.
  const p = S.player;
  setEngine(p && !p.onFoot && p.car ? Math.abs(p.car.speed) / p.car.def.top : 0, !!(p && !p.onFoot && p.car));
  setSiren(S.wanted > 0, S.time);

  // Autosave every 20 seconds of play.
  fpsAccum += dt;
  if (fpsAccum > 20) {
    fpsAccum = 0;
    saveGame();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  update(dt);
  render();
  consumePressed();
  requestAnimationFrame(frame);
}

function boot() {
  setCanvas(canvas, canvas.width, canvas.height);
  bindInput(canvas);
  applySaveToTitle();
  buildCity(seed);
  const rng = mulberry32(seed * 101 + 7);
  setEntRng(rng);
  if (shotName) {
    // Staged screenshot: build the world, put Dana in it, skip the menu.
    newRun(false);
    stageShot(shotName, seed);
  } else {
    S.player = makePlayer(600, 640);
    S.player.sprint = 1;
    spawnWorldLife();
    S.camera.x = S.player.x;
    S.camera.y = S.player.y;
    S.mode = 'title';
  }
  canvas.addEventListener('mousedown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  requestAnimationFrame(frame);
}

boot();
