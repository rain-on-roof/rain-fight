// The rooftop at night, in the rain. Stage space: fighters live on x 0..1600
// with their feet on y = GROUND; the painted world runs well past both edges so
// a wide screen or a moving camera never finds its end. Static layers are
// painted once; rain, neon flicker, steam, splashes and lightning are live.
import { mulberry32, range } from '../rng.js';
import { INK, inkUnder, makeCanvas, lerp } from './paint.js';

export const GROUND = 770;
export const FLOOR_TOP = 640;
export const STAGE_H = 900;
const X0 = -1000;
const X1 = 2600;
const LW = X1 - X0;

export function createStage(k) {
  const rand = mulberry32(42);
  const far = layer(k, (c) => paintFar(c, mulberry32(7)));
  const mid = layer(k, (c) => paintMid(c, mulberry32(8)));
  const signs = layer(k, (c) => paintSigns(c));
  const roof = layer(k, (c) => paintRoof(c, mulberry32(9)));
  return {
    k,
    far,
    mid,
    signs,
    roof,
    drops: Array.from({ length: 260 }, () => ({ x: rand(), y: rand(), len: range(rand, 0.6, 1.4), z: rand() })),
    splashes: [],
    lightning: { next: 4, t: -1, bolt: null },
    rand,
  };
}

function layer(k, paint) {
  const c = makeCanvas(LW * k, STAGE_H * k);
  const ctx = c.getContext('2d');
  ctx.scale(k, k);
  ctx.translate(-X0, 0);
  paint(ctx);
  return c;
}

/* ---------- sky (screen space) ---------- */

