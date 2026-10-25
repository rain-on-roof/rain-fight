// One fighter: input → state → physics. Hits are resolved by the match, which
// sees both fighters at once. Units: pixels and seconds, y up from the roof.
import { FIGHTERS } from './moves.js';

export const FPS = 60;
export const DT = 1 / FPS;
export const GRAVITY = 3300;
export const WALL_L = 90;
export const WALL_R = 1510;
export const BODY_W = 96;
export const STAND_H = 230;
export const CROUCH_H = 135;

const BUFFER = 8;
const BUTTONS = ['punch', 'kick', 'special'];
const ACTIONABLE = new Set(['idle', 'walk', 'crouch', 'block', 'crouchBlock']);

export function createFighter(id, side) {
  const def = FIGHTERS[id];
  return {
    id,
    def,
    side,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: def.hp,
    maxHp: def.hp,
    state: 'idle',
    stateTime: 0,
    move: null,
    moveFrame: 0,
    hasHit: false,
    cooldown: 0,
    combo: 0,
    juggles: 0,
    wins: 0,
    roundDamage: 0,
    hidden: false,
    stun: 0,
    prev: {},
    buffer: null,
  };
}

export function resetFighter(f, x) {
  Object.assign(f, {
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing: f.side === 0 ? 1 : -1,
    hp: f.maxHp,
    state: 'idle',
    stateTime: 0,
    move: null,
    moveFrame: 0,
    hasHit: false,
    cooldown: 0,
    combo: 0,
    juggles: 0,
    roundDamage: 0,
    hidden: false,
    prev: {},
    buffer: null,
  });
}

export function setState(f, state) {
  if (f.state !== state) {
    f.state = state;
    f.stateTime = 0;
  }
}

export const isAirborne = (f) => f.y > 0.5 || f.vy > 0;
export const actionable = (f) => ACTIONABLE.has(f.state) || (f.state === 'jump' && !f.move);

export function startMove(f, moveId, events) {
  const move = f.def.moves[moveId];
  if (!move) return false;
  if (moveId === 'special') {
    if (f.cooldown > 0) return false;
    f.cooldown = move.cooldown;
  }
  f.move = move;
  f.moveFrame = 0;
  f.hasHit = false;
  if (!move.air) {
    f.vx = 0;
    setState(f, 'attack');
  }
  events.push({ type: 'attack', side: f.side, move: moveId });
  return true;
}

export const moveLength = (m) => m.startup + m.active + m.recovery;
export const isActive = (f) => f.move && f.moveFrame >= f.move.startup && f.moveFrame < f.move.startup + f.move.active;

