import { createMatch, stepMatch } from './fight/match.js';
import { createAI, thinkAI } from './fight/ai.js';
import { FIGHTERS, ROSTER, FINISHERS } from './fight/moves.js';
import { createInput, readIntents } from './input.js';
import { createAudio } from './audio.js';
import { createStage, drawSky, drawStage, drawRain, drawSplashes, updateLightning, drawBolt, GROUND, STAGE_H } from './render/stage.js';
import { createFighterView, updateFighterView, drawFighter } from './render/fighters.js';
import { createEffects, spark, smoke, dust, debris, clothes, updateEffects, drawEffects, drawProjectiles, drawHonkRings, drawDizzy } from './render/effects.js';
import { createHud, updateHud, drawHud, banner, showCombo } from './render/hud.js';
import { BEATS, finisherState, drawFinisherBack, drawFinisherFront, flyX, flyY } from './render/finishers.js';
import { drawCutIn, CUT_IN_LENGTH } from './render/honk.js';
import { createFx, burst, updateFx, drawFx } from './render/fx.js';
import { drawPuppet, LOOKS } from './render/puppet.js';
import { POSES } from './render/poses.js';
import { createGooseAnimator, updateGoose, drawGoose } from './render/goose.js';
import { softShadow, clamp01, lerp } from './render/paint.js';
import { t, setLanguage } from './i18n.js';
import * as portal from './portal.js';
import { loadSprites, hasFrame, spriteReady, drawSpriteAt } from './render/sprites.js';
import { loadPaintedStage, paintedReady, drawPaintedStage, setStage, STAGES } from './render/stage.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const arena = $('arena');
const app = $('app');
const input = createInput(app);
const audio = createAudio();
const STEP = 1 / 60;

loadSprites(ROSTER);
document.fonts?.load('48px "RF Display"', 'AЖ');
loadPaintedStage();

const PORTRAITS = {};
for (const id of ROSTER) {
  const img = new Image();
  img.src = `assets/art/portrait-${id}.jpg`;
  img.onerror = () => (img.failed = true);
  PORTRAITS[id] = img;
}


const S = {
  screen: 'title',
  mode: 'cpu',
  level: 'normal',
  picks: [null, null],
  picking: 0,
  match: null,
  ais: [null, null],
  views: [],
  fx: createEffects(),
  crumbs: createFx(),
  hud: createHud(),
  stage: null,
  time: 0,
  slowmo: 0,
  simAcc: 0,
  shake: 0,
  flash: 0,
  cutIn: -1,
  cam: { x: 800, zoom: 1 },
  view: { w: 1, h: 1, dpr: 1 },
  resultAt: 0,
  paused: false,
  hostPaused: false,
  hostAudioOff: false,
  adOpen: false,
  attract: true,
};

/* ---------- layout ---------- */

function resize() {
  const r = arena.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(2, Math.round(r.width * dpr));
  canvas.height = Math.max(2, Math.round(r.height * dpr));
  S.view = { w: canvas.width, h: canvas.height, dpr };
  const k = Math.min(1.6, Math.max(0.6, (canvas.height / 700)));
  if (!S.stage || Math.abs(S.stage.k - k) > 0.15) S.stage = createStage(k);
}

/* ---------- matches ---------- */

let stageNo = (Math.random() * STAGES.length) | 0;

function startMatch(p1, p2, mode, attract = false) {
  // A different rooftop every match.
  setStage(++stageNo);
  S.match = createMatch({ p1, p2, seed: (Math.random() * 1e9) | 0 });
  S.mode = mode;
  S.attract = attract;
  S.ais = [attract ? createAI(0, 'hard', 3) : null, mode === 'cpu' ? createAI(1, attract ? 'normal' : S.level, (Math.random() * 1e6) | 0) : null];
  S.views = S.match.fighters.map((f) => createFighterView(f));
  S.fx = createEffects();
  S.crumbs = createFx();
  S.hud = createHud();
  S.cutIn = -1;
  S.slowmo = 0;
  S.resultAt = 0;
  S.cam.x = 800;
  if (!attract) {
    portal.matchStarted();
    audio.intensity = 0;
    audio.music('fight');
    handleEvents([{ type: 'round', n: 1, final: false }]);
  }
}

