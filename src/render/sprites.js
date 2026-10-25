// Painted fighters: one atlas per fighter (cut by tools/cut_sprites.py), and
// the choice of frame for whatever the fighter is doing. Motion between the
// key poses comes from timing, squash and a little rotation, the way classic
// fighting games sell a punch with three drawings.
import { clamp01 } from './paint.js';

// World units per atlas pixel: sets each fighter's on-screen size.
const SCALE = { volt: 0.665, brick: 0.76, shade: 0.69, goose: 0.64 };
const SPRITES = {};

export function loadSprites(ids) {
  for (const id of ids) {
    const s = { img: new Image(), frames: null, ready: false, flash: {} };
    SPRITES[id] = s;
    const done = () => (s.ready = !!(s.frames && s.img.complete && s.img.naturalWidth));
    s.img.onload = done;
    s.img.src = `assets/sprites/${id}.webp`;
    fetch(`assets/sprites/${id}.json`)
      .then((r) => r.json())
      .then((frames) => {
        s.frames = frames;
        done();
      })
      .catch(() => {});
  }
}

export const spriteReady = (id) => !!(SPRITES[id] && SPRITES[id].ready);
export const hasFrame = (id, name) => spriteReady(id) && !!SPRITES[id].frames[name];

// The look for this instant: { name, rot, dx, dy, sx, sy }. Rotation pivots on
// the feet; sx/sy squash around them.
export function spriteFrame(f, time) {
  const out = { name: 'idle', rot: 0, dx: 0, dy: 0, sx: 1, sy: 1 };
  const m = f.move;
  if (m) {
    const fr = f.moveFrame;
    const strike = { jab: 'jab', kick: 'kick', uppercut: 'uppercut', sweep: 'sweep', special: 'special', jumpKick: 'flykick', jumpPunch: 'jab' }[m.id] || 'idle';
    const windEnd = Math.max(1, Math.round(m.startup * 0.55));
    const back = m.startup + m.active + Math.round(m.recovery * 0.7);
    if (fr < windEnd) {
      // Wind-up: the guard pulls back and coils.
      out.name = m.air ? 'jump' : m.id === 'sweep' ? 'crouch' : 'idle';
      const k = fr / windEnd;
      out.dx = -14 * k;
      out.sx = 1 - 0.05 * k;
      out.sy = 1 - 0.04 * k;
    } else if (fr < back) {
      out.name = strike;
      // Two frames of overshoot sell the impact.
      const since = fr - windEnd;
      const snap = since < 3 ? 1 - since / 3 : 0;
      out.sx = 1 + 0.07 * snap;
      out.sy = 1 - 0.03 * snap;
      out.dx = 10 * snap;
      if (m.id === 'jumpPunch') out.rot = -0.12;
      if (m.id === 'uppercut' && since < 8) out.dy = -12 * Math.sin((since / 8) * Math.PI);
    } else {
      out.name = m.air ? 'jump' : m.id === 'sweep' ? 'crouch' : 'idle';
    }
    return out;
  }
  const t = f.stateTime;
  switch (f.state) {
    case 'walk': {
      const step = Math.floor(time * 6) % 2;
      out.name = step ? 'walk' : 'idle';
      out.dy = -Math.abs(Math.sin(time * Math.PI * 6)) * 5;
      break;
    }
    case 'crouch':
      out.name = 'crouch';
      out.sy = 1 - 0.06 * Math.max(0, 1 - t / 5);
      break;
    case 'block':
      out.name = 'block';
      break;
    case 'crouchBlock':
      out.name = 'crouchBlock';
      break;
    case 'blockstun':
      out.name = f.blockCrouch ? 'crouchBlock' : 'block';
      out.dx = -6 * Math.max(0, 1 - t / 6);
      break;
    case 'jump':
      out.name = 'jump';
      out.rot = Math.max(-0.12, Math.min(0.12, -f.vy / 9000));
      if (t < 4) out.sy = 1 + 0.05 * (1 - t / 4);
      break;
    case 'hit': {
      out.name = 'hit';
      const k = clamp01(t / Math.max(1, f.stun));
      out.dx = -16 * (1 - k) + Math.sin(t * 2.2) * 3 * (1 - k);
      out.rot = -0.06 * (1 - k);
      break;
    }
    case 'air-hit':
      out.name = hasFrame(f.id, 'tumble') ? 'tumble' : 'hit';
      out.rot = -0.15 - clamp01(t / 30) * (out.name === 'tumble' ? 0.55 : 0.7);
      out.pivot = 'center';
      break;
    case 'down':
      out.name = 'down';
      if (t < 6) out.sy = 1 - 0.12 * Math.sin((t / 6) * Math.PI);
      break;
    case 'ko':
      out.name = f.y > 1 ? (hasFrame(f.id, 'tumble') ? 'tumble' : 'hit') : 'down';
      if (f.y > 1) {
        out.rot = -0.2 - clamp01(t / 30) * 0.6;
        out.pivot = 'center';
      }
      break;
    case 'getup':
      out.name = hasFrame(f.id, 'getup') ? 'getup' : 'crouch';
      break;
    case 'dizzy':
    case 'finished':
      out.name = 'dizzy';
      out.rot = Math.sin(time * 3.2) * 0.07;
      break;
    case 'victory':
    case 'finisher':
      out.name = 'win';
      out.sy = 1 + Math.sin(time * 5) * 0.015;
      break;
    default:
      out.name = 'idle';
      out.sy = 1 + Math.sin(time * 4.5 + f.side) * 0.012;
      out.sx = 1 - Math.sin(time * 4.5 + f.side) * 0.006;
  }
  return out;
}