// Advances one fighter by one frame. `intent` holds held buttons; presses are
// edges against last frame, buffered for a few frames so a press during
// recovery still comes out.
export function stepFighter(f, intent, opp, events, { locked = false } = {}) {
  const pressed = {};
  for (const b of BUTTONS) {
    pressed[b] = !!intent[b] && !f.prev[b];
    if (pressed[b]) f.buffer = { button: b, frames: BUFFER };
  }
  f.prev = { ...intent };
  if (f.buffer && --f.buffer.frames <= 0) f.buffer = null;
  if (f.cooldown > 0) f.cooldown -= 1;
  f.stateTime += 1;

  const forward = f.facing;
  const dirX = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
  const airborne = isAirborne(f);

  if (!locked) {
    if (f.state === 'jump' && !f.move && f.buffer) {
      const id = f.buffer.button === 'kick' ? 'jumpKick' : f.buffer.button === 'punch' ? 'jumpPunch' : null;
      if (id) {
        f.buffer = null;
        startMove(f, id, events);
      }
    } else if (actionable(f) && !airborne) {
      if (f.buffer) {
        const b = f.buffer.button;
        const down = !!intent.down;
        const id = b === 'punch' ? (down ? 'uppercut' : 'jab') : b === 'kick' ? (down ? 'sweep' : 'kick') : 'special';
        if (startMove(f, id, events)) f.buffer = null;
      }
      if (f.state !== 'attack') {
        if (intent.block) {
          f.vx = 0;
          setState(f, intent.down ? 'crouchBlock' : 'block');
        } else if (intent.up) {
          f.vy = f.def.jump;
          f.vx = dirX * 340;
          setState(f, 'jump');
          events.push({ type: 'jump', side: f.side });
        } else if (intent.down) {
          f.vx = 0;
          setState(f, 'crouch');
        } else if (dirX !== 0) {
          f.vx = dirX * f.def.walk * (dirX === forward ? 1 : 0.8);
          setState(f, 'walk');
        } else {
          f.vx = 0;
          setState(f, 'idle');
        }
      }
    }
  } else if (actionable(f) && !airborne) {
    f.vx = 0;
    setState(f, 'idle');
  }

  // Moves in progress.
  if (f.move) {
    f.moveFrame += 1;
    const m = f.move;
    if (m.kind === 'projectile' && f.moveFrame === m.startup) events.push({ type: 'projectile', side: f.side, move: m });
    if (m.kind === 'teleport') {
      f.hidden = f.moveFrame >= m.vanish[0] && f.moveFrame < m.vanish[1];
      if (f.moveFrame === m.vanish[1]) {
        const side = Math.sign(opp.x - f.x) || 1;
        f.x = clampX(opp.x + side * 105);
        f.facing = Math.sign(opp.x - f.x) || f.facing;
        events.push({ type: 'teleport', side: f.side, x: f.x });
      }
    }
    if (f.moveFrame >= moveLength(m) && !m.air) endMove(f, intent);
  }

  // Hit and knockdown timers.
  if (f.state === 'hit' || f.state === 'blockstun') {
    f.vx *= 0.82;
    if (f.stateTime >= f.stun) {
      f.combo = 0;
      setState(f, intent.down ? 'crouch' : 'idle');
    }
  } else if (f.state === 'down') {
    f.vx *= 0.8;
    if (f.stateTime >= 42) setState(f, 'getup');
  } else if (f.state === 'getup') {
    if (f.stateTime >= 18) {
      f.juggles = 0;
      f.combo = 0;
      setState(f, 'idle');
    }
  }

  // Physics.
  f.x = clampX(f.x + f.vx * (1 / FPS));
  if (f.y > 0 || f.vy !== 0) {
    f.y += f.vy * (1 / FPS);
    f.vy -= GRAVITY * (1 / FPS);
    if (f.y <= 0) land(f, events);
  }

  // Keep facing the opponent whenever free to turn.
  if ((ACTIONABLE.has(f.state) || f.state === 'dizzy') && !isAirborne(f) && Math.abs(opp.x - f.x) > 4) {
    f.facing = opp.x > f.x ? 1 : -1;
  }
}

function endMove(f, intent) {
  f.move = null;
  f.moveFrame = 0;
  f.hidden = false;
  if (f.state === 'attack') setState(f, intent && intent.down ? 'crouch' : 'idle');
}

function land(f, events) {
  f.y = 0;
  f.vy = 0;
  if (f.state === 'jump') {
    if (f.move) endMove(f);
    f.vx = 0;
    setState(f, 'idle');
    events.push({ type: 'land', side: f.side });
  } else if (f.state === 'air-hit') {
    f.vx *= 0.4;
    setState(f, f.hp <= 0 ? 'ko' : 'down');
    events.push({ type: 'fall', side: f.side, x: f.x });
  }
}

export function clampX(x) {
  return Math.max(WALL_L, Math.min(WALL_R, x));
}

// Hurtbox in world space, or null while untouchable.
export function hurtbox(f) {
  if (f.hidden || ['down', 'getup', 'ko', 'finished', 'finisher', 'victory'].includes(f.state)) return null;
  if (f.state === 'air-hit' && f.juggles > 3) return null;
  const half = BODY_W / 2;
  if (isAirborne(f)) return [f.x - half, f.y + 10, f.x + half, f.y + 210];
  const low = f.state === 'crouch' || f.state === 'crouchBlock' || (f.state === 'blockstun' && f.blockCrouch);
  const h = low ? CROUCH_H : STAND_H;
  return [f.x - half, 0, f.x + half, h];
}

export function attackBox(f) {
  if (!isActive(f) || f.hasHit || !f.move.box) return null;
  const [x0, y0, x1, y1] = f.move.box;
  return f.facing > 0 ? [f.x + x0, f.y + y0, f.x + x1, f.y + y1] : [f.x - x1, f.y + y0, f.x - x0, f.y + y1];
}

export const overlap = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

export function blocks(f, level) {
  if (f.state === 'crouchBlock' || (f.state === 'blockstun' && f.blockCrouch)) return true;
  if (f.state === 'block' || f.state === 'blockstun') return level !== 'low';
  return false;
}