function attract() {
  const a = ROSTER[(Math.random() * 4) | 0];
  let b = ROSTER[(Math.random() * 4) | 0];
  if (b === a) b = ROSTER[(ROSTER.indexOf(a) + 1) % 4];
  startMatch(a, b, 'cpu', true);
}

/* ---------- events ---------- */

function handleEvents(events) {
  const m = S.match;
  const loud = !S.attract;
  const play = (n, d) => loud && audio.play(n, d);
  for (const ev of events) {
    const f = ev.side !== undefined ? m.fighters[ev.side] : null;
    switch (ev.type) {
      case 'round':
        if (loud && ev.final) audio.intensity = 1;
        if (loud) banner(S.hud, ev.final ? 'FINAL ROUND' : `ROUND ${ev.n}`, { color: '#ffffff', accent: '#ff4fd8', life: 1.15, size: 0.8 });
        play('round');
        break;
      case 'fight':
        if (loud) banner(S.hud, 'FIGHT!', { color: '#ffd23f', accent: '#ff3d6e', life: 0.9, size: 1.1 });
        play('fight');
        break;
      case 'attack':
        if (ev.move === 'special' && f.id === 'goose') play('honk');
        else play('whoosh');
        break;
      case 'jump':
        play('jump');
        break;
      case 'land':
        play('land');
        dust(S.fx, f.x, GROUND, 5);
        break;
      case 'fall':
        play('fall');
        dust(S.fx, ev.x, GROUND, 16);
        S.shake = Math.max(S.shake, 8);
        break;
      case 'hit': {
        const y = GROUND - ev.y;
        spark(S.fx, ev.x, y, { heavy: ev.heavy || ev.damage >= 10 });
        if (m.fighters[ev.side].id === 'goose') burst(S.crumbs, 'feathers', ev.x, y, 6);
        play(ev.heavy ? 'heavy' : 'hit');
        S.shake = Math.max(S.shake, ev.heavy ? 12 : 6);
        if (ev.combo >= 2) showCombo(S.hud, ev.side, ev.combo);
        if (loud && touchMode()) navigator.vibrate?.(ev.heavy ? 40 : 15);
        break;
      }
      case 'block':
        spark(S.fx, ev.x, GROUND - ev.y, { blocked: true });
        play('block');
        break;
      case 'projectile':
        if (f.id === 'brick') {
          play('slam');
          S.shake = Math.max(S.shake, 14);
          debris(S.fx, f.x + f.facing * 70, GROUND, 10);
          dust(S.fx, f.x + f.facing * 70, GROUND, 14);
        } else play('zap');
        break;
      case 'teleport':
        smoke(S.fx, ev.x, GROUND);
        play('teleport');
        break;
      case 'clash':
        spark(S.fx, ev.x, GROUND - ev.y, { heavy: true, color: '#ff4fd8' });
        play('heavy');
        break;
      case 'ko':
        if (loud) banner(S.hud, 'K.O.', { color: '#ff3d3d', accent: '#ffd23f', life: 1.8, size: 1.3 });
        play('ko');
        S.slowmo = 1.1;
        S.flash = 0.6;
        S.shake = 18;
        break;
      case 'timeUp':
        if (loud) banner(S.hud, 'TIME', { color: '#ffffff', accent: '#4ff3ff', life: 1.2 });
        break;
      case 'endIt':
        if (loud) banner(S.hud, 'END IT!', { color: '#ff3d3d', accent: '#ffd23f', life: 2.6, size: 1.2, sub: t('pressSpecial') });
        play('endIt');
        if (loud) audio.music(null);
        S.slowmo = 0.6;
        S.flash = 0.5;
        break;
      case 'finisher':
        play('finisher');
        break;
      case 'roundWin': {
        const w = m.fighters[ev.side];
        if (loud && !m.over) banner(S.hud, `${w.def.name} WINS`, { color: '#ffffff', accent: ev.side ? '#ff4fd8' : '#4ff3ff', life: 1.6, size: 0.8, sub: ev.perfect ? 'PERFECT' : null });
        break;
      }
      case 'matchEnd':
        S.resultAt = S.time + (ev.finisher ? 1.6 : 2.2);
        if (loud) {
          audio.music(null);
          const won = S.mode !== 'cpu' || ev.side === 0;
          play(won ? 'victory' : 'defeat', ev.finisher ? 0.9 : 0.7);
          portal.matchEnded(won);
        }
        if (loud && !ev.finisher) banner(S.hud, `${m.fighters[ev.side].def.name} WINS`, { color: '#ffffff', accent: '#ffd23f', life: 2, size: 0.9 });
        break;
      default:
        break;
    }
  }
}

