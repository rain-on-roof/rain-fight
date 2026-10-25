// Shared brushes. Every outline in the game is drawn the same way: a wide ink
// stroke underneath, then the fill on top, so overlapping shapes merge into one
// clean silhouette instead of showing seams.

export const INK = '#2b2131';

export const PALETTE = {
  skyTop: '#5fb0e6',
  skyMid: '#a6dcf3',
  skyLow: '#ffe6c0',
  sun: '#fff6cf',
  hazeHills: '#b9d3ad',
  skyline: '#b7c2dc',
  skylineLit: '#e6ebf6',
  farTrees: '#82b37b',
  farTreesLight: '#a1cb93',
  groundFar: '#a4d36e',
  groundNear: '#5aa646',
  grassDark: '#3f8a3a',
  grassLight: '#8fd067',
  leaf: '#4e9b4a',
  leafShade: '#367a3e',
  leafLight: '#78c060',
  leafGlow: '#a8de78',
  trunk: '#7c5236',
  trunkShade: '#5a3926',
  path: '#efd7a8',
  pathShade: '#d6b884',
  stone: '#c8b59c',
  water: '#6cc2e2',
  waterDeep: '#3f9cc6',
  waterLight: '#dff6ff',
  metal: '#3c4a57',
  metalLight: '#6b7d8c',
  wood: '#c07a43',
  woodShade: '#8f5530',
  woodLight: '#dc9a5e',
  goose: '#fbf8f1',
  gooseShade: '#d8d2ca',
  gooseDeep: '#b9b1a8',
  gooseLight: '#ffffff',
  beak: '#f7932b',
  beakShade: '#d86f17',
  beakLight: '#ffc06a',
  gold: '#ffd54a',
  goldShade: '#e2a51c',
  goldDeep: '#b97c0e',
  goldLight: '#fff2a8',
  skin: '#f4c29b',
  skinShade: '#d99a73',
  sleeve: '#2f8f8a',
  sleeveShade: '#21706c',
  jeans: '#3d5f9e',
  jeansShade: '#2d4a80',
};

export function circle(path, x, y, r) {
  path.moveTo(x + r, y);
  path.arc(x, y, r, 0, Math.PI * 2);
  return path;
}

export function ellipse(path, x, y, rx, ry, rot = 0) {
  path.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  path.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return path;
}

export function inkUnder(ctx, path, width = 4, ink = INK) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = width * 2;
  ctx.strokeStyle = ink;
  ctx.stroke(path);
  ctx.restore();
}

// Ink, fill, then cel shading clipped to the shape: a shadow band away from
// the light (upper right) and a lit band toward it.
export function toon(ctx, path, { fill, shade, light, width = 4, shadeOffset = [-0.0, 0.0], ink = INK, shading } = {}) {
  if (width > 0) inkUnder(ctx, path, width, ink);
  ctx.fillStyle = fill;
  ctx.fill(path);
  if (shading) {
    ctx.save();
    ctx.clip(path);
    shading(ctx, { shade, light, shadeOffset });
    ctx.restore();
  }
}

// Cel shading for a union of circles: everything starts in shadow, the
// circles shifted toward the light are painted back in the base colour, and a
// smaller shifted set adds the highlight.
export function toonBlobs(ctx, blobs, { fill, shade, light, glow, width = 4, ink = INK, lx = 0.22, ly = -0.3 }) {
  const union = new Path2D();
  for (const [x, y, r] of blobs) circle(union, x, y, r);
  if (width > 0) inkUnder(ctx, union, width, ink);
  ctx.fillStyle = shade;
  ctx.fill(union);
  ctx.save();
  ctx.clip(union);
  const base = new Path2D();
  for (const [x, y, r] of blobs) circle(base, x + r * lx, y + r * ly, r * 0.96);
  ctx.fillStyle = fill;
  ctx.fill(base);
  // Light and glow only on the blobs that face the sky; lighting every blob
  // reads as polka dots rather than a lit mass.
  const ys = blobs.map(([, y, r]) => y - r).sort((a, b) => a - b);
  const litCut = ys[Math.floor(ys.length * 0.6)] ?? Infinity;
  const glowCut = ys[Math.floor(ys.length * 0.3)] ?? Infinity;
  if (light) {
    const lit = new Path2D();
    for (const [x, y, r] of blobs) if (y - r <= litCut) circle(lit, x + r * lx * 1.7, y + r * ly * 1.7, r * 0.84);
    ctx.fillStyle = light;
    ctx.fill(lit);
  }
  if (glow) {
    const g = new Path2D();
    for (const [x, y, r] of blobs) if (r > 14 && y - r <= glowCut) circle(g, x + r * lx * 2.9, y + r * ly * 2.9, r * 0.5);
    ctx.fillStyle = glow;
    ctx.fill(g);
  }
  ctx.restore();
  return union;
}

export function softShadow(ctx, x, y, rx, ry, alpha = 0.28) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(30, 40, 30, ${alpha})`);
  g.addColorStop(0.65, `rgba(30, 40, 30, ${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(30, 40, 30, 0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c = 1.9;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
