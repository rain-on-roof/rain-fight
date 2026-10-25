// Keyboard, touch and gamepad, folded into one intent per player per frame:
// { left, right, up, down, punch, kick, special, block } as held booleans.
const P1 = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  punch: ['KeyJ'], kick: ['KeyK'], special: ['KeyL'], block: ['Space'],
};
// In single-player the arrow keys and Z/X/C also drive player one.
const P1_SOLO = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  punch: ['KeyZ'], kick: ['KeyX'], special: ['KeyC'], block: ['ShiftLeft', 'ShiftRight'],
};
const P2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  punch: ['Numpad1', 'Comma'], kick: ['Numpad2', 'Period'], special: ['Numpad3', 'Slash'], block: ['Numpad0', 'ShiftRight'],
};
const ACTIONS = Object.keys(P1);

export function createInput(root) {
  const keys = new Set();
  const touch = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };
  const input = { keys, touch, usedTouch: false };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    for (const k of ACTIONS) touch[k] = false;
  });

  bindTouch(root, touch, input);
  return input;
}

function held(keys, map) {
  const out = {};
  for (const a of ACTIONS) out[a] = map[a].some((c) => keys.has(c));
  return out;
}

function merge(...intents) {
  const out = {};
  for (const a of ACTIONS) out[a] = intents.some((i) => i && i[a]);
  return out;
}

function pad(index) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && pads[index];
  if (!p) return null;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  const ax = p.axes[0] || 0;
  const ay = p.axes[1] || 0;
  return {
    left: b(14) || ax < -0.45,
    right: b(15) || ax > 0.45,
    up: b(12) || ay < -0.6,
    down: b(13) || ay > 0.6,
    punch: b(2),
    kick: b(0),
    special: b(3),
    block: b(1) || b(4) || b(5) || b(6) || b(7),
  };
}

export function readIntents(input, mode) {
  const k = input.keys;
  if (mode === 'versus') {
    return [merge(held(k, P1), input.touch, pad(0)), merge(held(k, P2), pad(1))];
  }
  return [merge(held(k, P1), held(k, P1_SOLO), input.touch, pad(0)), {}];
}

// On-screen stick (left) and four buttons (right).
function bindTouch(root, touch, input) {
  const stick = root.querySelector('[data-stick]');
  const knob = root.querySelector('[data-knob]');
  if (stick) {
    let id = null;
    const set = (e) => {
      const r = stick.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const mag = Math.min(1, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      knob.style.transform = `translate(${Math.cos(ang) * mag * 32}%, ${Math.sin(ang) * mag * 32}%)`;
      const dead = 0.32;
      touch.left = dx < -dead;
      touch.right = dx > dead;
      touch.up = dy < -0.5;
      touch.down = dy > 0.5;
    };
    const clear = () => {
      id = null;
      knob.style.transform = '';
      touch.left = touch.right = touch.up = touch.down = false;
    };
    stick.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      input.usedTouch = true;
      stick.setPointerCapture(e.pointerId);
      set(e);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', (e) => e.pointerId === id && set(e));
    stick.addEventListener('pointerup', clear);
    stick.addEventListener('pointercancel', clear);
  }
  for (const btn of root.querySelectorAll('[data-btn]')) {
    const action = btn.dataset.btn;
    const down = (e) => {
      touch[action] = true;
      input.usedTouch = true;
      btn.classList.add('on');
      btn.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      navigator.vibrate?.(8);
    };
    const up = () => {
      touch[action] = false;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  }
}
