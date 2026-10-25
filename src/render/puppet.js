// Fighters as puppets: a two-bone skeleton driven by a handful of angles,
// dressed per character. Canvas coordinates: y down, origin at the feet,
// facing right (the caller mirrors for facing left). Angles for limbs are
// measured from straight down, positive toward the front.
import { INK, inkUnder, lerp } from './paint.js';

export const LOOKS = {
  volt: {
    scale: 1,
    thigh: 60, shin: 60, torso: 86, upper: 47, fore: 45, headR: 27, neck: 8,
    width: { thigh: [38, 29], shin: [29, 21], upper: [28, 23], fore: [24, 21], shoulder: 86, waist: 52 },
    fist: 19, foot: 32,
    colors: { skin: '#f2c193', skinShade: '#cf9465', top: '#19c3e6', topShade: '#0f8fb0', sleeve: null, pants: '#2b2a44', pantsShade: '#1b1a2e', boot: '#f2f2f7', bootShade: '#b9b9c9', glove: '#5ef2ff', hair: '#fff1a6', hairShade: '#f0c94a', accent: '#ff3d6e' },
    glowFists: '#5ef2ff',
  },
  brick: {
    scale: 1.14,
    thigh: 56, shin: 52, torso: 94, upper: 50, fore: 46, headR: 24, neck: 4,
    width: { thigh: [46, 36], shin: [36, 27], upper: [40, 33], fore: [34, 29], shoulder: 128, waist: 82 },
    fist: 25, foot: 36,
    colors: { skin: '#a8714c', skinShade: '#80522f', top: '#f4f1ea', topShade: '#cfc8bb', sleeve: null, pants: '#4b5a34', pantsShade: '#36421f', boot: '#3a2b22', bootShade: '#22180f', glove: '#e8e2d2', hair: '#1d1714', hairShade: '#000000', accent: '#ffb000' },
  },
  shade: {
    scale: 1,
    thigh: 62, shin: 62, torso: 84, upper: 48, fore: 47, headR: 25, neck: 8,
    width: { thigh: [32, 24], shin: [24, 18], upper: [23, 19], fore: [20, 17], shoulder: 72, waist: 44 },
    fist: 16, foot: 30,
    colors: { skin: '#3b2a55', skinShade: '#291c3d', top: '#3b2a55', topShade: '#291c3d', sleeve: '#3b2a55', pants: '#332349', pantsShade: '#22162f', boot: '#22162f', bootShade: '#140c1c', glove: '#22162f', hair: '#3b2a55', hairShade: '#291c3d', accent: '#ff3df0' },
    eyes: '#ff5cf4',
  },
};

// ---------- skeleton ----------

const dir = (a) => [Math.sin(a), Math.cos(a)];
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];

