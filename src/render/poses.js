// Fighter state → puppet pose. Attacks are keyframed over their own phases
// (wind-up during startup, full extension while active, settle in recovery)
// so the picture always matches the frame data.
import { lerp, clamp01 } from './paint.js';

const P = (o) => ({ lean: 0, head: 0, fs: 0.3, fe: 0.4, bs: 0.2, be: 0.4, fh: 0.2, fk: 0.2, bh: -0.2, bk: 0.2, rot: 0, dx: 0, ...o });

export const POSES = {
  guard: P({ lean: 0.1, head: -0.05, fs: 0.95, fe: 1.75, bs: 0.55, be: 2.0, fh: 0.38, fk: 0.4, bh: -0.38, bk: 0.3 }),
  crouch: P({ lean: 0.35, head: -0.25, fs: 1.0, fe: 1.8, bs: 0.6, be: 2.0, fh: 1.45, fk: 2.15, bh: 0.35, bk: 2.25 }),
  jump: P({ lean: 0.15, fs: 1.1, fe: 1.7, bs: 0.7, be: 1.9, fh: 1.35, fk: 2.1, bh: 0.55, bk: 1.9 }),
  block: P({ lean: -0.05, head: 0.15, fs: 1.35, fe: 2.55, bs: 1.15, be: 2.6, fh: 0.3, fk: 0.35, bh: -0.4, bk: 0.3 }),
  crouchBlock: P({ lean: 0.3, head: 0.1, fs: 1.35, fe: 2.55, bs: 1.15, be: 2.6, fh: 1.45, fk: 2.15, bh: 0.35, bk: 2.25 }),
  hit: P({ lean: -0.45, head: -0.55, fs: 0.2, fe: 0.5, bs: -0.4, be: 0.4, fh: 0.15, fk: 0.35, bh: -0.5, bk: 0.2 }),
  airHit: P({ lean: -0.3, head: -0.6, fs: 1.9, fe: 0.4, bs: -1.2, be: 0.3, fh: 0.7, fk: 0.4, bh: -0.3, bk: 0.6, rot: -1.0 }),
  down: P({ lean: 0, head: 0.1, fs: 2.6, fe: 0.3, bs: 1.4, be: 0.3, fh: 0.15, fk: 0.2, bh: -0.05, bk: 0.4, rot: -1.57 }),
  dizzy: P({ lean: 0.05, head: 0.3, fs: 0.05, fe: 0.2, bs: -0.05, be: 0.2, fh: 0.12, fk: 0.25, bh: -0.12, bk: 0.25 }),
  win: P({ lean: -0.05, head: -0.15, fs: 3.0, fe: 0.25, bs: 0.6, be: 2.4, fh: 0.25, fk: 0.1, bh: -0.25, bk: 0.1 }),
  // Moves: [wind-up, active].
  jab: [P({ lean: 0.12, fs: 0.75, fe: 2.1, bs: 0.6, be: 2.0, fh: 0.4, fk: 0.4, bh: -0.4, bk: 0.3 }), P({ lean: 0.22, head: 0.05, fs: 1.6, fe: 0.05, bs: 0.5, be: 2.2, fh: 0.45, fk: 0.35, bh: -0.45, bk: 0.2 })],
  kick: [P({ lean: -0.05, fs: 1.0, fe: 1.8, bs: 0.2, be: 1.6, fh: 1.4, fk: 2.0, bh: -0.2, bk: 0.1 }), P({ lean: -0.3, head: 0.1, fs: 0.6, fe: 1.6, bs: -0.5, be: 1.0, fh: 1.68, fk: 0.02, bh: -0.15, bk: 0.05 })],
  uppercut: [P({ lean: 0.35, fs: -0.2, fe: 1.4, bs: 0.6, be: 2.0, fh: 1.3, fk: 1.9, bh: 0.3, bk: 2.0 }), P({ lean: -0.12, head: -0.2, fs: 2.95, fe: 0.25, bs: 0.4, be: 1.8, fh: 0.25, fk: 0.1, bh: -0.25, bk: 0.2, dx: 12 })],
  sweep: [P({ lean: 0.45, fs: 1.1, fe: 1.6, bs: 0.6, be: 1.9, fh: 1.4, fk: 2.2, bh: 0.4, bk: 2.3 }), P({ lean: 0.55, head: -0.3, fs: 1.5, fe: 0.6, bs: 0.2, be: 1.2, fh: 1.55, fk: 0.0, bh: 0.6, bk: 2.4 })],
  jumpKick: [P({ lean: 0.1, fs: 1.2, fe: 1.7, bs: 0.6, be: 1.8, fh: 1.3, fk: 1.9, bh: 0.5, bk: 1.8 }), P({ lean: -0.2, head: 0.15, fs: 0.8, fe: 1.4, bs: -0.6, be: 0.9, fh: 1.35, fk: 0.05, bh: 0.2, bk: 1.6 })],
  jumpPunch: [P({ lean: 0.15, fs: 0.6, fe: 2.0, bs: 0.6, be: 1.9, fh: 1.2, fk: 2.0, bh: 0.6, bk: 1.9 }), P({ lean: 0.35, fs: 2.1, fe: 0.1, bs: 0.4, be: 1.8, fh: 1.1, fk: 1.8, bh: 0.5, bk: 1.9 })],
  volt_special: [P({ lean: -0.1, fs: -0.4, fe: 1.8, bs: -0.6, be: 1.7, fh: 0.5, fk: 0.5, bh: -0.5, bk: 0.4 }), P({ lean: 0.2, head: 0.05, fs: 1.6, fe: 0.05, bs: 1.45, be: 0.1, fh: 0.55, fk: 0.3, bh: -0.55, bk: 0.2 })],
  brick_special: [P({ lean: -0.25, head: -0.3, fs: 3.0, fe: 0.4, bs: 2.8, be: 0.5, fh: 0.4, fk: 0.2, bh: -0.4, bk: 0.2 }), P({ lean: 0.75, head: -0.2, fs: 0.75, fe: 0.1, bs: 0.6, be: 0.1, fh: 1.3, fk: 1.9, bh: 0.2, bk: 2.0 })],
  shade_special: [P({ lean: 0.5, fs: 0.2, fe: 2.4, bs: 0.0, be: 2.4, fh: 1.4, fk: 2.2, bh: 0.4, bk: 2.3 }), P({ lean: 0.3, head: 0.1, fs: 1.55, fe: 0.0, bs: -0.4, be: 0.8, fh: 1.2, fk: 0.6, bh: -0.6, bk: 0.3, dx: 16 })],
};