// Draw a frame with its feet at the origin, facing right.
// opts: { flash (0..1 white overlay), dark (0..1 soot), alpha }
export function drawSprite(ctx, id, look, opts = {}) {
  const s = SPRITES[id];
  const fr = s.frames[look.name] || s.frames.idle;
  const k = SCALE[id] || 0.66;
  const w = fr.w * k;
  const h = fr.h * k;
  ctx.save();
  ctx.translate(look.dx || 0, look.dy || 0);
  if (look.rot) {
    // Lying and tumbling frames spin about their middle, the rest about the feet.
    if (look.pivot === 'center') {
      ctx.translate(0, -h / 2);
      ctx.rotate(look.rot);
      ctx.translate(0, h / 2);
    } else ctx.rotate(look.rot);
  }
  ctx.scale(look.sx || 1, look.sy || 1);
  const x = -fr.ax * k;
  const y = -fr.ay * k;
  if (opts.dark) ctx.filter = `brightness(${1 - opts.dark * 0.8}) saturate(${1 - opts.dark * 0.7})`;
  ctx.drawImage(s.img, fr.x, fr.y, fr.w, fr.h, x, y, w, h);
  ctx.filter = 'none';
  if (opts.flash > 0.02) {
    ctx.globalAlpha *= Math.min(1, opts.flash);
    ctx.drawImage(silhouette(s, look.name in s.frames ? look.name : 'idle'), x, y, w, h);
  }
  ctx.restore();
}

// A white cut-out of a frame, for the flash on the frame a hit lands.
function silhouette(s, name) {
  if (s.flash[name]) return s.flash[name];
  const fr = s.frames[name];
  const c = document.createElement('canvas');
  c.width = fr.w;
  c.height = fr.h;
  const cx = c.getContext('2d');
  cx.drawImage(s.img, fr.x, fr.y, fr.w, fr.h, 0, 0, fr.w, fr.h);
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, fr.w, fr.h);
  s.flash[name] = c;
  return c;
}

// Height of a fighter's standing frame in world units (for effects placed on
// the head).
export function spriteHeight(id) {
  const s = SPRITES[id];
  if (!s || !s.ready) return 270;
  return s.frames.idle.h * (SCALE[id] || 0.66);
}
