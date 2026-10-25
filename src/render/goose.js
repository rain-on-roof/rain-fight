// The goose: a small rig of parts driven by a handful of pose numbers that
// spring toward the target pose for the current mood. Local units: the goose
// faces right, feet on y = 0, about 330 units tall with its neck up.
import { INK, PALETTE as P, circle, inkUnder, softShadow, lerp, clamp01, easeOutBack } from './paint.js';

const POSES = {
  idle: { hx: 80, hy: -300, mx: 86, my: -226, ha: -0.05, beak: 0, wing: 0, ruffle: 0, lower: 0, blush: 0, closed: 0 },
  creep: { hx: 112, hy: -268, mx: 100, my: -206, ha: 0.12, beak: 0, wing: 0.05, ruffle: 0.15, lower: 6, blush: 0, closed: 0 },
  tell: { hx: 190, hy: -146, mx: 120, my: -176, ha: 0.18, beak: 0.42, wing: 0.3, ruffle: 1, lower: 14, blush: 0, closed: 0 },
  innocent: { hx: 56, hy: -326, mx: 72, my: -238, ha: -0.95, beak: 0.14, wing: 0, ruffle: 0, lower: -4, blush: 1, closed: 1 },
  strike: { hx: 250, hy: -130, mx: 150, my: -150, ha: 0.25, beak: 1, wing: 1, ruffle: 1, lower: 18, blush: 0, closed: 0 },
  victory: { hx: 96, hy: -316, mx: 88, my: -236, ha: -0.35, beak: 0.3, wing: 0.7, ruffle: 0.4, lower: -6, blush: 0, closed: 0 },
};

// Big head, big acting.
const HEAD = 1.32;
const LEG_DROP = 24;

const SPEED = { idle: 7, creep: 8, tell: 16, innocent: 10, strike: 34, victory: 9 };

export function createGooseAnimator() {
  return {
    pose: { ...POSES.idle },
    mood: 'idle',
    moodTime: 0,
    blink: 0,
    nextBlink: 2,
    twitch: 0,
  };
}

// Small head jerk when the player takes a bite: the goose notices.
export function nudgeGoose(anim, amount = 1) {
  anim.twitch = Math.min(1, anim.twitch + amount);
}

export function updateGoose(anim, dt, { mood, time, strikeTarget }) {
  if (mood !== anim.mood) {
    anim.mood = mood;
    anim.moodTime = 0;
  }
  anim.moodTime += dt;
  const target = { ...POSES[mood] };
  if (mood === 'strike' && strikeTarget) {
    target.hx = strikeTarget.x;
    target.hy = strikeTarget.y;
    target.mx = lerp(60, strikeTarget.x, 0.45);
    target.my = lerp(-160, strikeTarget.y, 0.4) - 20;
  }
  if (mood === 'idle') {
    target.hy += Math.sin(time * 2.2) * 5;
    target.ha += Math.sin(time * 0.7) * 0.18;
  }
  if (mood === 'creep') target.hy += Math.sin(time * 6) * 3;
  if (mood === 'innocent') target.ha += Math.sin(time * 3) * 0.06;
  const k = 1 - Math.exp(-dt * SPEED[mood]);
  for (const key of Object.keys(target)) anim.pose[key] += (target[key] - anim.pose[key]) * k;

  anim.twitch = Math.max(0, anim.twitch - dt * 5);
  anim.nextBlink -= dt;
  if (anim.nextBlink <= 0) {
    anim.blink = 1;
    anim.nextBlink = 1.8 + ((time * 7.31) % 2.6);
  }
  anim.blink = Math.max(0, anim.blink - dt * 7);
  return anim.pose;
}

/* ---------- drawing ---------- */

