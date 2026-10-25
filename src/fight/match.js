// A whole match: rounds, timer, hits, projectiles, KO, the END IT window and
// finishers. Deterministic: same seed and inputs give the same fight.
import { createFighter, resetFighter, stepFighter, setState, hurtbox, attackBox, overlap, blocks, isAirborne, FPS, BODY_W, WALL_L, WALL_R } from './fighter.js';
import { FINISHERS } from './moves.js';
import { mulberry32 } from '../rng.js';

export const ROUND_SECONDS = 60;
export const WINS_NEEDED = 2;
export const START_X = [600, 1000];
const INTRO = 130;
const KO_HOLD = 150;
const ROUND_END = 100;
const FINISH_WINDOW = 190;
const FINISH_RANGE = 280;
const CHIP = 0.15;

export function createMatch({ p1 = 'volt', p2 = 'brick', seed = 1 } = {}) {
  const m = {
    rand: mulberry32(seed),
    fighters: [createFighter(p1, 0), createFighter(p2, 1)],
    projectiles: [],
    round: 0,
    phase: 'intro',
    phaseTime: 0,
    timer: ROUND_SECONDS * FPS,
    hitstop: 0,
    frame: 0,
    winner: null,
    roundWinner: null,
    finisher: null,
    over: false,
  };
  nextRound(m, []);
  return m;
}

function nextRound(m, events) {
  m.round += 1;
  m.phase = 'intro';
  m.phaseTime = 0;
  m.timer = ROUND_SECONDS * FPS;
  m.projectiles = [];
  m.roundWinner = null;
  m.fighters.forEach((f, i) => resetFighter(f, START_X[i]));
  events.push({ type: 'round', n: m.round, final: m.fighters.some((f) => f.wins === WINS_NEEDED - 1) });
}

const EMPTY = {};

export function stepMatch(m, intents = [EMPTY, EMPTY]) {
  const events = [];
  m.frame += 1;
  if (m.over) return events;
  if (m.hitstop > 0) {
    m.hitstop -= 1;
    return events;
  }
  m.phaseTime += 1;
  const [a, b] = m.fighters;

  switch (m.phase) {
    case 'intro':
      stepFighter(a, EMPTY, b, events, { locked: true });
      stepFighter(b, EMPTY, a, events, { locked: true });
      if (m.phaseTime === 70) events.push({ type: 'fight' });
      if (m.phaseTime >= INTRO) setPhase(m, 'fight');
      break;

    case 'fight': {
      stepFighter(a, intents[0] || EMPTY, b, events);
      stepFighter(b, intents[1] || EMPTY, a, events);
      separate(a, b);
      spawnProjectiles(m, events);
      stepProjectiles(m, events);
      resolveHits(m, events);
      m.timer -= 1;
      const ko = m.fighters.find((f) => f.hp <= 0);
      if (ko) endRound(m, m.fighters[1 - ko.side], events, 'ko');
      else if (m.timer <= 0) {
        const [ha, hb] = [a.hp / a.maxHp, b.hp / b.maxHp];
        events.push({ type: 'timeUp' });
        if (ha === hb) {
          // A dead heat replays the round.
          setPhase(m, 'roundEnd');
          m.roundWinner = null;
        } else endRound(m, ha > hb ? a : b, events, 'time');
      }
      break;
    }

    case 'ko':
      stepFighter(a, EMPTY, b, events, { locked: true });
      stepFighter(b, EMPTY, a, events, { locked: true });
      stepProjectiles(m, events);
      if (m.phaseTime >= KO_HOLD) {
        const w = m.roundWinner;
        w.wins += 1;
        events.push({ type: 'roundWin', side: w.side, perfect: w.roundDamage === 0 });
        if (w.wins >= WINS_NEEDED) finishMatch(m, w, events);
        else setPhase(m, 'roundEnd');
      }
      break;

    case 'finish': {
      // The loser staggers; the winner walks in and presses SPECIAL.
      const w = m.roundWinner;
      const l = m.fighters[1 - w.side];
      const intent = intents[w.side] || EMPTY;
      const pressSpecial = intent.special && !w.prev.special;
      stepFighter(w, { ...intent, punch: false, kick: false, special: false, block: false }, l, events);
      w.prev.special = intent.special;
      l.stateTime += 1;
      separate(w, l);
      if (pressSpecial && Math.abs(w.x - l.x) <= FINISH_RANGE && !isAirborne(w)) {
        m.finisher = { id: w.def.finisher, by: w.side, time: 0 };
        setState(w, 'finisher');
        setState(l, 'finished');
        w.vx = 0;
        w.facing = l.x > w.x ? 1 : -1;
        setPhase(m, 'finisher');
        events.push({ type: 'finisher', side: w.side, id: w.def.finisher, name: FINISHERS[w.def.finisher].name });
      } else if (m.phaseTime >= FINISH_WINDOW) {
        l.vy = 500;
        l.vx = -l.facing * 200;
        setState(l, 'air-hit');
        events.push({ type: 'ko', side: l.side });
        setPhase(m, 'ending');
      }
      break;
    }

    case 'finisher':
      m.finisher.time += 1;
      m.fighters.forEach((f) => (f.stateTime += 1));
      if (m.finisher.time >= FINISHERS[m.finisher.id].length) {
        m.roundWinner.wins += 1;
        events.push({ type: 'roundWin', side: m.roundWinner.side, perfect: m.roundWinner.roundDamage === 0 });
        endMatch(m, events);
      }
      break;

    case 'ending':
      stepFighter(a, EMPTY, b, events, { locked: true });
      stepFighter(b, EMPTY, a, events, { locked: true });
      if (m.phaseTime >= 110) {
        m.roundWinner.wins += 1;
        events.push({ type: 'roundWin', side: m.roundWinner.side, perfect: m.roundWinner.roundDamage === 0 });
        endMatch(m, events);
      }
      break;

    case 'roundEnd':
      if (m.phaseTime >= ROUND_END) nextRound(m, events);
      break;

    default:
      break;
  }
  return events;
}