function finisherBeats() {
  const m = S.match;
  if (m.phase !== 'finisher' && !(m.over && m.finisher)) return;
  const t = m.finisher.time;
  const id = m.finisher.id;
  const w = m.fighters[m.finisher.by];
  const l = m.fighters[1 - m.finisher.by];
  const loud = !S.attract;
  for (const [frame, beat] of BEATS[id]) {
    if (frame !== t) continue;
    switch (beat) {
      case 'charge':
        spark(S.fx, w.x + w.facing * 40, GROUND - 160, { color: '#5ef2ff' });
        loud && audio.play('zap');
        break;
      case 'bolt':
        S.flash = 1;
        S.shake = 22;
        spark(S.fx, l.x, GROUND - 150, { heavy: true, color: '#5ef2ff' });
        loud && audio.play('thunder');
        loud && audio.play('zap');
        break;
      case 'toast':
        smoke(S.fx, l.x, GROUND, 'rgba(70, 60, 80, 0.8)');
        loud && audio.play('fall');
        break;
      case 'pop':
        loud && audio.play('jump');
        break;
      case 'leap':
        loud && audio.play('whoosh');
        break;
      case 'slam':
        S.shake = 24;
        S.flash = 0.25;
        debris(S.fx, l.x, GROUND, 16);
        dust(S.fx, l.x, GROUND, 18);
        loud && audio.play('slam');
        break;
      case 'vanish':
        smoke(S.fx, w.x, GROUND);
        loud && audio.play('teleport');
        break;
      case 'slash':
        spark(S.fx, l.x, GROUND - 150, { color: '#ff4fd8' });
        loud && audio.play('whoosh');
        loud && audio.play('hit');
        break;
      case 'strip':
        if (l.id === 'goose') burst(S.crumbs, 'feathers', l.x, GROUND - 160, 40);
        else clothes(S.fx, l.x, GROUND, [LOOKS[l.id].colors.top, LOOKS[l.id].colors.pants, LOOKS[l.id].colors.accent]);
        S.shake = 10;
        loud && audio.play('heavy');
        break;
      case 'windup':
        loud && audio.play('jump');
        break;
      case 'honk':
        S.cutIn = 0;
        S.shake = 26;
        loud && audio.play('honk', 0.05);
        loud && audio.play('ko');
        break;
      case 'launch':
        loud && audio.play('whoosh');
        S.shake = 16;
        break;
      case 'twinkle':
        loud && audio.play('ui');
        break;
      case 'banner': {
        const name = id === 'undressed' && l.id === 'goose' ? 'PLUCKED' : FINISHERS[id].name;
        if (loud) banner(S.hud, name + '!', { color: '#ffd23f', accent: '#ff3d6e', life: 2.4, size: 1.15 });
        break;
      }
      default:
        break;
    }
  }
}

