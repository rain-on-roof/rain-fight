// Juice: crumbs, feathers, sparkles, pop-up text, screen shake and flashes.
import { INK, inkUnder, easeOutBack, clamp01 } from './paint.js';
import { star } from './goose.js';

export const DISPLAY_FONT = '"RF Display", "Arial Black", "Arial Rounded MT Bold", "Segoe UI Black", Impact, system-ui, sans-serif';

export function createFx() {
  return { parts: [], shakeAmount: 0, shakeTime: 0, flash: 0, punch: 0 };
}

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

export function burst(fx, kind, x, y, n = 8) {
  for (let i = 0; i < n; i++) {
    if (kind === 'crumbs') {
      fx.parts.push({ kind, x, y, vx: rnd(-160, 160), vy: rnd(-420, -160), rot: rnd(0, 6), vr: rnd(-12, 12), size: rnd(4, 9), life: rnd(0.6, 1), age: 0, color: ['#f6d9a0', '#d99a4e', '#7cc84a', '#ffc93c'][i % 4] });
    } else if (kind === 'feathers') {
      fx.parts.push({ kind, x: x + rnd(-40, 40), y: y + rnd(-40, 40), vx: rnd(-260, 260), vy: rnd(-380, -80), rot: rnd(0, 6), vr: rnd(-4, 4), size: rnd(12, 22), life: rnd(1.6, 2.6), age: 0, phase: rnd(0, 6) });
    } else if (kind === 'sparkles') {
      fx.parts.push({ kind, x: x + rnd(-60, 60), y: y + rnd(-60, 60), vx: rnd(-40, 40), vy: rnd(-90, -20), size: rnd(4, 9), life: rnd(0.5, 1), age: 0 });
    }
  }
}

export function popText(fx, text, x, y, { size = 34, color = '#ffffff', life = 0.8, rise = 70, rot = 0, kind = 'text' } = {}) {
  fx.parts.push({ kind, text, x, y, size, color, life, age: 0, rise, rot });
}

export function shake(fx, amount) {
  fx.shakeAmount = Math.max(fx.shakeAmount, amount);
}

export function flash(fx, amount) {
  fx.flash = Math.max(fx.flash, amount);
}

export function updateFx(fx, dt) {
  fx.shakeTime += dt;
  fx.shakeAmount = Math.max(0, fx.shakeAmount - dt * fx.shakeAmount * 6 - dt * 2);
  fx.flash = Math.max(0, fx.flash - dt * 3.5);
  for (const p of fx.parts) {
    p.age += dt;
    if (p.kind === 'crumbs') {
      p.vy += 1100 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    } else if (p.kind === 'feathers') {
      p.vx *= 1 - dt * 2.2;
      p.vy = p.vy * (1 - dt * 2.5) + 120 * dt;
      p.x += (p.vx + Math.sin(p.age * 4 + p.phase) * 40) * dt;
      p.y += p.vy * dt;
      p.rot = Math.sin(p.age * 3 + p.phase) * 0.9;
    } else if (p.kind === 'sparkles') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  fx.parts = fx.parts.filter((p) => p.age < p.life);
}

export function shakeOffset(fx) {
  const a = fx.shakeAmount;
  if (a <= 0.01) return { x: 0, y: 0 };
  return { x: Math.sin(fx.shakeTime * 71) * a, y: Math.cos(fx.shakeTime * 53) * a };
}

export function drawFx(ctx, fx) {
  for (const p of fx.parts) {
    const k = p.age / p.life;
    if (p.kind === 'crumbs') {
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const crumb = new Path2D();
      crumb.roundRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8, 2);
      inkUnder(ctx, crumb, 1.5);
      ctx.fillStyle = p.color;
      ctx.fill(crumb);
      ctx.restore();
    } else if (p.kind === 'feathers') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      const f = new Path2D();
      f.moveTo(0, -s);
      f.quadraticCurveTo(s * 0.6, -s * 0.2, 0, s);
      f.quadraticCurveTo(-s * 0.6, -s * 0.2, 0, -s);
      inkUnder(ctx, f, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill(f);
      ctx.strokeStyle = '#cfc8bf';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, s * 1.2);
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'sparkles') {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      star(ctx, p.x, p.y, p.size * (1 - k * 0.5));
      ctx.restore();
    } else if (p.kind === 'text' || p.kind === 'honk') {
      drawPopText(ctx, p, k);
    }
  }
}

function drawPopText(ctx, p, k) {
  const honk = p.kind === 'honk';
  const pop = honk ? easeOutBack(clamp01(p.age / 0.22)) : easeOutBack(clamp01(p.age / 0.15));
  ctx.save();
  ctx.globalAlpha = honk ? Math.min(1, (1 - k) * 4) : 1 - clamp01((k - 0.6) / 0.4);
  ctx.translate(p.x, p.y - p.rise * (honk ? 0 : k));
  ctx.rotate(p.rot + (honk ? Math.sin(p.age * 30) * 0.03 * (1 - k) : 0));
  ctx.scale(pop, pop);
  ctx.font = `900 ${p.size}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (honk) {
    ctx.fillStyle = '#e8352b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = p.size * 0.22;
    ctx.strokeText(p.text, 6, 8);
    ctx.fillText(p.text, 6, 8);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = p.size * (honk ? 0.2 : 0.22);
  ctx.strokeText(p.text, 0, 0);
  ctx.fillStyle = p.color;
  ctx.fillText(p.text, 0, 0);
  ctx.restore();
}