export function drawSky(ctx, w, h, t, flash) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#07061a');
  g.addColorStop(0.45, '#1b1047');
  g.addColorStop(0.75, '#3d1660');
  g.addColorStop(1, '#5b1d63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Stars, few: it is raining.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 7919) % 1000) / 1000;
    const y = ((i * 104729) % 1000) / 1000;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i));
    ctx.globalAlpha = tw * 0.6;
    ctx.fillRect(x * w, y * h * 0.4, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  // Moon behind drifting cloud.
  const mx = w * 0.72;
  const my = h * 0.17;
  const mr = Math.min(w, h) * 0.075;
  const glow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5);
  glow.addColorStop(0, 'rgba(255, 210, 255, 0.35)');
  glow.addColorStop(1, 'rgba(255, 150, 230, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
  ctx.fillStyle = '#ffe9f6';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 180, 220, 0.5)';
  for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.3, 0.12], [0.1, -0.4, 0.08]]) {
    ctx.beginPath();
    ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Clouds: dark bands catching the city glow underneath.
  for (let i = 0; i < 6; i++) {
    const y = h * (0.08 + i * 0.07);
    const x = ((t * (6 + i * 3) + i * 300) % (w + 600)) - 300;
    ctx.fillStyle = `rgba(${40 + i * 8}, ${20 + i * 4}, ${70 + i * 6}, ${0.55 + i * 0.05})`;
    cloud(ctx, x, y, w * 0.32, h * 0.05);
    cloud(ctx, x - w * 0.7, y + h * 0.02, w * 0.28, h * 0.04);
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(200, 210, 255, ${flash * 0.55})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function cloud(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, h, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.25, y - h * 0.5, w * 0.3, h * 0.9, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.2, y - h * 0.3, w * 0.25, h * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- far skyline ---------- */

function building(ctx, rand, x, w, top, base, fill, windowColors, density) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, top, w, base - top);
  for (let wy = top + 10; wy < base - 8; wy += 14) {
    for (let wx = x + 6; wx < x + w - 8; wx += 11) {
      if (rand() < density) {
        ctx.fillStyle = windowColors[Math.floor(rand() * windowColors.length)];
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
  }
}

function paintFar(ctx, rand) {
  const base = FLOOR_TOP + 10;
  let x = X0;
  while (x < X1) {
    const w = range(rand, 50, 120);
    const top = range(rand, 260, 520);
    building(ctx, rand, x, w, top, base, '#1d1a4a', ['rgba(255, 200, 120, 0.55)', 'rgba(120, 220, 255, 0.45)', 'rgba(255, 120, 200, 0.4)'], 0.16);
    if (rand() < 0.25) {
      ctx.fillStyle = '#1d1a4a';
      ctx.fillRect(x + w / 2 - 2, top - 50, 4, 50);
    }
    x += w + range(rand, -10, 20);
  }
  // Glow of the city in the haze.
  const g = ctx.createLinearGradient(0, 380, 0, base);
  g.addColorStop(0, 'rgba(120, 40, 140, 0)');
  g.addColorStop(1, 'rgba(160, 50, 150, 0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(X0, 380, LW, base - 380);
}

/* ---------- mid buildings ---------- */

function paintMid(ctx, rand) {
  const base = FLOOR_TOP + 20;
  const spots = [-900, -700, -480, -260, 0, 240, 470, 760, 1040, 1300, 1560, 1800, 2050, 2300];
  for (const sx of spots) {
    const w = range(rand, 150, 230);
    const top = range(rand, 140, 380);
    const x = sx + range(rand, -30, 30);
    building(ctx, rand, x, w, top, base, '#151236', ['rgba(255, 210, 140, 0.8)', 'rgba(140, 230, 255, 0.7)', 'rgba(255, 140, 210, 0.6)'], 0.22);
    // Roof details: tanks and antennas in silhouette.
    ctx.fillStyle = '#151236';
    if (rand() < 0.5) ctx.fillRect(x + w * 0.2, top - 26, 36, 26);
    if (rand() < 0.5) ctx.fillRect(x + w * 0.7, top - 70, 5, 70);
    // Edge light on the corner facing the moon.
    ctx.fillStyle = 'rgba(255, 170, 230, 0.12)';
    ctx.fillRect(x + w - 6, top, 6, base - top);
  }
}

/* ---------- neon ---------- */

function neonText(ctx, text, x, y, size, color, glow) {
  ctx.save();
  ctx.font = `900 ${size}px "Arial Black", "Segoe UI Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = glow;
  ctx.shadowBlur = size * 0.6;
  ctx.lineWidth = size * 0.1;
  ctx.strokeStyle = color;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = size * 0.25;
  ctx.strokeText(text, x, y);
  ctx.lineWidth = size * 0.04;
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(text, x, y);
  ctx.restore();
}

function paintSigns(ctx) {
  // RAIN ON ROOF: the studio sign on the building behind the fight.
  const sx = 1180;
  ctx.fillStyle = 'rgba(10, 6, 30, 0.85)';
  ctx.fillRect(sx - 190, 228, 380, 150);
  ctx.strokeStyle = '#2a2252';
  ctx.lineWidth = 4;
  ctx.strokeRect(sx - 190, 228, 380, 150);
  neonText(ctx, 'RAIN', sx, 268, 46, '#ff4fd8', '#ff2fc8');
  neonText(ctx, 'ON ROOF', sx, 330, 46, '#4ff3ff', '#2fd8ff');
  // Little rain drops drawn in neon.
  ctx.save();
  ctx.strokeStyle = '#4ff3ff';
  ctx.shadowColor = '#4ff3ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 4;
  for (const dx of [-150, 150]) {
    ctx.beginPath();
    ctx.moveTo(sx + dx, 252);
    ctx.quadraticCurveTo(sx + dx + 14, 280, sx + dx, 290);
    ctx.quadraticCurveTo(sx + dx - 14, 280, sx + dx, 252);
    ctx.stroke();
  }
  ctx.restore();

  // A billboard for a certain goose.
  const bx = 300;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(bx - 150, 250, 300, 140);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(bx - 150, 250, 300, 140);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(bx - 70, 345, 46, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx - 40, 330);
  ctx.quadraticCurveTo(bx - 10, 290, bx - 40, 278);
  ctx.stroke();
  ctx.fillStyle = '#f7932b';
  ctx.beginPath();
  ctx.moveTo(bx - 34, 270);
  ctx.lineTo(bx + 2, 282);
  ctx.lineTo(bx - 34, 292);
  ctx.fill();
  ctx.font = '900 54px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText('HONK', bx + 70, 340);
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('LAST BITE', bx + 70, 368);
  ctx.fillStyle = '#ffffff';
  for (const lx of [bx - 110, bx + 110]) {
    ctx.beginPath();
    ctx.arc(lx, 246, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far right: a hotel sign.
  neonText(ctx, 'HOTEL', 1980, 300, 40, '#ff6a3d', '#ff3d1d');
  neonText(ctx, '24/7', -420, 320, 44, '#7dff6a', '#3dff5a');
}

/* ---------- the roof ---------- */

function paintRoof(ctx, rand) {
  // Parapet wall at the back of the roof.
  const top = FLOOR_TOP - 36;
  const wall = ctx.createLinearGradient(0, top, 0, FLOOR_TOP + 6);
  wall.addColorStop(0, '#4a4170');
  wall.addColorStop(1, '#2a2348');
  ctx.fillStyle = wall;
  ctx.fillRect(X0, top, LW, FLOOR_TOP - top + 6);
  ctx.fillStyle = '#6a5d9a';
  ctx.fillRect(X0, top - 6, LW, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = X0; x < X1; x += 120) ctx.fillRect(x, top + 2, 3, FLOOR_TOP - top);

  // Props standing on the parapet line.
  waterTower(ctx, -260, top);
  acUnit(ctx, 120, FLOOR_TOP, 1);
  acUnit(ctx, 1480, FLOOR_TOP, 0.9);
  antenna(ctx, 860, top);
  stairHut(ctx, 1900, FLOOR_TOP);
  pipes(ctx, 560, FLOOR_TOP);
  acUnit(ctx, -620, FLOOR_TOP, 1.1);
  waterTower(ctx, 2300, top);

  // The floor: wet concrete in perspective.
  const floor = ctx.createLinearGradient(0, FLOOR_TOP, 0, STAGE_H);
  floor.addColorStop(0, '#2c2550');
  floor.addColorStop(0.5, '#1f1a3d');
  floor.addColorStop(1, '#120f26');
  ctx.fillStyle = floor;
  ctx.fillRect(X0, FLOOR_TOP, LW, STAGE_H - FLOOR_TOP);
  ctx.strokeStyle = 'rgba(140, 120, 220, 0.18)';
  ctx.lineWidth = 2;
  const vx = 800;
  for (let i = -30; i <= 30; i++) {
    ctx.beginPath();
    ctx.moveTo(vx + i * 60, FLOOR_TOP);
    ctx.lineTo(vx + i * 260, STAGE_H);
    ctx.stroke();
  }
  for (let j = 0; j < 7; j++) {
    const y = FLOOR_TOP + (STAGE_H - FLOOR_TOP) * ((j + 1) / 8) ** 1.6;
    ctx.beginPath();
    ctx.moveTo(X0, y);
    ctx.lineTo(X1, y);
    ctx.stroke();
  }
  // Neon spilling onto the wet floor.
  for (const [x, color] of [[1180, 'rgba(255, 79, 216, 0.22)'], [1180, 'rgba(79, 243, 255, 0.14)'], [300, 'rgba(255, 210, 63, 0.16)'], [1980, 'rgba(255, 106, 61, 0.16)']]) {
    const g = ctx.createRadialGradient(x, FLOOR_TOP + 60, 10, x, FLOOR_TOP + 60, 420);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 420, FLOOR_TOP, 840, STAGE_H - FLOOR_TOP);
  }
  // Puddles.
  for (let i = 0; i < 14; i++) {
    const x = range(rand, X0 + 100, X1 - 100);
    const y = range(rand, FLOOR_TOP + 40, STAGE_H - 30);
    const rx = range(rand, 60, 180) * lerp(0.6, 1.4, (y - FLOOR_TOP) / (STAGE_H - FLOOR_TOP));
    ctx.fillStyle = 'rgba(120, 100, 220, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Edge of the roof in front of the camera.
  ctx.fillStyle = '#0c0a1c';
  ctx.fillRect(X0, STAGE_H - 18, LW, 18);
}

function box(ctx, x, y, w, h, fill, light, dark) {
  const p = new Path2D();
  p.rect(x, y, w, h);
  inkUnder(ctx, p, 3, '#0a0818');
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.fillStyle = light;
  ctx.fillRect(x + 3, y + 3, w - 6, 5);
  ctx.fillStyle = dark;
  ctx.fillRect(x + 3, y + h - 10, w - 6, 7);
}

function acUnit(ctx, x, floor, s) {
  const w = 150 * s;
  const h = 90 * s;
  box(ctx, x - w / 2, floor - h, w, h, '#5a5288', '#7d74b0', '#3a3366');
  ctx.strokeStyle = '#2a2450';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + w * 0.18, floor - h * 0.5, h * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, floor - h * 0.8 + i * h * 0.13);
    ctx.lineTo(x - w * 0.05, floor - h * 0.8 + i * h * 0.13);
    ctx.stroke();
  }
}

function waterTower(ctx, x, top) {
  ctx.strokeStyle = '#1c1838';
  ctx.lineWidth = 8;
  for (const dx of [-60, 60]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 0.7, top - 160);
    ctx.lineTo(x + dx, top);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - 55, top - 60);
  ctx.lineTo(x + 55, top - 110);
  ctx.moveTo(x + 55, top - 60);
  ctx.lineTo(x - 55, top - 110);
  ctx.stroke();
  const tank = new Path2D();
  tank.roundRect(x - 80, top - 330, 160, 180, 14);
  inkUnder(ctx, tank, 4, '#0a0818');
  ctx.fillStyle = '#3d3366';
  ctx.fill(tank);
  ctx.fillStyle = '#2a2350';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 78 + i * 28, top - 328, 4, 176);
  const cap = new Path2D();
  cap.moveTo(x - 90, top - 330);
  cap.lineTo(x, top - 390);
  cap.lineTo(x + 90, top - 330);
  cap.closePath();
  inkUnder(ctx, cap, 4, '#0a0818');
  ctx.fillStyle = '#4c4180';
  ctx.fill(cap);
  ctx.fillStyle = 'rgba(255, 140, 230, 0.25)';
  ctx.fillRect(x + 50, top - 326, 26, 172);
}

function antenna(ctx, x, top) {
  ctx.strokeStyle = '#1c1838';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - 360);
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const y = top - 60 - i * 50;
    ctx.beginPath();
    ctx.moveTo(x - 30 + i * 3, y);
    ctx.lineTo(x + 30 - i * 3, y);
    ctx.stroke();
  }
}

function stairHut(ctx, x, floor) {
  box(ctx, x - 130, floor - 220, 260, 220, '#3a3266', '#574d8a', '#28224c');
  const door = new Path2D();
  door.rect(x - 40, floor - 150, 80, 150);
  inkUnder(ctx, door, 3, '#0a0818');
  ctx.fillStyle = '#1a1533';
  ctx.fill(door);
  ctx.fillStyle = '#ffe28a';
  ctx.fillRect(x - 22, floor - 196, 44, 22);
  const cone = ctx.createLinearGradient(0, floor - 180, 0, floor + 80);
  cone.addColorStop(0, 'rgba(255, 226, 138, 0.35)');
  cone.addColorStop(1, 'rgba(255, 226, 138, 0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(x - 22, floor - 176);
  ctx.lineTo(x + 22, floor - 176);
  ctx.lineTo(x + 140, floor + 80);
  ctx.lineTo(x - 140, floor + 80);
  ctx.fill();
}

function pipes(ctx, x, floor) {
  for (const [dx, h, w] of [[0, 120, 26], [44, 80, 20]]) {
    const p = new Path2D();
    p.roundRect(x + dx - w / 2, floor - h, w, h, 6);
    inkUnder(ctx, p, 3, '#0a0818');
    ctx.fillStyle = '#4a4178';
    ctx.fill(p);
    ctx.fillStyle = '#6a5fa2';
    ctx.fillRect(x + dx - w / 2 - 4, floor - h, w + 8, 8);
  }
}

/* ---------- live layers ---------- */

// Draw a pre-painted layer with parallax: p = 1 moves with the fight, smaller
// values lag behind like distant things do.
export function drawLayer(ctx, stage, which, camX, p, alpha = 1) {
  const c = stage[which];
  const off = (camX - 800) * (1 - p);
  ctx.globalAlpha = alpha;
  ctx.drawImage(c, X0 + off, 0, LW, STAGE_H);
  ctx.globalAlpha = 1;
}

export function drawStage(ctx, stage, camX, t) {
  drawLayer(ctx, stage, 'far', camX, 0.25);
  drawLayer(ctx, stage, 'mid', camX, 0.55);
  // Neon flickers now and then, like real tubes.
  const flick = Math.sin(t * 37) > 0.96 || (t % 7 > 6.7 && Math.sin(t * 60) > 0) ? 0.35 : 1;
  drawLayer(ctx, stage, 'signs', camX, 0.55, flick);
  drawLayer(ctx, stage, 'roof', camX, 1);
  blink(ctx, 860, FLOOR_TOP - 400, t);
  steam(ctx, 560, FLOOR_TOP - 120, t);
}

function blink(ctx, x, y, t) {
  const on = Math.sin(t * 3) > 0.2;
  ctx.fillStyle = on ? '#ff3b3b' : '#5a1020';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
    g.addColorStop(0, 'rgba(255, 60, 60, 0.6)');
    g.addColorStop(1, 'rgba(255, 60, 60, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
  }
}

function steam(ctx, x, y, t) {
  for (let i = 0; i < 7; i++) {
    const k = (t * 0.4 + i / 7) % 1;
    ctx.fillStyle = `rgba(200, 190, 240, ${0.18 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 6 + i) * 18 + k * 40, y - k * 160, 14 + k * 40, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rain in screen space: far fine streaks and near heavy ones, slanted.
export function drawRain(ctx, stage, w, h, t, near) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const d of stage.drops) {
    if ((d.z > 0.7) !== near) continue;
    const speed = near ? 1.9 : 1.1;
    const y = ((d.y + t * speed * (0.8 + d.len * 0.4)) % 1.2) - 0.1;
    const x = ((d.x + y * 0.18) % 1) * w;
    const len = (near ? 46 : 22) * d.len * (h / 900);
    ctx.strokeStyle = near ? 'rgba(200, 220, 255, 0.38)' : 'rgba(170, 180, 255, 0.28)';
    ctx.lineWidth = near ? 2.2 * (h / 900) : 1.2 * (h / 900);
    ctx.beginPath();
    ctx.moveTo(x, y * h);
    ctx.lineTo(x - len * 0.18, y * h + len);
    ctx.stroke();
  }
  ctx.restore();
}

// Splashes on the floor, in stage space.
export function drawSplashes(ctx, stage, camX, viewW, t, dt) {
  const s = stage.splashes;
  for (let i = 0; i < 3; i++) {
    if (stage.rand() < 0.9) {
      s.push({ x: camX + (stage.rand() - 0.5) * viewW * 1.1, y: lerp(FLOOR_TOP + 10, STAGE_H - 20, stage.rand()), age: 0 });
    }
  }
  ctx.strokeStyle = 'rgba(210, 220, 255, 0.5)';
  ctx.lineWidth = 1.5;
  for (const p of s) {
    p.age += dt;
    const k = p.age / 0.3;
    const r = 4 + k * 10;
    ctx.globalAlpha = 1 - k;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  stage.splashes = s.filter((p) => p.age < 0.3);
}

// Lightning: returns the current flash strength (0..1) and paints the bolt in
// screen space when one is live.
export function updateLightning(stage, t, dt) {
  const L = stage.lightning;
  if (L.t < 0 && t > L.next) {
    L.t = 0;
    L.next = t + range(stage.rand, 7, 14);
    L.bolt = makeBolt(stage.rand);
    L.thunder = true;
  }
  if (L.t >= 0) {
    L.t += dt;
    if (L.t > 0.6) L.t = -1;
  }
  if (L.t < 0) return 0;
  const k = L.t;
  return k < 0.08 ? 1 : k < 0.16 ? 0.2 : k < 0.24 ? 0.8 : Math.max(0, 0.8 - (k - 0.24) * 2.2);
}

function makeBolt(rand) {
  const pts = [[range(rand, 0.15, 0.85), 0]];
  let [x, y] = pts[0];
  while (y < 0.45) {
    x += range(rand, -0.04, 0.04);
    y += range(rand, 0.03, 0.07);
    pts.push([x, y]);
  }
  return pts;
}

export function drawBolt(ctx, stage, w, h, flash) {
  const L = stage.lightning;
  if (!L.bolt || flash <= 0.15) return;
  ctx.save();
  ctx.strokeStyle = `rgba(240, 240, 255, ${flash})`;
  ctx.shadowColor = '#b8c4ff';
  ctx.shadowBlur = 20;
  ctx.lineWidth = 3;
  ctx.beginPath();
  L.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.stroke();
  ctx.restore();
}

/* ---------- painted stages ---------- */

// The painted rooftops (assets/stage, cut by tools/split_stages.py): the city
// and parapet drift slower than the fight, the wet floor moves with it. Both
// are mirror-tiled, so no screen shape ever runs off the edge of the paint.
const PX = 2016 / 3830; // world units per painting pixel
const PAINT_W = 3830 * PX;
const PAINT_L = 800 - PAINT_W / 2;
const FIGHT_ROW = 1412; // painting row the fighters stand on
export const STAGES = [
  { id: 'chinatown', cut: 1214 },
  { id: 'oldtown', cut: 1300 },
  { id: 'harbor', cut: 1244 },
  { id: 'billboard', cut: 1270 },
];
let current = 0;

export function loadPaintedStage() {
  for (const st of STAGES) {
    st.line = GROUND - (FIGHT_ROW - st.cut) * PX;
    for (const k of ['back', 'floor']) {
      const img = new Image();
      img.onload = () => {
        // Colours to extend the paint past its top and bottom edges.
        const c = document.createElement('canvas');
        c.width = 8;
        c.height = 1;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, k === 'back' ? 0 : img.naturalHeight - 2, img.naturalWidth, 2, 0, 0, 8, 1);
        const d = cx.getImageData(0, 0, 8, 1).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < 32; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        st[k === 'back' ? 'skyColor' : 'groundColor'] = `rgb(${(r / 8) | 0}, ${(g / 8) | 0}, ${(b / 8) | 0})`;
      };
      img.src = `assets/stage/${st.id}-${k}.webp`;
      st[k] = img;
    }
  }
}

export function setStage(i) {
  current = ((i % STAGES.length) + STAGES.length) % STAGES.length;
}

const loaded = (st) => st.back && st.back.complete && st.back.naturalWidth && st.floor.complete && st.floor.naturalWidth;
export const paintedReady = () => !!loaded(STAGES[current]);

function tiled(ctx, img, left, y, w, h, viewL, viewR) {
  const i0 = Math.floor((viewL - left) / w);
  const i1 = Math.floor((viewR - left) / w);
  for (let i = i0; i <= i1; i++) {
    const x = left + i * w;
    if (Math.abs(i) % 2 === 0) ctx.drawImage(img, x, y, w, h);
    else {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    }
  }
}

// view: { left, right, top, bottom } in stage space.
export function drawPaintedStage(ctx, camX, view, flash) {
  const st = STAGES[current];
  const bh = st.back.naturalHeight * PX;
  const top = st.line - bh;
  if (view.top < top + 2) {
    const g = ctx.createLinearGradient(0, view.top, 0, top + 2);
    g.addColorStop(0, '#04031a');
    g.addColorStop(1, st.skyColor || '#0a093a');
    ctx.fillStyle = g;
    ctx.fillRect(view.left - 10, view.top - 10, view.right - view.left + 20, top - view.top + 12);
  }
  const off = (camX - 800) * 0.3;
  tiled(ctx, st.back, PAINT_L + off, top, PAINT_W, bh, view.left, view.right);
  if (flash > 0) {
    // Lightning lights the whole city for a beat.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash * 0.3;
    tiled(ctx, st.back, PAINT_L + off, top, PAINT_W, bh, view.left, view.right);
    ctx.restore();
  }
  const fh = st.floor.naturalHeight * PX;
  tiled(ctx, st.floor, PAINT_L, st.line, PAINT_W, fh, view.left, view.right);
  if (view.bottom > st.line + fh - 2) {
    ctx.fillStyle = st.groundColor || '#151030';
    ctx.fillRect(view.left - 10, st.line + fh - 2, view.right - view.left + 20, view.bottom - st.line - fh + 12);
  }
  // A shadow line where the parapet meets the floor hides the parallax seam.
  const s = ctx.createLinearGradient(0, st.line - 8, 0, st.line + 14);
  s.addColorStop(0, 'rgba(5, 3, 15, 0)');
  s.addColorStop(0.4, 'rgba(5, 3, 15, 0.5)');
  s.addColorStop(1, 'rgba(5, 3, 15, 0)');
  ctx.fillStyle = s;
  ctx.fillRect(view.left - 10, st.line - 8, view.right - view.left + 20, 22);
}