export function drawGoose(ctx, anim, view) {
  const { x, y, scale, time, walk = 0, walking = false, anger = 0, golden = false, held = null } = view;
  const pose = anim.pose;
  const mood = anim.mood;
  const colors = golden
    ? { base: P.gold, shade: P.goldShade, deep: P.goldDeep, light: P.goldLight }
    : { base: P.goose, shade: P.gooseShade, deep: P.gooseDeep, light: P.gooseLight };

  softShadow(ctx, x - 14 * scale, y + 2, 118 * scale, 20 * scale, 0.32);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const w = walk * Math.PI * 2;
  const tremble = mood === 'tell' ? 1 : 0;
  const jx = tremble * Math.sin(time * 61) * 1.6;
  const jy = tremble * Math.cos(time * 47) * 1.2;
  const rock = walking ? Math.sin(w) * 0.06 : 0;
  const bob = walking ? Math.abs(Math.cos(w)) * -5 : 0;

  drawLegs(ctx, { w, walking, mood, time });

  const twitch = anim.twitch;
  const head = { x: pose.hx - twitch * 6, y: pose.hy - twitch * 8, a: pose.ha - twitch * 0.25 };

  ctx.save();
  // Short legs: the body sits LEG_DROP lower than the rig's numbers say.
  ctx.translate(0, pose.lower + bob + LEG_DROP);
  ctx.translate(0, -90);
  ctx.rotate(rock);
  ctx.translate(jx, 90 + jy);


  const mid = { x: pose.mx, y: pose.my };

  const body = bodyPath();
  const neck = neckPath({ x: 52, y: -150 }, mid, head);
  const skull = headPath(head);
  const fluff = ruffles(pose.ruffle, mid, head, time);

  // Ink every piece first, then fill every piece: one merged silhouette.
  for (const p of [body, neck, skull, fluff]) inkUnder(ctx, p, 4.5);
  ctx.fillStyle = colors.base;
  for (const p of [fluff, body, neck, skull]) ctx.fill(p);

  shadeGoose(ctx, { body, neck, skull, fluff, colors, mid, head });

  drawWing(ctx, pose.wing, mood, time, colors);
  drawHead(ctx, anim, head, { anger, colors, time, held });

  ctx.restore();

  // Head-anchored overlays share the body's offset but not its tremble.
  ctx.save();
  ctx.translate(0, pose.lower + bob + LEG_DROP);
  if (mood === 'tell') drawAlarm(ctx, head, anim.moodTime, time);
  if (mood === 'innocent') drawNotes(ctx, head, anim.moodTime);
  ctx.restore();
  if (golden) drawSparkles(ctx, time);

  ctx.restore();
}

function bodyPath() {
  const p = new Path2D();
  p.moveTo(40, -165);
  p.bezierCurveTo(10, -186, -62, -192, -100, -172);
  p.bezierCurveTo(-124, -164, -142, -174, -156, -186);
  p.bezierCurveTo(-150, -156, -136, -128, -116, -110);
  p.bezierCurveTo(-90, -78, -30, -60, 22, -64);
  p.bezierCurveTo(72, -70, 92, -108, 84, -136);
  p.bezierCurveTo(78, -156, 60, -166, 40, -165);
  p.closePath();
  return p;
}

function quad(a, c, b, t) {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

function neckPath(base, mid, head) {
  const n = 18;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = quad(base, mid, head, t);
    const q = quad(base, mid, head, Math.min(1, t + 0.02));
    const r = quad(base, mid, head, Math.max(0, t - 0.02));
    let tx = q.x - r.x;
    let ty = q.y - r.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const half = lerp(28, 19, t);
    left.push({ x: p.x - ty * half, y: p.y + tx * half });
    right.push({ x: p.x + ty * half, y: p.y - tx * half });
  }
  const path = new Path2D();
  path.moveTo(left[0].x, left[0].y);
  for (const pt of left) path.lineTo(pt.x, pt.y);
  for (let i = right.length - 1; i >= 0; i--) path.lineTo(right[i].x, right[i].y);
  path.closePath();
  return path;
}

function headPath(head) {
  const p = new Path2D();
  const c = Math.cos(head.a);
  const s = Math.sin(head.a);
  const cx = head.x + c * 4;
  const cy = head.y + s * 4;
  p.moveTo(cx + c * 30 * HEAD, cy + s * 30 * HEAD);
  p.ellipse(cx, cy, 30 * HEAD, 25 * HEAD, head.a, 0, Math.PI * 2);
  return p;
}

function ruffles(amount, mid, head, time) {
  const p = new Path2D();
  if (amount < 0.05) return p;
  const len = 11 * amount;
  const tuft = (ox, oy, ang, size, wob) => {
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    const tx = -ny;
    const ty = nx;
    p.moveTo(ox - tx * size, oy - ty * size);
    p.quadraticCurveTo(ox - tx * size * 0.2 + nx * len * 1.1 + wob, oy - ty * size * 0.2 + ny * len * 1.1, ox + tx * size * 0.4 + nx * len * 0.9 + wob, oy + ty * size * 0.4 + ny * len * 0.9);
    p.quadraticCurveTo(ox + tx * size * 0.5, oy + ty * size * 0.5, ox + tx * size, oy + ty * size);
    p.closePath();
  };
  // A few soft tufts along the back.
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    const bx = lerp(-112, 6, t);
    const by = -170 - Math.sin(t * Math.PI) * 15;
    tuft(bx, by + 3, -Math.PI / 2 - 0.5, 10, Math.sin(time * 26 + i) * 1.4 * amount);
  }
  // And along the back of the neck, where an angry goose puffs up.
  const base = { x: 52, y: -150 };
  for (let i = 1; i < 5; i++) {
    const t = i / 5.5;
    const pt = quad(base, mid, head, t);
    const q = quad(base, mid, head, t + 0.03);
    const ang = Math.atan2(q.y - pt.y, q.x - pt.x) - Math.PI / 2;
    const off = lerp(25, 18, t);
    tuft(pt.x + Math.cos(ang) * off, pt.y + Math.sin(ang) * off, ang - 0.5, 9, Math.sin(time * 24 + i * 2) * 1.4 * amount);
  }
  return p;
}

