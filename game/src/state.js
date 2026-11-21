// The single mutable game state. Every system reads and writes this one
// object so the loop, the missions and the renderer always agree.
import { WORLD_W, WORLD_H } from './config.js';

export const S = {
  mode: 'title', // title | playing | paused | busted | wasted | missiondone | gameover
  time: 0, // seconds since the run started
  clock: 8 * 60, // in-game minutes, starts 08:00
  seed: 1,
  shot: null, // staged screenshot name, or null in normal play
  shotT: 0,
  cash: 150,
  health: 100,
  armor: 0,
  wanted: 0,
  wantedTimer: 0,
  respect: 0,
  missionIndex: 0, // next mission to play
  mission: null, // live mission state or null
  missionToast: '',
  missionToastT: 0,
  objective: '',
  player: null,
  cars: [], // traffic + parked + police cars
  peds: [],
  cops: [], // foot police
  rivals: [], // armed enemies (missions)
  bullets: [],
  particles: [],
  pickups: [], // {kind: health|armor|ammo|cash, x, y}
  camera: { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 },
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
  messages: [], // scrolling log lines {text, t}
  stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, distance: 0 },
  save: null,
};

export function resetRun() {
  S.time = 0;
  S.clock = 8 * 60;
  S.cash = 150;
  S.health = 100;
  S.armor = 0;
  S.wanted = 0;
  S.wantedTimer = 0;
  S.respect = 0;
  S.missionIndex = 0;
  S.mission = null;
  S.objective = '';
  S.cars = [];
  S.peds = [];
  S.cops = [];
  S.rivals = [];
  S.bullets = [];
  S.particles = [];
  S.pickups = [];
  S.messages = [];
  S.stats = { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, distance: 0 };
}

export function say(text) {
  S.messages.push({ text, t: S.time });
  if (S.messages.length > 5) S.messages.shift();
}

export function setToast(text, seconds = 4) {
  S.missionToast = text;
  S.missionToastT = seconds;
}