export function skeleton(look, pose) {
  const hip = [0, 0];
  const torsoDir = [Math.sin(pose.lean), -Math.cos(pose.lean)];
  const neck = add(hip, torsoDir, look.torso);
  const across = [Math.cos(pose.lean), Math.sin(pose.lean)];
  // Shoulders sit below the neck and out to the sides of the chest.
  const chest = add(neck, torsoDir, -look.width.upper[0] * 0.55);
  const shoulderF = add(chest, across, look.width.shoulder * 0.26);
  const shoulderB = add(chest, across, -look.width.shoulder * 0.3);
  const headDir = [Math.sin(pose.lean + pose.head), -Math.cos(pose.lean + pose.head)];
  const head = add(neck, headDir, look.neck + look.headR);
  const hipF = [look.width.waist * 0.18, 0];
  const hipB = [-look.width.waist * 0.18, 0];
  const leg = (h, a, k) => {
    const knee = add(h, dir(a), look.thigh);
    const ankle = add(knee, dir(a - k), look.shin);
    return { hip: h, knee, ankle, footAngle: a - k };
  };
  const arm = (s, a, e) => {
    const elbow = add(s, dir(a), look.upper);
    const hand = add(elbow, dir(a + e), look.fore);
    return { shoulder: s, elbow, hand };
  };
  const sk = {
    hip, neck, head,
    legF: leg(hipF, pose.fh, pose.fk),
    legB: leg(hipB, pose.bh, pose.bk),
    armF: arm(shoulderF, pose.fs, pose.fe),
    armB: arm(shoulderB, pose.bs, pose.be),
  };
  // Whole-body rotation (falls, lying down) about the hip.
  if (pose.rot) {
    const c = Math.cos(pose.rot);
    const s = Math.sin(pose.rot);
    const r = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
    for (const k of ['hip', 'neck', 'head']) sk[k] = r(sk[k]);
    for (const k of ['legF', 'legB']) for (const j of ['hip', 'knee', 'ankle']) sk[k][j] = r(sk[k][j]);
    for (const k of ['armF', 'armB']) for (const j of ['shoulder', 'elbow', 'hand']) sk[k][j] = r(sk[k][j]);
    sk.legF.footAngle -= pose.rot;
    sk.legB.footAngle -= pose.rot;
  }
  sk.rot = pose.rot || 0;
  sk.lean = pose.lean;
  sk.headAngle = pose.lean + pose.head + (pose.rot || 0);
  return sk;
}

// Lift or drop the skeleton so its lowest point touches the floor.
export function groundOffset(sk, look) {
  const ys = [sk.legF.ankle[1], sk.legB.ankle[1]];
  if (Math.abs(sk.rot) > 0.6) ys.push(sk.head[1] + look.headR, sk.neck[1] + 14, sk.hip[1] + 18, sk.armF.hand[1], sk.armB.hand[1], sk.legF.knee[1] + 12, sk.legB.knee[1] + 12);
  return -Math.max(...ys) - 8;
}

// ---------- shapes ----------

function capsule(a, b, wa, wb) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  const p = new Path2D();
  p.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2);
  p.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
  p.arc(b[0], b[1], wb / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
  p.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2);
  p.arc(a[0], a[1], wa / 2, ang - Math.PI / 2, ang + Math.PI / 2, true);
  p.closePath();
  return { path: p, nx, ny };
}

// A shaded limb: base fill, a shadow band on the far side, a neon rim on the
// near side.
function limb(ctx, a, b, wa, wb, fill, shade, rim, ink = 4) {
  const { path, nx, ny } = capsule(a, b, wa, wb);
  inkUnder(ctx, path, ink);
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const w = Math.max(wa, wb);
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade;
  ctx.lineWidth = w * 0.55;
  ctx.beginPath();
  ctx.moveTo(a[0] - nx * w * 0.42, a[1] - ny * w * 0.42);
  ctx.lineTo(b[0] - nx * w * 0.42, b[1] - ny * w * 0.42);
  ctx.stroke();
  if (rim) {
    // Neon rim light hugging the outline, not a racing stripe.
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(2, w * 0.12);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * w * 0.47, a[1] + ny * w * 0.47);
    ctx.lineTo(b[0] + nx * w * 0.47, b[1] + ny * w * 0.47);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return path;
}

