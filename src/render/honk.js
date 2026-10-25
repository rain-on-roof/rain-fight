// The HONK. The moment the game exists for, staged like a fighting-game super
// move: a two-tone manga impact frame while time is frozen, then a cut-in band
// slams across the screen with a screaming goose head and HONK!!! in letters
// that land one by one.
import { INK, makeCanvas, clamp01, easeOutBack, lerp } from './paint.js';
import { createGooseAnimator, drawGoose } from './goose.js';
import { DISPLAY_FONT } from './fx.js';

export const CUT_IN_LENGTH = 1.35;

let silhouette = null;

// Draws `paint` (the goose and hands, in world space) as a flat silhouette
// over a flat ground, alternating black-on-white and white-on-black.
export function drawImpactFrame(ctx, fw, fh, { invert, focus, paint }) {
  if (!silhouette || silhouette.width !== fw || silhouette.height !== fh) silhouette = makeCanvas(fw, fh);
  const sctx = silhouette.getContext('2d');
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, fw, fh);
  paint(sctx);
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = invert ? '#ffffff' : INK;
  sctx.fillRect(0, 0, fw, fh);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = invert ? INK : '#fffdf6';
  ctx.fillRect(0, 0, fw, fh);
  focusLines(ctx, fw, fh, focus, invert ? '#ffffff' : INK, 0);
  ctx.drawImage(silhouette, 0, 0);
  ctx.restore();
}

// Manga focus lines: thin wedges from the frame edge toward a point.
function focusLines(ctx, fw, fh, focus, color, seed) {
  const r = Math.hypot(fw, fh);
  ctx.fillStyle = color;
  const n = 90;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.sin(i * 12.9 + seed) * 0.03;
    const inner = r * (0.16 + ((i * 37) % 11) / 60);
    const spread = 0.008 + ((i * 53) % 7) / 600;
    ctx.beginPath();
    ctx.moveTo(focus.x + Math.cos(a) * inner, focus.y + Math.sin(a) * inner);
    ctx.lineTo(focus.x + Math.cos(a - spread) * r, focus.y + Math.sin(a - spread) * r);
    ctx.lineTo(focus.x + Math.cos(a + spread) * r, focus.y + Math.sin(a + spread) * r);
    ctx.closePath();
    ctx.fill();
  }
}

const screamer = createGooseAnimator();