const KEYS = Object.keys(POSES.guard);

export function blend(a, b, t) {
  const out = {};
  for (const k of KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

const ease = (t) => 1 - (1 - t) ** 3;

function walkPose(phase, back) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    ...POSES.guard,
    fh: 0.38 + s * 0.42 * back,
    fk: 0.35 + Math.max(0, -c) * 0.7,
    bh: -0.38 - s * 0.42 * back,
    bk: 0.3 + Math.max(0, c) * 0.7,
    lean: 0.14,
  };
}

// The pose a fighter should show right now.
export function poseFor(f, time, extra = {}) {
  const bob = Math.sin(time * 5 + f.side) * 0.04;
  const moveId = f.move ? (f.move.id === 'special' ? `${f.id}_special` : f.move.id) : null;
  if (f.move && POSES[moveId]) {
    const m = f.move;
    const [wind, hit] = POSES[moveId];
    const fr = f.moveFrame;
    let pose;
    if (fr < m.startup) pose = blend(f.state === 'jump' ? POSES.jump : POSES.guard, wind, ease(fr / m.startup));
    else if (fr < m.startup + m.active) pose = blend(wind, hit, ease(clamp01((fr - m.startup + 1) / 2)));
    else {
      const rec = clamp01((fr - m.startup - m.active) / Math.max(1, m.recovery));
      const settle = m.air ? POSES.jump : moveId === 'sweep' || moveId === 'uppercut' ? POSES.crouch : POSES.guard;
      pose = blend(hit, settle, ease(rec));
    }
    return pose;
  }
  switch (f.state) {
    case 'walk': {
      const back = Math.sign(f.vx) === f.facing ? 1 : -1;
      return walkPose(time * 11 * back, 1);
    }
    case 'crouch':
      return { ...POSES.crouch, lean: POSES.crouch.lean + bob * 0.5 };
    case 'jump':
      return f.vy > 300 ? blend(POSES.guard, POSES.jump, 0.85) : POSES.jump;
    case 'block':
      return POSES.block;
    case 'crouchBlock':
      return POSES.crouchBlock;
    case 'blockstun':
      return f.blockCrouch ? POSES.crouchBlock : { ...POSES.block, lean: -0.15 };
    case 'hit':
      return blend(POSES.hit, POSES.guard, clamp01(f.stateTime / Math.max(1, f.stun)) ** 2);
    case 'air-hit':
      return { ...POSES.airHit, rot: -0.6 - clamp01(f.stateTime / 30) * 0.9 };
    case 'down':
    case 'ko':
      return POSES.down;
    case 'getup':
      return blend(POSES.down, POSES.crouch, ease(clamp01(f.stateTime / 18)));
    case 'dizzy': {
      const w = Math.sin(time * 3);
      return { ...POSES.dizzy, lean: w * 0.18, head: 0.3 + Math.sin(time * 4.2) * 0.3, fs: 0.1 + w * 0.2, bs: -0.1 - w * 0.2 };
    }
    case 'victory':
    case 'finisher':
      return extra.finisherPose || { ...POSES.win, fs: 2.9 + Math.sin(time * 6) * 0.15 };
    case 'finished':
      return extra.finishedPose || POSES.dizzy;
    default:
      return { ...POSES.guard, lean: POSES.guard.lean + bob, fs: POSES.guard.fs + bob * 2 };
  }
}

export function expressionFor(f) {
  if (f.state === 'ko' || (f.state === 'down' && f.hp <= 0)) return 'ko';
  if (f.state === 'dizzy' || f.state === 'finished') return 'dizzy';
  if (f.state === 'hit' || f.state === 'air-hit' || f.state === 'down') return 'hit';
  if (f.state === 'victory' || f.state === 'finisher') return 'win';
  if (f.move && f.move.heavy) return 'shout';
  return 'fight';
}