function blob(ctx, x, y, r, fill, shade, ink = 4) {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  inkUnder(ctx, p, ink);
  ctx.fillStyle = fill;
  ctx.fill(p);
  if (shade) {
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x - r * 0.45, y + r * 0.4, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return p;
}

// ---------- the puppet ----------

// opts: { look, pose, time, rim, expression, outfit ('normal' | 'underwear'), glow }
export function drawPuppet(ctx, id, opts) {
  const look = LOOKS[id];
  const { pose, time = 0, rim = 'rgba(120, 240, 255, 0.85)', expression = 'fight', outfit = 'normal' } = opts;
  const sk = skeleton(look, pose);
  const lift = opts.grounded === false ? 0 : groundOffset(sk, look);
  ctx.save();
  ctx.scale(look.scale, look.scale);
  ctx.translate(0, lift);
  const C = look.colors;
  const bare = outfit === 'underwear';
  const back = { skin: C.skinShade, pants: C.pantsShade, top: C.topShade };
  const dark = (c) => shadeOf(c, 0.78);

  // Volt's scarf streams behind everything.
  if (id === 'volt' && !bare) drawScarf(ctx, sk, time, C.accent);

  // Back limbs, a shade darker.
  drawLeg(ctx, look, sk.legB, bare, true);
  drawArm(ctx, look, sk.armB, id, bare, true, null);

  drawTorso(ctx, id, look, sk, bare, rim);

  drawLeg(ctx, look, sk.legF, bare, false, rim);
  drawHead(ctx, id, look, sk, expression, time, bare);
  drawArm(ctx, look, sk.armF, id, bare, false, rim);

  if (look.glowFists && !bare && opts.glow !== false) {
    for (const h of [sk.armF.hand]) {
      const g = ctx.createRadialGradient(h[0], h[1], 2, h[0], h[1], look.fist * 2.6);
      g.addColorStop(0, 'rgba(160, 250, 255, 0.55)');
      g.addColorStop(1, 'rgba(94, 242, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(h[0], h[1], look.fist * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  void back;
  void dark;
  return { sk, lift, scale: look.scale };
}

function shadeOf(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function drawLeg(ctx, look, leg, bare, isBack, rim) {
  const C = look.colors;
  const w = look.width;
  const k = isBack ? 0.8 : 1;
  const pants = bare ? C.skin : C.pants;
  const pantsShade = bare ? C.skinShade : C.pantsShade;
  limb(ctx, leg.hip, leg.knee, w.thigh[0], w.thigh[1], isBack ? shadeOf(pants, k) : pants, pantsShade, isBack ? null : rim);
  limb(ctx, leg.knee, leg.ankle, w.shin[0], w.shin[1], isBack ? shadeOf(bare ? C.skin : C.pants, k) : bare ? C.skin : C.pants, pantsShade, isBack ? null : rim);
  // Boot.
  const fa = leg.footAngle + Math.PI / 2;
  const toe = [leg.ankle[0] + Math.sin(fa) * look.foot, leg.ankle[1] + Math.cos(fa) * look.foot];
  limb(ctx, leg.ankle, toe, w.shin[1] + 6, w.shin[1] - 2, isBack ? shadeOf(C.boot, k) : C.boot, C.bootShade, null);
}

function drawArm(ctx, look, arm, id, bare, isBack, rim) {
  const C = look.colors;
  const w = look.width;
  const k = isBack ? 0.8 : 1;
  const sleeve = !bare && C.sleeve ? C.sleeve : C.skin;
  limb(ctx, arm.shoulder, arm.elbow, w.upper[0], w.upper[1], isBack ? shadeOf(sleeve, k) : sleeve, C.skinShade === sleeve ? C.skinShade : shadeOf(sleeve, 0.75), isBack ? null : rim);
  const fore = !bare && C.sleeve ? C.sleeve : C.skin;
  limb(ctx, arm.elbow, arm.hand, w.fore[0], w.fore[1], isBack ? shadeOf(fore, k) : fore, shadeOf(fore, 0.75), isBack ? null : rim);
  if (id === 'brick' && !bare) {
    // Wrist tape.
    const t = [lerp(arm.elbow[0], arm.hand[0], 0.75), lerp(arm.elbow[1], arm.hand[1], 0.75)];
    blob(ctx, t[0], t[1], w.fore[1] * 0.55, isBack ? shadeOf(C.glove, k) : C.glove, null, 3);
  }
  const glove = bare ? C.skin : id === 'volt' ? C.glove : id === 'shade' ? C.glove : C.skin;
  blob(ctx, arm.hand[0], arm.hand[1], look.fist, isBack ? shadeOf(glove, k) : glove, shadeOf(glove, 0.72));
}

function drawTorso(ctx, id, look, sk, bare, rim) {
  const C = look.colors;
  const w = look.width;
  const ang = sk.lean + sk.rot;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // A trapezoid from waist to shoulders, slightly bulged.
  const pt = (u, v) => [sk.hip[0] + u * ca - v * sa, sk.hip[1] + u * sa + v * ca];
  const H = look.torso;
  const sw = w.shoulder / 2;
  const ww = w.waist / 2;
  const a = pt(-ww, 4);
  const b = pt(ww, 4);
  const c = pt(sw, -H + 8);
  const d = pt(-sw * 0.85, -H + 8);
  const torso = new Path2D();
  torso.moveTo(...a);
  torso.lineTo(...b);
  torso.quadraticCurveTo(...pt(sw * 1.15, -H * 0.45), ...c);
  torso.quadraticCurveTo(...pt(0, -H - 10), ...d);
  torso.quadraticCurveTo(...pt(-sw * 1.05, -H * 0.45), ...a);
  torso.closePath();
  inkUnder(ctx, torso, 4.5);
  ctx.fillStyle = bare ? C.skin : C.top;
  ctx.fill(torso);
  ctx.save();
  ctx.clip(torso);
  ctx.fillStyle = bare ? C.skinShade : C.topShade;
  ctx.beginPath();
  ctx.moveTo(...pt(-sw * 1.2, -H));
  ctx.lineTo(...pt(-sw * 0.3, -H));
  ctx.lineTo(...pt(-ww * 0.2, 10));
  ctx.lineTo(...pt(-ww * 1.4, 10));
  ctx.fill();
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(...pt(sw * 0.92, -H + 12));
    ctx.quadraticCurveTo(...pt(sw * 1.02, -H * 0.45), ...pt(ww * 0.92, 0));
    ctx.stroke();
  }
  if (!bare) torsoDetail(ctx, id, look, pt, H, sw, ww);
  else {
    // Underwear with hearts.
    ctx.fillStyle = '#ff5c8a';
    ctx.beginPath();
    ctx.moveTo(...pt(-ww * 1.2, -12));
    ctx.lineTo(...pt(ww * 1.2, -12));
    ctx.lineTo(...pt(ww * 1.2, 14));
    ctx.lineTo(...pt(-ww * 1.2, 14));
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = -1; i <= 1; i++) heart(ctx, ...pt(i * ww * 0.6, 0), 4);
  }
  ctx.restore();
}

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 2, y - s * 0.5, x - s, y - s * 2, x, y - s * 0.6);
  ctx.bezierCurveTo(x + s, y - s * 2, x + s * 2, y - s * 0.5, x, y + s);
  ctx.fill();
}

function torsoDetail(ctx, id, look, pt, H, sw, ww) {
  const C = look.colors;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (id === 'volt') {
    // Lightning emblem and a belt.
    ctx.fillStyle = '#fff36b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    const bolt = [[4, -H + 22], [-10, -H * 0.5], [0, -H * 0.5], [-6, -H * 0.22], [12, -H * 0.58], [2, -H * 0.58]];
    ctx.beginPath();
    bolt.forEach(([u, v], i) => (i ? ctx.lineTo(...pt(u, v)) : ctx.moveTo(...pt(u, v))));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(...pt(-ww * 1.2, -6));
    ctx.lineTo(...pt(ww * 1.2, -6));
    ctx.lineTo(...pt(ww * 1.2, 4));
    ctx.lineTo(...pt(-ww * 1.2, 4));
    ctx.fill();
  } else if (id === 'brick') {
    // Tank top straps and chest hair peeking out.
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.moveTo(...pt(-sw * 0.45, -H));
    ctx.quadraticCurveTo(...pt(0, -H * 0.6), ...pt(sw * 0.5, -H));
    ctx.fill();
    ctx.strokeStyle = C.hair;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(...pt(i * 6, -H + 10));
      ctx.lineTo(...pt(i * 6 + 3, -H + 16));
      ctx.stroke();
    }
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.moveTo(...pt(-ww * 1.3, -8));
    ctx.lineTo(...pt(ww * 1.3, -8));
    ctx.lineTo(...pt(ww * 1.3, 6));
    ctx.lineTo(...pt(-ww * 1.3, 6));
    ctx.fill();
    ctx.fillStyle = C.accent;
    ctx.fillRect(...pt(-6, -9), 12, 14);
  } else if (id === 'shade') {
    // Wrapped chest and a pink sash.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(...pt(-sw, -H + i * 16));
      ctx.lineTo(...pt(sw, -H + i * 16 - 10));
      ctx.stroke();
    }
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.moveTo(...pt(-ww * 1.3, -12));
    ctx.lineTo(...pt(ww * 1.3, -16));
    ctx.lineTo(...pt(ww * 1.3, -2));
    ctx.lineTo(...pt(-ww * 1.3, 2));
    ctx.fill();
  }
}

