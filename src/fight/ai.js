// The CPU opponent. It sees the world a few frames late (its reaction time),
// so Easy really is slow and Hard really is sharp, without cheating on input.
import { isAirborne, isActive } from './fighter.js';
import { mulberry32 } from '../rng.js';

export const LEVELS = {
  easy: { reaction: 22, block: 0.18, antiAir: 0.1, jumpProjectile: 0.25, aggression: 0.35, combo: 0.1, special: 0.006, finish: 0.04 },
  normal: { reaction: 13, block: 0.45, antiAir: 0.35, jumpProjectile: 0.55, aggression: 0.55, combo: 0.45, special: 0.012, finish: 0.12 },
  hard: { reaction: 7, block: 0.75, antiAir: 0.7, jumpProjectile: 0.85, aggression: 0.75, combo: 0.85, special: 0.02, finish: 0.3 },
};

export function createAI(side, level = 'normal', seed = 7) {
  return { side, level: LEVELS[level] || LEVELS.normal, rand: mulberry32(seed + side * 101), history: [], plan: null, planLeft: 0, tapped: {} };
}

function snapshot(m, side) {
  const me = m.fighters[side];
  const op = m.fighters[1 - side];
  return {
    dx: op.x - me.x,
    opAir: isAirborne(op),
    opAttacking: !!op.move && (isActive(op) || op.moveFrame < op.move.startup),
    opMoveLevel: op.move ? op.move.level : null,
    opState: op.state,
    opVy: op.vy,
    projectile: m.projectiles.find((p) => p.owner !== side && Math.sign(me.x - p.x) === Math.sign(p.vx) && Math.abs(me.x - p.x) < 420) || null,
  };
}

// Returns held buttons for this frame.
export function thinkAI(ai, m) {
  const me = m.fighters[ai.side];
  ai.history.push(snapshot(m, ai.side));
  if (ai.history.length > 40) ai.history.shift();
  const seen = ai.history[Math.max(0, ai.history.length - 1 - ai.level.reaction)];
  const r = ai.rand;
  const L = ai.level;
  const toward = Math.sign(seen.dx) || 1;
  const dist = Math.abs(seen.dx);
  const out = {};
  const hold = (dirSign) => (dirSign > 0 ? (out.right = true) : (out.left = true));
  const tap = (button) => {
    // A press needs a released frame before it.
    if (ai.tapped[button]) ai.tapped[button] = false;
    else {
      out[button] = true;
      ai.tapped[button] = true;
    }
  };

  if (m.phase === 'finish') {
    if (m.roundWinner === me) {
      if (dist > 200) hold(toward);
      else if (r() < L.finish) tap('special');
    }
    return out;
  }
  if (m.phase !== 'fight') return out;

  // Keep finishing a short plan (a combo or a walk) before rethinking.
  if (ai.plan && ai.planLeft > 0) {
    ai.planLeft -= 1;
    return ai.plan(out, toward, tap, hold) || out;
  }
  ai.plan = null;

  if (seen.projectile && !isAirborne(me)) {
    if (r() < L.jumpProjectile) {
      out.up = true;
      hold(toward);
    } else if (r() < L.block) out.block = true;
    return out;
  }
  if (seen.opAttacking && dist < 230 && r() < L.block) {
    out.block = true;
    if (seen.opMoveLevel === 'low') out.down = true;
    return out;
  }
  if (seen.opAir && dist < 210 && seen.opVy < 200 && r() < L.antiAir) {
    out.down = true;
    tap('punch');
    return out;
  }
  if (me.move || me.state === 'hit' || me.state === 'blockstun') return out;

  if (dist > 380) {
    if (me.def.moves.special.kind === 'projectile' && me.cooldown === 0 && r() < L.special * 4) tap('special');
    else if (me.def.moves.special.kind === 'teleport' && me.cooldown === 0 && r() < L.special * 2) tap('special');
    else if (r() < L.aggression) hold(toward);
    else if (r() < 0.1) setPlan(ai, 20, (o, t, _tap, h) => h(-t));
  } else if (dist > 170) {
    if (r() < 0.04 * L.aggression) {
      setPlan(ai, 24, (o, t, tp, h) => {
        o.up = ai.planLeft > 20;
        h(t);
        if (ai.planLeft === 10) tp('kick');
        return o;
      });
    } else if (me.def.id === 'goose' && me.cooldown === 0 && r() < L.special * 3) tap('special');
    else if (r() < L.aggression + 0.2) hold(toward);
  } else {
    const roll = r();
    if (roll < 0.06 * L.aggression + 0.03) {
      if (r() < L.combo) {
        // Jab into uppercut: the bread and butter.
        setPlan(ai, 22, (o, t, tp) => {
          if (ai.planLeft === 21) tp('punch');
          if (ai.planLeft < 9) o.down = true;
          if (ai.planLeft === 6) tp('punch');
          return o;
        });
      } else tap('punch');
    } else if (roll < 0.1) tap('kick');
    else if (roll < 0.125) {
      out.down = true;
      tap('kick');
    } else if (roll < 0.135 && me.cooldown === 0) tap('special');
    else if (roll < 0.16) setPlan(ai, 14, (o, t, _tp, h) => h(-t));
  }
  return out;
}

function setPlan(ai, frames, fn) {
  ai.plan = fn;
  ai.planLeft = frames;
}