// t: seconds since the cut-in started. fw/fh: frame size in pixels.
// `head(ctx, x, y, size)` may draw the screamer instead of the code-drawn goose.
export function drawCutIn(ctx, fw, fh, t, { golden = false, text = 'HONK!!!', head = null } = {}) {
  if (t < 0 || t > CUT_IN_LENGTH) return;
  const portrait = fh > fw;
  const bandH = portrait ? fh * 0.3 : fh * 0.42;
  const angle = -0.11;
  const enter = easeOutBack(clamp01(t / 0.12));
  const exit = clamp01((t - (CUT_IN_LENGTH - 0.22)) / 0.22);
  const shake = (1 - clamp01(t / 0.9)) * bandH * 0.03;
  const sx = Math.sin(t * 83) * shake;
  const sy = Math.cos(t * 71) * shake;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Darken the world behind the band.
  ctx.fillStyle = `rgba(20, 10, 25, ${0.55 * (1 - exit)})`;
  ctx.fillRect(0, 0, fw, fh);

  ctx.translate(fw / 2 + sx + exit * fw * 1.3, fh * (portrait ? 0.4 : 0.46) + sy);
  ctx.rotate(angle);
  const half = (bandH / 2) * enter;
  const len = Math.hypot(fw, fh) * 1.2;

  // Band edges.
  ctx.fillStyle = INK;
  ctx.fillRect(-len / 2, -half - bandH * 0.06, len, half * 2 + bandH * 0.12);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-len / 2, -half - bandH * 0.035, len, half * 2 + bandH * 0.07);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-len / 2, -half, len, half * 2);
  ctx.clip();

  // Burst background: rotating rays in hot colours.
  const rays = 28;
  const spin = t * 1.6;
  const burstX = portrait ? -fw * 0.12 : -fw * 0.18;
  ctx.fillStyle = golden ? '#ffb31a' : '#ff4b2b';
  ctx.fillRect(-len / 2, -half, len, half * 2);
  ctx.fillStyle = golden ? '#ffe066' : '#ffcf3a';
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2 + spin;
    const a1 = ((i + 1) / rays) * Math.PI * 2 + spin;
    ctx.beginPath();
    ctx.moveTo(burstX, 0);
    ctx.lineTo(burstX + Math.cos(a0) * len, Math.sin(a0) * len);
    ctx.lineTo(burstX + Math.cos(a1) * len, Math.sin(a1) * len);
    ctx.closePath();
    ctx.fill();
  }
  // Speed streaks racing left.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 22; i++) {
    const y = ((i * 97) % 200) / 100 - 1;
    const w = bandH * (0.4 + ((i * 31) % 10) / 8);
    const x = len / 2 - ((t * fw * 3.2 + i * 211) % (len + w));
    ctx.fillRect(x, y * half * 0.95, w, Math.max(2, bandH * 0.012));
  }

  // The screaming head slides in from the left and never stops shaking.
  const slide = easeOutBack(clamp01((t - 0.02) / 0.2));
  const headX = lerp(-fw * 0.9, portrait ? -fw * 0.2 : -fw * 0.27, slide);
  // On a phone the head rides the top of the band and the word the bottom.
  const headY = portrait ? -bandH * 0.16 : 0;
  const textY = portrait ? bandH * 0.25 : 0;
  const scream = 0.86 + Math.sin(t * 70) * 0.14;
  Object.assign(screamer.pose, {
    hx: 210, hy: -210, mx: 120, my: -200, ha: -0.12 + Math.sin(t * 40) * 0.04,
    beak: scream, wing: 1, ruffle: 1, lower: 0, blush: 0, closed: 0,
  });
  screamer.mood = 'strike';
  screamer.moodTime = 1;
  screamer.twitch = 0;
  screamer.blink = 0;
  const s = (bandH * 0.62) / 70;
  if (head) head(ctx, headX - bandH * 0.25 + Math.sin(t * 90) * bandH * 0.012, headY + bandH * 0.5, bandH * 1.0 * scream ** 0.3);
  else drawGoose(ctx, screamer, {
    x: headX - 210 * s + Math.sin(t * 90) * bandH * 0.012,
    y: 186 * s + bandH * 0.08 + headY,
    scale: s,
    time: t,
    anger: 1,
    golden,
  });
  ctx.restore();

  // HONK!!! letters land one at a time with a chromatic double.
  // Size the word to the room it has: right of the head on a wide screen,
  // the full width on a phone.
  const room = portrait ? fw * 0.86 : fw * 0.5;
  ctx.font = `100px ${DISPLAY_FONT}`;
  const unitW = [...text].reduce((n, ch) => n + ctx.measureText(ch).width * 1.02, 0) / 100;
  const size = Math.min(bandH * (portrait ? 0.4 : 0.5), room / (unitW * 1.12));
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  const letters = [...text];
  const widths = letters.map((ch) => ctx.measureText(ch).width * 1.02);
  const total = widths.reduce((a, b) => a + b, 0);
  let x = portrait ? -total / 2 : fw * 0.44 - total * 1.08;
  for (let i = 0; i < letters.length; i++) {
    const lt = t - 0.14 - i * 0.055;
    if (lt > 0) {
      const pop = easeOutBack(clamp01(lt / 0.13));
      const wob = Math.sin(t * 50 + i * 2) * 0.08;
      const lift = Math.sin(t * 22 + i) * size * 0.04;
      ctx.save();
      ctx.translate(x + widths[i] / 2, textY + lift - (1 - pop) * size * 0.6);
      ctx.rotate(wob + (i % 2 ? 0.06 : -0.06));
      ctx.scale(pop * 1.12, pop * 1.12);
      const off = size * 0.045;
      ctx.lineWidth = size * 0.2;
      ctx.strokeStyle = INK;
      ctx.strokeText(letters[i], -widths[i] / 2, size * 0.06);
      ctx.fillStyle = INK;
      ctx.fillText(letters[i], -widths[i] / 2, size * 0.06);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#21d4fd';
      ctx.fillText(letters[i], -widths[i] / 2 - off, 0);
      ctx.fillStyle = '#ff2e63';
      ctx.fillText(letters[i], -widths[i] / 2 + off, 0);
      ctx.globalAlpha = 1;
      ctx.lineWidth = size * 0.07;
      ctx.strokeText(letters[i], -widths[i] / 2, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(letters[i], -widths[i] / 2, 0);
      ctx.restore();
    }
    x += widths[i];
  }
  ctx.restore();

  // A white slam flash on entry.
  if (t < 0.09) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.09})`;
    ctx.fillRect(0, 0, fw, fh);
    ctx.restore();
  }
}

