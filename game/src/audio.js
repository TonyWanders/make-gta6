// All sound is synthesised with WebAudio: no audio files, no network.
// Engine hum, siren, gunshots, pickups and mission stings.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function blip(freq, dur, type = 'sine', vol = 0.15) {
  const c = ensure();
  if (!c || muted) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch { /* sound is optional */ }
}

function noiseBurst(dur, vol = 0.2, low = 400) {
  const c = ensure();
  if (!c || muted) return;
  try {
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = low;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  } catch { /* sound is optional */ }
}

export function setEngine(speed01, on) {
  const c = ensure();
  if (!c || !engineOsc) return;
  try {
    engineOsc.frequency.value = 45 + speed01 * 140;
    engineGain.gain.value = on && !muted ? 0.03 + speed01 * 0.04 : 0;
  } catch { /* ignore */ }
}

export function setSiren(on, t) {
  const c = ensure();
  if (!c || !sirenOsc) return;
  try {
    sirenOsc.frequency.value = 660 + Math.sin(t * 4) * 180;
    sirenGain.gain.value = on && !muted ? 0.025 : 0;
  } catch { /* ignore */ }
}

export function sfx(name) {
  if (muted) return;
  switch (name) {
    case 'shoot': noiseBurst(0.12, 0.25, 900); break;
    case 'enemyShoot': noiseBurst(0.1, 0.12, 900); break;
    case 'pickup': blip(880, 0.15, 'sine', 0.18); setTimeout(() => blip(1320, 0.2, 'sine', 0.15), 70); break;
    case 'cash': blip(660, 0.1, 'square', 0.1); setTimeout(() => blip(990, 0.18, 'square', 0.1), 90); break;
    case 'hurt': blip(140, 0.2, 'sawtooth', 0.2); break;
    case 'crash': noiseBurst(0.25, 0.3, 200); break;
    case 'explode': noiseBurst(0.7, 0.4, 120); blip(60, 0.6, 'sine', 0.3); break;
    case 'mission': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.16), i * 110)); break;
    case 'fail': [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.15), i * 140)); break;
    case 'steal': blip(300, 0.12, 'square', 0.12); setTimeout(() => blip(450, 0.15, 'square', 0.12), 100); break;
    case 'busted': [440, 415, 392].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'sawtooth', 0.12), i * 160)); break;
    default: break;
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}