function setPhase(m, phase) {
  m.phase = phase;
  m.phaseTime = 0;
}

function endRound(m, winner, events, how) {
  const loser = m.fighters[1 - winner.side];
  m.roundWinner = winner;
  m.projectiles = [];
  const final = winner.wins + 1 >= WINS_NEEDED;
  if (winner.move && !winner.move.air) {
    winner.move = null;
    winner.hidden = false;
  }
  if (final) {
    loser.hp = Math.max(loser.hp, 0);
    loser.vx = 0;
    loser.vy = 0;
    loser.y = 0;
    loser.move = null;
    loser.hidden = false;
    setState(loser, 'dizzy');
    if (!isAirborne(winner)) setState(winner, 'idle');
    events.push({ type: 'endIt', side: winner.side, how });
    setPhase(m, 'finish');
  } else {
    if (loser.state !== 'air-hit') {
      loser.vy = 650;
      loser.vx = -loser.facing * 260;
      loser.move = null;
      loser.hidden = false;
      setState(loser, 'air-hit');
    }
    events.push({ type: 'ko', side: loser.side, how });
    setPhase(m, 'ko');
  }
}

function finishMatch(m, winner, events) {
  m.winner = winner;
  endMatch(m, events);
}

function endMatch(m, events) {
  m.winner = m.roundWinner;
  m.over = true;
  setState(m.winner, 'victory');
  events.push({ type: 'matchEnd', side: m.winner.side, finisher: m.finisher ? m.finisher.id : null });
}

// Bodies never overlap; at a wall the one pushing gives way.
function separate(a, b) {
  const dx = b.x - a.x;
  const gap = BODY_W - Math.abs(dx);
  if (gap <= 0 || Math.abs(a.y - b.y) > 150) return;
  const dir = dx === 0 ? (a.side === 0 ? 1 : -1) : Math.sign(dx);
  let ax = a.x - (dir * gap) / 2;
  let bx = b.x + (dir * gap) / 2;
  for (const [lo, hi] of [[WALL_L, WALL_R]]) {
    if (ax < lo) { bx += lo - ax; ax = lo; }
    if (ax > hi) { bx -= ax - hi; ax = hi; }
    if (bx > hi) { ax -= bx - hi; bx = hi; }
    if (bx < lo) { ax += lo - bx; bx = lo; }
  }
  a.x = ax;
  b.x = bx;
}

