// Keyboard and mouse state, with edge detection for one-shot actions
// (enter car, pause, restart) so holding a key does not repeat them.
export const keys = {};
export const pressed = {}; // keys pressed since the last frame was consumed
export const mouse = { x: 0, y: 0, down: false, clicked: false };

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
}

export function consumePressed() {
  for (const k of Object.keys(pressed)) delete pressed[k];
  mouse.clicked = false;
}

export function wasPressed(k) {
  return !!pressed[k.toLowerCase()];
}

export function axis() {
  // Returns {x, y} in -1..1 from WASD or the arrow keys.
  let x = 0;
  let y = 0;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  return { x, y };
}
