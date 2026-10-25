// The fight HUD and the announcer, in screen space.
import { INK, clamp01, easeOutBack } from './paint.js';
import { DISPLAY_FONT } from './fx.js';

export function createHud() {
  return { shown: [1, 1], trail: [1, 1], banners: [], combo: [null, null] };
}

export function banner(hud, text, { color = '#ffffff', accent = '#ff3d6e', life = 1.4, size = 1, sub = null } = {}) {
  hud.banners = hud.banners.filter((b) => b.age > b.life * 0.6);
  hud.banners.push({ text, color, accent, life, size, sub, age: 0 });
}

export function showCombo(hud, side, n) {
  hud.combo[side] = { n, age: 0 };
}

export function updateHud(hud, match, dt) {
  match.fighters.forEach((f, i) => {
    const target = f.hp / f.maxHp;
    hud.shown[i] += (target - hud.shown[i]) * Math.min(1, dt * 18);
    if (hud.trail[i] > target) hud.trail[i] = Math.max(target, hud.trail[i] - dt * 0.35);
    else hud.trail[i] = target;
  });
  for (const b of hud.banners) b.age += dt;
  hud.banners = hud.banners.filter((b) => b.age < b.life);
  for (let i = 0; i < 2; i++) {
    const c = hud.combo[i];
    if (c) {
      c.age += dt;
      if (c.age > 1.4) hud.combo[i] = null;
    }
  }
}

function slanted(ctx, x, y, w, h, slant) {
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

export function drawHud(ctx, w, h, match, hud, { portraits = {}, time = 0, top = 0 } = {}) {
  const u = w < h ? w / 1000 : Math.min(w / 1600, h / 900) * 1.25;
  const barW = Math.min(w * 0.37, 620 * u);
  const barH = 30 * u;
  const y = top + 30 * u;
  const gap = 70 * u;
  match.fighters.forEach((f, i) => {
    const left = i === 0;
    const x0 = left ? w / 2 - gap - barW : w / 2 + gap;
    ctx.save();
    // Frame.
    ctx.translate(x0, y);
    if (!left) {
      ctx.translate(barW, 0);
      ctx.scale(-1, 1);
    }
    slanted(ctx, -6 * u, -6 * u, barW + 12 * u, barH + 12 * u, 14 * u);
    ctx.fillStyle = INK;
    ctx.fill();
    slanted(ctx, 0, 0, barW, barH, 10 * u);
    ctx.fillStyle = '#3a1020';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Damage trail, then health. Health drains toward the centre.
    const trailW = barW * hud.trail[i];
    const hpW = barW * hud.shown[i];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(barW - trailW, 0, trailW, barH);
    const low = hud.shown[i] < 0.25;
    const g = ctx.createLinearGradient(0, 0, 0, barH);
    g.addColorStop(0, low && Math.sin(time * 14) > 0 ? '#ff6b6b' : '#ffe96b');
    g.addColorStop(1, low ? '#d61f3b' : '#ff9a1f');
    ctx.fillStyle = g;
    ctx.fillRect(barW - hpW, 0, hpW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(barW - hpW, 3 * u, hpW, barH * 0.22);
    ctx.restore();
    ctx.restore();

    // Portrait medallion at the outer end.
    const px = left ? x0 - 18 * u : x0 + barW + 18 * u;
    const py = y + barH / 2 + 6 * u;
    const pr = 40 * u;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr + 5 * u, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1240';
    ctx.fill();
    const img = portraits[f.id];
    if (img && img.complete && img.naturalWidth) {
      ctx.clip();
      ctx.save();
      if (!left) {
        ctx.translate(px * 2, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, px - pr * 1.25, py - pr * 1.1, pr * 2.5, pr * 2.5);
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = left ? '#4ff3ff' : '#ff4fd8';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(px, py, pr + 2 * u, 0, Math.PI * 2);
    ctx.stroke();

    // Name and round wins.
    ctx.font = `${27 * u}px ${DISPLAY_FONT}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = left ? 'left' : 'right';
    ctx.lineJoin = 'round';
    const nx = left ? x0 + 40 * u : x0 + barW - 40 * u;
    const ny = y + barH + 12 * u;
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = INK;
    ctx.strokeText(f.def.name, nx, ny);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(f.def.name, nx, ny);
    for (let k = 0; k < 2; k++) {
      const wx = left ? x0 + barW - 20 * u - k * 30 * u : x0 + 20 * u + k * 30 * u;
      const won = f.wins > k;
      ctx.beginPath();
      ctx.arc(wx, ny + 12 * u, 10 * u, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(wx, ny + 12 * u, 7 * u, 0, Math.PI * 2);
      ctx.fillStyle = won ? '#ffd23f' : '#3a2a5a';
      ctx.fill();
    }
  });

  // Timer.
  const secs = Math.max(0, Math.ceil(match.timer / 60));
  ctx.save();
  ctx.translate(w / 2, y + barH / 2);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * 46 * u, Math.sin(a) * 46 * u);
  }
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.font = `${50 * u}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = secs <= 10 && Math.sin(time * 10) > 0 ? '#ff4f6a' : '#ffffff';
  ctx.fillText(String(secs), 0, 2 * u);
  ctx.restore();

  // Combo counters on the attacker's side.
  for (let i = 0; i < 2; i++) {
    const c = hud.combo[i];
    if (!c || c.n < 2) continue;
    const side = 1 - i;
    const pop = easeOutBack(clamp01(c.age / 0.15));
    ctx.save();
    ctx.globalAlpha = 1 - clamp01((c.age - 1) / 0.4);
    ctx.translate(side === 0 ? w * 0.12 : w * 0.88, h * 0.32);
    ctx.rotate(side === 0 ? -0.12 : 0.12);
    ctx.scale(pop, pop);
    bigText(ctx, `${c.n} HITS`, 0, 0, 54 * u, '#ffd23f', '#ff3d6e');
    ctx.restore();
  }

  // Announcer banners.
  for (const b of hud.banners) {
    const pop = easeOutBack(clamp01(b.age / 0.2));
    const out = clamp01((b.age - (b.life - 0.25)) / 0.25);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.translate(w / 2, h * 0.3);
    ctx.scale(pop * (1 + out * 0.4), pop * (1 + out * 0.4));
    ctx.rotate(-0.05);
    const size = Math.min(150 * u * b.size, (w * 0.9) / Math.max(4, b.text.length * 0.72));
    bigText(ctx, b.text, Math.sin(b.age * 40) * 3 * u * (1 - clamp01(b.age * 2)), 0, size, b.color, b.accent);
    if (b.sub) bigText(ctx, b.sub, 0, size * 0.8, size * 0.32, '#ffffff', b.accent);
    ctx.restore();
  }
}

export function bigText(ctx, text, x, y, size, color, accent) {
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y + size * 0.07);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y + size * 0.07);
  const off = size * 0.04;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#21d4fd';
  ctx.fillText(text, x - off, y);
  ctx.fillStyle = accent;
  ctx.fillText(text, x + off, y);
  ctx.lineWidth = size * 0.06;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