function shadeGoose(ctx, { body, neck, skull, fluff, colors, mid, head }) {
  const all = new Path2D();
  all.addPath(body);
  all.addPath(neck);
  all.addPath(skull);
  all.addPath(fluff);
  ctx.save();
  ctx.clip(all);
  // Belly shadow away from the light.
  ctx.fillStyle = colors.shade;
  ctx.beginPath();
  ctx.ellipse(-40, -48, 150, 62, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.deep;
  ctx.beginPath();
  ctx.ellipse(-50, -30, 120, 40, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // Shadow side of the neck and a lit edge on the sun side.
  ctx.lineCap = 'round';
  const base = { x: 52, y: -150 };
  ctx.strokeStyle = colors.shade;
  ctx.lineWidth = 10;
  strokeCurve(ctx, base, mid, head, -13);
  ctx.strokeStyle = colors.light;
  ctx.lineWidth = 5;
  strokeCurve(ctx, base, mid, head, 12);
  // Warm rim light across the top of the back.
  ctx.strokeStyle = 'rgba(255, 236, 190, 0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-90, -170);
  ctx.bezierCurveTo(-50, -186, 0, -184, 34, -166);
  ctx.stroke();
  ctx.restore();
}

function strokeCurve(ctx, a, c, b, offset) {
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const p = quad(a, c, b, t);
    const q = quad(a, c, b, Math.min(1, t + 0.02));
    const r = quad(a, c, b, Math.max(0, t - 0.02));
    const len = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    const nx = (q.y - r.y) / len;
    const ny = -(q.x - r.x) / len;
    const o = offset * lerp(1, 0.6, t);
    const px = p.x - nx * o;
    const py = p.y - ny * o;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawLegs(ctx, { w, walking, mood, time }) {
  const legs = [
    { hip: -30, phase: 0, far: true },
    { hip: 4, phase: Math.PI, far: false },
  ];
  for (const leg of legs) {
    let dx = 0;
    let lift = 0;
    if (walking) {
      dx = Math.sin(w + leg.phase) * 16;
      lift = Math.max(0, Math.cos(w + leg.phase)) * 10;
    }
    if (mood === 'strike') dx = leg.far ? -16 : 22;
    if (mood === 'victory') lift = Math.max(0, Math.sin(time * 12 + leg.phase)) * 8;
    const fx = leg.hip + dx;
    const fy = -lift;
    ctx.save();
    const orange = leg.far ? P.beakShade : P.beak;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(leg.hip, -78 + LEG_DROP);
    ctx.lineTo(leg.hip + dx * 0.6, -28);
    ctx.lineTo(fx, fy - 6);
    ctx.stroke();
    ctx.strokeStyle = orange;
    ctx.lineWidth = 7.5;
    ctx.stroke();
    const foot = new Path2D();
    foot.moveTo(fx - 8, fy - 4);
    foot.quadraticCurveTo(fx + 8, fy - 6, fx + 30, fy);
    foot.quadraticCurveTo(fx + 22, fy + 3, fx + 18, fy + 1);
    foot.quadraticCurveTo(fx + 12, fy + 4, fx + 6, fy + 1);
    foot.quadraticCurveTo(fx - 2, fy + 4, fx - 10, fy + 1);
    foot.closePath();
    inkUnder(ctx, foot, 3.5);
    ctx.fillStyle = orange;
    ctx.fill(foot);
    ctx.restore();
  }
}

function drawWing(ctx, lift, mood, time, colors) {
  let spread = lift;
  if (mood === 'victory') spread = 0.45 + Math.sin(time * 16) * 0.4;
  if (mood === 'strike') spread = lift * (0.85 + Math.sin(time * 30) * 0.15);
  ctx.save();
  ctx.translate(26, -142);
  ctx.rotate(spread * 1.15);
  ctx.scale(1 + spread * 0.12, 1 - spread * 0.1);
  const wing = new Path2D();
  wing.moveTo(8, 0);
  wing.bezierCurveTo(-30, -14, -100, -18, -150, -26);
  wing.bezierCurveTo(-128, -6, -118, 8, -110, 14);
  // Scalloped trailing edge: the primaries.
  const tips = [[-110, 14], [-92, 24], [-72, 32], [-50, 38], [-28, 40], [-6, 36]];
  for (let i = 1; i < tips.length; i++) {
    const [px, py] = tips[i - 1];
    const [qx, qy] = tips[i];
    wing.quadraticCurveTo((px + qx) / 2 - 2, Math.max(py, qy) + 10, qx, qy);
  }
  wing.bezierCurveTo(10, 30, 22, 14, 8, 0);
  wing.closePath();
  inkUnder(ctx, wing, 4);
  ctx.fillStyle = colors.base;
  ctx.fill(wing);
  ctx.save();
  ctx.clip(wing);
  ctx.fillStyle = colors.shade;
  ctx.beginPath();
  ctx.ellipse(-60, 34, 110, 26, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.deep;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const [sx, sy, ex, ey] of [[-20, 2, -38, 30], [-48, -2, -66, 26], [-78, -6, -92, 18], [-104, -12, -114, 8]]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo((sx + ex) / 2 + 4, (sy + ey) / 2, ex, ey);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.bezierCurveTo(-40, -14, -96, -18, -136, -22);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawHead(ctx, anim, head, { anger, colors, time, held }) {
  const pose = anim.pose;
  const mood = anim.mood;
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.a);
  ctx.scale(HEAD, HEAD);

  // Cheek shade under the eye.
  ctx.save();
  const skull = new Path2D();
  skull.ellipse(4, 0, 30, 25, 0, 0, Math.PI * 2);
  ctx.clip(skull);
  ctx.fillStyle = colors.shade;
  ctx.beginPath();
  ctx.ellipse(-6, 22, 32, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.light;
  ctx.beginPath();
  ctx.ellipse(12, -16, 16, 6, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (pose.blush > 0.05) {
    ctx.fillStyle = `rgba(255, 120, 150, ${0.45 * pose.blush})`;
    ctx.beginPath();
    ctx.ellipse(6, 10, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBeak(ctx, pose.beak, mood, held);
  drawEye(ctx, anim, { anger, time });
  ctx.restore();
}

function drawBeak(ctx, open, mood, held) {
  const jaw = open * 0.75;
  // Mouth interior shows when the beak opens.
  if (open > 0.05) {
    ctx.save();
    ctx.translate(24, 4);
    const mouth = new Path2D();
    mouth.moveTo(0, -2);
    mouth.lineTo(44, -2);
    mouth.lineTo(Math.cos(jaw) * 40, Math.sin(jaw) * 40 + 4);
    mouth.closePath();
    ctx.fillStyle = '#5a1f2c';
    ctx.fill(mouth);
    ctx.fillStyle = '#ff7a8c';
    ctx.beginPath();
    ctx.ellipse(Math.cos(jaw * 0.6) * 18, Math.sin(jaw * 0.6) * 18 + 2, 11, 5, jaw * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Lower mandible, hinged at the base.
  ctx.save();
  ctx.translate(24, 4);
  ctx.rotate(jaw);
  const lower = new Path2D();
  lower.moveTo(-4, -2);
  lower.quadraticCurveTo(20, 2, 40, 0);
  lower.quadraticCurveTo(28, 10, 2, 10);
  lower.closePath();
  inkUnder(ctx, lower, 3.5);
  ctx.fillStyle = P.beakShade;
  ctx.fill(lower);
  if (open > 0.3) serrations(ctx, -1);
  ctx.restore();

  if (held) {
    ctx.save();
    ctx.translate(44, 8);
    ctx.rotate(0.15);
    held(ctx);
    ctx.restore();
  }

  // Upper mandible with the knob of a domestic goose.
  ctx.save();
  ctx.translate(24, 4);
  const upper = new Path2D();
  upper.moveTo(-8, -14);
  upper.quadraticCurveTo(14, -16, 32, -8);
  upper.quadraticCurveTo(46, -3, 50, 2);
  upper.quadraticCurveTo(34, 2, 0, 0);
  upper.closePath();
  const knob = new Path2D();
  circle(knob, -2, -15, 10);
  inkUnder(ctx, upper, 3.5);
  inkUnder(ctx, knob, 3.5);
  ctx.fillStyle = P.beak;
  ctx.fill(upper);
  ctx.fill(knob);
  ctx.fillStyle = P.beakLight;
  ctx.beginPath();
  ctx.ellipse(18, -9, 12, 3, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-4, -19, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(32, -6, 3, 1.6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (open > 0.3) serrations(ctx, 1);
  ctx.restore();
}

// Geese really do have serrated beaks. On screen it reads as teeth.
function serrations(ctx, dir) {
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 7.5;
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(x, 0.5);
      ctx.lineTo(x + 3, 6);
      ctx.lineTo(x + 6, 0.5);
    } else {
      ctx.moveTo(x, -1);
      ctx.lineTo(x + 3, -6.5);
      ctx.lineTo(x + 6, -1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawEye(ctx, anim, { anger, time }) {
  const pose = anim.pose;
  const mood = anim.mood;
  const ex = 8;
  const ey = -7;
  const closed = Math.max(pose.closed, anim.blink);
  if (closed > 0.5) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'innocent') ctx.arc(ex, ey + 3, 7, Math.PI * 1.1, Math.PI * 1.9);
    else {
      ctx.moveTo(ex - 7, ey);
      ctx.lineTo(ex + 7, ey);
    }
    ctx.stroke();
  } else {
    const wide = mood === 'tell' || mood === 'strike';
    const r = wide ? 10.5 : 9;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Looks at the sandwich (forward and down), jitters when furious.
    const look = mood === 'idle' ? Math.sin(time * 0.9) * 2 : 3;
    const px = ex + look + (wide ? Math.sin(time * 50) * 0.8 : 0);
    const py = ey + (mood === 'victory' ? -2 : 2);
    const pr = wide ? 3.6 : 4.8;
    if (wide) {
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath();
      ctx.arc(px, py, pr + 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 1.6, py - 1.8, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The brow carries most of the acting.
  const a = mood === 'innocent' ? -0.6 : clamp01(anger);
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(ex - 11, ey - 13 - a * 1);
  ctx.quadraticCurveTo(ex, ey - 15 + a * 2, ex + 11, ey - 12 + a * 9);
  ctx.stroke();
}

function drawAlarm(ctx, head, moodTime, time) {
  const pop = easeOutBack(clamp01(moodTime / 0.18));
  ctx.save();
  ctx.translate(head.x - 10, head.y - 92);
  ctx.scale(pop, pop);
  ctx.rotate(Math.sin(time * 40) * 0.08);
  const bubble = new Path2D();
  bubble.roundRect(-17, -26, 34, 52, 12);
  inkUnder(ctx, bubble, 4);
  ctx.fillStyle = '#ff4a3d';
  ctx.fill(bubble);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-5, -18, 10, 25, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 15, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Hiss lines out of the beak.
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.a);
  ctx.strokeStyle = 'rgba(43, 33, 49, 0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const k = (time * 3 + i / 3) % 1;
    const sx = 100 + k * 40;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const xx = sx + j * 4;
      const yy = (i - 1) * 12 + Math.sin(j * 1.7 + time * 20) * 3;
      if (j === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawNotes(ctx, head, moodTime) {
  for (let i = 0; i < 2; i++) {
    const k = (moodTime * 0.9 + i * 0.5) % 1;
    const x = head.x + 40 + k * 40 + i * 14;
    const y = head.y - 30 - k * 70;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - k) * 3, k * 6);
    ctx.translate(x, y);
    ctx.rotate(Math.sin(k * 8) * 0.3);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(5, -26, 3, 26);
    ctx.beginPath();
    ctx.moveTo(8, -26);
    ctx.quadraticCurveTo(20, -20, 16, -8);
    ctx.quadraticCurveTo(16, -16, 8, -18);
    ctx.fill();
    ctx.restore();
  }
}

function drawSparkles(ctx, time) {
  for (let i = 0; i < 6; i++) {
    const a = time * 0.8 + i * 1.05;
    const r = 130 + Math.sin(time * 2 + i) * 20;
    const x = Math.cos(a) * r * 0.9;
    const y = -170 + Math.sin(a) * r * 0.8;
    const s = 6 + Math.sin(time * 6 + i * 2) * 4;
    star(ctx, x, y, Math.max(1, s));
  }
}

export function star(ctx, x, y, s, color = '#fff6b0') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s * 2);
  ctx.quadraticCurveTo(0, 0, s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, s * 2);
  ctx.quadraticCurveTo(0, 0, -s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s * 2);
  ctx.fill();
  ctx.restore();
}
