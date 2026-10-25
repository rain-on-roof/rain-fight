// The four finishers. Each is a little timeline over the match's finisher
// frames: where the two fighters are and how they look, plus the extras
// painted around them. `beats` lists the frames where effects and sounds fire.
import { INK, clamp01, lerp, easeOutBack } from './paint.js';
import { GROUND } from './stage.js';
import { POSES, blend } from './poses.js';
import { hasFrame, spriteHeight } from './sprites.js';

export const BEATS = {
  toasted: [[1, 'charge'], [36, 'bolt'], [52, 'toast'], [62, 'banner'], [92, 'pop']],
  nailed: [[1, 'leap'], [32, 'slam'], [62, 'slam'], [92, 'slam'], [102, 'banner']],
  undressed: [[1, 'vanish'], [18, 'slash'], [32, 'slash'], [46, 'slash'], [62, 'strip'], [72, 'banner']],
  honked: [[1, 'windup'], [20, 'honk'], [34, 'launch'], [108, 'banner'], [140, 'twinkle']],
};

const COVER = { lean: 0.15, head: 0.35, fs: 0.35, fe: 2.4, bs: 0.25, be: 2.3, fh: 0.05, fk: 0.3, bh: -0.05, bk: 0.3, rot: 0, dx: 0 };

// How the winner and loser are drawn at finisher frame t. `frame` names the
// painted frame; `poseOverride` and friends drive the code-drawn fallback.
export function finisherState(m, t, time) {
  const id = m.finisher.id;
  const w = m.fighters[m.finisher.by];
  const l = m.fighters[1 - m.finisher.by];
  const dir = Math.sign(l.x - w.x) || 1;
  const win = {};
  const lose = {};
  if (id === 'toasted') {
    const [wind, hit] = POSES.volt_special;
    win.poseOverride = t < 36 ? blend(POSES.guard, wind, clamp01(t / 20)) : t < 60 ? hit : { ...POSES.win, fs: 2.9 + Math.sin(time * 6) * 0.15 };
    win.frame = t < 14 ? 'idle' : t < 64 ? 'special' : 'win';
    if (hasFrame(l.id, 'idle')) {
      // Struck, fried, and down like a plank.
      if (t >= 36 && t < 52) {
        lose.frame = 'hit';
        lose.flash = t % 4 < 2 ? 1 : 0;
      } else if (t >= 52 && t < 100) {
        lose.frame = hasFrame(l.id, 'charred') ? 'charred' : 'dizzy';
        lose.dark = lose.frame === 'charred' ? 0 : 1;
      } else if (t >= 100) {
        lose.frame = 'down';
        lose.dark = 1;
      }
    } else {
      lose.toast = t >= 52;
    }
  } else if (id === 'nailed') {
    const jump = clamp01(t / 30);
    win.dx = lerp(0, l.x - w.x - dir * 110, jump);
    win.dy = t < 30 ? -Math.sin(jump * Math.PI) * 230 : t < 100 ? -Math.max(0, Math.sin(((t - 30) % 30) / 30 * Math.PI)) * 60 : 0;
    const [wind, hit] = POSES.brick_special;
    const phase = ((t - 30) % 30) / 30;
    win.poseOverride = t < 30 ? POSES.jump : t < 100 ? (phase < 0.6 ? wind : hit) : { ...POSES.win, fs: 2.9 + Math.sin(time * 6) * 0.15 };
    win.frame = t < 30 ? 'jump' : t < 100 ? (phase < 0.6 ? 'uppercut' : 'special') : 'win';
    lose.frame = t >= 32 && ((t - 32) % 30) < 10 ? 'hit' : 'dizzy';
    const slams = t >= 92 ? 3 : t >= 62 ? 2 : t >= 32 ? 1 : 0;
    lose.sink = slams * 72;
    lose.clip = true;
  } else if (id === 'undressed') {
    const strikes = [18, 32, 46];
    const k = strikes.findIndex((s) => t >= s - 4 && t < s + 8);
    win.hidden = t < 14 || (k < 0 && t < 58);
    if (k >= 0) {
      win.dx = l.x - w.x + (k % 2 ? -1 : 1) * 120;
      win.flip = k % 2 ? 1 : -1;
      win.poseOverride = POSES.shade_special[1];
      win.frame = 'special';
    }
    if (t >= 58) {
      win.dx = l.x - w.x - dir * 170;
      win.poseOverride = { ...POSES.guard, fs: 1.2, fe: 2.6, bs: 1.0, be: 2.6, lean: -0.05 };
      win.frame = 'win';
    }
    lose.frame = t >= 62 && hasFrame(l.id, 'underwear') ? 'underwear' : t >= 14 && (k >= 0) ? 'hit' : 'dizzy';
    lose.outfit = t >= 62 ? 'underwear' : 'normal';
    lose.poseOverride = t >= 62 ? COVER : null;
    lose.expression = t >= 62 ? 'shout' : 'dizzy';
    lose.plucked = t >= 62;
  } else if (id === 'honked') {
    win.goosePose = t < 20 ? 'tell' : t < 100 ? 'strike' : 'victory';
    win.frame = t < 20 ? 'crouch' : t < 100 ? 'special' : 'win';
    lose.frame = t >= 34 ? (hasFrame(l.id, 'tumble') ? 'tumble' : 'hit') : t >= 20 ? 'hit' : 'dizzy';
    if (t >= 34) {
      const k = clamp01((t - 34) / 100);
      lose.fly = k;
    }
  }
  return { win, lose, w, l, dir };
}