/* ---------- loop ---------- */

function update(dt) {
  S.time += dt;
  const m = S.match;
  if (!m) return;
  if (S.paused || S.hostPaused) return;
  const flash = updateLightning(S.stage, S.time, dt);
  if (S.stage.lightning.thunder) {
    S.stage.lightning.thunder = false;
    if (!S.attract) audio.play('thunder', 0.4);
  }
  S.lightningFlash = flash;

  // Slow motion advances the simulation every few frames.
  S.slowmo = Math.max(0, S.slowmo - dt);
  S.simAcc += S.slowmo > 0 ? 0.35 : 1;
  while (S.simAcc >= 1) {
    S.simAcc -= 1;
    let intents = [{}, {}];
    if (!S.attract && S.screen === 'fight') intents = readIntents(input, S.mode);
    for (let i = 0; i < 2; i++) if (S.ais[i]) intents[i] = thinkAI(S.ais[i], m);
    handleEvents(stepMatch(m, intents));
    finisherBeats();
    m.fighters.forEach((f, i) => updateFighterView(S.views[i], f, STEP, S.time, finisherMood(m, i)));
  }
  if (S.cutIn >= 0) {
    S.cutIn += dt;
    if (S.cutIn > CUT_IN_LENGTH) S.cutIn = -1;
  }
  updateEffects(S.fx, dt);
  updateFx(S.crumbs, dt);
  updateHud(S.hud, m, dt);
  S.shake = Math.max(0, S.shake - dt * 60);
  S.flash = Math.max(0, S.flash - dt * 2.5);

  if (m.over && S.resultAt && S.time >= S.resultAt) {
    S.resultAt = 0;
    if (S.attract) setTimeout(attract, 300);
    else if (S.screen === 'fight') showResult();
  }
}

function finisherMood(m, i) {
  if (!m.finisher || i !== m.finisher.by || m.fighters[i].id !== 'goose') return null;
  const t = m.finisher.time;
  return t < 20 ? 'tell' : t < 100 ? 'strike' : 'victory';
}

/* ---------- render ---------- */

function camera(dt) {
  const m = S.match;
  const [a, b] = m.fighters;
  const { w, h } = S.view;
  let mid = (a.x + b.x) / 2;
  let spread = Math.abs(a.x - b.x);
  if (m.phase === 'finisher' || (m.over && m.finisher)) {
    const l = m.fighters[1 - m.finisher.by];
    mid = lerp(mid, l.x, 0.4);
    spread = Math.min(spread, 500);
  }
  // Tall screens frame tighter: the fighters may nearly touch the edges.
  const narrow = w < h;
  const needW = narrow ? Math.max(560, spread + 440) : Math.max(820, spread + 640);
  // Pull back when someone is launched high, so nobody leaves the top.
  const topY = Math.max(a.y, b.y) + 340;
  const target = Math.min(w / needW, h / 620, (h * 0.72) / topY);
  S.cam.zoom += (target - S.cam.zoom) * Math.min(1, dt * 4);
  S.cam.x += (mid - S.cam.x) * Math.min(1, dt * 5);
  // Keep the view inside the painted rooftop; a view wider than it centres.
  const half = w / S.cam.zoom / 2;
  const [L, R] = [-100, 1700];
  S.cam.x = half * 2 >= R - L ? (L + R) / 2 : Math.max(L + half, Math.min(R - half, S.cam.x));
  return S.cam;
}

