// Draws a fighter at its place on the roof: the painted atlas when it has
// loaded, else the code-drawn fallback (puppets, and the Last Bite goose rig).
import { drawPuppet } from './puppet.js';
import { poseFor, expressionFor } from './poses.js';
import { createGooseAnimator, updateGoose, drawGoose, nudgeGoose } from './goose.js';
import { GROUND } from './stage.js';
import { clamp01 } from './paint.js';
import { spriteReady, spriteFrame, drawSprite } from './sprites.js';

const GOOSE_SCALE = 0.8;

export function createFighterView(f) {
  return { goose: f.id === 'goose' ? createGooseAnimator() : null, lastState: null, flash: 0 };
}

function gooseMood(f) {
  const m = f.move;
  if (m) {
    const fr = f.moveFrame;
    const winding = fr < m.startup;
    switch (m.id) {
      case 'jab':
        return winding ? ['tell'] : ['strike', { x: 240, y: -200 }];
      case 'uppercut':
        return winding ? ['tell'] : ['strike', { x: 150, y: -370 }];
      case 'sweep':
        return winding ? ['tell'] : ['strike', { x: 260, y: -30 }];
      case 'jumpKick':
      case 'jumpPunch':
        return winding ? ['victory'] : ['strike', { x: 200, y: -50 }];
      case 'kick':
        return ['victory'];
      case 'special':
        return winding ? ['tell'] : ['strike', { x: 220, y: -240 }];
      default:
        return ['idle'];
    }
  }
  switch (f.state) {
    case 'walk':
      return ['creep'];
    case 'crouch':
      return ['tell'];
    case 'jump':
      return ['victory'];
    case 'block':
    case 'crouchBlock':
    case 'blockstun':
      return ['innocent'];
    case 'victory':
    case 'finisher':
      return ['victory'];
    default:
      return ['idle'];
  }
}

// `mood` overrides the goose's own reading of the fight (finishers use it).
export function updateFighterView(view, f, dt, time, mood = null) {
  if (view.goose) {
    const [own, target] = gooseMood(f);
    if (!mood) mood = own;
    updateGoose(view.goose, dt, { mood, time, strikeTarget: target });
    if (f.state === 'hit' && view.lastState !== 'hit') nudgeGoose(view.goose, 1);
  }
  if (f.state === 'hit' && view.lastState !== 'hit') view.flash = 1;
  view.flash = Math.max(0, view.flash - dt * 8);
  view.lastState = f.state;
}

// opts: { time, rim, sink (px into the roof), outfit, poseOverride, frame,
//         dark, flash, reflection }
export function drawFighter(ctx, f, view, opts = {}) {
  if (f.hidden) return;
  const { time = 0 } = opts;
  const x = f.x + (opts.dx || 0);
  const y = GROUND - f.y + (opts.sink || 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f.facing, 1);
  if (spriteReady(f.id)) {
    const look = opts.frame ? { name: opts.frame, rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 } : spriteFrame(f, time);
    const flash = opts.reflection ? 0 : opts.flash ?? view.flash;
    drawSprite(ctx, f.id, look, { flash, dark: opts.dark || 0 });
  } else if (view.goose) drawGooseFighter(ctx, f, view, time);
  else {
    const pose = opts.poseOverride || poseFor(f, time, opts);
    if (pose.dx) ctx.translate(pose.dx, 0);
    const lying = ['down', 'ko', 'air-hit'].includes(f.state) || (f.state === 'getup' && f.stateTime < 10);
    drawPuppet(ctx, f.id, {
      pose,
      time,
      expression: opts.expression || expressionFor(f),
      outfit: opts.outfit || 'normal',
      rim: opts.rim,
      grounded: f.y <= 0.5 || lying,
    });
  }
  ctx.restore();
}

function drawGooseFighter(ctx, f, view, time) {
  const anim = view.goose;
  let rot = 0;
  let lift = 0;
  if (f.state === 'hit') rot = -0.25 * (1 - clamp01(f.stateTime / Math.max(1, f.stun)));
  if (f.state === 'air-hit') rot = -0.6 - clamp01(f.stateTime / 30) * 0.8;
  if (f.state === 'down' || f.state === 'ko') {
    rot = -1.45;
    lift = -40;
  }
  if (f.state === 'getup') rot = -1.45 * (1 - clamp01(f.stateTime / 18));
  if (f.state === 'dizzy' || f.state === 'finished') rot = Math.sin(time * 3) * 0.15;
  let dx = 0;
  if (f.move && f.move.id === 'kick' && f.moveFrame >= f.move.startup) dx = 26;
  ctx.translate(dx, lift);
  ctx.rotate(rot);
  drawGoose(ctx, anim, {
    x: 0,
    y: 0,
    scale: GOOSE_SCALE,
    time,
    walk: (time * 1.8) % 1,
    walking: f.state === 'walk',
    anger: f.state === 'dizzy' ? 0 : 1,
  });
}