function spawnProjectiles(m, events) {
  for (const ev of events) {
    if (ev.type !== 'projectile') continue;
    const f = m.fighters[ev.side];
    const p = ev.move.projectile;
    m.projectiles.push({
      owner: ev.side,
      kind: p.kind,
      x: f.x + f.facing * 70,
      y: p.y,
      w: p.w,
      h: p.h,
      vx: f.facing * p.speed,
      life: p.life,
      move: ev.move,
      age: 0,
    });
  }
}

function stepProjectiles(m, events) {
  for (const p of m.projectiles) {
    p.x += p.vx / FPS;
    p.age += 1;
    if (p.age >= p.life || p.x < 0 || p.x > 1600) p.dead = true;
  }
  // Projectiles cancel each other.
  for (let i = 0; i < m.projectiles.length; i++) {
    for (let j = i + 1; j < m.projectiles.length; j++) {
      const p = m.projectiles[i];
      const q = m.projectiles[j];
      if (p.owner !== q.owner && !p.dead && !q.dead && overlap(projBox(p), projBox(q))) {
        p.dead = q.dead = true;
        events.push({ type: 'clash', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + p.h / 2 });
      }
    }
  }
  m.projectiles = m.projectiles.filter((p) => !p.dead);
}

const projBox = (p) => [p.x - p.w / 2, p.y, p.x + p.w / 2, p.y + p.h];

function resolveHits(m, events) {
  const [a, b] = m.fighters;
  const pending = [];
  for (const [att, def] of [[a, b], [b, a]]) {
    const box = attackBox(att);
    if (box && overlap(box, hurtbox(def))) {
      att.hasHit = true;
      pending.push({ att, def, move: att.move, x: (Math.max(box[0], hurtbox(def)[0]) + Math.min(box[2], hurtbox(def)[2])) / 2, y: (box[1] + box[3]) / 2 });
    }
  }
  for (const p of m.projectiles) {
    const def = m.fighters[1 - p.owner];
    if (overlap(projBox(p), hurtbox(def))) {
      p.dead = true;
      pending.push({ att: m.fighters[p.owner], def, move: p.move, x: p.x, y: p.y + p.h / 2, projectile: true, dir: Math.sign(p.vx) });
    }
  }
  m.projectiles = m.projectiles.filter((p) => !p.dead);
  for (const hit of pending) applyHit(m, hit, events);
}

function applyHit(m, { att, def, move, x, y, projectile, dir }, events) {
  const push = dir || att.facing;
  const blocked = blocks(def, move.level);
  if (blocked) {
    const chip = Math.max(1, Math.round(move.damage * CHIP));
    damage(def, chip);
    def.stun = move.blockstun;
    def.vx = push * move.push * 2.2;
    const crouching = def.state === 'crouchBlock' || (def.state === 'blockstun' && def.blockCrouch);
    setState(def, 'blockstun');
    def.stateTime = 0;
    def.blockCrouch = crouching;
    m.hitstop = 3;
    events.push({ type: 'block', side: def.side, by: att.side, x, y, damage: chip, move: move.id });
  } else {
    const scale = Math.max(0.4, 0.86 ** def.combo);
    const dmg = Math.max(1, Math.round(move.damage * scale));
    damage(def, dmg);
    def.combo += 1;
    def.move = null;
    def.hidden = false;
    const airborne = isAirborne(def) || def.state === 'air-hit';
    if (move.launch || move.knockdown || airborne) {
      def.vy = move.launch || (airborne ? 620 : 520);
      def.vx = push * (move.launch ? 70 : 260);
      def.juggles += 1;
      if (def.y <= 0) def.y = 1;
      setState(def, 'air-hit');
    } else {
      def.stun = move.hitstun;
      def.vx = push * move.push * 2.6;
      setState(def, 'hit');
      def.stateTime = 0;
    }
    // A defender at the wall pushes the attacker back instead.
    if (!projectile && (def.x <= WALL_L + 1 || def.x >= WALL_R - 1)) att.vx = -push * move.push * 2;
    m.hitstop = move.heavy ? 7 : 4;
    events.push({ type: 'hit', side: def.side, by: att.side, x, y, damage: dmg, combo: def.combo, heavy: !!move.heavy, move: move.id, launch: !!move.launch });
  }
}

function damage(f, n) {
  f.hp = Math.max(0, f.hp - n);
  f.roundDamage += n;
}