function render(dt) {
  const m = S.match;
  if (!m) return;
  const { w, h } = S.view;
  const cam = camera(dt);
  const z = cam.zoom;
  const groundY = h * 0.84;
  const sx = (Math.random() - 0.5) * S.shake * z;
  const sy = (Math.random() - 0.5) * S.shake * z;
  const viewTop = GROUND - groundY / z;
  const viewW = w / z;
  const lf = S.lightningFlash || 0;

  const painted = paintedReady();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!painted) {
    drawSky(ctx, w, h, S.time, lf);
    drawBolt(ctx, S.stage, w, h, lf);
  }

  const world = () => ctx.setTransform(z, 0, 0, z, w / 2 - cam.x * z + sx, groundY - GROUND * z + sy);
  world();
  if (painted) {
    const view = { left: cam.x - viewW / 2 - 40, right: cam.x + viewW / 2 + 40, top: viewTop - 40, bottom: GROUND + (h - groundY) / z + 40 };
    drawPaintedStage(ctx, cam.x, view, lf);
  } else drawStage(ctx, S.stage, cam.x, S.time);
  drawSplashes(ctx, S.stage, cam.x, viewW, S.time, dt);

  const fin = m.finisher && (m.phase === 'finisher' || m.over) ? finisherState(m, m.finisher.time, S.time) : null;
  if (fin) drawFinisherBack(ctx, m, m.finisher.time, S.time, viewTop);

  // Reflections in the wet roof.
  ctx.save();
  ctx.beginPath();
  ctx.rect(cam.x - viewW, GROUND, viewW * 2, STAGE_H - GROUND);
  ctx.clip();
  ctx.translate(0, GROUND * 2);
  ctx.scale(1, -1);
  ctx.globalAlpha = 0.22;
  drawFighters(fin, true);
  ctx.restore();

  for (const f of m.fighters) if (!f.hidden) softShadow(ctx, f.x, GROUND + 4, 80 * (1 - Math.min(0.6, f.y / 400)), 14, 0.45);
  drawFighters(fin, false);

  drawProjectiles(ctx, m.projectiles, S.time);
  m.fighters.forEach((f) => {
    drawHonkRings(ctx, f, S.time);
    drawDizzy(ctx, f, S.time);
  });
  drawEffects(ctx, S.fx);
  drawFx(ctx, S.crumbs);
  if (fin) drawFinisherFront(ctx, m, m.finisher.time, S.time);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawRain(ctx, S.stage, w, h, S.time, true);
  // Vignette and flashes.
  const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  g.addColorStop(0, 'rgba(5, 2, 20, 0)');
  g.addColorStop(1, 'rgba(5, 2, 20, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (S.flash > 0 || lf > 0) {
    ctx.fillStyle = `rgba(230, 235, 255, ${Math.max(S.flash, lf * 0.25)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (!S.attract && S.screen === 'fight' && S.cutIn < 0) drawHud(ctx, w, h, m, S.hud, { portraits: PORTRAITS, time: S.time, top: 0 });
  if (S.cutIn >= 0) {
    const head = spriteReady('goose') ? (c, x, y, size) => drawSpriteAt(c, 'goose', 'special', x, y, size) : null;
    drawCutIn(ctx, w, h, S.cutIn, { head });
  }
}

function drawFighters(fin, reflection) {
  const m = S.match;
  // The fighter who is attacking is drawn in front.
  const order = [0, 1].sort((i, j) => (m.fighters[i].move ? 1 : 0) - (m.fighters[j].move ? 1 : 0));
  for (const i of order) {
    const f = m.fighters[i];
    const view = S.views[i];
    const opts = { time: S.time, reflection, rim: i === 0 ? 'rgba(120, 240, 255, 0.9)' : 'rgba(255, 120, 230, 0.9)' };
    if (fin) {
      const isWinner = i === m.finisher.by;
      const o = isWinner ? fin.win : fin.lose;
      if (o.hidden || o.toast) continue;
      Object.assign(opts, { dx: o.dx || 0, poseOverride: o.poseOverride || null, outfit: o.outfit, expression: o.expression, frame: o.frame || null, dark: o.dark || 0 });
      if (o.flash !== undefined) opts.flash = o.flash;
      if (o.fly !== undefined) {
        const k = o.fly;
        if (k >= 0.98) continue;
        ctx.save();
        const fx = f.x + flyX(f, k);
        const fy = GROUND - flyY(k) * k;
        ctx.translate(fx, fy);
        ctx.rotate(k * 14);
        ctx.scale(1 - k * 0.92, 1 - k * 0.92);
        ctx.translate(-f.x, -GROUND + 120);
        drawFighter(ctx, f, view, opts);
        ctx.restore();
        continue;
      }
      if (o.sink) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(f.x - 400, GROUND - 2000, 800, reflection ? 0 : 2002);
        ctx.clip();
        drawFighter(ctx, f, view, { ...opts, sink: o.sink });
        ctx.restore();
        continue;
      }
      if (o.dy) {
        ctx.save();
        ctx.translate(0, o.dy);
        drawFighter(ctx, f, view, opts);
        ctx.restore();
        continue;
      }
      if (o.flip) {
        const keep = f.facing;
        f.facing = o.flip;
        drawFighter(ctx, f, view, opts);
        f.facing = keep;
        continue;
      }
      if (o.plucked && f.id === 'goose' && !hasFrame(f.id, 'underwear')) continue;
    }
    drawFighter(ctx, f, view, opts);
  }
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
  }
  render(dt);
  if (S.screen === 'select') renderCards();
  requestAnimationFrame(frame);
}

/* ---------- screens ---------- */

function show(screen) {
  S.screen = screen;
  for (const id of ['title', 'select', 'result']) $(id).hidden = id !== screen;
  $('pad').hidden = screen !== 'fight' || !touchMode();
  app.dataset.screen = screen;
}

const touchMode = () => input.usedTouch || matchMedia('(pointer: coarse)').matches;

function goTitle() {
  audio.music('menu');
  show('title');
  attract();
}

function goSelect(mode) {
  audio.unlock();
  audio.play('ui');
  S.mode = mode;
  audio.music('menu');
  S.picks = [null, null];
  S.picking = 0;
  updateSelectText();
  show('select');
  focusCard(0);
}

function updateSelectText() {
  $('select-title').textContent = S.mode === 'versus' ? t(S.picking === 0 ? 'p1choose' : 'p2choose') : t('choose');
  document.querySelectorAll('.card').forEach((c) => {
    c.classList.toggle('p1', c.dataset.id === S.picks[0]);
    c.classList.toggle('p2', c.dataset.id === S.picks[1]);
  });
}

function pick(id) {
  audio.play('select');
  S.picks[S.picking] = id;
  updateSelectText();
  if (S.mode === 'versus' && S.picking === 0) {
    S.picking = 1;
    updateSelectText();
    return;
  }
  if (S.mode === 'cpu') {
    const others = ROSTER.filter((r) => r !== id);
    S.picks[1] = others[(Math.random() * others.length) | 0];
    updateSelectText();
  }
  setTimeout(() => {
    show('fight');
    startMatch(S.picks[0], S.picks[1], S.mode);
  }, 450);
}

function showResult() {
  const m = S.match;
  const w = m.winner;
  const human = S.mode === 'cpu' ? w.side === 0 : true;
  $('result-title').textContent = S.mode === 'cpu' ? t(human ? 'youWin' : 'youLose') : t('wins', { name: w.def.name });
  const fin = m.finisher ? (m.finisher.id === 'undressed' && m.fighters[1 - w.side].id === 'goose' ? 'PLUCKED' : FINISHERS[m.finisher.id].name) : null;
  $('result-sub').textContent = fin ? `${w.def.name} · ${fin}!` : t('takesIt', { name: w.def.name });
  $('result-level').textContent = S.mode === 'cpu' ? t('vsCpuLevel', { level: t(S.level) }) : t('localVersus');
  const img = $('result-img');
  img.src = PORTRAITS[w.id].src;
  img.hidden = !!PORTRAITS[w.id].failed;
  show('result');
  $('rematch').focus({ preventScroll: true });
  setTimeout(() => S.screen === 'result' && audio.music('menu'), 2600);
}

/* ---------- character cards ---------- */

const cardCanvases = [];
const cardAnims = {};

function buildCards() {
  const wrap = $('cards');
  for (const id of ROSTER) {
    const def = FIGHTERS[id];
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.dataset.id = id;
    card.style.setProperty('--accent', LOOKS[id] ? LOOKS[id].colors.accent : '#ffd23f');
    card.innerHTML = `
      <div class="card-art">
        <img alt="" src="assets/art/portrait-${id}.jpg">
        <canvas width="320" height="360"></canvas>
      </div>
      <div class="card-info">
        <b>${def.name}</b>
        <span data-i18n="blurb_${id}"></span>
        <i><em data-i18n="special"></em> · <em data-i18n="special_${id}"></em></i>
      </div>
      <em class="tag tag-p1">P1</em><em class="tag tag-p2">${S.mode === 'versus' ? 'P2' : 'CPU'}</em>`;
    const img = card.querySelector('img');
    img.onerror = () => card.classList.add('no-art');
    img.onload = () => card.classList.add('has-art');
    card.addEventListener('click', () => pick(id));
    card.addEventListener('mouseenter', () => focusCard(ROSTER.indexOf(id)));
    wrap.append(card);
    cardCanvases.push({ id, canvas: card.querySelector('canvas'), card });
    if (id === 'goose') cardAnims[id] = createGooseAnimator();
  }
}

let focused = 0;
function focusCard(i) {
  focused = (i + ROSTER.length) % ROSTER.length;
  document.querySelectorAll('.card').forEach((c, j) => c.classList.toggle('focus', j === focused));
}

function renderCards() {
  for (const { id, canvas: c, card } of cardCanvases) {
    if (card.classList.contains('has-art') && !card.classList.contains('focus')) continue;
    const cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, c.width, c.height);
    cx.translate(160, 340);
    const t = S.time;
    if (id === 'goose') {
      updateGoose(cardAnims[id], 1 / 60, { mood: card.classList.contains('focus') ? 'tell' : 'idle', time: t });
      drawGoose(cx, cardAnims[id], { x: -10, y: 0, scale: 0.9, time: t, anger: 1 });
    } else {
      const focusedCard = card.classList.contains('focus');
      const pose = focusedCard ? { ...POSES.win, fs: 2.9 + Math.sin(t * 6) * 0.12 } : { ...POSES.guard, lean: 0.1 + Math.sin(t * 5) * 0.03 };
      cx.scale(1.15, 1.15);
      drawPuppet(cx, id, { pose, time: t, expression: focusedCard ? 'win' : 'fight' });
    }
  }
}

/* ---------- wiring ---------- */

function setLevel(level, store = true) {
  if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
  S.level = level;
  if (store) portal.save('level', level);
  document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === level)));
}

$('play-cpu').addEventListener('click', () => goSelect('cpu'));
$('play-versus').addEventListener('click', () => goSelect('versus'));
document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => {
  audio.unlock();
  audio.play('ui');
  setLevel(b.dataset.level);
}));
$('back').addEventListener('click', () => {
  audio.play('ui');
  goTitle();
});
$('rematch').addEventListener('click', () => afterBreak(() => {
  // The same two fighters as the match that just ended.
  const [a, b] = S.match.fighters.map((f) => f.id);
  audio.play('select');
  show('fight');
  startMatch(a, b, S.mode);
}));
$('change').addEventListener('click', () => afterBreak(() => goSelect(S.mode)));
$('menu').addEventListener('click', () => afterBreak(() => {
  audio.play('ui');
  goTitle();
}));

// Between matches is the one natural break in a fighting game, so that is
// where a portal may show an interstitial; mid-match round breaks last two
// seconds and count as gameplay. On the open web `next` runs at once.
let breaking = false;
async function afterBreak(next) {
  if (breaking) return;
  breaking = true;
  S.adOpen = true;
  audio.setHostMuted(true);
  try {
    await portal.breakAd();
  } finally {
    S.adOpen = false;
    audio.setHostMuted(S.hostAudioOff);
    breaking = false;
  }
  next();
}
$('share').addEventListener('click', async () => {
  const m = S.match;
  const w = m.winner;
  const text = S.mode === 'cpu' && w.side === 0
    ? t('shareWin', { level: t(S.level), name: w.def.name })
    : t('shareOther', { name: w.def.name });
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) await navigator.share({ title: 'Rain Fight', text, url });
    else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast(t('copied'));
    }
  } catch {}
});
$('mute').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  $('mute').setAttribute('aria-pressed', String(audio.muted));
});

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (S.screen === 'select') {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') focusCard(focused + 1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') focusCard(focused - 1);
    else if (e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'Space') {
      e.preventDefault();
      pick(ROSTER[focused]);
    } else if (e.code === 'Escape') goTitle();
  } else if (S.screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    e.preventDefault();
    goSelect('cpu');
  } else if (S.screen === 'fight' && (e.code === 'Escape' || e.code === 'KeyP')) {
    S.paused = !S.paused;
    $('pause').hidden = !S.paused;
    audio.setPaused(S.paused);
  }
});
$('resume').addEventListener('click', () => {
  S.paused = false;
  audio.setPaused(false);
  $('pause').hidden = true;
});
$('quit').addEventListener('click', () => {
  S.paused = false;
  audio.setPaused(false);
  $('pause').hidden = true;
  goTitle();
});
$('pause-btn').addEventListener('click', () => {
  S.paused = true;
  audio.setPaused(true);
  $('pause').hidden = false;
});

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 1800);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.screen === 'fight') {
    S.paused = true;
    audio.setPaused(true);
    $('pause').hidden = false;
  }
});
app.addEventListener('pointerdown', () => {
  audio.unlock();
  if (S.screen === 'fight') $('pad').hidden = !touchMode();
});

/* ---------- copy and portal ---------- */

function applyCopy() {
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  const k = (key, word) => `<kbd>${key}</kbd> ${t(word)}`;
  $('keys').innerHTML = [k('WASD', 'k_move'), k('J', 'k_punch'), k('K', 'k_kick'), k('L', 'k_special'), k('Space', 'k_block')].join(' · ');
  $('studio').innerHTML = t('studio', { studio: '<b>Rain on Roof</b>' });
  $('select-hint').innerHTML = t('selectHint', { enter: '<kbd>Enter</kbd>' });
  if (S.screen === 'select') updateSelectText();
}

// A portal page carries no way out: no studio link, no share button.
if (portal.isPortal()) {
  app.dataset.portal = '1';
  $('studio').removeAttribute('href');
  $('studio').removeAttribute('target');
}

setLanguage(navigator.language);
buildCards();
applyCopy();
setLevel(S.level, false);
resize();
new ResizeObserver(resize).observe(arena);
goTitle();
requestAnimationFrame(frame);

portal
  .init({
    onPause: (paused) => {
      S.hostPaused = paused;
      audio.setSuspended(paused);
    },
    onAudio: (enabled) => {
      S.hostAudioOff = !enabled;
      audio.setHostMuted(!enabled || S.adOpen);
    },
  })
  .then(async (lang) => {
    if (lang) {
      setLanguage(lang);
      applyCopy();
    }
    const level = await portal.load('level');
    if (level) setLevel(level, false);
    // The title and its demo fight are on screen and answer input.
    requestAnimationFrame(() => portal.ready());
  });

window.__rainFight = { S, startMatch, show, goSelect, pick, setLanguage: (l) => (setLanguage(l), applyCopy()) };
