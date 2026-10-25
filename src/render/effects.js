// Fight effects in stage space: projectiles, hit sparks, shockwave rings,
// teleport smoke, dizzy stars and the goose's HONK rings.
import { INK } from './paint.js';
import { GROUND } from './stage.js';
import { star } from './goose.js';

export function createEffects() {
  return { parts: [] };
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function spark(fx, x, y, { blocked = false, heavy = false, color } = {}) {
  const c = color || (blocked ? '#9fe8ff' : heavy ? '#ffd23f' : '#ffffff');
  fx.parts.push({ kind: 'flash', x, y, age: 0, life: heavy ? 0.16 : 0.1, size: heavy ? 90 : 60, color: c });
  fx.parts.push({ kind: 'ring', x, y, age: 0, life: 0.3, size: heavy ? 120 : 70, color: c });
  const n = heavy ? 16 : 9;
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const sp = rnd(400, heavy ? 1300 : 900);
    fx.parts.push({ kind: 'streak', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rnd(0.12, 0.28), color: c });
  }
}

export function smoke(fx, x, y, color = 'rgba(120, 60, 180, 0.7)') {
  for (let i = 0; i < 14; i++) {
    fx.parts.push({ kind: 'puff', x: x + rnd(-40, 40), y: y - rnd(20, 220), vx: rnd(-90, 90), vy: rnd(-120, -20), age: 0, life: rnd(0.4, 0.8), size: rnd(18, 40), color });
  }
}

export function dust(fx, x, y, n = 10) {
  for (let i = 0; i < n; i++) {
    fx.parts.push({ kind: 'puff', x: x + rnd(-30, 30), y, vx: rnd(-260, 260), vy: rnd(-160, -30), age: 0, life: rnd(0.3, 0.6), size: rnd(10, 26), color: 'rgba(150, 140, 210, 0.55)' });
  }
}

export function debris(fx, x, y, n = 14, colors = ['#4a4178', '#6a5fa2', '#2c2550']) {
  for (let i = 0; i < n; i++) {
    fx.parts.push({ kind: 'chunk', x, y, vx: rnd(-500, 500), vy: rnd(-900, -300), age: 0, life: rnd(0.6, 1.1), size: rnd(6, 16), rot: rnd(0, 6), vr: rnd(-10, 10), color: colors[i % colors.length] });
  }
}

export function clothes(fx, x, y, colors) {
  for (let i = 0; i < 12; i++) {
    fx.parts.push({ kind: 'cloth', x: x + rnd(-30, 30), y: y - rnd(40, 200), vx: rnd(-700, 700), vy: rnd(-1200, -500), age: 0, life: rnd(1.2, 2), size: rnd(18, 34), rot: rnd(0, 6), vr: rnd(-14, 14), color: colors[i % colors.length] });
  }
}

export function updateEffects(fx, dt) {
  for (const p of fx.parts) {
    p.age += dt;
    if (p.kind === 'streak') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    } else if (p.kind === 'puff') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
    } else if (p.kind === 'chunk' || p.kind === 'cloth') {
      p.vy += (p.kind === 'cloth' ? 1400 : 2600) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === 'cloth') p.vx *= 0.985;
    }
  }
  fx.parts = fx.parts.filter((p) => p.age < p.life);
}

export function drawEffects(ctx, fx) {
  for (const p of fx.parts) {
    const k = p.age / p.life;
    ctx.save();
    if (p.kind === 'flash') {
      ctx.globalAlpha = 1 - k;
      star(ctx, p.x, p.y, p.size * 0.35 * (1 + k), p.color);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.25 * (1 - k), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.3 + k), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'streak') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else if (p.kind === 'puff') {
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'chunk' || p.kind === 'cloth') {
      ctx.globalAlpha = Math.min(1, (1 - k) * 3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (p.kind === 'cloth') {
        ctx.moveTo(-p.size, -p.size * 0.5);
        ctx.lineTo(p.size * 0.8, -p.size * 0.7);
        ctx.lineTo(p.size, p.size * 0.4);
        ctx.lineTo(-p.size * 0.6, p.size * 0.6);
      } else ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawProjectiles(ctx, projectiles, time) {
  for (const p of projectiles) {
    const dir = Math.sign(p.vx);
    const y = GROUND - p.y - p.h / 2;
    if (p.kind === 'bolt') {
      // A crackling ball of lightning with a tail.
      ctx.save();
      ctx.translate(p.x, y);
      ctx.scale(dir, 1);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
      g.addColorStop(0, 'rgba(220, 255, 255, 0.95)');
      g.addColorStop(0.35, 'rgba(94, 242, 255, 0.6)');
      g.addColorStop(1, 'rgba(94, 242, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#5ef2ff';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.moveTo(10, 0);
        let x = 10;
        let yy = 0;
        for (let i = 0; i < 7; i++) {
          x -= 18;
          yy = Math.sin(time * 70 + i * 2.1 + j * 3) * 14;
          ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 14 + Math.sin(time * 50) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'wave') {
      // A shockwave tearing along the roof.
      ctx.save();
      ctx.translate(p.x, GROUND);
      ctx.scale(dir, 1);
      for (let i = 0; i < 4; i++) {
        const h = 50 + i * 16 + Math.sin(time * 30 + i) * 8;
        ctx.globalAlpha = 0.9 - i * 0.2;
        ctx.fillStyle = i % 2 ? '#ff9a1f' : '#ffd23f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-60 - i * 22, 0);
        ctx.quadraticCurveTo(-20 - i * 14, -h, 20 - i * 8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// Concentric sound rings out of the goose's beak during its HONK.
export function drawHonkRings(ctx, f, time) {
  if (!f.move || f.move.id !== 'special' || f.id !== 'goose' || f.moveFrame < f.move.startup) return;
  const t = (f.moveFrame - f.move.startup) / (f.move.active + 6);
  ctx.save();
  ctx.translate(f.x + f.facing * 120, GROUND - 190);
  ctx.scale(f.facing, 1);
  for (let i = 0; i < 4; i++) {
    const k = (t * 1.6 + i * 0.22) % 1;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = i % 2 ? '#ffffff' : '#ffd23f';
    ctx.lineWidth = 10 * (1 - k) + 2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + k * 200, -0.7, 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDizzy(ctx, f, time) {
  if (f.state !== 'dizzy') return;
  const hx = f.x;
  const hy = GROUND - 290;
  for (let i = 0; i < 3; i++) {
    const a = time * 4 + (i * Math.PI * 2) / 3;
    const x = hx + Math.cos(a) * 46;
    const y = hy + Math.sin(a) * 12;
    star(ctx, x, y, 7, '#ffe14d');
  }
}