// Extras in stage space: the lightning, the toast, the crater, slash arcs, the
// flight to the horizon.
export function drawFinisherBack(ctx, m, t, time, viewTop) {
  const id = m.finisher.id;
  const l = m.fighters[1 - m.finisher.by];
  if (id === 'nailed' && t >= 32) {
    // A crater the loser is being hammered into.
    ctx.save();
    ctx.translate(l.x, GROUND + 4);
    ctx.fillStyle = '#0a0818';
    ctx.beginPath();
    ctx.ellipse(0, 0, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0818';
    ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 80, Math.sin(a) * 15);
      ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 30);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (id === 'toasted' && t >= 34 && t < 60) {
    // The bolt from the sky.
    const a = 1 - clamp01((t - 46) / 14);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#5ef2ff';
    ctx.shadowBlur = 40;
    for (const [wd, col] of [[42, 'rgba(94,242,255,0.6)'], [16, '#ffffff']]) {
      ctx.lineWidth = wd;
      ctx.strokeStyle = col;
      ctx.beginPath();
      let x = l.x;
      ctx.moveTo(x, viewTop - 50);
      for (let y = viewTop; y < GROUND - 120; y += 70) {
        x = l.x + Math.sin(y * 0.07 + t * 3) * 40;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(l.x, GROUND - 120);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawFinisherFront(ctx, m, t, time) {
  const id = m.finisher.id;
  const l = m.fighters[1 - m.finisher.by];
  if (id === 'toasted' && t >= 52) {
    if (hasFrame(l.id, 'idle')) smokeColumn(ctx, l.x, GROUND - (t >= 100 ? 40 : spriteHeight(l.id) * 0.9), time, t >= 100 ? 0.6 : 1);
    else drawToast(ctx, l.x, GROUND, t, time);
  }
  if (id === 'undressed') {
    for (const s of [18, 32, 46]) {
      const k = (t - s) / 10;
      if (k < 0 || k > 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 20;
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.lineCap = 'round';
      const sgn = s === 32 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(l.x - 160 * sgn, GROUND - 260 + k * 40);
      ctx.quadraticCurveTo(l.x, GROUND - 120, l.x + 170 * sgn, GROUND - 40);
      ctx.stroke();
      ctx.restore();
    }
    if (t >= 62 && t < 140 && !hasFrame(l.id, 'underwear')) {
      // Blush and a bead of sweat.
      ctx.fillStyle = 'rgba(255, 90, 140, 0.55)';
      ctx.beginPath();
      ctx.ellipse(l.x + l.facing * 10, GROUND - 268, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (id === 'honked' && t >= 130) {
    // Gone. A twinkle where they vanished.
    const k = clamp01((t - 130) / 20);
    const s = Math.sin(k * Math.PI) * 26;
    if (s > 0.5) twinkle(ctx, l.x - l.facing * 0 + flyX(l, 1), GROUND - flyY(1), s);
  }
}

export function flyX(l, k) {
  const away = -l.facing;
  return away * k * 700;
}

export function flyY(k) {
  return 120 + k * 900 - (1 - k) * 0;
}

function twinkle(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffe96b';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2);
  ctx.quadraticCurveTo(x, y, x + s * 2, y);
  ctx.quadraticCurveTo(x, y, x, y + s * 2);
  ctx.quadraticCurveTo(x, y, x - s * 2, y);
  ctx.quadraticCurveTo(x, y, x, y - s * 2);
  ctx.fill();
  ctx.restore();
}

function drawToast(ctx, x, ground, t, time) {
  const pop = t >= 92 ? Math.sin(clamp01((t - 92) / 26) * Math.PI) * 140 : 0;
  const appear = easeOutBack(clamp01((t - 52) / 10));
  ctx.save();
  ctx.translate(x, ground - pop);
  ctx.scale(appear, appear);
  ctx.rotate(t >= 92 ? Math.sin(clamp01((t - 92) / 26) * Math.PI) * 0.5 : Math.sin(time * 2) * 0.03);
  const p = new Path2D();
  p.moveTo(-70, 0);
  p.lineTo(-70, -150);
  p.bezierCurveTo(-110, -170, -90, -240, -40, -232);
  p.bezierCurveTo(-10, -260, 30, -260, 50, -230);
  p.bezierCurveTo(100, -232, 110, -170, 70, -150);
  p.lineTo(70, 0);
  p.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke(p);
  ctx.fillStyle = '#7a4420';
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = '#c7894a';
  ctx.beginPath();
  ctx.moveTo(-54, -10);
  ctx.lineTo(-54, -150);
  ctx.bezierCurveTo(-84, -168, -70, -220, -36, -214);
  ctx.bezierCurveTo(-8, -238, 26, -238, 44, -212);
  ctx.bezierCurveTo(84, -214, 92, -168, 54, -150);
  ctx.lineTo(54, -10);
  ctx.fill();
  ctx.fillStyle = 'rgba(40, 20, 10, 0.55)';
  for (const [bx, by, r] of [[-20, -60, 18], [24, -110, 14], [-30, -170, 12], [30, -40, 10]]) {
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Face: X eyes and a tiny O mouth.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const ex of [-24, 24]) {
    ctx.beginPath();
    ctx.moveTo(ex - 9, -130);
    ctx.lineTo(ex + 9, -112);
    ctx.moveTo(ex + 9, -130);
    ctx.lineTo(ex - 9, -112);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, -84, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  smokeColumn(ctx, x, ground - pop - 250, time, 1);
}

function smokeColumn(ctx, x, y, time, amount) {
  for (let i = 0; i < 7; i++) {
    const k = (time * 0.6 + i / 7) % 1;
    ctx.fillStyle = `rgba(90, 80, 110, ${0.55 * amount * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(i * 3 + k * 4) * 30, y - k * 170, 14 + k * 34, 0, Math.PI * 2);
    ctx.fill();
  }
}