function drawHead(ctx, id, look, sk, expression, time, bare) {
  const C = look.colors;
  const [hx, hy] = sk.head;
  const r = look.headR;
  const a = sk.headAngle;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a);
  // Neck.
  limb(ctx, [0, r * 0.6], [0, r + look.neck * 0.8], r * 0.8, r * 0.85, C.skin, C.skinShade, null);
  if (id === 'shade' && !bare) {
    // Hood.
    const hood = new Path2D();
    hood.moveTo(-r * 1.15, r * 0.7);
    hood.quadraticCurveTo(-r * 1.4, -r * 1.3, r * 0.2, -r * 1.25);
    hood.quadraticCurveTo(r * 1.3, -r * 1.1, r * 1.1, r * 0.8);
    hood.closePath();
    inkUnder(ctx, hood, 4);
    ctx.fillStyle = C.top;
    ctx.fill(hood);
    ctx.fillStyle = '#120a1a';
    ctx.beginPath();
    ctx.ellipse(r * 0.35, r * 0.05, r * 0.72, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawFace(ctx, id, r, expression, time, look);
    ctx.restore();
    return;
  }
  blob(ctx, 0, 0, r, C.skin, C.skinShade);
  if (id === 'volt') {
    // Spiky hair.
    const hair = new Path2D();
    const spikes = [[-r * 1.1, r * 0.1], [-r * 1.5, -r * 0.6], [-r * 0.7, -r * 0.7], [-r * 0.9, -r * 1.5], [-r * 0.1, -r * 1.0], [r * 0.2, -r * 1.7], [r * 0.6, -r * 0.9], [r * 1.3, -r * 1.2], [r * 1.0, -r * 0.35]];
    hair.moveTo(-r * 0.9, r * 0.2);
    for (const [x, y] of spikes) hair.lineTo(x, y);
    hair.quadraticCurveTo(r * 0.6, -r * 0.4, r * 0.1, -r * 0.35);
    hair.quadraticCurveTo(-r * 0.4, -r * 0.2, -r * 0.6, r * 0.25);
    hair.closePath();
    inkUnder(ctx, hair, 3.5);
    ctx.fillStyle = C.hair;
    ctx.fill(hair);
    ctx.save();
    ctx.clip(hair);
    ctx.fillStyle = C.hairShade;
    ctx.fillRect(-r * 2, -r * 0.6, r * 4, r);
    ctx.restore();
    // Headband.
    ctx.fillStyle = C.accent;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillRect(-r, -r * 0.5, r * 2, r * 0.28);
    ctx.restore();
  } else if (id === 'brick') {
    // Beard and a shiny scalp.
    const beard = new Path2D();
    beard.moveTo(-r * 0.9, -r * 0.05);
    beard.quadraticCurveTo(-r * 0.9, r * 1.35, r * 0.5, r * 1.15);
    beard.quadraticCurveTo(r * 1.2, r * 0.9, r * 1.0, r * 0.1);
    beard.quadraticCurveTo(r * 0.4, r * 0.55, -r * 0.2, r * 0.2);
    beard.closePath();
    inkUnder(ctx, beard, 3.5);
    ctx.fillStyle = C.hair;
    ctx.fill(beard);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.6, r * 0.35, r * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  drawFace(ctx, id, r, expression, time, look);
  ctx.restore();
}

function drawFace(ctx, id, r, expression, time, look) {
  const ex = r * 0.42;
  const ey = -r * 0.05;
  ctx.lineCap = 'round';
  if (id === 'shade') {
    // Only the glowing eyes show under the hood.
    const glow = expression === 'ko' || expression === 'dizzy' ? 0.4 : 1;
    ctx.fillStyle = look.eyes;
    ctx.shadowColor = look.eyes;
    ctx.shadowBlur = 12 * glow;
    if (expression === 'ko') {
      ctx.strokeStyle = look.eyes;
      ctx.lineWidth = 3;
      for (const x of [ex - 6, ex + 10]) {
        ctx.beginPath();
        ctx.moveTo(x - 4, ey - 4);
        ctx.lineTo(x + 4, ey + 4);
        ctx.moveTo(x + 4, ey - 4);
        ctx.lineTo(x - 4, ey + 4);
        ctx.stroke();
      }
    } else {
      for (const x of [ex - 6, ex + 10]) {
        ctx.beginPath();
        ctx.ellipse(x, ey, 5, expression === 'hit' ? 1.5 : 3, -0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    return;
  }
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  if (expression === 'ko') {
    ctx.lineWidth = 3;
    for (const x of [ex - 2, ex + 12]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, ey - 4);
      ctx.lineTo(x + 4, ey + 4);
      ctx.moveTo(x + 4, ey - 4);
      ctx.lineTo(x - 4, ey + 4);
      ctx.stroke();
    }
  } else if (expression === 'dizzy') {
    ctx.lineWidth = 2;
    for (const x of [ex - 2, ex + 12]) {
      ctx.beginPath();
      for (let t = 0; t < 12; t++) {
        const ang = t * 0.9 + time * 8;
        const rr = t * 0.45;
        const px = x + Math.cos(ang) * rr;
        const py = ey + Math.sin(ang) * rr;
        t ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  } else if (expression === 'hit') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex - 6, ey - 4);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - 6, ey + 4);
    ctx.moveTo(ex + 16, ey - 4);
    ctx.lineTo(ex + 10, ey);
    ctx.lineTo(ex + 16, ey + 4);
    ctx.stroke();
  } else {
    // Determined eyes and a heavy brow.
    ctx.fillStyle = '#ffffff';
    for (const x of [ex - 2, ex + 12]) {
      ctx.beginPath();
      ctx.ellipse(x, ey, 4.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    for (const x of [ex - 1, ex + 13]) {
      ctx.beginPath();
      ctx.arc(x + 1, ey + 0.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(ex - 8, ey - 9);
    ctx.lineTo(ex + 4, ey - 5);
    ctx.moveTo(ex + 8, ey - 5);
    ctx.lineTo(ex + 18, ey - 9);
    ctx.stroke();
  }
  // Mouth.
  ctx.lineWidth = 3;
  ctx.beginPath();
  const mx = r * 0.5;
  const my = r * 0.48;
  if (expression === 'win') {
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(mx - 9, my - 3);
    ctx.quadraticCurveTo(mx + 2, my + 9, mx + 12, my - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'hit' || expression === 'ko' || expression === 'dizzy' || expression === 'shout') {
    ctx.fillStyle = '#4a1020';
    ctx.ellipse(mx + 2, my, 6, expression === 'shout' ? 7 : 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(mx - 6, my);
    ctx.lineTo(mx + 8, my - 1);
    ctx.stroke();
  }
}

function drawScarf(ctx, sk, time, color) {
  const n = sk.neck;
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push([n[0] - t * 70 - Math.abs(Math.sin(time * 3)) * 6 * t, n[1] + 6 + Math.sin(time * 9 - i * 1.1) * 7 * t + t * 10]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 16;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.restore();
}
